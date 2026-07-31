"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";
import { sendNotification } from "@/lib/email";

type Supa = Awaited<ReturnType<typeof createClient>>;
const loose = (s: Supa): SupabaseClient => s as unknown as SupabaseClient;

function str(v: FormDataEntryValue | null): string | null {
  const s = ((v as string) ?? "").trim();
  return s || null;
}
function dollarsToCents(v: FormDataEntryValue | null): number | null {
  const s = ((v as string) ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/**
 * Find a sign-in account by email, creating one (confirmed, random password,
 * no email sent) if none exists. Returns the profile id, or null on failure.
 * Account creation is silent — invite the tenant to the portal separately when
 * you're ready to send them a login.
 */
async function ensureAccount(
  supabase: Supa,
  email: string,
  fullName: string | null
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (existing) return existing.id;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `38thAve-${crypto.randomUUID().slice(0, 12)}`,
    email_confirm: true,
    user_metadata: { full_name: fullName ?? undefined },
  });
  if (error || !data.user) return null;
  return data.user.id;
}

/** Insert an active lease + a lease_events note. Returns the lease id. */
async function createActiveLease(
  db: SupabaseClient,
  row: {
    unit_id: string;
    resident_id: string;
    start_date: string;
    end_date: string | null;
    rent_cents: number;
    deposit_cents: number;
    signed_at: string | null;
    actor_id: string;
    note: string;
  }
): Promise<string | null> {
  const { data: lease, error } = await db
    .from("leases")
    .insert({
      unit_id: row.unit_id,
      resident_id: row.resident_id,
      start_date: row.start_date,
      end_date: row.end_date,
      rent_cents: row.rent_cents,
      deposit_cents: row.deposit_cents,
      status: "active",
      signed_at: row.signed_at,
    })
    .select("id")
    .maybeSingle();
  if (error || !lease) return null;

  await db.from("lease_events").insert({
    lease_id: lease.id,
    actor_id: row.actor_id,
    type: "note",
    note: row.note,
  });
  return lease.id;
}

/** Unit ids that already have an active lease (so we never double-activate). */
async function activeLeaseUnitIds(db: SupabaseClient): Promise<Set<string>> {
  const { data } = await db
    .from("leases")
    .select("unit_id")
    .eq("status", "active")
    .returns<{ unit_id: string }[]>();
  return new Set((data ?? []).map((l) => l.unit_id));
}

export type AddTenantState = { ok: boolean; error?: string; notice?: string };

/**
 * Record-keeping first: create/link an account, email a login. Used only when
 * the staff member ticks "invite". Returns the linked profile id + a note.
 */
async function inviteAccount(
  supabase: Supa,
  unitId: string,
  email: string,
  name: string,
  existingId: string | null
): Promise<{ ok: true; id: string; note: string } | { ok: false; error: string }> {
  const { data: u } = await supabase
    .from("units")
    .select("label, properties(name)")
    .eq("id", unitId)
    .maybeSingle<{ label: string; properties: { name: string | null } | null }>();
  const home = u?.properties?.name ? `${u.properties.name} — ${u.label}` : "your home";
  const greeting = name.split(" ")[0] || "there";

  let id = existingId;
  let tempPassword: string | null = null;
  if (!id) {
    const admin = createAdminClient();
    tempPassword = `38thAve-${crypto.randomUUID().slice(0, 8)}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error || !data.user) return { ok: false, error: "Could not create the account." };
    id = data.user.id;
  }

  const intro = tempPassword
    ? `<p>We've set up a resident portal for <strong>${home}</strong>. Sign in at <a href="https://38thaveproperties.com/login" style="color:#2f5d50;font-weight:600">38thaveproperties.com/login</a> with <strong>${email}</strong> and temporary password <strong>${tempPassword}</strong> — then use “Forgot password?” to set your own.</p>`
    : `<p>Your account is now linked to <strong>${home}</strong>. Sign in at <a href="https://38thaveproperties.com/login" style="color:#2f5d50;font-weight:600">38thaveproperties.com/login</a> (use “Forgot password?” if you need to reset it).</p>`;
  await sendNotification({
    to: email,
    subject: "Your 38th Ave Properties resident portal",
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;color:#2c2622;font-size:15px;line-height:1.7"><div style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#2f5d50;margin-bottom:12px">Welcome, ${greeting} 👋</div>${intro}<p style="margin-top:18px;color:#6f655a;font-size:14px">— The 38th Ave Properties team</p></div>`,
  });

  return {
    ok: true,
    id,
    note: tempPassword ? "Account created & login emailed." : "Linked to their account & emailed.",
  };
}

/**
 * Add / update one renter's record on a unit. RECORD-KEEPING FIRST: always
 * saves the tenancy (name, contact, lease dates, rent, deposit, notes) with NO
 * account required — many tenants won't want one. If the email already has an
 * account it's linked so their data connects. Tick "invite" to create an
 * account and email a login. Billing (active leases) stays a separate step.
 */
export async function addTenant(
  _prev: AddTenantState,
  form: FormData
): Promise<AddTenantState> {
  const { profile } = await requireProfile("/admin/tenants/new");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = str(form.get("unit_id"));
  const name = str(form.get("tenant_name"));
  const email = str(form.get("tenant_email"))?.toLowerCase() ?? null;
  const phone = str(form.get("tenant_phone"));
  const rentCents = dollarsToCents(form.get("rent"));
  const depositCents = dollarsToCents(form.get("deposit"));
  const moveIn = str(form.get("move_in_date"));
  const leaseStart = str(form.get("lease_start_date"));
  const leaseSigned = str(form.get("lease_signed_date"));
  const leaseEnd = str(form.get("lease_end_date"));
  const notes = str(form.get("notes"));
  const invite = form.get("invite") === "on";

  if (!unitId) return { ok: false, error: "Choose a unit." };
  if (!name) return { ok: false, error: "Enter the tenant's name." };
  if (invite && !email) {
    return { ok: false, error: "Add an email to create a portal account." };
  }

  const supabase = await createClient();
  const db = loose(supabase);

  // Connect an existing account by email (never auto-create here).
  let occupantId: string | null = null;
  if (email) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    occupantId = existing?.id ?? null;
  }

  // Optional: create an account + email a login.
  let inviteNote = "";
  if (invite && email) {
    const res = await inviteAccount(supabase, unitId, email, name, occupantId);
    if (!res.ok) return { ok: false, error: res.error };
    occupantId = res.id;
    inviteNote = res.note;
  }

  await db.from("unit_occupancy").upsert(
    {
      unit_id: unitId,
      occupant_profile_id: occupantId,
      tenant_name: name,
      tenant_email: email,
      tenant_phone: phone,
      rent_cents: rentCents,
      deposit_cents: depositCents,
      lease_start_date: leaseStart,
      lease_signed_date: leaseSigned,
      lease_end_date: leaseEnd,
      move_in_date: moveIn,
      notes,
    },
    { onConflict: "unit_id" }
  );
  await supabase.from("units").update({ status: "occupied" }).eq("id", unitId);

  revalidatePath("/admin/properties");
  revalidatePath("/admin/properties/[slug]", "page");
  revalidatePath("/admin");

  const linked = occupantId && !invite ? " Connected to their existing account." : "";
  return {
    ok: true,
    notice: `Saved ${name}'s record.${inviteNote ? " " + inviteNote : linked}`,
  };
}

export type ActivateResult = {
  ok: boolean;
  activated: number;
  alreadyActive: number;
  skippedNoEmail: number;
  error?: string;
};

type OccForBilling = {
  unit_id: string;
  occupant_profile_id: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  rent_cents: number | null;
  lease_start_date: string | null;
  lease_signed_date: string | null;
  lease_end_date: string | null;
  move_in_date: string | null;
  units: { rent_cents: number | null } | null;
};

/**
 * Billing bridge: turn every imported tenancy into an active lease so it shows
 * up in Payments / Delinquency / the owner report. Ensures an account per
 * tenant (silent). Tenancies without an email are skipped (no account possible)
 * and reported back. Idempotent: units that already have an active lease are
 * left alone.
 */
export async function activateImportedBilling(): Promise<ActivateResult> {
  const { user, profile } = await requireProfile("/admin/import");
  if (!isStaff(profile)) {
    return { ok: false, activated: 0, alreadyActive: 0, skippedNoEmail: 0, error: "Staff only." };
  }

  const supabase = await createClient();
  const db = loose(supabase);

  const { data: occ } = await db
    .from("unit_occupancy")
    .select(
      "unit_id, occupant_profile_id, tenant_name, tenant_email, rent_cents, lease_start_date, lease_signed_date, lease_end_date, move_in_date, units(rent_cents)"
    )
    .returns<OccForBilling[]>();

  const active = await activeLeaseUnitIds(db);
  const today = new Date().toISOString().slice(0, 10);

  let activated = 0;
  let alreadyActive = 0;
  let skippedNoEmail = 0;

  for (const o of occ ?? []) {
    if (!o.unit_id) continue;
    // Only tenanted rows.
    if (!o.tenant_name && !o.tenant_email && !o.occupant_profile_id) continue;
    if (active.has(o.unit_id)) {
      alreadyActive += 1;
      continue;
    }

    let residentId = o.occupant_profile_id;
    if (!residentId) {
      const email = o.tenant_email?.trim().toLowerCase();
      if (!email) {
        skippedNoEmail += 1;
        continue;
      }
      residentId = await ensureAccount(supabase, email, o.tenant_name);
      if (!residentId) {
        skippedNoEmail += 1;
        continue;
      }
      await supabase
        .from("unit_occupancy")
        .update({ occupant_profile_id: residentId })
        .eq("unit_id", o.unit_id);
    }

    const leaseId = await createActiveLease(db, {
      unit_id: o.unit_id,
      resident_id: residentId,
      start_date: o.lease_start_date ?? o.move_in_date ?? today,
      end_date: o.lease_end_date,
      rent_cents: o.rent_cents ?? o.units?.rent_cents ?? 0,
      deposit_cents: 0,
      signed_at: o.lease_signed_date ?? o.lease_start_date ?? null,
      actor_id: user.id,
      note: "Activated from imported tenancy",
    });
    if (leaseId) {
      await supabase.from("units").update({ status: "occupied" }).eq("id", o.unit_id);
      active.add(o.unit_id);
      activated += 1;
    }
  }

  revalidatePath("/admin/import");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/delinquency");
  revalidatePath("/admin");
  return { ok: true, activated, alreadyActive, skippedNoEmail };
}
