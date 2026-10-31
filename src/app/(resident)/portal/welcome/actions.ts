"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResidentUnitId } from "@/lib/occupancy";
import { sendNotification, notificationHtml } from "@/lib/email";
import { RENT_DROPBOX } from "@/lib/rent-dropbox";
import { prorateFirstMonth, moveInTotal } from "@/lib/prorate";
import { sendMoveInStatement } from "@/lib/portal-invite";
import { formatCents, formatDate } from "@/lib/format";

export type WelcomeState = { ok: boolean; error?: string; notice?: string };

// 'online' stays valid in the database for when card / bank payment opens, but
// isn't offered yet, so it isn't accepted here either.
const PREFERENCES = new Set(["money_order", "check"]);

const PREFERENCE_LABEL: Record<string, string> = {
  money_order: `Money order payable to ${RENT_DROPBOX.payee}`,
  check: `Check payable to ${RENT_DROPBOX.payee}`,
  online: "Online from the portal",
};

/** The signed-in resident plus the home they're onboarding into. */
async function residentHome(): Promise<
  { userId: string; unitId: string; db: SupabaseClient } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const unitId = await getResidentUnitId(user.id);
  if (!unitId) return { error: "No home is on file for your account yet." };

  return { userId: user.id, unitId, db: createAdminClient() as unknown as SupabaseClient };
}

/** Who and where, for the note that goes to the office. */
async function homeContext(db: SupabaseClient, unitId: string, userId: string) {
  const [{ data: unit }, { data: profile }] = await Promise.all([
    db
      .from("units")
      .select("label, properties(name)")
      .eq("id", unitId)
      .maybeSingle<{ label: string; properties: { name: string | null } | null }>(),
    db
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle<{ full_name: string | null; email: string | null }>(),
  ]);
  const home = unit
    ? `${unit.properties?.name ? `${unit.properties.name} · ` : ""}${unit.label}`
    : "—";
  return { home, name: profile?.full_name ?? profile?.email ?? "A resident" };
}

/**
 * Record how the resident intends to pay rent.
 *
 * Worth asking rather than assuming: most residents here pay by money order,
 * and knowing in advance is the difference between a payment we can match to a
 * home and one that sits unidentified in the drop box.
 */
export async function setPaymentPreference(
  _prev: WelcomeState,
  form: FormData
): Promise<WelcomeState> {
  const ctx = await residentHome();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const choice = String(form.get("payment_preference") ?? "").trim();
  if (!PREFERENCES.has(choice)) {
    return { ok: false, error: "Please choose how you'd like to pay." };
  }

  const { error } = await ctx.db
    .from("unit_occupancy")
    .update({
      payment_preference: choice,
      payment_preference_set_at: new Date().toISOString(),
    })
    .eq("unit_id", ctx.unitId);
  if (error) return { ok: false, error: "Could not save that. Please try again." };

  await stampIfComplete(ctx.db, ctx.unitId);

  const { home, name } = await homeContext(ctx.db, ctx.unitId, ctx.userId);
  await sendNotification({
    subject: `${name} will pay by ${choice === "online" ? "card or bank" : choice.replace("_", " ")} — ${home}`,
    html: notificationHtml("New resident chose how they'll pay rent", [
      ["Resident", name],
      ["Home", home],
      ["Paying by", PREFERENCE_LABEL[choice]],
    ]),
  });

  revalidatePath("/portal/welcome");
  revalidatePath("/portal");
  return { ok: true, notice: "Saved — thank you." };
}

/**
 * Record the day the resident actually plans to move in.
 *
 * The date off a Zillow application is a hope, not a plan, and the lease start
 * follows from it. Stamping move_in_confirmed_at separates "they told us" from
 * "we guessed".
 */
export async function confirmMoveIn(
  _prev: WelcomeState,
  form: FormData
): Promise<WelcomeState> {
  const ctx = await residentHome();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const raw = String(form.get("move_in_date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false, error: "Please pick the day you plan to move in." };
  }

  // A date in the past is almost always a typo in the year; a date more than a
  // season out usually is too. Catch both here rather than in a phone call.
  const today = new Date().toISOString().slice(0, 10);
  if (raw < today) {
    return { ok: false, error: "That day has already passed — please pick an upcoming date." };
  }
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() + 6);
  if (raw > horizon.toISOString().slice(0, 10)) {
    return {
      ok: false,
      error: "That's more than six months out. Please call us so we can plan it properly.",
    };
  }

  const { error } = await ctx.db
    .from("unit_occupancy")
    .update({ move_in_date: raw, move_in_confirmed_at: new Date().toISOString() })
    .eq("unit_id", ctx.unitId);
  if (error) return { ok: false, error: "Could not save that. Please try again." };

  // Now the date is settled, the first month's rent can actually be billed.
  await raiseMoveInRent(ctx.db, ctx.unitId, ctx.userId, raw);

  await stampIfComplete(ctx.db, ctx.unitId);

  // What they now owe, so both sides see the same figure.
  const monthlyRent = await rentForUnit(ctx.db, ctx.unitId);
  const { data: money } = await ctx.db
    .from("unit_occupancy")
    .select("deposit_cents")
    .eq("unit_id", ctx.unitId)
    .maybeSingle<{ deposit_cents: number | null }>();

  const p = monthlyRent ? prorateFirstMonth(raw, monthlyRent) : null;
  const due = moveInTotal(p, monthlyRent, money?.deposit_cents ?? null);

  const { home, name } = await homeContext(ctx.db, ctx.unitId, ctx.userId);
  await sendNotification({
    subject: `${name} confirmed move-in ${raw} — ${home}`,
    html: notificationHtml("New resident confirmed their move-in day", [
      ["Resident", name],
      ["Home", home],
      ["Moving in", formatDate(raw)],
      [
        "First month",
        p
          ? `${formatCents(p.amountCents)} — ${p.description}`
          : formatCents(due.rentCents),
      ],
      ["Deposit", due.depositCents > 0 ? formatCents(due.depositCents) : "Not set"],
      ["Due before keys", formatCents(due.totalCents)],
      [
        "Next",
        "They've been emailed the amount and asked to bring it when they sign. Record it on the home once it's in hand.",
      ],
    ]),
  });

  // And tell them, plainly, what to bring and who to make it out to.
  const { data: who } = await ctx.db
    .from("profiles")
    .select("email, full_name")
    .eq("id", ctx.userId)
    .maybeSingle<{ email: string | null; full_name: string | null }>();
  if (who?.email && due.totalCents > 0) {
    await sendMoveInStatement({
      email: who.email,
      fullName: who.full_name,
      homeLabel: home,
      moveInDate: raw,
      prorationLabel: p && !p.isWholeMonth ? p.description : null,
      rentCents: due.rentCents,
      depositCents: due.depositCents,
      totalCents: due.totalCents,
      firstFullMonthOn: p?.firstFullMonthOn ?? null,
      monthlyRentCents: monthlyRent,
    });
  }

  revalidatePath("/portal/welcome");
  revalidatePath("/portal");
  return { ok: true, notice: "Got it — see you then." };
}

/**
 * The rent for a home, from the tenancy if it carries one, otherwise from the
 * home itself.
 *
 * A tenancy set up by hand can easily end up without a rent on it — the figure
 * lives on the unit as well, and it's the unit you're looking at when you set
 * the price. Without this fallback that gap is silent and expensive: no
 * prorated charge is raised and the resident is told to bring the deposit
 * alone, which is exactly what happened to The Villa Unit 2.
 */
async function rentForUnit(db: SupabaseClient, unitId: string): Promise<number | null> {
  const { data: occ } = await db
    .from("unit_occupancy")
    .select("rent_cents")
    .eq("unit_id", unitId)
    .maybeSingle<{ rent_cents: number | null }>();
  if (occ?.rent_cents) return occ.rent_cents;

  const { data: unit } = await db
    .from("units")
    .select("rent_cents")
    .eq("id", unitId)
    .maybeSingle<{ rent_cents: number | null }>();
  if (!unit?.rent_cents) return null;

  // Heal it, so every other screen stops disagreeing with this one.
  await db.from("unit_occupancy").update({ rent_cents: unit.rent_cents }).eq("unit_id", unitId);
  return unit.rent_cents;
}

/**
 * Raise the prorated first-month rent charge for a confirmed move-in.
 *
 * Replaces any charge raised against an earlier guess at the date — the whole
 * point of asking them is that the date can move, and a stale charge for the
 * wrong number of days is worse than none.
 *
 * The deposit is deliberately NOT a charge: open charges are what the
 * delinquency report is built from, and a deposit not yet handed over would
 * put a resident who has done nothing wrong onto the rent board.
 */
async function raiseMoveInRent(
  db: SupabaseClient,
  unitId: string,
  residentId: string,
  moveInIso: string
): Promise<void> {
  const rentCents = await rentForUnit(db, unitId);
  if (!rentCents) return;

  const p = prorateFirstMonth(moveInIso, rentCents);
  if (!p) return;

  // Anything already raised for the move-in month that nobody has paid against
  // is a charge for a date that has since changed — clear it and re-raise.
  const { data: existing } = await db
    .from("charges")
    .select("id, amount_cents, description")
    .eq("unit_id", unitId)
    .eq("period", p.period)
    .neq("status", "void")
    .returns<{ id: string; amount_cents: number; description: string | null }[]>();

  for (const c of existing ?? []) {
    if (c.amount_cents === p.amountCents && c.description === p.description) return;
    const { count } = await db
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("charge_id", c.id)
      .eq("status", "succeeded");
    // Something has been paid against it — leave it alone and let staff sort it.
    if ((count ?? 0) > 0) return;
    await db.from("charges").update({ status: "void" }).eq("id", c.id);
  }

  await db.from("charges").insert({
    unit_id: unitId,
    resident_id: residentId,
    amount_cents: p.amountCents,
    description: p.isWholeMonth ? "Monthly rent" : p.description,
    due_date: moveInIso,
    status: "open",
    period: p.period,
  });
}

/**
 * Stamp onboarding complete once both answers are in. These two are the only
 * parts of the welcome the resident controls from here; the lease carries its
 * own signed_at.
 */
async function stampIfComplete(db: SupabaseClient, unitId: string): Promise<void> {
  const { data } = await db
    .from("unit_occupancy")
    .select("payment_preference, move_in_confirmed_at, onboarding_completed_at")
    .eq("unit_id", unitId)
    .maybeSingle<{
      payment_preference: string | null;
      move_in_confirmed_at: string | null;
      onboarding_completed_at: string | null;
    }>();

  if (!data || data.onboarding_completed_at) return;
  if (!data.payment_preference || !data.move_in_confirmed_at) return;

  await db
    .from("unit_occupancy")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("unit_id", unitId);
}
