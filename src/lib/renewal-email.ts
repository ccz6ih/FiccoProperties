/** Emails for lease renewal offers — offer to the tenant, response alerts. */
import { formatCents } from "@/lib/format";
import { esc } from "@/lib/email";

const PINE = "#2f5d50";
const INK = "#2c2622";
const FAINT = "#9b9286";
const LINE = "#e6dcc8";
const TERRA = "#b4562f";

function row(label: string, value: string, strong = false): string {
  return `<tr><td style="padding:8px 0;border-bottom:1px solid ${LINE};color:${FAINT};font-size:13px;white-space:nowrap;padding-right:16px;vertical-align:top">${label}</td><td style="padding:8px 0;border-bottom:1px solid ${LINE};color:${strong ? PINE : INK};font-size:14px;font-weight:600">${value}</td></tr>`;
}

function shell(bandLabel: string, headline: string, inner: string): string {
  return `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><table role="presentation" width="100%" style="border-collapse:collapse"><tr><td align="center"><table role="presentation" width="600" style="width:600px;max-width:600px;background:#fff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
    <tr><td style="background:${PINE};padding:22px 28px"><div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#f7f3ea">38th Ave Properties</div><div style="font-size:11px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">${bandLabel}</div></td></tr>
    <tr><td style="padding:26px 28px 8px"><div style="font-family:Georgia,serif;font-size:21px;color:${INK};margin-bottom:8px">${headline}</div>${inner}</td></tr>
    <tr><td style="padding:8px 28px 26px"><div style="border-top:1px solid #f0e9db;padding-top:14px"><p style="margin:0;font-size:12px;color:${FAINT};line-height:1.6">Questions? Reply to this email or call (720) 527-2596. 38th Ave Properties · Wheat Ridge, CO · Equal Housing Opportunity</p></div></td></tr>
  </table></td></tr></table></div>`;
}

export type RenewalOfferEmailData = {
  firstName: string;
  home: string;
  currentRentCents: number;
  newRentCents: number;
  termMonths: number; // 0 = month-to-month
  effectiveDate: string; // human formatted
  link: string; // one-click portal link
};

function termLabel(months: number): string {
  if (months === 0) return "Month-to-month";
  if (months === 12) return "12 months (1 year)";
  return `${months} months`;
}

/** The renewal offer, sent to the tenant with a one-click link to respond. */
export function renewalOfferEmail(d: RenewalOfferEmailData): { subject: string; html: string } {
  const delta = d.newRentCents - d.currentRentCents;
  const deltaLine =
    delta === 0
      ? `<div style="font-size:13px;color:${PINE};font-weight:600;margin-top:2px">No change from your current rent.</div>`
      : delta > 0
        ? `<div style="font-size:12px;color:${FAINT};margin-top:2px">Currently ${formatCents(d.currentRentCents)} — a change of ${formatCents(delta)}/month.</div>`
        : `<div style="font-size:13px;color:${PINE};font-weight:600;margin-top:2px">That's ${formatCents(-delta)}/month less than you pay now.</div>`;

  const inner = `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:${INK}">Hi ${esc(d.firstName)},</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:${INK}">We'd love to have you stay at <strong>${esc(d.home)}</strong>. Here's your renewal offer — you can review and respond right in your resident portal.</p>
    <div style="background:#faf7f1;border:1px solid ${LINE};border-radius:12px;padding:16px 20px;margin-bottom:16px;text-align:center">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:${FAINT}">New monthly rent</div>
      <div style="font-family:Georgia,serif;font-size:30px;font-weight:700;color:${PINE};margin-top:2px">${formatCents(d.newRentCents)}</div>
      ${deltaLine}
    </div>
    <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:18px">
      ${row("Term", esc(termLabel(d.termMonths)))}
      ${row("Starts", esc(d.effectiveDate))}
      ${row("Home", esc(d.home))}
    </table>
    <a href="${d.link}" style="display:inline-block;background:${PINE};color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px">Review &amp; respond →</a>
    <p style="margin:16px 0 0;font-size:12px;color:${FAINT}">This link signs you straight in. Nothing changes until you accept — and if you have questions or want to talk it over first, just reply to this email.</p>`;
  return {
    subject: `Your lease renewal offer — ${d.home}`,
    html: shell("Lease renewal", "Your renewal offer is ready", inner),
  };
}

export type RenewalResponseEmailData = {
  tenantName: string;
  home: string;
  newRentCents: number;
  termMonths: number;
  effectiveDate: string;
  accepted: boolean;
  declineReason?: string | null;
  adminUrl: string;
};

/** Owner/staff alert when the resident responds. */
export function renewalResponseAlert(d: RenewalResponseEmailData): { subject: string; html: string } {
  const inner = `<table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:16px">
      ${row("Resident", esc(d.tenantName))}
      ${row("Home", esc(d.home))}
      ${row("Response", d.accepted ? "Accepted ✓" : "Declined", d.accepted)}
      ${row("New rent", formatCents(d.newRentCents))}
      ${row("Term", esc(termLabel(d.termMonths)))}
      ${row("Effective", esc(d.effectiveDate))}
      ${d.accepted ? "" : row("Reason", esc(d.declineReason || "Not given"))}
    </table>
    ${d.accepted ? `<p style="margin:0 0 16px;font-size:13px;color:${FAINT}">The new terms will be applied to the tenancy automatically on the effective date (or apply them now from the offer page).</p>` : `<p style="margin:0 0 16px;font-size:13px;color:${TERRA}">They declined — worth a call to talk options before the lease runs out.</p>`}
    <a href="${d.adminUrl}" style="display:inline-block;background:${PINE};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px">Open the offer →</a>`;
  return {
    subject: `Renewal ${d.accepted ? "accepted" : "declined"} — ${d.tenantName} · ${d.home}`,
    html: shell("Lease renewal", d.accepted ? "A resident accepted their renewal 🎉" : "A resident declined their renewal", inner),
  };
}

/** Confirmation to the resident after accepting. */
export function renewalAcceptedReceipt(d: {
  firstName: string;
  home: string;
  newRentCents: number;
  termMonths: number;
  effectiveDate: string;
  signedName: string;
  signedAt: string;
}): { subject: string; html: string } {
  const inner = `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:${INK}">Thank you, ${esc(d.firstName)} — your renewal is confirmed. We're glad you're staying! 🏡</p>
    <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:16px">
      ${row("Home", esc(d.home))}
      ${row("New rent", formatCents(d.newRentCents), true)}
      ${row("Term", esc(termLabel(d.termMonths)))}
      ${row("Starts", esc(d.effectiveDate))}
      ${row("Signed", `${esc(d.signedName)} · ${esc(d.signedAt)}`)}
    </table>
    <p style="margin:0;font-size:12px;color:${FAINT}">Keep this email for your records — it confirms your acceptance and when you signed. Your new rent takes effect on the start date above; nothing changes before then.</p>`;
  return {
    subject: `Renewal confirmed — ${d.home}`,
    html: shell("Lease renewal", "Your renewal is confirmed", inner),
  };
}
