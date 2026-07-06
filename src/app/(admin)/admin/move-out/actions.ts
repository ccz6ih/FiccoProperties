"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";

/** Save the deposit amount + notes/status for a unit's move-out settlement. */
export async function saveDepositSettlement(form: FormData) {
  const { profile } = await requireProfile("/admin/move-out");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  if (!unitId) return;
  const depositDollars = Number(form.get("deposit_dollars"));
  const notes = (form.get("notes") as string)?.trim() || null;
  const status = (form.get("status") as string)?.trim() === "finalized" ? "finalized" : "draft";

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("deposit_settlements").upsert(
    {
      unit_id: unitId,
      deposit_cents: Number.isFinite(depositDollars) ? Math.round(depositDollars * 100) : 0,
      notes,
      status,
      updated_by: profile!.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "unit_id" }
  );

  revalidatePath(`/admin/move-out/${unitId}`);
}

/** Add an itemized deduction. */
export async function addDeduction(form: FormData) {
  const { profile } = await requireProfile("/admin/move-out");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  const description = (form.get("description") as string)?.trim();
  const amountDollars = Number(form.get("amount_dollars"));
  if (!unitId || !description || !Number.isFinite(amountDollars) || amountDollars <= 0) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("deposit_deductions").insert({
    unit_id: unitId,
    description,
    amount_cents: Math.round(amountDollars * 100),
    created_by: profile!.id,
  });

  revalidatePath(`/admin/move-out/${unitId}`);
}

/** Remove a deduction. */
export async function deleteDeduction(form: FormData) {
  const { profile } = await requireProfile("/admin/move-out");
  if (!isStaff(profile)) return;

  const id = (form.get("id") as string)?.trim();
  const unitId = (form.get("unit_id") as string)?.trim();
  if (!id) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("deposit_deductions").delete().eq("id", id);

  if (unitId) revalidatePath(`/admin/move-out/${unitId}`);
}
