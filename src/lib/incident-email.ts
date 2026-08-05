/** Emails for a submitted resident incident report. */
import { esc } from "@/lib/email";

const PINE = "#2f5d50";
const INK = "#2c2622";
const FAINT = "#9b9286";
const LINE = "#e6dcc8";
const TERRA = "#b4562f";

export type IncidentEmailData = {
  id: string;
  logNumber: string;
  reporterName: string;
  home: string;
  occurred: string; // human date/time
  location: string;
  narrative: string;
  anyoneHurt: boolean;
  policeCalled: string; // 'no' | 'unknown' | 'yes'
  photoCount: number;
  appUrl: string;
};

function clip(s: string, n = 600): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function row(label: string, value: string, warn = false): string {
  return `<tr><td style="padding:8px 0;border-bottom:1px solid ${LINE};color:${FAINT};font-size:13px;white-space:nowrap;vertical-align:top;padding-right:16px">${label}</td><td style="padding:8px 0;border-bottom:1px solid ${LINE};color:${warn ? TERRA : INK};font-size:14px;font-weight:600">${value}</td></tr>`;
}

function shell(bandLabel: string, headline: string, inner: string): string {
  return `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><table role="presentation" width="100%" style="border-collapse:collapse"><tr><td align="center"><table role="presentation" width="600" style="width:600px;max-width:600px;background:#fff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
    <tr><td style="background:${PINE};padding:22px 28px"><div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#f7f3ea">38th Ave Properties</div><div style="font-size:11px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">${bandLabel}</div></td></tr>
    <tr><td style="padding:26px 28px 8px"><div style="font-family:Georgia,serif;font-size:21px;color:${INK};margin-bottom:8px">${headline}</div>${inner}</td></tr>
    <tr><td style="padding:8px 28px 26px"><div style="border-top:1px solid #f0e9db;padding-top:14px"><p style="margin:0;font-size:12px;color:${FAINT};line-height:1.6">This report is kept on file at 38th Ave Properties. In an emergency, always call 911 first.</p></div></td></tr>
  </table></td></tr></table></div>`;
}

/** Alert to staff/owners when a resident submits an incident report. */
export function incidentAlertEmail(d: IncidentEmailData): { subject: string; html: string } {
  const police = d.policeCalled === "yes" ? "Yes" : d.policeCalled === "unknown" ? "Don't know" : "No";
  const details = `<table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:16px">
      ${row("Log number", esc(d.logNumber))}
      ${row("Reported by", esc(d.reporterName))}
      ${row("Home", esc(d.home))}
      ${row("When", esc(d.occurred))}
      ${row("Where", esc(d.location || "—"))}
      ${row("Anyone hurt", d.anyoneHurt ? "Yes" : "No", d.anyoneHurt)}
      ${row("Police called", police, d.policeCalled === "yes")}
      ${row("Photos attached", d.photoCount > 0 ? `${d.photoCount}` : "None")}
    </table>
    <div style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">What happened</div>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${INK};white-space:pre-wrap">${esc(clip(d.narrative))}</p>
    <a href="${d.appUrl}/admin/incidents/${d.id}" style="display:inline-block;background:${PINE};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px">Open the full report →</a>`;
  return {
    subject: `New incident report — ${d.reporterName} · ${d.home}`,
    html: shell("Incident report", "A resident filed an incident report", details),
  };
}

/** Confirmation copy to the resident who filed it. */
export function incidentReceiptEmail(d: IncidentEmailData): { subject: string; html: string } {
  const inner = `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:${INK}">Thank you, ${esc(d.reporterName)}. We've received your incident report and it's now on file. Our team will review it, and we'll follow up if we need anything more from you.</p>
    <div style="background:#faf7f1;border:1px solid ${LINE};border-radius:10px;padding:12px 16px;margin-bottom:16px"><div style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.05em">Your log number</div><div style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:${PINE}">${esc(d.logNumber)}</div><div style="font-size:12px;color:${FAINT};margin-top:2px">Keep this for your records — it confirms you reported this, and when.</div></div>
    <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:16px">
      ${row("Home", esc(d.home))}
      ${row("When", esc(d.occurred))}
      ${row("Photos included", d.photoCount > 0 ? `${d.photoCount}` : "None")}
    </table>
    <div style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Your description</div>
    <p style="margin:0;font-size:14px;line-height:1.6;color:${INK};white-space:pre-wrap">${esc(clip(d.narrative))}</p>`;
  return {
    subject: "We received your incident report — 38th Ave Properties",
    html: shell("Incident report", "Your report is on file", inner),
  };
}
