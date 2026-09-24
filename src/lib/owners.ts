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

/**
 * Send one owner email PER recipient rather than a single message addressed to
 * everyone.
 *
 * A single transactional email with four To: addresses is a well-known spam
 * signal — it is how bulk mail looks — and the owners here are on AOL, Yahoo
 * and Gmail, which are the strictest about exactly that. It also put every
 * owner's address in front of the others, and gave one delivery result for
 * four people, so a single inbox quietly failing was invisible. Sent
 * individually, each gets its own delivery record.
 *
 * Returns how many were accepted.
 */
export async function sendToEachOwner(
  recipients: string[],
  message: { subject: string; html: string; meta?: Record<string, unknown> }
): Promise<{ accepted: number; failed: string[] }> {
  const { sendNotification } = await import("@/lib/email");
  let accepted = 0;
  const failed: string[] = [];
  for (const to of recipients) {
    const res = await sendNotification({
      to,
      subject: message.subject,
      html: message.html,
      meta: message.meta as never,
    });
    if (res.sent) accepted += 1;
    else failed.push(to);
  }
  return { accepted, failed };
}
