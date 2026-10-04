"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { raiseDueRecurringWork } from "@/lib/recurring-work";

export type RecurringState = { ok: boolean; error?: string; notice?: string };

const str = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
};

/** Add a recurring job. Months come in as a set of checkboxes. */
export async function createRecurring(
  _prev: RecurringState,
  form: FormData
): Promise<RecurringState> {
  const { user, profile } = await requireProfile("/admin/recurring");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const title = str(form.get("title"));
  if (!title) return { ok: false, error: "Give it a name." };

  const months = form
    .getAll("months")
    .map((m) => Number(m))
    .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
  if (months.length === 0) return { ok: false, error: "Pick at least one month." };

  const dayOfMonth = Number(form.get("day_of_month")) || 1;
  const leadDays = Number(form.get("lead_days"));

  // A home and a community are alternatives, not both — a job on a home is
  // already at that community.
  const unitId = str(form.get("unit_id"));
  const propertyId = unitId ? null : str(form.get("property_id"));
  if (!unitId && !propertyId) {
    return { ok: false, error: "Choose a community or a home." };
  }

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { error } = await db.from("recurring_work").insert({
    title,
    details: str(form.get("details")),
    kind: str(form.get("kind")) === "maintenance" && unitId ? "maintenance" : "task",
    category: str(form.get("category")) ?? "other",
    priority: str(form.get("priority")) ?? "normal",
    property_id: propertyId,
    unit_id: unitId,
    assignee_id: str(form.get("assignee_id")),
    months,
    day_of_month: Math.min(28, Math.max(1, dayOfMonth)),
    lead_days: Number.isFinite(leadDays) ? Math.min(90, Math.max(0, leadDays)) : 7,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Could not save it." };

  revalidatePath("/admin/recurring");
  return { ok: true, notice: `“${title}” added.` };
}

/** Pause or resume one. Pausing keeps the history; deleting throws it away. */
export async function toggleRecurring(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/recurring");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  const active = form.get("active") === "true";
  if (!id) return;

  const supabase = await createClient();
  await (supabase as unknown as SupabaseClient)
    .from("recurring_work")
    .update({ active: !active })
    .eq("id", id);

  revalidatePath("/admin/recurring");
}

export async function deleteRecurring(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/recurring");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  if (!id) return;

  const supabase = await createClient();
  await (supabase as unknown as SupabaseClient).from("recurring_work").delete().eq("id", id);

  revalidatePath("/admin/recurring");
}

/**
 * Raise anything due right now rather than waiting for tomorrow's cron — for
 * when a schedule is added after its lead window has already opened.
 */
export async function raiseNow(): Promise<void> {
  const { profile } = await requireProfile("/admin/recurring");
  if (!isStaff(profile)) return;

  const supabase = await createClient();
  await raiseDueRecurringWork(supabase as unknown as SupabaseClient);

  revalidatePath("/admin/recurring");
  revalidatePath("/admin/work");
  revalidatePath("/admin/tasks");
}
