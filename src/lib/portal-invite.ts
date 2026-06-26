import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/email";

/**
 * Email a resident a one-click magic sign-in link to their portal, with
 * forgot-password instructions to set a password for future logins. Server-only.
 */
export async function emailPortalLogin(email: string, fullName: string | null): Promise<void> {
  const greeting = fullName?.split(" ")[0] ?? "there";
  const portal = "https://38thaveproperties.com/portal";

  let link = "https://38thaveproperties.com/login";
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: portal },
    });
    if (data?.properties?.action_link) link = data.properties.action_link;
  } catch {
    // fall back to the login page + forgot-password instructions
  }

  await sendNotification({
    to: email,
    replyTo: "hello@38thaveproperties.com",
    subject: "Your 38th Ave Properties resident portal",
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;color:#2c2622;font-size:15px;line-height:1.7"><div style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#2f5d50;margin-bottom:12px">Welcome to your resident portal, ${greeting}</div><p>Your portal is where you can review and sign your lease, pay rent, request maintenance, and message our team.</p><p style="margin:22px 0"><a href="${link}" style="background:#2f5d50;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:9999px;display:inline-block">Open your resident portal →</a></p><p style="font-size:13px;color:#6f655a">This secure link signs you in. To set a password for next time, go to <a href="https://38thaveproperties.com/login" style="color:#2f5d50;font-weight:600">38thaveproperties.com/login</a> with <strong>${email}</strong> and use “Forgot password?”.</p><p style="margin-top:18px;color:#6f655a;font-size:14px">— The 38th Ave Properties team</p></div>`,
  });
}
