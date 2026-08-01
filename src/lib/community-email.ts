/** A warm, branded "community note" broadcast email to residents. */
import { esc } from "@/lib/email";

const PINE = "#2f5d50";
const INK = "#2c2622";
const FAINT = "#9b9286";
const LINE = "#e6dcc8";

/** Turn a plain-text body into HTML paragraphs (blank line = new paragraph). */
function paragraphs(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:${INK}">${esc(p).replace(/\n/g, "<br/>")}</p>`
    )
    .join("");
}

export function communityNoteEmail(d: {
  firstName: string;
  heading: string;
  body: string;
  appUrl: string;
}): string {
  return `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">

      <tr><td style="background:${PINE};padding:22px 32px">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:600;color:#f7f3ea">38th Ave Properties</div>
        <div style="font-size:11px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">Community note</div>
      </td></tr>

      <tr><td style="padding:28px 32px 8px">
        ${d.heading ? `<div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${INK};margin:0 0 12px">${esc(d.heading)}</div>` : ""}
        <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:${INK}">Hi ${esc(d.firstName)},</p>
        ${paragraphs(d.body)}
      </td></tr>

      <tr><td style="padding:6px 32px 0">
        <a href="${d.appUrl}/portal/tenancy" style="display:inline-block;background:${PINE};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 24px;border-radius:8px">Open your resident portal →</a>
      </td></tr>

      <tr><td style="padding:22px 32px 26px">
        <div style="border-top:1px solid #f0e9db;padding-top:16px">
          <p style="margin:0;font-size:12px;color:${FAINT};line-height:1.6">Questions? Just reply to this email or call <strong style="color:#6f655a">(720) 527-2596</strong>. Thanks for being part of our community.</p>
        </div>
      </td></tr>

    </table>
    <div style="font-size:11px;color:${FAINT};margin-top:16px;line-height:1.6">38th Ave Properties &middot; W 38th Ave, Wheat Ridge, CO &middot; Equal Housing Opportunity</div>
  </td></tr></table>
</div>`;
}
