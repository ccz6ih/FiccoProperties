"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendNotification, notificationHtml } from "@/lib/email";

export type IdeaState = { ok: boolean; error?: string };

const CATEGORIES = new Set(["upgrade", "fix", "event", "idea"]);

/** Resident posts an idea to the community board. */
export async function postIdea(_prev: IdeaState, form: FormData): Promise<IdeaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const title = (form.get("title") as string)?.trim();
  if (!title) return { ok: false, error: "Give your idea a short title." };
  const body = (form.get("body") as string)?.trim() || null;
  const categoryRaw = (form.get("category") as string) || "idea";
  const category = CATEGORIES.has(categoryRaw) ? categoryRaw : "idea";

  const db = supabase as unknown as SupabaseClient;
  const { data: inserted, error } = await db
    .from("community_posts")
    .insert({ author_id: user.id, title, body, category })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !inserted) return { ok: false, error: "Could not post your idea. Please try again." };

  // Author auto-votes their own idea — it starts at 1, not a lonely 0.
  await db.from("community_post_votes").insert({ post_id: inserted.id, profile_id: user.id });

  // Quiet heads-up to the office.
  await sendNotification({
    subject: `New community idea — ${title}`,
    html: notificationHtml("New idea on the community board", [
      ["Idea", title],
      ["Category", category],
      ["Review", "https://38thaveproperties.com/admin/ideas"],
    ]),
  });

  revalidatePath("/portal/ideas");
  return { ok: true };
}

/** Toggle the resident's +1 on an idea. */
export async function toggleVote(form: FormData): Promise<void> {
  const postId = (form.get("post_id") as string)?.trim();
  if (!postId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const db = supabase as unknown as SupabaseClient;
  const { data: existing } = await db
    .from("community_post_votes")
    .select("id")
    .eq("post_id", postId)
    .eq("profile_id", user.id)
    .maybeSingle<{ id: string }>();

  if (existing) {
    await db.from("community_post_votes").delete().eq("id", existing.id);
  } else {
    await db.from("community_post_votes").insert({ post_id: postId, profile_id: user.id });
  }

  revalidatePath("/portal/ideas");
}
