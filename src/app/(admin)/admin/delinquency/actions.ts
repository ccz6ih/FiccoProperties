"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { lateFeeCapCents } from "@/lib/late-fee";

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
