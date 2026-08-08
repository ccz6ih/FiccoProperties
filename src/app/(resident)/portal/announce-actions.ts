"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Resident taps "Got it" — records the read receipt (RLS: own row only). */
export async function acknowledgeAnnouncement(form: FormData): Promise<void> {
  const id = (form.get("announcement_id") as string)?.trim();
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Plain insert (not upsert): RLS only grants INSERT, and a duplicate just
  // means they already acknowledged — safe to ignore.
  const db = supabase as unknown as SupabaseClient;
  await db
    .from("announcement_receipts")
    .insert({ announcement_id: id, profile_id: user.id });

  revalidatePath("/portal");
}
