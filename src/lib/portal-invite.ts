import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/email";
import { RENT_DROPBOX } from "@/lib/rent-dropbox";

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

/**
 * "Welcome to the community" email sent when a resident's account is linked to
 * their home. Confirms what happened and walks them through the first things to
 * do in the portal. Ends with a one-click sign-in link.
 */
export async function sendResidentWelcome(opts: {
  email: string;
  fullName: string | null;
  homeLabel: string | null;
}): Promise<void> {
  const greeting = opts.fullName?.split(" ")[0] ?? "there";
  const link = await signInLink(opts.email, "/portal/tenancy");
  const home = opts.homeLabel ? ` at <strong>${opts.homeLabel}</strong>` : "";

  const step = (n: number, title: string, body: string, href: string) =>
    `<tr>
      <td style="vertical-align:top;padding:0 12px 14px 0"><div style="width:26px;height:26px;border-radius:13px;background:#2f5d50;color:#fff;font-weight:700;font-size:13px;text-align:center;line-height:26px">${n}</div></td>
      <td style="padding:0 0 14px">
        <a href="${BASE_URL}${href}" style="color:#2f5d50;font-weight:600;text-decoration:none;font-size:15px">${title}</a>
        <div style="font-size:13px;color:#6f655a;margin-top:2px">${body}</div>
      </td>
    </tr>`;

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#2c2622;font-size:15px;line-height:1.65">
    <div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#2f5d50;margin-bottom:4px">38th Ave Properties</div>
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#2c2622;margin:14px 0 6px">Welcome to the community, ${greeting} 🏡</div>
    <p style="margin:0 0 16px">Your resident portal account is now linked to your home${home}. Everything about your tenancy lives in one place — here are a few things to get started.</p>

    <table role="presentation" style="border-collapse:collapse;width:100%;margin:4px 0 6px">
      ${step(1, "Review &amp; sign your lease", "View your lease terms and add your signature and initials.", "/portal/lease")}
      ${step(2, "Read the house rules", "A quick guide to caring for your home and community — please acknowledge when done.", "/portal/guide")}
      ${step(3, "Request maintenance anytime", "Something need fixing? Submit a request and track it to done.", "/portal/maintenance")}
      ${step(4, "Pay your rent", "See your balance and history. Rent is due the 1st each month.", "/portal/payments")}
      ${step(5, "Message the team", "Questions? Reach us right from the portal.", "/portal/messages")}
    </table>

    <div style="border:1px solid #e6dcc8;border-radius:10px;padding:12px 16px;margin:14px 0">
      <div style="font-size:11px;color:#9b9286;text-transform:uppercase;letter-spacing:.04em">Rent drop box (check or money order)</div>
      <div style="font-size:14px;font-weight:600;color:#2c2622">${RENT_DROPBOX.full}</div>
      <div style="font-size:13px;color:#2c2622;margin-top:3px">Make checks / money orders payable to <strong>${RENT_DROPBOX.payee}</strong>.</div>
      <div style="font-size:12px;color:#9b9286">Please write your unit number on your payment.</div>
    </div>

    <div style="margin:20px 0 8px">
      <a href="${link}" style="display:inline-block;background:#2f5d50;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:8px">Open your resident portal →</a>
    </div>

    <p style="margin:14px 0 0;font-size:12px;color:#9b9286">We're glad you're here. Reply to this email or call ${RENT_DROPBOX.phone} anytime.<br/>38th Ave Properties · Wheat Ridge, CO · Equal Housing Opportunity</p>
  </div>`;

  await sendNotification({
    to: opts.email,
    subject: "Welcome to your 38th Ave Properties resident portal",
    html,
  });
}
