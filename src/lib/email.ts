/**
 * Lightweight transactional email via Resend (https://resend.com).
 * Server-only. No-ops safely until the env vars are set, so the app never
 * breaks if email isn't configured yet.
 *
 * Env:
 *   RESEND_API_KEY  — from the Resend dashboard
 *   NOTIFY_EMAIL    — where staff notifications go (comma-separated allowed)
 *   EMAIL_FROM      — verified sender, e.g. "38th Ave Properties <notifications@38thaveproperties.com>"
 *   OWNER_REPLY_TO  — where resident replies go (set in Vercel). Falls back to
 *                     hello@38thaveproperties.com if unset.
 */

/** Where replies to office emails should land — one env-controlled knob. */
export function ownerReplyTo(): string {
  return process.env.OWNER_REPLY_TO || "hello@38thaveproperties.com";
}

export async function sendNotification(opts: {
  subject: string;
  html: string;
  replyTo?: string;
  /** Override the recipient. Defaults to NOTIFY_EMAIL (staff). */
  to?: string;
  /** Optional: log this send for delivery tracking + link it to a record. */
  meta?: { kind: string; refType?: string; refId?: string };
}): Promise<{ sent: boolean; id?: string }> {
  const key = process.env.RESEND_API_KEY;
  const to = opts.to ?? process.env.NOTIFY_EMAIL;
  const from =
    process.env.EMAIL_FROM ||
    '"Craig Carda · 38th Ave Properties" <notifications@38thaveproperties.com>';

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
        reply_to: opts.replyTo ?? ownerReplyTo(),
      }),
    });
    if (!res.ok) return { sent: false };

    let id: string | undefined;
    try {
      const json = (await res.json()) as { id?: string };
      id = json?.id;
    } catch {
      /* body not JSON — still sent */
    }

    // Record the send for delivery tracking (best-effort).
    if (id && opts.meta) {
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (createAdminClient() as any).from("email_log").insert({
          message_id: id,
          to_email: to,
          subject: opts.subject,
          kind: opts.meta.kind,
          ref_type: opts.meta.refType ?? null,
          ref_id: opts.meta.refId ?? null,
          status: "sent",
        });
      } catch {
        /* logging is best-effort */
      }
    }

    return { sent: true, id };
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
    <p style="margin:18px 0 0;font-size:13px;color:#6f655a">— The 38th Ave Properties team</p>
    <p style="margin:6px 0 0;font-size:12px;color:#9b9286">38th Ave Properties · W 38th Ave, Wheat Ridge, CO · Equal Housing Opportunity</p>
  </div>`;
}

/** Branded notification card for staff/owner alerts. Matches the resident-facing
 * emails so every message looks like it's from the same place. */
export function notificationHtml(title: string, rows: [string, string][]): string {
  const PINE = "#2f5d50", INK = "#2c2622", FAINT = "#9b9286", LINE = "#e6dcc8";
  const items = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 16px 8px 0;color:${FAINT};font-size:13px;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:8px 0;color:${INK};font-size:14px;font-weight:600">${v}</td></tr>`
    )
    .join("");
  return `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:#fff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
      <tr><td style="background:${PINE};padding:20px 26px"><div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:600;color:#f7f3ea">38th Ave Properties</div><div style="font-size:11px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">Notification</div></td></tr>
      <tr><td style="padding:24px 26px 8px"><div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;color:${INK};margin-bottom:12px">${title}</div><table role="presentation" style="border-collapse:collapse">${items}</table></td></tr>
      <tr><td style="padding:8px 26px 24px"><div style="border-top:1px solid #f0e9db;padding-top:12px"><p style="margin:0;font-size:12px;color:${FAINT}">38th Ave Properties · admin notification</p></div></td></tr>
    </table>
  </td></tr></table></div>`;
}
