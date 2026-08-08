"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";

const STATUSES = new Set(["active", "contacted", "converted", "closed"]);

/** Move a waitlist entry through the pipeline. */
export async function setWaitlistStatus(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/waitlist");
  if (!isStaff(profile)) return;

  const id = (form.get("id") as string)?.trim();
  const status = (form.get("status") as string)?.trim();
  if (!id || !STATUSES.has(status)) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("waitlist_entries").update({ status }).eq("id", id);
  revalidatePath("/admin/waitlist");
}

/** Remove an entry entirely. */
export async function deleteWaitlistEntry(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/waitlist");
  if (!isStaff(profile)) return;

  const id = (form.get("id") as string)?.trim();
  if (!id) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("waitlist_entries").delete().eq("id", id);
  revalidatePath("/admin/waitlist");
}
