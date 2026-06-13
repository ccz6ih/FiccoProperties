"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";

export type ImportRow = {
  unitId: string;
  tenant_name: string | null;
  tenant_email: string | null;
  tenant_phone: string | null;
  move_in_date: string | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  rent_cents: number | null;
  notes: string | null;
};

export type ImportResult = {
  ok: boolean;
  imported: number;
  linked: number;
  occupied: number;
  skipped: number;
  error?: string;
};

/**
 * Bulk-import existing tenancies into unit_occupancy (matched to units client-
 * side, re-validated here). Upserts by unit_id, auto-links a sign-in account
 * when the tenant email already matches a profile, and marks tenanted units
 * occupied. Staff-only. Does not create portal accounts or leases — invite
 * tenants from the unit roster afterward.
 */
export async function importOccupancies(rows: ImportRow[]): Promise<ImportResult> {
  const { profile } = await requireProfile("/admin/import");
  if (!isStaff(profile)) {
    return { ok: false, imported: 0, linked: 0, occupied: 0, skipped: 0, error: "Staff only." };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, imported: 0, linked: 0, occupied: 0, skipped: 0, error: "Nothing to import." };
  }

  const supabase = await createClient();

  // Re-validate unit ids against the database (don't trust the client).
  const { data: units } = await supabase.from("units").select("id");
  const validUnits = new Set((units ?? []).map((u) => u.id));

  // Email -> profile id map so existing accounts get linked automatically.
  const { data: profiles } = await supabase.from("profiles").select("id, email");
  const byEmail = new Map<string, string>();
  for (const p of profiles ?? []) {
    if (p.email) byEmail.set(p.email.trim().toLowerCase(), p.id);
  }

  let imported = 0;
  let linked = 0;
  let occupied = 0;
  let skipped = 0;
  const occupiedUnitIds: string[] = [];

  for (const r of rows) {
    if (!r.unitId || !validUnits.has(r.unitId)) {
      skipped += 1;
      continue;
    }

    const email = r.tenant_email?.trim().toLowerCase() || null;
    const occupantId = email ? byEmail.get(email) ?? null : null;
    if (occupantId) linked += 1;

    const { error } = await supabase.from("unit_occupancy").upsert(
      {
        unit_id: r.unitId,
        occupant_profile_id: occupantId,
        tenant_name: r.tenant_name,
        tenant_email: r.tenant_email,
        tenant_phone: r.tenant_phone,
        rent_cents: r.rent_cents,
        lease_start_date: r.lease_start_date,
        lease_end_date: r.lease_end_date,
        move_in_date: r.move_in_date,
        notes: r.notes,
      },
      { onConflict: "unit_id" }
    );

    if (error) {
      skipped += 1;
      continue;
    }
    imported += 1;
    if (r.tenant_name || r.tenant_email) occupiedUnitIds.push(r.unitId);
  }

  // Mark tenanted units occupied in one shot.
  if (occupiedUnitIds.length > 0) {
    const { error } = await supabase
      .from("units")
      .update({ status: "occupied" })
      .in("id", occupiedUnitIds);
    if (!error) occupied = occupiedUnitIds.length;
  }

  revalidatePath("/admin/properties");
  revalidatePath("/admin/properties/[slug]", "page");
  revalidatePath("/admin");
  return { ok: true, imported, linked, occupied, skipped };
}
