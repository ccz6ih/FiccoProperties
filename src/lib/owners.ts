import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Every owner's email, plus the NOTIFY_EMAIL staff inbox — de-duplicated. Use
 * for owner-facing alerts so all owners are reached, not just one inbox. Falls
 * back to NOTIFY_EMAIL alone if no owner accounts have emails.
 */
export async function getOwnerRecipients(): Promise<string[]> {
  const admin = createAdminClient() as unknown as SupabaseClient;
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("role", "owner")
    .not("email", "is", null)
    .returns<{ email: string | null }[]>();

  const owners = (data ?? []).map((r) => r.email?.trim()).filter(Boolean) as string[];
  const notify = (process.env.NOTIFY_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return [...new Set([...owners, ...notify])];
}
