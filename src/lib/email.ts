/**
 * Lightweight transactional email via Resend (https://resend.com).
 * Server-only. No-ops safely until the env vars are set, so the app never
 * breaks if email isn't configured yet.
 *
 * Env:
 *   RESEND_API_KEY  — from the Resend dashboard
 *   NOTIFY_EMAIL    — where staff notifications go (comma-separated allowed)
 *   EMAIL_FROM      — verified sender, e.g. "Ficco Properties <notifications@ficcoproperties.com>"
 */
export async function sendNotification(opts: {
  subject: string;
  html: string;
  replyTo?: string;
  /** Override the recipient. Defaults to NOTIFY_EMAIL (staff). */
  to?: string;
}): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY;
  const to = opts.to ?? process.env.NOTIFY_EMAIL;
  const from =
    process.env.EMAIL_FROM ||
    "Ficco Properties <notifications@ficcoproperties.com>";

  if (!key || !to) return { sent: false };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: to.split(",").map((s) => s.trim()).filter(Boolean),
        subject: opts.subject,
        html: opts.html,
        reply_to: opts.replyTo,
      }),
    });
    return { sent: res.ok };
  } catch {
    return { sent: false };
  }
}

/** Escape a dynamic value before embedding it in email HTML. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Friendly, branded confirmation email for applicants / prospects. */
export function customerHtml(heading: string, paragraphs: string[]): string {
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#2c2622">${p}</p>`
    )
    .join("");
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px">
    <div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#2f5d50;margin-bottom:14px">${heading}</div>
    ${body}
    <p style="margin:18px 0 0;font-size:13px;color:#6f655a">— The Ficco Properties team</p>
    <p style="margin:6px 0 0;font-size:12px;color:#9b9286">Ficco Properties · W 38th Ave, Wheat Ridge, CO · Equal Housing Opportunity</p>
  </div>`;
}

/** Minimal HTML wrapper for a notification body. */
export function notificationHtml(title: string, rows: [string, string][]): string {
  const items = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6f655a;font-size:13px">${k}</td><td style="padding:4px 0;color:#2c2622;font-size:13px"><strong>${v}</strong></td></tr>`
    )
    .join("");
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px">
    <h2 style="color:#2f5d50;font-size:18px;margin:0 0 12px">${title}</h2>
    <table style="border-collapse:collapse">${items}</table>
    <p style="margin:18px 0 0;font-size:12px;color:#9b9286">Ficco Properties · admin notification</p>
  </div>`;
}
