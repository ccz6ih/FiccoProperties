"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { lateFeeCapCents } from "@/lib/late-fee";
import { buildNotice } from "@/lib/notice-template";
import { formatDate } from "@/lib/format";

export type LateFeeState = { ok: boolean; error?: string; notice?: string };

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Add a late-fee charge for a resident. The amount is admin-confirmed but
 * clamped server-side to the Colorado cap as a safety net.
 */
export async function addLateFee(
  _prev: LateFeeState,
  form: FormData
): Promise<LateFeeState> {
  const { profile } = await requireProfile("/admin/delinquency");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const lease_id = (form.get("lease_id") as string) || null;
  const resident_id = (form.get("resident_id") as string) || null;
  const unit_id = (form.get("unit_id") as string) || null;
  const overdueCents = Number(form.get("overdue_cents")) || 0;
  const amountDollars = Number(form.get("amount_dollars"));

  if (!unit_id && !resident_id) return { ok: false, error: "Missing tenant." };
  if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
    return { ok: false, error: "Enter a valid late-fee amount." };
  }

  let amountCents = Math.round(amountDollars * 100);
  const cap = lateFeeCapCents(overdueCents);
  if (amountCents > cap) amountCents = cap; // clamp to the CO cap

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const today = new Date().toISOString().slice(0, 10);

  const { data: charge, error } = await db
    .from("charges")
    .insert({
      lease_id,
      resident_id,
      unit_id,
      amount_cents: amountCents,
      description: "Late fee",
      due_date: today,
      status: "open",
      period: currentPeriod(),
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !charge) return { ok: false, error: "Could not add the late fee." };

  if (resident_id) {
    await db.from("ledger_entries").insert({
      resident_id,
      lease_id,
      unit_id,
      kind: "charge",
      amount_cents: amountCents,
      ref_id: charge.id,
      memo: "Late fee",
    });
  }

  revalidatePath("/admin/delinquency");
  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  return { ok: true, notice: "Late fee added." };
}

type UnitInfo = {
  label: string;
  properties: {
    name: string | null;
    address_line1: string | null;
    city: string | null;
    postal_code: string | null;
  } | null;
};
type OccInfo = {
  tenant_name: string | null;
  occupant_profile_id: string | null;
  rent_cents: number | null;
  profiles: { full_name: string | null } | null;
};

/**
 * Assemble a 10-day Demand for Compliance draft-notice row for one unit's
 * overdue rent. Returns null when the unit has no past-due charges. Shared by
 * the single- and bulk-demand actions so both produce identical notices.
 */
async function buildDemandForUnit(
  db: SupabaseClient,
  unitId: string,
  createdBy: string,
  now: Date
) {
  const todayIso = now.toISOString().slice(0, 10);

  const [{ data: unit }, { data: occ }, { data: charges }] = await Promise.all([
    db
      .from("units")
      .select("label, properties(name, address_line1, city, postal_code)")
      .eq("id", unitId)
      .maybeSingle<UnitInfo>(),
    db
      .from("unit_occupancy")
      .select("tenant_name, occupant_profile_id, rent_cents, profiles:occupant_profile_id(full_name)")
      .eq("unit_id", unitId)
      .maybeSingle<OccInfo>(),
    db
      .from("charges")
      .select("amount_cents, due_date, status")
      .eq("unit_id", unitId)
      .in("status", ["open", "past_due"])
      .returns<{ amount_cents: number; due_date: string | null; status: string }[]>(),
  ]);

  const overdue = (charges ?? []).filter((c) => c.due_date && c.due_date < todayIso);
  if (overdue.length === 0) return null;

  const pastDueCents = overdue.reduce((s, c) => s + c.amount_cents, 0);
  const missedDates = overdue
    .map((c) => (c.due_date ? formatDate(c.due_date) : null))
    .filter(Boolean)
    .join(", ");

  const p = unit?.properties ?? null;
  const homeLabel = [p?.name, unit?.label].filter(Boolean).join(" — ");
  const fullAddress = [p?.address_line1, unit?.label].filter(Boolean).join(", ") || homeLabel;

  const cure = new Date(now);
  cure.setDate(cure.getDate() + 10);
  const cureIso = cure.toISOString().slice(0, 10);

  const { title, body } = buildNotice("pay_or_quit", {
    tenantName: occ?.tenant_name ?? occ?.profiles?.full_name ?? "Resident",
    homeLabel,
    fullAddress,
    city: p?.city,
    county: "Jefferson",
    amount: pastDueCents / 100,
    monthlyRent: (occ?.rent_cents ?? 0) / 100,
    missedDates,
    cureBy: formatDate(cureIso),
    today: formatDate(todayIso),
  });

  return {
    resident_id: occ?.occupant_profile_id ?? null,
    unit_id: unitId,
    type: "pay_or_quit",
    title,
    body,
    amount_cents: pastDueCents,
    cure_by: cureIso,
    status: "draft",
    created_by: createdBy,
  };
}

/** Units that already have an open (draft/served) pay-or-quit notice, so bulk
 *  runs don't create duplicates for the same delinquency cycle. */
async function unitsWithActiveDemand(db: SupabaseClient): Promise<Set<string>> {
  const { data } = await db
    .from("notices")
    .select("unit_id")
    .eq("type", "pay_or_quit")
    .in("status", ["draft", "served"])
    .returns<{ unit_id: string | null }[]>();
  return new Set((data ?? []).map((n) => n.unit_id).filter(Boolean) as string[]);
}

/**
 * Auto-fill a 10-day Demand for Compliance (pay-or-quit) for a unit's overdue
 * rent, then open it as a draft notice to review, print, and serve. Works for
 * record-only tenants too (the notice is unit-based).
 */
export async function createDemandForUnit(form: FormData) {
  const { profile } = await requireProfile("/admin/delinquency");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  if (!unitId) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const row = await buildDemandForUnit(db, unitId, profile!.id, new Date());
  if (!row) return;

  const { data: notice, error } = await db
    .from("notices")
    .insert(row)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !notice) return;

  revalidatePath("/admin/notices");
  redirect(`/admin/notices/${notice.id}`);
}

const TERM_TYPE: Record<string, "terminate_substantial" | "terminate_repeat" | "terminate_nonrenewal"> = {
  substantial: "terminate_substantial",
  repeat: "terminate_repeat",
  nonrenewal: "terminate_nonrenewal",
};
const TERM_DAYS: Record<string, number> = { substantial: 3, repeat: 10, nonrenewal: 21 };

/**
 * Create a Notice to Terminate Tenancy (JDF 99B) for a unit — substantial
 * violation (3-day), repeat lease violation (10-day), or non-renewal. Opens as
 * a draft to review, print, and serve. Move-out date defaults by ground but is
 * set on the form; for a repeat violation the prior served demand date is
 * pre-filled from the record when available.
 */
export async function createTerminationNotice(form: FormData) {
  const { profile } = await requireProfile("/admin/delinquency");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  const ground = (form.get("ground") as string)?.trim();
  if (!unitId || !TERM_TYPE[ground]) return;

  const reason = (form.get("reason") as string)?.trim() || null;
  const moveOutForm = (form.get("move_out_date") as string)?.trim() || null;
  const priorDemandForm = (form.get("prior_demand_date") as string)?.trim() || null;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const [{ data: unit }, { data: occ }] = await Promise.all([
    db.from("units").select("label, properties(name, address_line1, city, postal_code)").eq("id", unitId).maybeSingle<UnitInfo>(),
    db.from("unit_occupancy").select("tenant_name, occupant_profile_id, rent_cents, profiles:occupant_profile_id(full_name)").eq("unit_id", unitId).maybeSingle<OccInfo>(),
  ]);

  let moveOutIso = moveOutForm;
  if (!moveOutIso) {
    const d = new Date(now);
    d.setDate(d.getDate() + (TERM_DAYS[ground] ?? 21));
    moveOutIso = d.toISOString().slice(0, 10);
  }

  let priorDemandDate = priorDemandForm;
  if (ground === "repeat" && !priorDemandDate) {
    const { data: prior } = await db
      .from("notices")
      .select("served_at")
      .eq("unit_id", unitId)
      .eq("type", "lease_violation")
      .not("served_at", "is", null)
      .order("served_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ served_at: string | null }>();
    priorDemandDate = prior?.served_at ?? null;
  }

  const p = unit?.properties ?? null;
  const homeLabel = [p?.name, unit?.label].filter(Boolean).join(" — ");
  const fullAddress = [p?.address_line1, unit?.label].filter(Boolean).join(", ") || homeLabel;

  const { title, body } = buildNotice(TERM_TYPE[ground], {
    tenantName: occ?.tenant_name ?? occ?.profiles?.full_name ?? "Resident",
    homeLabel,
    fullAddress,
    city: p?.city,
    county: "Jefferson",
    reason,
    moveOutDate: formatDate(moveOutIso),
    priorDemandDate: priorDemandDate ? formatDate(priorDemandDate) : null,
    today: formatDate(todayIso),
  });

  const { data: notice, error } = await db
    .from("notices")
    .insert({
      resident_id: occ?.occupant_profile_id ?? null,
      unit_id: unitId,
      type: TERM_TYPE[ground],
      title,
      body,
      cure_by: moveOutIso,
      status: "draft",
      created_by: profile!.id,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !notice) return;

  revalidatePath("/admin/notices");
  redirect(`/admin/notices/${notice.id}`);
}

/**
 * Bulk: create a demand for every overdue unit that doesn't already have an
 * open pay-or-quit notice. One click on the 8th instead of one per tenant.
 */
export async function createDemandsForAllOverdue() {
  const { profile } = await requireProfile("/admin/delinquency");
  if (!isStaff(profile)) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  // Distinct units with a past-due charge.
  const { data: charges } = await db
    .from("charges")
    .select("unit_id, due_date, status")
    .in("status", ["open", "past_due"])
    .returns<{ unit_id: string | null; due_date: string | null; status: string }[]>();

  const overdueUnits = new Set(
    (charges ?? [])
      .filter((c) => c.unit_id && c.due_date && c.due_date < todayIso)
      .map((c) => c.unit_id as string)
  );

  const alreadyDemanded = await unitsWithActiveDemand(db);
  const targets = [...overdueUnits].filter((u) => !alreadyDemanded.has(u));

  const built = await Promise.all(
    targets.map((u) => buildDemandForUnit(db, u, profile!.id, now))
  );
  const rows = built.filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length > 0) {
    await db.from("notices").insert(rows);
  }

  revalidatePath("/admin/notices");
  revalidatePath("/admin/delinquency");
  redirect(`/admin/notices?created=${rows.length}`);
}

/**
 * Prepare a 90-day Notice of No-Fault Eviction for repeated late payment
 * (C.R.S. § 38-12-1303(3)(f)) for a unit, pre-filled from the served
 * Demands for Compliance already on record. Opens as a draft to review — staff
 * must confirm eligibility (1+ year tenancy, each payment 10+ days late with a
 * served demand) before serving.
 */
export async function createNoFaultNotice(form: FormData) {
  const { profile } = await requireProfile("/admin/delinquency");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  if (!unitId) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const [{ data: unit }, { data: occ }, { data: demands }] = await Promise.all([
    db
      .from("units")
      .select("label, properties(name, address_line1, city, postal_code)")
      .eq("id", unitId)
      .maybeSingle<UnitInfo>(),
    db
      .from("unit_occupancy")
      .select("tenant_name, occupant_profile_id, rent_cents, profiles:occupant_profile_id(full_name)")
      .eq("unit_id", unitId)
      .maybeSingle<OccInfo>(),
    db
      .from("notices")
      .select("served_at")
      .eq("unit_id", unitId)
      .eq("type", "pay_or_quit")
      .not("served_at", "is", null)
      .order("served_at", { ascending: true })
      .returns<{ served_at: string | null }[]>(),
  ]);

  const served = (demands ?? []).filter((d) => d.served_at);
  const demandDates = served
    .map((d) => (d.served_at ? formatDate(d.served_at) : null))
    .filter(Boolean)
    .join("; ");

  const p = unit?.properties ?? null;
  const homeLabel = [p?.name, unit?.label].filter(Boolean).join(" — ");
  const fullAddress = [p?.address_line1, unit?.label].filter(Boolean).join(", ") || homeLabel;

  const moveOut = new Date(now);
  moveOut.setDate(moveOut.getDate() + 90);
  const moveOutIso = moveOut.toISOString().slice(0, 10);

  const { title, body } = buildNotice("no_fault_late", {
    tenantName: occ?.tenant_name ?? occ?.profiles?.full_name ?? "Resident",
    homeLabel,
    fullAddress,
    city: p?.city,
    county: "Jefferson",
    demandCount: served.length,
    demandDates,
    moveOutDate: formatDate(moveOutIso),
    today: formatDate(todayIso),
  });

  const { data: notice, error } = await db
    .from("notices")
    .insert({
      resident_id: occ?.occupant_profile_id ?? null,
      unit_id: unitId,
      type: "no_fault_late",
      title,
      body,
      cure_by: moveOutIso,
      status: "draft",
      created_by: profile!.id,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !notice) return;

  revalidatePath("/admin/notices");
  redirect(`/admin/notices/${notice.id}`);
}
