"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { buildSchedule, type Cadence } from "@/lib/repayment";

const CADENCES: Cadence[] = ["weekly", "biweekly", "monthly"];

/** Create a repayment plan for a unit's outstanding balance + its schedule. */
export async function createRepaymentPlan(form: FormData) {
  const { profile } = await requireProfile("/admin/repayment-plans");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  const totalDollars = Number(form.get("total_dollars"));
  const downDollars = Number(form.get("down_dollars")) || 0;
  const installments = Math.max(1, Math.floor(Number(form.get("installments")) || 1));
  const cadenceRaw = (form.get("cadence") as string)?.trim() as Cadence;
  const cadence: Cadence = CADENCES.includes(cadenceRaw) ? cadenceRaw : "monthly";
  const startDate = (form.get("start_date") as string)?.trim();
  const notes = (form.get("notes") as string)?.trim() || null;

  if (!unitId || !startDate) return;
  if (!Number.isFinite(totalDollars) || totalDollars <= 0) return;

  const totalCents = Math.round(totalDollars * 100);
  const downCents = Math.max(0, Math.round(downDollars * 100));

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: occ } = await db
    .from("unit_occupancy")
    .select("occupant_profile_id")
    .eq("unit_id", unitId)
    .maybeSingle<{ occupant_profile_id: string | null }>();

  const { data: plan, error } = await db
    .from("repayment_plans")
    .insert({
      unit_id: unitId,
      resident_id: occ?.occupant_profile_id ?? null,
      total_cents: totalCents,
      down_payment_cents: downCents,
      installments,
      cadence,
      start_date: startDate,
      status: "active",
      notes,
      created_by: profile!.id,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !plan) return;

  const schedule = buildSchedule({
    totalCents,
    downPaymentCents: downCents,
    installments,
    cadence,
    startDate,
  });
  await db.from("repayment_plan_items").insert(
    schedule.map((s) => ({
      plan_id: plan.id,
      seq: s.seq,
      due_date: s.dueDate,
      amount_cents: s.amountCents,
      status: "open",
    }))
  );

  revalidatePath("/admin/repayment-plans");
  redirect(`/admin/repayment-plans/${plan.id}`);
}

/** Toggle an installment paid/open (tracking only — record the actual money on Payments). */
export async function toggleInstallment(form: FormData) {
  const { profile } = await requireProfile("/admin/repayment-plans");
  if (!isStaff(profile)) return;

  const itemId = (form.get("item_id") as string)?.trim();
  const planId = (form.get("plan_id") as string)?.trim();
  const paid = (form.get("paid") as string) === "1";
  if (!itemId || !planId) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  await db
    .from("repayment_plan_items")
    .update({ status: paid ? "paid" : "open", paid_at: paid ? new Date().toISOString() : null })
    .eq("id", itemId);

  // Auto-complete the plan when every installment is paid.
  const { data: items } = await db
    .from("repayment_plan_items")
    .select("status")
    .eq("plan_id", planId)
    .returns<{ status: string }[]>();
  const allPaid = (items ?? []).length > 0 && (items ?? []).every((i) => i.status === "paid");
  await db
    .from("repayment_plans")
    .update({ status: allPaid ? "completed" : "active" })
    .eq("id", planId);

  revalidatePath(`/admin/repayment-plans/${planId}`);
  revalidatePath("/admin/repayment-plans");
}

/** Cancel or reactivate a plan. */
export async function setPlanStatus(form: FormData) {
  const { profile } = await requireProfile("/admin/repayment-plans");
  if (!isStaff(profile)) return;

  const planId = (form.get("plan_id") as string)?.trim();
  const status = (form.get("status") as string)?.trim();
  if (!planId || !["active", "cancelled", "completed"].includes(status)) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("repayment_plans").update({ status }).eq("id", planId);

  revalidatePath(`/admin/repayment-plans/${planId}`);
  revalidatePath("/admin/repayment-plans");
}
