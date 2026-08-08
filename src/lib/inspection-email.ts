/** Entry-notice email for a scheduled unit inspection. */
import { esc } from "@/lib/email";

const PINE = "#2f5d50";
const INK = "#2c2622";
const FAINT = "#9b9286";
const LINE = "#e6dcc8";

const KIND_LABEL: Record<string, string> = {
  annual: "Annual inspection",
  seasonal: "Seasonal check",
  move_in: "Move-in inspection",
  move_out: "Move-out inspection",
  follow_up: "Follow-up visit",
  complaint: "Follow-up visit",
};

export function entryNoticeEmail(d: {
  firstName: string;
  home: string;
  kind: string;
  dateLabel: string;   // "Tuesday, August 12, 2026"
  timeWindow: string | null;
}): { subject: string; html: string } {
  const kind = KIND_LABEL[d.kind] ?? "Inspection";
  const inner = `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:${INK}">Hi ${esc(d.firstName)},</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:${INK}">This is your advance notice that we'll be stopping by <strong>${esc(d.home)}</strong> for a routine <strong>${esc(kind.toLowerCase())}</strong>. It usually takes just a few minutes — we're checking that everything in your home is working the way it should.</p>
    <div style="background:#faf7f1;border:1px solid ${LINE};border-radius:12px;padding:16px 20px;margin-bottom:16px;text-align:center">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:${FAINT}">When</div>
      <div style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:${PINE};margin-top:2px">${esc(d.dateLabel)}</div>
      ${d.timeWindow ? `<div style="font-size:14px;color:${INK};margin-top:2px">${esc(d.timeWindow)}</div>` : ""}
    </div>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.7;color:${INK}">
      <li>You don't need to be home — we'll use our key if you're out.</li>
      <li>Pets? Let us know so we can plan around them.</li>
      <li>Anything not working (drips, doors, detectors)? Tell us and we'll look at it while we're there.</li>
    </ul>
    <p style="margin:0;font-size:13px;color:${FAINT}">Need a different day or time? Just reply to this email or call (720) 527-2596 and we'll happily reschedule.</p>`;
  return {
    subject: `Heads up — ${kind.toLowerCase()} at ${d.home} on ${d.dateLabel}`,
    html: `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><table role="presentation" width="100%" style="border-collapse:collapse"><tr><td align="center"><table role="presentation" width="600" style="width:600px;max-width:600px;background:#fff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
      <tr><td style="background:${PINE};padding:22px 28px"><div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#f7f3ea">38th Ave Properties</div><div style="font-size:11px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">Notice of entry</div></td></tr>
      <tr><td style="padding:26px 28px 8px"><div style="font-family:Georgia,serif;font-size:21px;color:${INK};margin-bottom:8px">We'll be stopping by</div>${inner}</td></tr>
      <tr><td style="padding:8px 28px 26px"><div style="border-top:1px solid #f0e9db;padding-top:14px"><p style="margin:0;font-size:12px;color:${FAINT};line-height:1.6">This email serves as your written advance notice of entry. 38th Ave Properties · Wheat Ridge, CO · Equal Housing Opportunity</p></div></td></tr>
    </table></td></tr></table></div>`,
  };
}
