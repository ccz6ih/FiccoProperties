"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";
import {
  sendResidentWelcome,
  emailLoginCredentials,
  sendOnboardingInvite,
} from "@/lib/portal-invite";
import { notifyOwnersOfNewTenant } from "@/lib/new-tenant-email";
import { sendMoveInStatement } from "@/lib/portal-invite";
import { prorateFirstMonth, moveInTotal } from "@/lib/prorate";
import { sendNotification, notificationHtml } from "@/lib/email";

/**
 * Link an existing resident account to a unit as a co-tenant (a second login for
 * the same home). The account must already exist — invite them first if needed.
 */
export async function linkResidentAccount(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  const email = (form.get("email") as string)?.trim().toLowerCase();
  const name = (form.get("full_name") as string)?.trim() || null;
  if (!unitId || !email) return;

  const admin = createAdminClient();
  const db = admin as unknown as SupabaseClient;
  let { data: account } = await db
    .from("profiles")
    .select("id, full_name, email")
    .ilike("email", email)
    .maybeSingle<{ id: string; full_name: string | null; email: string | null }>();

  // No account yet (e.g. a spouse who never signed up): create one, then email
  // them their login. Previously this silently did nothing.
  let createdNow = false;
  if (!account) {
    const tempPassword = `38thAve-${crypto.randomUUID().slice(0, 8)}`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: name ?? email },
    });
    if (createErr || !created?.user) return;
    if (name) await db.from("profiles").update({ full_name: name }).eq("id", created.user.id);
    await emailLoginCredentials(email, name, tempPassword);
    account = { id: created.user.id, full_name: name, email };
    createdNow = true;
  }

  // Was this account already a co-tenant here? If so, don't re-welcome them.
  const { data: prevLink } = await db
    .from("unit_occupants")
    .select("id")
    .eq("unit_id", unitId)
    .eq("profile_id", account.id)
    .maybeSingle<{ id: string }>();

  await db
    .from("unit_occupants")
    .upsert({ unit_id: unitId, profile_id: account.id, is_primary: false }, { onConflict: "unit_id,profile_id" });

  if (!prevLink && !createdNow && account.email) {
    const { data: unit } = await db
      .from("units")
      .select("label, properties(name)")
      .eq("id", unitId)
      .maybeSingle<{ label: string; properties: { name: string | null } | null }>();
    const homeLabel = unit
      ? `${unit.properties?.name ? `${unit.properties.name} · ` : ""}${unit.label}`
      : null;
    await sendResidentWelcome({
      email: account.email,
      fullName: account.full_name,
      homeLabel,
    });
  }

  revalidatePath(`/admin/units/${unitId}`);
}

/**
 * Send a new resident the welcome-and-onboarding invite: the email that walks
 * them through how they'll pay, when they're moving in, and the lease.
 *
 * Also reopens the welcome steps, but only where the lease isn't signed yet —
 * clicking this on an established tenancy shouldn't put a "Welcome" step back
 * in someone's portal a year into living here.
 */
export async function sendWelcomeOnboarding(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  if (!unitId) return;

  const db = createAdminClient() as unknown as SupabaseClient;

  const { data: occ } = await db
    .from("unit_occupancy")
    .select("occupant_profile_id, rent_cents")
    .eq("unit_id", unitId)
    .maybeSingle<{ occupant_profile_id: string | null; rent_cents: number | null }>();

  // Prefer the primary portal account; fall back to whoever's on the tenancy.
  const { data: primary } = await db
    .from("unit_occupants")
    .select("profile_id")
    .eq("unit_id", unitId)
    .eq("is_primary", true)
    .maybeSingle<{ profile_id: string }>();

  const residentId = primary?.profile_id ?? occ?.occupant_profile_id;
  if (!residentId) return;

  const { data: person } = await db
    .from("profiles")
    .select("email, full_name")
    .eq("id", residentId)
    .maybeSingle<{ email: string | null; full_name: string | null }>();
  if (!person?.email) return;

  const { data: unit } = await db
    .from("units")
    .select("label, properties(name)")
    .eq("id", unitId)
    .maybeSingle<{ label: string; properties: { name: string | null } | null }>();

  const { data: signed } = await db
    .from("leases")
    .select("id")
    .eq("unit_id", unitId)
    .not("signed_at", "is", null)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (!signed) {
    await db
      .from("unit_occupancy")
      .update({ onboarding_completed_at: null })
      .eq("unit_id", unitId);
  }

  // Mint a fresh temporary password and carry it in the same email as the
  // one-click button. A new resident who loses the magic link shouldn't have to
  // ring the office to get in — and two separate emails is not a warm welcome.
  const admin = createAdminClient();
  const tempPassword = `38thAve-${crypto.randomUUID().slice(0, 8)}`;
  const { error: pwErr } = await admin.auth.admin.updateUserById(residentId, {
    password: tempPassword,
    email_confirm: true,
  });

  await sendOnboardingInvite({
    email: person.email,
    fullName: person.full_name,
    homeLabel: unit
      ? `${unit.properties?.name ? `${unit.properties.name} · ` : ""}${unit.label}`
      : null,
    rentCents: occ?.rent_cents ?? null,
    tempPassword: pwErr ? null : tempPassword,
  });

  revalidatePath(`/admin/units/${unitId}`);
}

/**
 * Tell the owners a home is rented.
 *
 * Everything in the email is read live off the home, including what the last
 * resident paid — which comes from the tenancy history, so the rent comparison
 * is the real one rather than something typed in by hand.
 */
export async function announceNewTenant(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  if (!unitId) return;

  const db = createAdminClient() as unknown as SupabaseClient;

  const { data: occ } = await db
    .from("unit_occupancy")
    .select(
      "tenant_name, tenant_email, tenant_phone, rent_cents, deposit_cents, move_in_date, move_in_confirmed_at, payment_preference, occupant_profile_id"
    )
    .eq("unit_id", unitId)
    .maybeSingle<{
      tenant_name: string | null;
      tenant_email: string | null;
      tenant_phone: string | null;
      rent_cents: number | null;
      deposit_cents: number | null;
      move_in_date: string | null;
      move_in_confirmed_at: string | null;
      payment_preference: string | null;
      occupant_profile_id: string | null;
    }>();
  if (!occ?.tenant_name) return;

  const { data: unit } = await db
    .from("units")
    .select("label, properties(name)")
    .eq("id", unitId)
    .maybeSingle<{ label: string; properties: { name: string | null } | null }>();

  // The previous tenancy, for the rent comparison and the empty-days count.
  const { data: last } = await db
    .from("tenancy_history")
    .select("tenant_name, rent_cents, move_out_date")
    .eq("unit_id", unitId)
    .order("move_out_date", { ascending: false })
    .limit(1)
    .maybeSingle<{
      tenant_name: string | null;
      rent_cents: number | null;
      move_out_date: string | null;
    }>();

  // When the make-ready finished. Most of a home's empty time is the turn, not
  // time on the market, and reporting one number for both reads as if it took
  // three months to find a tenant.
  const { data: turn } = await db
    .from("makeready_turns")
    .select("completed_at")
    .eq("unit_id", unitId)
    .eq("status", "complete")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ completed_at: string | null }>();

  // What the empty months actually cost: rent that was voided or never raised
  // between the move-out and now, priced at what the last resident paid.
  let monthsVacant: number | null = null;
  let lostRentCents: number | null = null;
  if (last?.move_out_date && last.rent_cents) {
    const { count } = await db
      .from("charges")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", unitId)
      .eq("status", "void")
      .gte("due_date", last.move_out_date);

    // A voided charge is a month we chose not to bill; months with no charge at
    // all are months the turn ran through. Count both.
    const from = new Date(`${last.move_out_date}T00:00:00`);
    const to = new Date(`${(occ.move_in_date ?? new Date().toISOString().slice(0, 10))}T00:00:00`);
    const wholeMonths = Math.max(
      0,
      (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
    );
    monthsVacant = Math.max(count ?? 0, wholeMonths);
    if (monthsVacant > 0) lostRentCents = monthsVacant * last.rent_cents;
  }

  // Screening points come off the approved application, which is where the
  // report summary was written when it was imported.
  const { data: app } = await db
    .from("applications")
    .select("screening_notes, screening_status, created_at")
    .eq("unit_id", unitId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      screening_notes: string | null;
      screening_status: string | null;
      created_at: string;
    }>();

  const screening = (app?.screening_notes ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.toLowerCase().startsWith("source:"))
    .slice(0, 6);

  const { data: lease } = await db
    .from("leases")
    .select("signed_at")
    .eq("unit_id", unitId)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ signed_at: string | null }>();

  const PREF: Record<string, string> = {
    money_order: "Money order, payable to Ficco Brothers",
    check: "Check, payable to Ficco Brothers",
    online: "Online from the portal",
  };

  await notifyOwnersOfNewTenant({
    unitId,
    home: unit
      ? `${unit.properties?.name ? `${unit.properties.name} · ` : ""}${unit.label}`
      : "—",
    tenantName: occ.tenant_name,
    email: occ.tenant_email,
    phone: occ.tenant_phone,
    rentCents: occ.rent_cents,
    priorRentCents: last?.rent_cents ?? null,
    priorTenantName: last?.tenant_name ?? null,
    depositCents: occ.deposit_cents,
    moveInDate: occ.move_in_date,
    moveInConfirmed: Boolean(occ.move_in_confirmed_at),
    paymentPreferenceLabel: occ.payment_preference ? PREF[occ.payment_preference] : null,
    screening,
    vacantSince: last?.move_out_date ?? null,
    turnCompletedOn: turn?.completed_at ? turn.completed_at.slice(0, 10) : null,
    monthsVacant,
    lostRentCents,
    rentedOn: app?.created_at ? app.created_at.slice(0, 10) : null,
    paperwork: [
      {
        label: "Application and screening on file",
        ok: app?.screening_status === "passed",
        note: app?.screening_status === "passed" ? "background check clear" : undefined,
      },
      { label: "Rent set", ok: occ.rent_cents != null },
      { label: "Deposit set", ok: occ.deposit_cents != null },
      { label: "Resident portal account made", ok: Boolean(occ.occupant_profile_id) },
      {
        label: "Move-in day confirmed by them",
        ok: Boolean(occ.move_in_confirmed_at),
        note: occ.move_in_confirmed_at ? undefined : "they confirm it in the portal",
      },
      {
        label: "Told us how they'll pay",
        ok: Boolean(occ.payment_preference),
      },
      {
        label: "Lease signed",
        ok: Boolean(lease?.signed_at),
        note: lease?.signed_at ? undefined : "signs it in the portal",
      },
    ],
  });

  revalidatePath(`/admin/units/${unitId}`);
}

export type MoveInDateState = { ok: boolean; error?: string; notice?: string };

/**
 * Record a move-in date that was given over the phone.
 *
 * The welcome flow asks the resident, which is the right default — but plenty
 * of them will ring instead, and until now taking it by phone meant typing the
 * date into the tenancy, where nothing else happens: no prorated charge, no
 * statement, and a resident who still doesn't know what to bring.
 *
 * Does exactly what the resident confirming it does, so both routes end in the
 * same place.
 */
export async function recordMoveInByPhone(
  _prev: MoveInDateState,
  form: FormData
): Promise<MoveInDateState> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = (form.get("unit_id") as string)?.trim();
  const moveIn = (form.get("move_in_date") as string)?.trim();
  const tellThem = form.get("tell_them") === "on";
  if (!unitId) return { ok: false, error: "Which home?" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(moveIn)) {
    return { ok: false, error: "Pick the day they're moving in." };
  }

  const db = createAdminClient() as unknown as SupabaseClient;

  const { data: occ } = await db
    .from("unit_occupancy")
    .select("rent_cents, deposit_cents, occupant_profile_id, tenant_name")
    .eq("unit_id", unitId)
    .maybeSingle<{
      rent_cents: number | null;
      deposit_cents: number | null;
      occupant_profile_id: string | null;
      tenant_name: string | null;
    }>();

  // The home knows the price even when the tenancy doesn't.
  let rentCents = occ?.rent_cents ?? null;
  if (!rentCents) {
    const { data: unit } = await db
      .from("units")
      .select("rent_cents")
      .eq("id", unitId)
      .maybeSingle<{ rent_cents: number | null }>();
    rentCents = unit?.rent_cents ?? null;
    if (rentCents) {
      await db.from("unit_occupancy").update({ rent_cents: rentCents }).eq("unit_id", unitId);
    }
  }

  await db
    .from("unit_occupancy")
    .update({ move_in_date: moveIn, move_in_confirmed_at: new Date().toISOString() })
    .eq("unit_id", unitId);

  const p = rentCents ? prorateFirstMonth(moveIn, rentCents) : null;
  const due = moveInTotal(p, rentCents, occ?.deposit_cents ?? null);

  if (p) {
    // Replace anything raised against an earlier date, unless money has
    // already landed on it — then it's for a person to untangle, not a button.
    const { data: existing } = await db
      .from("charges")
      .select("id, amount_cents, description")
      .eq("unit_id", unitId)
      .eq("period", p.period)
      .neq("status", "void")
      .returns<{ id: string; amount_cents: number; description: string | null }[]>();

    let blocked = false;
    let alreadyRight = false;
    for (const c of existing ?? []) {
      if (c.amount_cents === p.amountCents && c.description === p.description) {
        alreadyRight = true;
        continue;
      }
      const { count } = await db
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("charge_id", c.id)
        .eq("status", "succeeded");
      if ((count ?? 0) > 0) {
        blocked = true;
        continue;
      }
      await db.from("charges").update({ status: "void" }).eq("id", c.id);
    }

    if (blocked) {
      return {
        ok: true,
        notice: `Date saved. There's already a payment against this month's rent, so the old charge was left as it is — check it on the Payments screen.`,
      };
    }
    if (!alreadyRight) {
      await db.from("charges").insert({
        unit_id: unitId,
        resident_id: occ?.occupant_profile_id ?? null,
        amount_cents: p.amountCents,
        description: p.isWholeMonth ? "Monthly rent" : p.description,
        due_date: moveIn,
        status: "open",
        period: p.period,
      });
    }
  }

  const { data: unit } = await db
    .from("units")
    .select("label, properties(name)")
    .eq("id", unitId)
    .maybeSingle<{ label: string; properties: { name: string | null } | null }>();
  const home = unit
    ? `${unit.properties?.name ? `${unit.properties.name} · ` : ""}${unit.label}`
    : null;

  await db.from("unit_log_entries").insert({
    unit_id: unitId,
    kind: "tenancy",
    body: `Move-in confirmed for ${moveIn}, taken by phone. First month ${
      p ? `${p.description} = ${(p.amountCents / 100).toFixed(2)}` : "not prorated"
    }; ${(due.totalCents / 100).toFixed(2)} due before the keys.`,
  });

  let told = "";
  if (tellThem && occ?.occupant_profile_id && due.totalCents > 0) {
    const { data: who } = await db
      .from("profiles")
      .select("email, full_name")
      .eq("id", occ.occupant_profile_id)
      .maybeSingle<{ email: string | null; full_name: string | null }>();
    if (who?.email) {
      await sendMoveInStatement({
        email: who.email,
        fullName: who.full_name,
        homeLabel: home,
        moveInDate: moveIn,
        prorationLabel: p && !p.isWholeMonth ? p.description : null,
        rentCents: due.rentCents,
        depositCents: due.depositCents,
        totalCents: due.totalCents,
        firstFullMonthOn: p?.firstFullMonthOn ?? null,
        monthlyRentCents: rentCents,
      });
      told = ` ${who.email} has been emailed what to bring.`;
    } else {
      told = " No email on file for them, so nothing was sent.";
    }
  }

  revalidatePath(`/admin/units/${unitId}`);
  revalidatePath("/portal/welcome");
  revalidatePath("/admin");

  return {
    ok: true,
    notice: `Moving in ${moveIn}. ${(due.totalCents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    })} due before the keys.${told}`,
  };
}

export type MoveInMoneyState = { ok: boolean; error?: string; notice?: string };

/**
 * Check in the money a new resident hands over at the signing.
 *
 * Two different things arrive in the same envelope and have to go to different
 * places: the first month's rent settles an open charge in the ledger, and the
 * deposit is money we hold, which belongs on the tenancy and must stay OUT of
 * the rent ledger — an open charge is what the delinquency report is built
 * from.
 *
 * Both halves are optional, because they often arrive on separate money orders
 * and sometimes a week apart.
 */
export async function recordMoveInMoney(
  _prev: MoveInMoneyState,
  form: FormData
): Promise<MoveInMoneyState> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = (form.get("unit_id") as string)?.trim();
  if (!unitId) return { ok: false, error: "Which home?" };

  const money = (k: string) => {
    const raw = ((form.get(k) as string) ?? "").replace(/[$,\s]/g, "");
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  };

  const rentCents = money("rent_amount");
  const depositCents = money("deposit_amount");
  const rentRef = ((form.get("rent_reference") as string) ?? "").trim() || null;
  const depositRef = ((form.get("deposit_reference") as string) ?? "").trim() || null;
  const receivedOn = ((form.get("received_on") as string) ?? "").trim();

  if (rentCents === 0 && depositCents === 0) {
    return { ok: false, error: "Enter the rent, the deposit, or both." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedOn)) {
    return { ok: false, error: "When did it come in?" };
  }
  if (receivedOn > new Date().toISOString().slice(0, 10)) {
    return { ok: false, error: "That date is in the future." };
  }

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: occ } = await db
    .from("unit_occupancy")
    .select("occupant_profile_id, move_in_date, deposit_received_cents")
    .eq("unit_id", unitId)
    .maybeSingle<{
      occupant_profile_id: string | null;
      move_in_date: string | null;
      deposit_received_cents: number | null;
    }>();

  const done: string[] = [];

  if (rentCents > 0) {
    // Find the charge this is settling: the move-in month's, or the oldest
    // thing still open on the home.
    const period = occ?.move_in_date ? occ.move_in_date.slice(0, 7) : null;
    let chargeId: string | null = null;

    if (period) {
      const { data: c } = await db
        .from("charges")
        .select("id")
        .eq("unit_id", unitId)
        .eq("period", period)
        .neq("status", "void")
        .limit(1)
        .maybeSingle<{ id: string }>();
      chargeId = c?.id ?? null;
    }
    if (!chargeId) {
      const { data: c } = await db
        .from("charges")
        .select("id")
        .eq("unit_id", unitId)
        .in("status", ["open", "past_due"])
        .order("due_date", { ascending: true })
        .limit(1)
        .maybeSingle<{ id: string }>();
      chargeId = c?.id ?? null;
    }
    if (!chargeId) {
      return {
        ok: false,
        error:
          "There's no open rent charge on this home to put it against. Confirm their move-in day first, or record it from the Payments screen.",
      };
    }

    const { error: payErr } = await db.from("payments").insert({
      unit_id: unitId,
      charge_id: chargeId,
      resident_id: occ?.occupant_profile_id ?? null,
      amount_cents: rentCents,
      status: "succeeded",
      provider_ref: rentRef ?? "Move-in payment",
      created_at: `${receivedOn}T12:00:00Z`,
    });
    if (payErr) return { ok: false, error: `Could not record the rent: ${payErr.message}` };

    // Close the charge if it's now fully covered.
    const { data: paidRows } = await db
      .from("payments")
      .select("amount_cents")
      .eq("charge_id", chargeId)
      .eq("status", "succeeded")
      .returns<{ amount_cents: number }[]>();
    const { data: charge } = await db
      .from("charges")
      .select("amount_cents")
      .eq("id", chargeId)
      .maybeSingle<{ amount_cents: number }>();
    const paid = (paidRows ?? []).reduce((s, p) => s + p.amount_cents, 0);
    if (charge && paid >= charge.amount_cents) {
      await db.from("charges").update({ status: "paid" }).eq("id", chargeId);
    }

    done.push(`${(rentCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} rent`);
  }

  if (depositCents > 0) {
    // Added to, not replaced — a deposit often arrives in two money orders.
    const already = occ?.deposit_received_cents ?? 0;
    const { error: depErr } = await db
      .from("unit_occupancy")
      .update({
        deposit_received_cents: already + depositCents,
        deposit_received_on: receivedOn,
        deposit_reference: depositRef,
      })
      .eq("unit_id", unitId);
    if (depErr) return { ok: false, error: `Could not record the deposit: ${depErr.message}` };

    done.push(
      `${(depositCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} deposit`
    );
  }

  await db.from("unit_log_entries").insert({
    unit_id: unitId,
    kind: "tenancy",
    body: `Move-in money received ${receivedOn}: ${done.join(" and ")}${
      [rentRef, depositRef].filter(Boolean).length > 0
        ? ` (${[rentRef, depositRef].filter(Boolean).join(", ")})`
        : ""
    }.`,
  });

  revalidatePath(`/admin/units/${unitId}`);
  revalidatePath("/portal/welcome");
  revalidatePath("/admin/payments");
  revalidatePath("/admin");

  return { ok: true, notice: `Recorded ${done.join(" and ")}. Their portal is updated.` };
}

export type NoticeState = { ok: boolean; error?: string; notice?: string };

/**
 * Record that a resident has given notice to leave.
 *
 * Deliberately separate from the move-out itself, which happens weeks later.
 * This is the moment the turn becomes plannable, so it's worth capturing on
 * the day it's said rather than reconstructing it from the walk-through notes.
 */
export async function recordNoticeToVacate(
  _prev: NoticeState,
  form: FormData
): Promise<NoticeState> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = (form.get("unit_id") as string)?.trim();
  const givenOn = (form.get("notice_given_on") as string)?.trim();
  const leavingOn = (form.get("notice_move_out_on") as string)?.trim();
  const reason = ((form.get("notice_reason") as string) ?? "").trim();
  if (!unitId) return { ok: false, error: "Which home?" };

  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(givenOn)) return { ok: false, error: "When did they give notice?" };
  if (!iso.test(leavingOn)) return { ok: false, error: "When are they leaving?" };
  if (leavingOn < givenOn) {
    return { ok: false, error: "They can't be leaving before they gave notice." };
  }

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: occ } = await db
    .from("unit_occupancy")
    .select("tenant_name, rent_cents")
    .eq("unit_id", unitId)
    .maybeSingle<{ tenant_name: string | null; rent_cents: number | null }>();

  const { error } = await db
    .from("unit_occupancy")
    .update({
      notice_given_on: givenOn,
      notice_move_out_on: leavingOn,
      notice_reason: reason || null,
    })
    .eq("unit_id", unitId);
  if (error) return { ok: false, error: "Could not save that. Please try again." };

  const { data: unit } = await db
    .from("units")
    .select("label, properties(name)")
    .eq("id", unitId)
    .maybeSingle<{ label: string; properties: { name: string | null } | null }>();
  const home = unit
    ? `${unit.properties?.name ? `${unit.properties.name} · ` : ""}${unit.label}`
    : "a home";

  // Colorado requires a full rental period's notice for a month-to-month
  // tenancy; short notice is worth flagging while there's still time to talk.
  const days = Math.round(
    (new Date(`${leavingOn}T00:00:00`).getTime() -
      new Date(`${givenOn}T00:00:00`).getTime()) /
      86_400_000
  );

  await sendNotification({
    subject: `Notice to vacate — ${home} · leaving ${leavingOn}`,
    html: notificationHtml("A resident has given notice", [
      ["Home", home],
      ["Resident", occ?.tenant_name ?? "—"],
      ["Notice given", givenOn],
      ["Leaving", `${leavingOn} (${days} days' notice)`],
      ...(reason ? ([["Reason given", reason]] as [string, string][]) : []),
      ...(days < 28
        ? ([
            [
              "Worth checking",
              "That's less than a full rental period. Colorado normally requires 28 days' notice on a month-to-month tenancy — check the lease before accepting the date.",
            ],
          ] as [string, string][])
        : []),
      ["Next", `Plan the make-ready and get the listing up: https://38thaveproperties.com/admin/units/${unitId}`],
    ]),
  });

  revalidatePath(`/admin/units/${unitId}`);
  revalidatePath("/admin");
  return {
    ok: true,
    notice: `Recorded — ${home} is leaving ${leavingOn}.`,
  };
}

/** Clear a notice to vacate — they changed their mind and are staying. */
export async function clearNoticeToVacate(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  if (!unitId) return;

  const db = createAdminClient() as unknown as SupabaseClient;
  await db
    .from("unit_occupancy")
    .update({ notice_given_on: null, notice_move_out_on: null, notice_reason: null })
    .eq("unit_id", unitId);

  revalidatePath(`/admin/units/${unitId}`);
  revalidatePath("/admin");
}

/** Remove a co-tenant account link from a unit. */
export async function unlinkResidentAccount(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  const linkId = (form.get("link_id") as string)?.trim();
  if (!unitId || !linkId) return;

  const db = createAdminClient() as unknown as SupabaseClient;
  await db.from("unit_occupants").delete().eq("id", linkId);
  revalidatePath(`/admin/units/${unitId}`);
}

const LEASE_BUCKET = "lease-docs";
const COST_BUCKET = "unit-cost-docs";
const COST_DOC_TYPES = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
]);

export type LogState = { ok: boolean; error?: string };
export type CostState = { ok: boolean; error?: string };

function costCents(v: FormDataEntryValue | null): number | null {
  const s = ((v as string) ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Book an outside contractor bill / cost against a unit (optional invoice). */
export async function addUnitCost(
  _prev: CostState,
  form: FormData
): Promise<CostState> {
  const { user, profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = str(form.get("unit_id"));
  const amount = costCents(form.get("amount"));
  if (!unitId) return { ok: false, error: "Missing unit." };
  if (amount == null || amount <= 0) return { ok: false, error: "Enter an amount." };

  const hoursRaw = str(form.get("hours"));
  const hours = hoursRaw != null && Number.isFinite(Number(hoursRaw)) ? Number(hoursRaw) : null;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  let docPath: string | null = null;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (!COST_DOC_TYPES.has(file.type)) {
      return { ok: false, error: "Invoice must be a PDF or image." };
    }
    const admin = createAdminClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    docPath = `${unitId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(COST_BUCKET)
      .upload(docPath, file, { contentType: file.type, upsert: false });
    if (upErr) return { ok: false, error: "Invoice upload failed." };
  }

  const { error } = await db.from("unit_costs").insert({
    unit_id: unitId,
    vendor: str(form.get("vendor")),
    trade: str(form.get("trade")),
    description: str(form.get("description")),
    amount_cents: amount,
    hours,
    rate_cents: costCents(form.get("rate")),
    incurred_on: str(form.get("incurred_on")) ?? undefined,
    doc_path: docPath,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Could not save the cost." };

  revalidatePath(`/admin/units/${unitId}`);
  return { ok: true };
}

/** Edit a unit cost's details (not its invoice file). Staff-only. */
export async function editUnitCost(
  _prev: CostState,
  form: FormData
): Promise<CostState> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const id = str(form.get("id"));
  const unitId = str(form.get("unit_id"));
  if (!id) return { ok: false, error: "Missing cost." };
  const amount = costCents(form.get("amount"));
  if (amount == null || amount <= 0) return { ok: false, error: "Enter an amount." };

  const hoursRaw = str(form.get("hours"));
  const hours = hoursRaw != null && Number.isFinite(Number(hoursRaw)) ? Number(hoursRaw) : null;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const updates: Record<string, unknown> = {
    vendor: str(form.get("vendor")),
    trade: str(form.get("trade")),
    description: str(form.get("description")),
    amount_cents: amount,
    hours,
    rate_cents: costCents(form.get("rate")),
  };
  const d = str(form.get("incurred_on"));
  if (d) updates.incurred_on = d;

  const { error } = await db.from("unit_costs").update(updates).eq("id", id);
  if (error) return { ok: false, error: "Could not save changes." };

  if (unitId) revalidatePath(`/admin/units/${unitId}`);
  return { ok: true };
}

/** Delete a unit cost (and its invoice file). Staff-only. */
export async function deleteUnitCost(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  const unitId = str(form.get("unit_id"));
  if (!id) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: row } = await db
    .from("unit_costs")
    .select("doc_path")
    .eq("id", id)
    .maybeSingle<{ doc_path: string | null }>();

  if (row?.doc_path) {
    const admin = createAdminClient();
    await admin.storage.from(COST_BUCKET).remove([row.doc_path]);
  }
  await db.from("unit_costs").delete().eq("id", id);

  if (unitId) revalidatePath(`/admin/units/${unitId}`);
}

function str(v: FormDataEntryValue | null): string | null {
  const s = ((v as string) ?? "").trim();
  return s || null;
}

/**
 * Add a note or a record of maintenance performed to a unit's running history.
 * Staff-only (admins + maintenance manager). Auto-stamps the author and links
 * the unit's current resident when one is on file.
 */
export async function addLogEntry(
  _prev: LogState,
  form: FormData
): Promise<LogState> {
  const { user, profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = str(form.get("unit_id"));
  const body = str(form.get("body"));
  const kind = str(form.get("kind")) === "maintenance" ? "maintenance" : "note";
  const performedOn = str(form.get("performed_on"));
  const costDollars = str(form.get("cost"));
  if (!unitId) return { ok: false, error: "Missing unit." };
  if (!body) return { ok: false, error: "Write something first." };

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  // Link the current occupant, if any.
  const { data: occ } = await supabase
    .from("unit_occupancy")
    .select("occupant_profile_id")
    .eq("unit_id", unitId)
    .maybeSingle<{ occupant_profile_id: string | null }>();

  let costCents: number | null = null;
  if (costDollars) {
    const n = Number(costDollars.replace(/[$,\s]/g, ""));
    if (Number.isFinite(n) && n >= 0) costCents = Math.round(n * 100);
  }

  const { error } = await db.from("unit_log_entries").insert({
    unit_id: unitId,
    resident_id: occ?.occupant_profile_id ?? null,
    kind,
    body,
    performed_on: performedOn,
    cost_cents: costCents,
    author_id: user.id,
  });
  if (error) return { ok: false, error: "Could not save the entry." };

  revalidatePath(`/admin/units/${unitId}`);
  return { ok: true };
}

export type DocState = { ok: boolean; error?: string };

const DOC_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** Upload an existing signed lease (PDF/scan) for a unit. Staff-only. */
export async function uploadLeaseDocument(
  _prev: DocState,
  form: FormData
): Promise<DocState> {
  const { user, profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = str(form.get("unit_id"));
  const label = str(form.get("label"));
  const file = form.get("file");
  if (!unitId) return { ok: false, error: "Missing unit." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (!DOC_TYPES.has(file.type)) {
    return { ok: false, error: "Upload a PDF or image." };
  }

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const admin = createAdminClient();

  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `${unitId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from(LEASE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: "Upload failed. Please try again." };

  const { data: occ } = await supabase
    .from("unit_occupancy")
    .select("occupant_profile_id")
    .eq("unit_id", unitId)
    .maybeSingle<{ occupant_profile_id: string | null }>();

  const residentId = occ?.occupant_profile_id ?? null;
  // Only share on upload if asked AND there's a portal resident to share with.
  const share = str(form.get("share")) === "on" && !!residentId;
  const DOC_CATEGORIES = ["lease", "esa", "insurance", "notice", "other"];
  const categoryRaw = str(form.get("category")) || "";
  const category = DOC_CATEGORIES.includes(categoryRaw) ? categoryRaw : "lease";

  await db.from("lease_documents").insert({
    unit_id: unitId,
    resident_id: residentId,
    label,
    path,
    uploaded_by: user.id,
    shared_with_resident: share,
    category,
  });

  revalidatePath(`/admin/units/${unitId}`);
  revalidatePath("/admin/residents/[id]", "page");
  return { ok: true };
}

/** Show/hide a scanned lease in the resident's portal. Staff-only. */
export async function setLeaseDocumentShared(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  const unitId = str(form.get("unit_id"));
  const share = str(form.get("share")) === "1";
  if (!id) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db
    .from("lease_documents")
    .update({ shared_with_resident: share })
    .eq("id", id);

  if (unitId) revalidatePath(`/admin/units/${unitId}`);
  revalidatePath("/admin/residents/[id]", "page");
}

/** Delete a lease document (removes the file + row). Staff-only. */
export async function deleteLeaseDocument(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  const unitId = str(form.get("unit_id"));
  if (!id) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: doc } = await db
    .from("lease_documents")
    .select("path")
    .eq("id", id)
    .maybeSingle<{ path: string }>();

  if (doc?.path) {
    const admin = createAdminClient();
    await admin.storage.from(LEASE_BUCKET).remove([doc.path]);
  }
  await db.from("lease_documents").delete().eq("id", id);

  if (unitId) revalidatePath(`/admin/units/${unitId}`);
}

/** Remove a log entry (staff-only). */
export async function deleteLogEntry(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  const unitId = str(form.get("unit_id"));
  if (!id) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("unit_log_entries").delete().eq("id", id);

  if (unitId) revalidatePath(`/admin/units/${unitId}`);
}

/**
 * Set the tenancy's display name from the linked resident accounts — so boards,
 * reports, and notices read "Dan Barone / Geimy Sundheim" instead of a bare
 * surname. Only touches the label; nobody's account is changed.
 */
export async function useResidentNames(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  if (!unitId) return;

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: links } = await db
    .from("unit_occupants")
    .select("profile_id, is_primary")
    .eq("unit_id", unitId)
    .order("is_primary", { ascending: false })
    .returns<{ profile_id: string; is_primary: boolean }[]>();

  const ids = (links ?? []).map((l) => l.profile_id);
  if (ids.length === 0) return;

  const { data: profs } = await db
    .from("profiles")
    .select("id, full_name")
    .in("id", ids)
    .returns<{ id: string; full_name: string | null }[]>();

  // Keep the primary-first order from the links.
  const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name?.trim() || null]));
  const names = ids.map((id) => nameById.get(id)).filter((n): n is string => !!n);
  if (names.length === 0) return;

  await db
    .from("unit_occupancy")
    .update({ tenant_name: names.join(" / ") })
    .eq("unit_id", unitId);

  revalidatePath(`/admin/units/${unitId}`);
  revalidatePath("/admin/rent-board");
  revalidatePath("/admin/payments");
}
