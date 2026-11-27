/**
 * "Forgot password?" without depending on Supabase Auth's mail server.
 *
 * Supabase sends its own auth emails (recovery, invite, confirmation) through
 * SMTP settings configured in the Supabase dashboard — a completely separate
 * configuration from the app's transport in lib/email-transport.ts. When those
 * two drifted apart, every reset failed with a bare "Error sending recovery
 * email" while the rest of the app's mail went out perfectly, and the resident
 * had no way to tell anyone useful what they were seeing.
 *
 * Johana Torres-Gallardo at The Villa Unit 2 is the case that surfaced it: she
 * had moved in and simply could not get into her portal.
 *
 * So the link is generated through the admin API — which does NOT send mail and
 * therefore keeps working whatever Supabase's SMTP is doing — and delivered
 * through the same transport as every other email the app sends. One mail path,
 * one place to fix, and it lands in email_log like everything else.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/email";

const BASE_URL = "https://38thaveproperties.com";

/** Resets accepted for one address in an hour before we stop sending. */
const MAX_PER_HOUR = 3;

/**
 * Have we already sent this address its share of reset emails?
 *
 * Counts what was actually sent rather than what was asked for, so a burst of
 * rate-limited attempts can't itself lock someone out. Best-effort: if the log
 * can't be read we let the email through, because a resident locked out of
 * their home's portal is the worse failure.
 */
async function withinRateLimit(db: SupabaseClient, email: string): Promise<boolean> {
  try {
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await db
      .from("email_log")
      .select("id", { count: "exact", head: true })
      .ilike("to_email", email)
      .eq("kind", "password_reset")
      .gte("created_at", hourAgo);
    return (count ?? 0) < MAX_PER_HOUR;
  } catch {
    return true;
  }
}

function resetEmailHtml(link: string, greeting: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#2c2622;font-size:16px;line-height:1.65">
    <div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#2f5d50">38th Ave Properties</div>

    <div style="font-family:Georgia,serif;font-size:23px;font-weight:600;color:#2c2622;margin:16px 0 8px">
      Set a new password, ${greeting}
    </div>
    <p style="margin:0 0 18px">Someone asked to reset the password for your resident portal. If that was you, use the button below and you'll be asked to choose a new one.</p>

    <div style="margin:20px 0 12px">
      <a href="${link}" style="display:inline-block;background:#2f5d50;color:#fff;text-decoration:none;font-size:17px;font-weight:600;padding:15px 28px;border-radius:10px">Choose a new password →</a>
    </div>

    <p style="margin:0 0 18px;font-size:14px;color:#9b9286">This link works once and expires in about an hour. If it's expired by the time you get to it, just ask for another from the sign-in page.</p>

    <p style="margin:0;font-size:15px;color:#6f655a">If you didn't ask for this, you can ignore this email — your password hasn't changed. Any trouble at all, just reply and we'll sort it out.</p>
    <p style="margin:16px 0 0;font-size:12px;color:#9b9286">38th Ave Properties · Wheat Ridge, CO · Equal Housing Opportunity</p>
  </div>`;
}

/**
 * Email a password-reset link, through the app's own transport.
 *
 * Always resolves, and never reports whether the address has an account: the
 * sign-in page says the same thing either way, so this cannot be used to find
 * out who holds an account here.
 */
export async function sendPasswordReset(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) return;

  const admin = createAdminClient();
  const db = admin as unknown as SupabaseClient;

  if (!(await withinRateLimit(db, email))) return;

  // Generates the token WITHOUT sending anything. This is the step that keeps
  // working when Supabase's own SMTP is misconfigured.
  let hashedToken: string | null = null;
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${BASE_URL}/auth/reset` },
    });
    if (error) return; // no such account — say nothing
    hashedToken = data?.properties?.hashed_token ?? null;
  } catch {
    return;
  }
  if (!hashedToken) return;

  // Route through /auth/confirm so the SSR session cookie is set server-side.
  // Supabase's own token-hash link only establishes a client-side session, and
  // the reset page reads the user on the server — which is how people ended up
  // on a "Set a new password" page that didn't know who they were.
  const link = `${BASE_URL}/auth/confirm?token_hash=${encodeURIComponent(
    hashedToken
  )}&type=recovery&next=${encodeURIComponent("/auth/reset")}`;

  let greeting = "there";
  try {
    const { data: profile } = await db
      .from("profiles")
      .select("full_name")
      .ilike("email", email)
      .maybeSingle<{ full_name: string | null }>();
    const first = profile?.full_name?.trim().split(/\s+/)[0];
    if (first) greeting = first;
  } catch {
    /* a generic greeting is fine */
  }

  await sendNotification({
    to: email,
    subject: "Reset your 38th Ave Properties password",
    meta: { kind: "password_reset" },
    html: resetEmailHtml(link, greeting),
  });
}
