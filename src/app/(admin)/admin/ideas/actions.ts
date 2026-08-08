"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";

export type IdeaAdminState = { ok: boolean; error?: string };

const STATUSES = new Set(["new", "considering", "planned", "done", "not_now"]);

/** Save status + owner reply (and moderation flag) on an idea. */
export async function updateIdea(
  _prev: IdeaAdminState,
  form: FormData
): Promise<IdeaAdminState> {
  const { profile } = await requireProfile("/admin/ideas");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const id = (form.get("id") as string)?.trim();
  if (!id) return { ok: false, error: "Missing idea." };

  const statusRaw = (form.get("status") as string)?.trim() ?? "new";
  const reply = (form.get("staff_reply") as string)?.trim() || null;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { error } = await db
    .from("community_posts")
    .update({
      status: STATUSES.has(statusRaw) ? statusRaw : "new",
      staff_reply: reply,
      staff_reply_at: reply ? new Date().toISOString() : null,
      hidden: form.get("hidden") === "on",
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Could not save." };

  revalidatePath("/admin/ideas");
  revalidatePath("/portal/ideas");
  return { ok: true };
}

/** Delete an idea outright (spam etc.). */
export async function deleteIdea(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/ideas");
  if (!isStaff(profile)) return;
  const id = (form.get("id") as string)?.trim();
  if (!id) return;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("community_posts").delete().eq("id", id);
  revalidatePath("/admin/ideas");
  revalidatePath("/portal/ideas");
}
