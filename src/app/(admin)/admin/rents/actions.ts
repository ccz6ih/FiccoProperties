"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";

export type SetRentState = { ok: boolean; error?: string; notice?: string };

/**
 * Set the monthly rent for a unit's current tenancy. Writes to
 * unit_occupancy.rent_cents — the figure billing uses when there's no active
 * lease — so record-only / month-to-month units get a rent before you generate
 * charges. (When an active lease exists, its rent still takes precedence.)
 */
export async function setUnitRent(
  _prev: SetRentState,
  form: FormData
): Promise<SetRentState> {
  const { profile } = await requireProfile("/admin/rents");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = (form.get("unit_id") as string)?.trim();
  const rentDollars = Number(form.get("rent_dollars"));
  if (!unitId) return { ok: false, error: "Missing unit." };
  if (!Number.isFinite(rentDollars) || rentDollars < 0) {
    return { ok: false, error: "Enter a valid rent amount." };
  }

  const rentCents = Math.round(rentDollars * 100);
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { error } = await db
    .from("unit_occupancy")
    .update({ rent_cents: rentCents })
    .eq("unit_id", unitId);

  if (error) return { ok: false, error: "Could not save the rent." };

  revalidatePath("/admin/rents");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/rent-board");
  return { ok: true, notice: "Rent saved." };
}
