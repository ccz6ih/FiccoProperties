"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";

/**
 * Closing a loop from the list it appears on.
 *
 * The work was nearly always already done — what didn't happen was the record
 * catching up, because marking it meant remembering which of six screens owned
 * it. So the button lives next to the thing it closes, and each action does
 * exactly one small, reversible thing.
 */

const stamp = () => new Date().toISOString().slice(0, 10);

/** A notice that's been paid or put right. */
export async function markNoticeCured(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/follow-ups");
  if (!isStaff(profile)) return;

  const id = (form.get("notice_id") as string)?.trim();
  if (!id) return;

  const db = createAdminClient() as unknown as SupabaseClient;
  await db.from("notices").update({ status: "cured" }).eq("id", id);

  // Leave a trail on the home, so the case file still shows it happened.
  const { data: n } = await db
    .from("notices")
    .select("unit_id, type")
    .eq("id", id)
    .maybeSingle<{ unit_id: string | null; type: string }>();
  if (n?.unit_id) {
    await db.from("unit_log_entries").insert({
      unit_id: n.unit_id,
      kind: "notice",
      body: `${n.type.replace(/_/g, " ")} marked cured on ${stamp()} — resolved, no further action.`,
    });
    revalidatePath(`/admin/units/${n.unit_id}`);
  }

  revalidatePath("/admin/follow-ups");
  revalidatePath("/admin/notices");
  revalidatePath("/admin");
}

/** A deposit that's been returned. */
export async function markDepositSettled(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/follow-ups");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  if (!unitId) return;

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: existing } = await db
    .from("deposit_settlements")
    .select("notes, deposit_cents")
    .eq("unit_id", unitId)
    .maybeSingle<{ notes: string | null; deposit_cents: number | null }>();

  const { data: past } = await db
    .from("tenancy_history")
    .select("deposit_cents")
    .eq("unit_id", unitId)
    .order("move_out_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ deposit_cents: number | null }>();

  // Says plainly that the amount is assumed to be the full deposit — if any of
  // it was withheld, that belongs on the itemised statement, not here.
  const note = `Returned in full and confirmed from the follow-ups list on ${stamp()}. No deductions recorded — if any were taken, itemise them on this statement.`;

  await db.from("deposit_settlements").upsert(
    {
      unit_id: unitId,
      deposit_cents: existing?.deposit_cents ?? past?.deposit_cents ?? 0,
      status: "finalized",
      notes: existing?.notes ? `${existing.notes}\n\n${note}` : note,
      updated_by: profile!.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "unit_id" }
  );

  revalidatePath("/admin/follow-ups");
  revalidatePath(`/admin/move-out/${unitId}`);
  revalidatePath("/admin");
}

/** A make-ready whose work is finished. */
export async function markTurnComplete(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/follow-ups");
  if (!isStaff(profile)) return;

  const turnId = (form.get("turn_id") as string)?.trim();
  if (!turnId) return;

  // The day the work was FINISHED, not the day it got ticked. These drift —
  // a turn finished on the 10th and ticked on the 31st reported three extra
  // weeks of vacancy — and the vacancy figures in the owners' reports are
  // built off this date.
  const on = (form.get("completed_on") as string)?.trim();
  const completedAt = /^\d{4}-\d{2}-\d{2}$/.test(on)
    ? `${on}T17:00:00Z`
    : new Date().toISOString();

  const db = createAdminClient() as unknown as SupabaseClient;
  await db
    .from("makeready_turns")
    .update({ status: "complete", completed_at: completedAt })
    .eq("id", turnId);

  const { data: t } = await db
    .from("makeready_turns")
    .select("unit_id")
    .eq("id", turnId)
    .maybeSingle<{ unit_id: string }>();
  if (t?.unit_id) revalidatePath(`/admin/units/${t.unit_id}`);

  revalidatePath("/admin/follow-ups");
  revalidatePath("/admin");
}
