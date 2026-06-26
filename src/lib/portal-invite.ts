import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/email";

const BASE_URL = "https://38thaveproperties.com";

/**
 * Build a one-click sign-in link that lands the user signed in on `next`.
 * Routes through /auth/confirm so the SSR session cookie is actually set
 * (Supabase's default token-hash link only sets a client-side session). Falls
 * back to the login page if a link can't be generated.
 */
export async function signInLink(email: string, next: string): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${BASE_URL}${next}` },
    });
    const tokenHash = data?.properties?.hashed_token;
    if (tokenHash) {
      return `${BASE_URL}/auth/confirm?token_hash=${encodeURIComponent(
        tokenHash
      )}&type=magiclink&next=${encodeURIComponent(next)}`;
    }
  } catch {
    // fall through to the login page
  }
  return `${BASE_URL}/login`;
}

/**
 * Email standard email + password sign-in credentials. The most reliable path:
 * the resident signs in at /login (which sets the SSR cookie session normally),
 * with no dependence on magic links or Supabase's own emails.
 */
export async function emailLoginCredentials(
  email: string,
  fullName: string | null,
  tempPassword: string
): Promise<void> {
  const greeting = fullName?.split(" ")[0] ?? "there";
  await sendNotification({
    to: email,
    replyTo: "hello@38thaveproperties.com",
    subject: "Your 38th Ave Properties resident portal login",
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;color:#2c2622;font-size:15px;line-height:1.7"><div style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#2f5d50;margin-bottom:12px">Welcome to your resident portal, ${greeting}</div><p>Your portal is where you can review and sign your lease, pay rent, request maintenance, and message our team.</p><div style="background:#faf7f1;border:1px solid #e6dcc8;border-radius:12px;padding:16px;margin:18px 0"><p style="margin:0 0 8px;font-weight:600">How to sign in:</p><ol style="margin:0;padding-left:20px"><li style="margin-bottom:6px">Go to <a href="${BASE_URL}/login" style="color:#2f5d50;font-weight:600">38thaveproperties.com/login</a></li><li style="margin-bottom:6px">Email: <strong>${email}</strong></li><li style="margin-bottom:6px">Temporary password: <strong>${tempPassword}</strong></li></ol></div><p style="font-size:13px;color:#6f655a">Once you're in, you can set your own password from “Forgot password?” on the sign-in page, or just keep using this one. Reply to this email if you need a hand.</p><p style="margin-top:18px;color:#6f655a;font-size:14px">— The 38th Ave Properties team</p></div>`,
  });
}

/**
 * Set a fresh temporary password on an existing account and email it. Use to
 * (re)grant a resident portal access when they can't get in. Returns false if
 * the password could not be set.
 */
export async function resetPortalPassword(
  userId: string,
  email: string,
  fullName: string | null
): Promise<boolean> {
  const admin = createAdminClient();
  const tempPassword = `38thAve-${crypto.randomUUID().slice(0, 8)}`;
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
    email_confirm: true,
  });
  if (error) return false;
  await emailLoginCredentials(email, fullName, tempPassword);
  return true;
}
