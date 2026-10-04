"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { notifyWorkLogged } from "@/lib/work-notify";
import { matchesTerms, splitTerms } from "@/lib/search-match";

export type LogWorkState = { ok: boolean; error?: string; notice?: string };

/** Words too common to mean two jobs are the same. */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "in", "on", "at", "to", "of", "is", "it",
  "not", "for", "with", "new", "fix", "unit", "replace", "repair", "need",
  "needs", "please", "some", "very", "my",
]);

/**
 * Log work against a home, choosing which kind it is.
 *
 * Both boards could already create things, which is exactly how one problem
 * ended up logged twice — the Unit 5 faucet is a maintenance request AND a
 * task. Starting from the home, with the choice made explicitly and open work
 * on that home checked for overlap first, is what stops that happening again.
 */
export async function logWorkForUnit(
  _prev: LogWorkState,
  form: FormData
): Promise<LogWorkState> {
  const { user, profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = (form.get("unit_id") as string)?.trim();
  const title = (form.get("title") as string)?.trim();
  const kind = (form.get("kind") as string)?.trim() === "task" ? "task" : "maintenance";
  if (!unitId || !title) return { ok: false, error: "Give it a title." };

  const details = (form.get("details") as string)?.trim() || null;
  const category = (form.get("category") as string)?.trim() || (kind === "task" ? "repair" : "general");
  const priority = (form.get("priority") as string)?.trim() || "normal";
  const dueDate = (form.get("due_date") as string)?.trim() || null;
  const ignoreDuplicate = form.get("ignore_duplicate") === "on";

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  // Look for open work on this home that sounds like the same thing. Refusing
  // outright would be wrong — a home can genuinely have two toilet problems —
  // so this asks once and takes "yes, it's different" for an answer.
  if (!ignoreDuplicate) {
    const terms = splitTerms(title).filter((t) => t.length > 2 && !STOPWORDS.has(t));
    if (terms.length > 0) {
      const [{ data: openMaint }, { data: openTasks }] = await Promise.all([
        db
          .from("maintenance_requests")
          .select("title, created_at")
          .eq("unit_id", unitId)
          .in("status", ["open", "in_progress", "on_hold"])
          .returns<{ title: string; created_at: string }[]>(),
        db
          .from("tasks")
          .select("title, created_at")
          .eq("unit_id", unitId)
          .in("status", ["todo", "in_progress"])
          .returns<{ title: string; created_at: string }[]>(),
      ]);
      const existing = [
        ...(openMaint ?? []).map((m) => ({ ...m, what: "maintenance request" })),
        ...(openTasks ?? []).map((t) => ({ ...t, what: "task" })),
      ];
      // Any significant word in common is enough to be worth a second look.
      const hit = existing.find((e) =>
        terms.some((t) => matchesTerms(e.title, [t]))
      );
      if (hit) {
        const when = new Date(hit.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        return {
          ok: false,
          error: `There's already an open ${hit.what} on this home that sounds similar — “${hit.title}” from ${when}. Tick "log it anyway" if this is a different job.`,
        };
      }
    }
  }

  let newId: string | null = null;

  if (kind === "maintenance") {
    const { data, error } = await db
      .from("maintenance_requests")
      .insert({
        unit_id: unitId,
        created_by: user.id,
        title,
        description: details,
        category,
        priority,
        status: "open",
      })
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error || !data) return { ok: false, error: "Could not log the work." };
    newId = data.id;
  } else {
    const { data, error } = await db
      .from("tasks")
      .insert({
        unit_id: unitId,
        title,
        details,
        category,
        priority,
        due_date: dueDate,
        assignee_id: user.id,
        created_by: user.id,
      })
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error || !data) return { ok: false, error: "Could not log the work." };
    newId = data.id;
  }

  try {
    await notifyWorkLogged({
      kind,
      id: newId,
      title,
      details,
      category,
      priority,
      unitId,
      dueDate,
      assigneeName: kind === "task" ? profile!.full_name ?? null : null,
    });
  } catch {
    /* saved either way */
  }

  revalidatePath(`/admin/units/${unitId}`);
  revalidatePath("/admin/work");
  revalidatePath(kind === "maintenance" ? "/admin/maintenance" : "/admin/tasks");

  return {
    ok: true,
    notice:
      kind === "maintenance"
        ? "Logged as a maintenance request — the resident can see it and follow it."
        : "Logged as an office task — internal only.",
  };
}
