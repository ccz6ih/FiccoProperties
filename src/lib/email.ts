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
}): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
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
