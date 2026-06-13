"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";

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
 * Add one renter to a unit. Two modes:
 *  - "existing": the lease is already signed on paper — records the tenancy,
 *    ensures an account, and creates an ACTIVE lease so they're billable now.
 *  - "new": creates a DRAFT lease and sends you to it to e-sign.
 * Always writes unit_occupancy so the roster/portal connect.
 */
export async function addTenant(
  _prev: AddTenantState,
  form: FormData
): Promise<AddTenantState> {
  const { user, profile } = await requireProfile("/admin/tenants/new");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = str(form.get("unit_id"));
  const name = str(form.get("tenant_name"));
  const email = str(form.get("tenant_email"))?.toLowerCase() ?? null;
  const phone = str(form.get("tenant_phone"));
  const leaseType = (str(form.get("lease_type")) ?? "existing") as
    | "existing"
    | "new";
  const rentCents = dollarsToCents(form.get("rent"));
  const depositCents = dollarsToCents(form.get("deposit")) ?? 0;
  const moveIn = str(form.get("move_in_date"));
  const leaseStart = str(form.get("lease_start_date"));
  const leaseSigned = str(form.get("lease_signed_date"));
  const leaseEnd = str(form.get("lease_end_date"));
  const notes = str(form.get("notes"));

  if (!unitId) return { ok: false, error: "Choose a unit." };
  if (!name) return { ok: false, error: "Enter the tenant's name." };

  const supabase = await createClient();
  const db = loose(supabase);

  // Ensure / link an account when we have an email.
  let occupantId: string | null = null;
  if (email) {
    occupantId = await ensureAccount(supabase, email, name);
    if (!occupantId) {
      return { ok: false, error: "Could not set up an account for that email." };
    }
  }

  await supabase.from("unit_occupancy").upsert(
    {
      unit_id: unitId,
      occupant_profile_id: occupantId,
      tenant_name: name,
      tenant_email: email,
      tenant_phone: phone,
      rent_cents: rentCents,
      lease_start_date: leaseStart,
      lease_signed_date: leaseSigned,
      lease_end_date: leaseEnd,
      move_in_date: moveIn,
      notes,
    },
    { onConflict: "unit_id" }
  );
  await supabase.from("units").update({ status: "occupied" }).eq("id", unitId);

  const revalidate = () => {
    revalidatePath("/admin/properties");
    revalidatePath("/admin/properties/[slug]", "page");
    revalidatePath("/admin");
    revalidatePath("/admin/payments");
  };

  if (!email) {
    revalidate();
    return {
      ok: true,
      notice:
        "Tenancy saved. Add an email to set up billing — an active lease needs a portal account.",
    };
  }

  // Past the `if (!email)` guard, the account is guaranteed.
  const residentId: string = occupantId!;
  const startDate = leaseStart ?? moveIn ?? new Date().toISOString().slice(0, 10);

  if (leaseType === "new") {
    // Draft lease -> go to the lease page to send for e-signature.
    const { data: lease } = await db
      .from("leases")
      .insert({
        unit_id: unitId,
        resident_id: residentId,
        start_date: startDate,
        end_date: leaseEnd,
        rent_cents: rentCents ?? 0,
        deposit_cents: depositCents,
        status: "draft",
      })
      .select("id")
      .maybeSingle();
    if (lease) {
      await db.from("lease_events").insert({
        lease_id: lease.id,
        actor_id: user.id,
        type: "created",
        note: "Lease drafted",
      });
      revalidate();
      redirect(`/admin/leases/${lease.id}`);
    }
    revalidate();
    return { ok: false, error: "Could not create the draft lease." };
  }

  // Existing lease -> create an active lease unless the unit already has one.
  const active = await activeLeaseUnitIds(db);
  if (active.has(unitId)) {
    revalidate();
    return {
      ok: true,
      notice: "Tenancy saved. This unit already has an active lease.",
    };
  }

  const leaseId = await createActiveLease(db, {
    unit_id: unitId,
    resident_id: residentId,
    start_date: startDate,
    end_date: leaseEnd,
    rent_cents: rentCents ?? 0,
    deposit_cents: depositCents,
    signed_at: leaseSigned ?? startDate,
    actor_id: user.id,
    note: "Existing lease recorded (active)",
  });

  revalidate();
  if (!leaseId) return { ok: false, error: "Saved tenancy, but the lease failed." };
  return {
    ok: true,
    notice:
      "Tenant added and billing activated. Use “Generate this month’s rent” on Payments to bill them.",
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
