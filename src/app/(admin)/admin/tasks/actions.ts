"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { notifyWorkLogged } from "@/lib/work-notify";

export type TaskState = { ok: boolean; error?: string };

function str(v: FormDataEntryValue | null): string | null {
  const s = ((v as string) ?? "").trim();
  return s || null;
}

const CATEGORIES = new Set([
  "repair", "cleaning", "trash", "fence", "landscaping",
  "emergency", "inspection", "admin", "extra", "other",
]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const STATUSES = new Set(["todo", "in_progress", "done", "cancelled"]);

/** Create a staff task. */
export async function createTask(
  _prev: TaskState,
  form: FormData
): Promise<TaskState> {
  const { user, profile } = await requireProfile("/admin/tasks");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const title = str(form.get("title"));
  if (!title) return { ok: false, error: "Give the task a title." };

  const category = str(form.get("category")) ?? "other";
  const priority = str(form.get("priority")) ?? "normal";

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const assigneeId = str(form.get("assignee_id"));
  const unitId = str(form.get("unit_id"));
  const propertyId = str(form.get("property_id"));
  const dueDate = str(form.get("due_date"));
  const details = str(form.get("details"));
  const finalCategory = CATEGORIES.has(category) ? category : "other";
  const finalPriority = PRIORITIES.has(priority) ? priority : "normal";

  const { data: created, error } = await db
    .from("tasks")
    .insert({
      title,
      details,
      category: finalCategory,
      priority: finalPriority,
      assignee_id: assigneeId,
      property_id: propertyId,
      unit_id: unitId,
      due_date: dueDate,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !created) return { ok: false, error: "Could not create the task." };

  // Tasks used to notify nobody, so one assigned to someone lived only on a
  // board they had to remember to open. Best-effort — the task is already saved.
  try {
    const [assignee, property] = await Promise.all([
      assigneeId
        ? db.from("profiles").select("full_name, email").eq("id", assigneeId)
            .maybeSingle<{ full_name: string | null; email: string | null }>()
        : Promise.resolve({ data: null }),
      propertyId && !unitId
        ? db.from("properties").select("name").eq("id", propertyId)
            .maybeSingle<{ name: string | null }>()
        : Promise.resolve({ data: null }),
    ]);
    await notifyWorkLogged({
      kind: "task",
      id: created.id,
      title,
      details,
      category: finalCategory,
      priority: finalPriority,
      unitId,
      propertyName: property.data?.name ?? null,
      dueDate,
      assigneeName: assignee.data?.full_name ?? assignee.data?.email ?? null,
    });
  } catch {
    /* the task is saved; the alert is best-effort */
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/admin/work");
  return { ok: true };
}

/** Move a task to a new status (done stamps completed_at). */
export async function setTaskStatus(form: FormData): Promise<void> {
  const { user, profile } = await requireProfile("/admin/tasks");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  const status = str(form.get("status"));
  if (!id || !status || !STATUSES.has(status)) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  // Read the task first so we can (a) tell whether this is a fresh completion
  // and (b) copy it into the unit's maintenance log when it's tied to a unit.
  const { data: prev } = await db
    .from("tasks")
    .select("status, unit_id, title, details")
    .eq("id", id)
    .maybeSingle<{ status: string; unit_id: string | null; title: string; details: string | null }>();

  await db
    .from("tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  // First time a unit-tagged task is completed → drop a maintenance entry into
  // that unit's log so it keeps a permanent history.
  if (status === "done" && prev && prev.status !== "done" && prev.unit_id) {
    const { data: occ } = await supabase
      .from("unit_occupancy")
      .select("occupant_profile_id")
      .eq("unit_id", prev.unit_id)
      .maybeSingle<{ occupant_profile_id: string | null }>();

    const body = prev.details ? `${prev.title} — ${prev.details}` : prev.title;
    await db.from("unit_log_entries").insert({
      unit_id: prev.unit_id,
      resident_id: occ?.occupant_profile_id ?? null,
      kind: "maintenance",
      body: `Task completed: ${body}`,
      performed_on: new Date().toISOString().slice(0, 10),
      cost_cents: null,
      author_id: user.id,
    });
    revalidatePath(`/admin/units/${prev.unit_id}`);
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/admin");
}

/** Delete a task. */
export async function deleteTask(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/tasks");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  if (!id) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("tasks").delete().eq("id", id);

  revalidatePath("/admin/tasks");
}
