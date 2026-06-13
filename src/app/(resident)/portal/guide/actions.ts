"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

/** Record that the resident has read & acknowledged the house rules. */
export async function acknowledgeRules(): Promise<void> {
  const { user } = await requireProfile("/portal/guide");
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db
    .from("profiles")
    .update({ house_rules_ack_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/portal/guide");
  revalidatePath("/portal");
}
