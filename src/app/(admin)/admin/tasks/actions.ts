"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";

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

  const { error } = await db.from("tasks").insert({
    title,
    details: str(form.get("details")),
    category: CATEGORIES.has(category) ? category : "other",
    priority: PRIORITIES.has(priority) ? priority : "normal",
    assignee_id: str(form.get("assignee_id")),
    property_id: str(form.get("property_id")),
    unit_id: str(form.get("unit_id")),
    due_date: str(form.get("due_date")),
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Could not create the task." };

  revalidatePath("/admin/tasks");
  return { ok: true };
}

/** Move a task to a new status (done stamps completed_at). */
export async function setTaskStatus(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/tasks");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  const status = str(form.get("status"));
  if (!id || !status || !STATUSES.has(status)) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db
    .from("tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id);

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
