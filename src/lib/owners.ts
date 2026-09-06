import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Everyone who runs the place — owners AND admins — plus the NOTIFY_EMAIL
 * staff inbox, de-duplicated. Use for owner-facing alerts so the whole team is
 * reached, not just one inbox. Falls back to NOTIFY_EMAIL alone if nobody has
 * an email on file.
 *
 * Admins are included deliberately: they already see every screen and every
 * tenant's details in the app, so leaving them off the reports meant the
 * emails told them less than they could read for themselves. Anyone given the
 * admin role therefore also receives the owner reports.
 */
export async function getOwnerRecipients(): Promise<string[]> {
  const admin = createAdminClient() as unknown as SupabaseClient;
  const { data } = await admin
    .from("profiles")
    .select("email")
    .in("role", ["owner", "admin"])
    .not("email", "is", null)
    .returns<{ email: string | null }[]>();

  const owners = (data ?? []).map((r) => r.email?.trim()).filter(Boolean) as string[];
  const notify = (process.env.NOTIFY_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return [...new Set([...owners, ...notify])];
}
