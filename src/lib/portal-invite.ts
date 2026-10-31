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
    // Tagged so it lands in email_log and the webhook can report back. A
    // silent bounce here is the worst kind: the resident can't get in and has
    // no way to tell us — which is exactly how Villa Victoria 16 lost six
    // weeks to a mistyped address.
    meta: { kind: "portal_login" },
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
    meta: { kind: "resident_welcome" },
    html,
  });
}

/**
 * "Here's what to bring when you sign."
 *
 * Sent the moment they pick their move-in day, because that's the moment the
 * number becomes knowable — and because the single most common new-resident
 * phone call is "how much do I owe and who do I make it out to?". Answering it
 * before it's asked is the whole point.
 *
 * The proration is spelled out rather than presented as a total. A part month
 * that isn't explained reads like a mistake.
 */
export async function sendMoveInStatement(opts: {
  email: string;
  fullName: string | null;
  homeLabel: string | null;
  moveInDate: string;
  /** "Prorated rent (5/30 days)", or null when they move in on the 1st. */
  prorationLabel: string | null;
  rentCents: number;
  depositCents: number;
  totalCents: number;
  firstFullMonthOn: string | null;
  monthlyRentCents: number | null;
}): Promise<void> {
  const greeting = opts.fullName?.split(" ")[0] ?? "there";
  const link = await signInLink(opts.email, "/portal/welcome");
  const money = (c: number) =>
    `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const day = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const line = (what: string, note: string, amount: number) =>
    `<tr>
      <td style="padding:11px 0;border-bottom:1px solid #e6dcc8">
        <div style="font-size:16px;color:#2c2622;font-weight:600">${what}</div>
        ${note ? `<div style="font-size:13px;color:#9b9286;margin-top:2px">${note}</div>` : ""}
      </td>
      <td style="padding:11px 0;border-bottom:1px solid #e6dcc8;text-align:right;font-size:17px;font-weight:600;color:#2c2622;white-space:nowrap">${money(amount)}</td>
    </tr>`;

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:580px;margin:0 auto;color:#2c2622;font-size:16px;line-height:1.65">
    <div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#2f5d50">38th Ave Properties</div>

    <div style="font-family:Georgia,serif;font-size:24px;font-weight:600;color:#2c2622;margin:16px 0 6px">
      You're moving in ${day(opts.moveInDate)} 🎉
    </div>
    <p style="margin:0 0 20px">Here's exactly what to bring${
      opts.homeLabel ? ` for <strong>${opts.homeLabel}</strong>` : ""
    }, ${greeting} — no surprises on the day.</p>

    <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:6px">
      ${line(
        "First month's rent",
        opts.prorationLabel
          ? `${opts.prorationLabel} — you only pay for the days you're actually here`
          : "",
        opts.rentCents
      )}
      ${opts.depositCents > 0 ? line("Security deposit", "Held, and returned when you move out", opts.depositCents) : ""}
      <tr>
        <td style="padding:14px 0 0;font-size:18px;font-weight:700;color:#2c2622">Total before keys</td>
        <td style="padding:14px 0 0;text-align:right;font-family:Georgia,serif;font-size:26px;font-weight:700;color:#2f5d50;white-space:nowrap">${money(opts.totalCents)}</td>
      </tr>
    </table>

    ${
      opts.firstFullMonthOn && opts.monthlyRentCents && opts.prorationLabel
        ? `<p style="margin:16px 0 0;font-size:15px;color:#6f655a">After that, rent is ${money(
            opts.monthlyRentCents
          )} on the 1st of each month, starting ${day(opts.firstFullMonthOn)}.</p>`
        : ""
    }

    <div style="background:#2f5d50;color:#fff;border-radius:14px;padding:20px;margin:22px 0">
      <div style="font-size:12px;color:rgba(255,255,255,.75);text-transform:uppercase;letter-spacing:.06em">How to pay it</div>
      <div style="font-size:19px;font-weight:700;margin:6px 0 8px">Check or money order, payable to<br>${RENT_DROPBOX.payee}</div>
      <div style="font-size:15px;line-height:1.6;color:rgba(255,255,255,.9)">
        Bring it with you when you come to sign the lease and collect your keys — Craig will
        be there to sign with you. If it's easier, two money orders are fine; just make sure
        they add up.
      </div>
      <div style="font-size:15px;line-height:1.6;color:rgba(255,255,255,.9);margin-top:10px">
        Or drop it at the office: <strong>${RENT_DROPBOX.full}</strong>. Write your unit number on it.
      </div>
    </div>

    <div style="margin:20px 0 10px">
      <a href="${link}" style="display:inline-block;background:#2f5d50;color:#fff;text-decoration:none;font-size:16px;font-weight:600;padding:13px 24px;border-radius:9px">See this in your portal →</a>
    </div>

    <p style="margin:14px 0 0;font-size:15px;color:#6f655a">Anything at all, call us on <strong style="color:#2c2622">${RENT_DROPBOX.phone}</strong> or reply to this email. We'll have the home open and ready for you.</p>
    <p style="margin:16px 0 0;font-size:12px;color:#9b9286">38th Ave Properties · Wheat Ridge, CO · Equal Housing Opportunity</p>
  </div>`;

  await sendNotification({
    to: opts.email,
    subject: `What to bring on move-in day — ${money(opts.totalCents)}`,
    meta: { kind: "move_in_statement" },
    html,
  });
}

/**
 * The first email a brand-new resident gets — before the lease, not after.
 *
 * The welcome above assumes a settled tenancy and lists nine things to explore.
 * Someone who hasn't signed yet needs the opposite: the three questions that
 * have to be answered, in order, and a single button. Everything else can wait
 * until they're in.
 */
export async function sendOnboardingInvite(opts: {
  email: string;
  fullName: string | null;
  homeLabel: string | null;
  rentCents: number | null;
  tempPassword?: string | null;
}): Promise<void> {
  const greeting = opts.fullName?.split(" ")[0] ?? "there";
  const link = await signInLink(opts.email, "/portal/welcome");
  const rent =
    opts.rentCents != null
      ? `$${(opts.rentCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
      : null;

  const step = (n: number, title: string, body: string) =>
    `<tr>
      <td style="vertical-align:top;padding:0 14px 16px 0"><div style="width:30px;height:30px;border-radius:15px;background:#2f5d50;color:#fff;font-weight:700;font-size:15px;text-align:center;line-height:30px">${n}</div></td>
      <td style="padding:0 0 16px">
        <div style="font-weight:600;font-size:17px;color:#2c2622">${title}</div>
        <div style="font-size:15px;color:#6f655a;margin-top:3px">${body}</div>
      </td>
    </tr>`;

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:580px;margin:0 auto;color:#2c2622;font-size:16px;line-height:1.65">
    <div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#2f5d50">38th Ave Properties</div>

    <div style="background:#2f5d50;color:#fff;border-radius:14px;padding:24px;margin:16px 0 20px">
      <div style="font-family:Georgia,serif;font-size:26px;font-weight:600">Your home is ready, ${greeting}</div>
      ${opts.homeLabel ? `<div style="font-size:17px;margin-top:6px;color:rgba(255,255,255,.85)">${opts.homeLabel}${rent ? ` · ${rent} a month` : ""}</div>` : ""}
    </div>

    <p style="margin:0 0 18px">Congratulations — your application was approved, and there&apos;s <strong>nothing more to apply for</strong>. Three quick things and the keys are yours:</p>

    <table role="presentation" style="border-collapse:collapse;width:100%;margin:0 0 6px">
      ${step(1, "Tell us how you'd like to pay rent", `Money order or check, made out to <strong>${RENT_DROPBOX.payee}</strong>. Paying online is coming soon.`)}
      ${step(2, "Confirm the day you're moving in", "So we have the keys cut and the home open and waiting.")}
      ${step(3, "Read and sign your lease", "Take your time with it, and ask us anything before you sign.")}
    </table>

    <div style="margin:22px 0 10px">
      <a href="${link}" style="display:inline-block;background:#2f5d50;color:#fff;text-decoration:none;font-size:17px;font-weight:600;padding:15px 28px;border-radius:10px">Start here →</a>
    </div>
    <p style="margin:0 0 20px;font-size:14px;color:#9b9286">That button signs you straight in — no password needed.${
      opts.tempPassword
        ? ` If you&apos;d rather sign in the usual way, your email is <strong>${opts.email}</strong> and your temporary password is <strong>${opts.tempPassword}</strong>.`
        : ""
    }</p>

    <div style="border:1px solid #e6dcc8;border-radius:12px;padding:16px 18px;margin:0 0 18px">
      <div style="font-size:11px;color:#9b9286;text-transform:uppercase;letter-spacing:.04em">Rent drop box</div>
      <div style="font-size:16px;font-weight:600;color:#2c2622;margin-top:2px">${RENT_DROPBOX.full}</div>
      <div style="font-size:15px;color:#2c2622;margin-top:4px">Checks and money orders payable to <strong>${RENT_DROPBOX.payee}</strong>. Write your unit number on it.</div>
    </div>

    <p style="margin:0;font-size:15px;color:#6f655a">Anything at all, call us on <strong style="color:#2c2622">${RENT_DROPBOX.phone}</strong> or just reply to this email. We&apos;re glad you&apos;re here.</p>
    <p style="margin:16px 0 0;font-size:12px;color:#9b9286">38th Ave Properties · Wheat Ridge, CO · Equal Housing Opportunity</p>
  </div>`;

  await sendNotification({
    to: opts.email,
    subject: `Your home is ready${opts.homeLabel ? ` — ${opts.homeLabel}` : ""}`,
    meta: { kind: "onboarding_invite" },
    html,
  });
}
