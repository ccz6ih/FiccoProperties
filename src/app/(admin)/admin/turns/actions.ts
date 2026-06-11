"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type TemplateItem = { label: string; sort: number };

/**
 * Start a make-ready turn for a unit from a template. Copies the template's
 * items into per-turn tasks, flips the unit to make_ready, and redirects to
 * the new turn.
 */
export async function startTurn(form: FormData) {
  const unitId = form.get("unit_id") as string;
  const templateId = form.get("template_id") as string;
  if (!unitId || !templateId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const db = supabase as unknown as SupabaseClient;

  const { data: turn } = await db
    .from("makeready_turns")
    .insert({
      unit_id: unitId,
      template_id: templateId,
      started_by: user?.id ?? null,
      status: "open",
    })
    .select("id")
    .single();

  if (!turn) return;

  const { data: items } = await db
    .from("makeready_template_items")
    .select("label, sort")
    .eq("template_id", templateId)
    .order("sort", { ascending: true })
    .returns<TemplateItem[]>();

  if (items && items.length > 0) {
    await db.from("makeready_tasks").insert(
      items.map((it) => ({
        turn_id: turn.id,
        label: it.label,
        sort: it.sort,
      }))
    );
  }

  // Reflect the turnover on the unit.
  await supabase.from("units").update({ status: "make_ready" }).eq("id", unitId);

  revalidatePath("/admin/turns");
  revalidatePath(`/admin/units/${unitId}`);
  redirect(`/admin/turns/${turn.id}`);
}

export async function toggleTask(form: FormData) {
  const taskId = form.get("task_id") as string;
  const turnId = form.get("turn_id") as string;
  const done = form.get("done") === "true";
  if (!taskId || !turnId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const db = supabase as unknown as SupabaseClient;

  await db
    .from("makeready_tasks")
    .update({
      done,
      done_by: done ? user?.id ?? null : null,
      done_at: done ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  // First task checked nudges an open turn into progress.
  if (done) {
    await db
      .from("makeready_turns")
      .update({ status: "in_progress" })
      .eq("id", turnId)
      .eq("status", "open");
  }

  revalidatePath(`/admin/turns/${turnId}`);
}

export async function setTurnStatus(form: FormData) {
  const turnId = form.get("turn_id") as string;
  const status = form.get("status") as string;
  if (!turnId || !["open", "in_progress", "blocked", "complete"].includes(status)) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db
    .from("makeready_turns")
    .update({
      status,
      completed_at: status === "complete" ? new Date().toISOString() : null,
    })
    .eq("id", turnId);

  revalidatePath(`/admin/turns/${turnId}`);
  revalidatePath("/admin/turns");
}

/**
 * Complete a turn: only allowed when every task is done. Marks the unit
 * available again.
 */
export async function completeTurn(form: FormData) {
  const turnId = form.get("turn_id") as string;
  if (!turnId) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { count: remaining } = await db
    .from("makeready_tasks")
    .select("id", { count: "exact", head: true })
    .eq("turn_id", turnId)
    .eq("done", false);

  if ((remaining ?? 0) > 0) return;

  const { data: turn } = await db
    .from("makeready_turns")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", turnId)
    .select("unit_id")
    .single<{ unit_id: string | null }>();

  if (turn?.unit_id) {
    await supabase.from("units").update({ status: "available" }).eq("id", turn.unit_id);
    revalidatePath(`/admin/units/${turn.unit_id}`);
  }

  revalidatePath(`/admin/turns/${turnId}`);
  revalidatePath("/admin/turns");
}
