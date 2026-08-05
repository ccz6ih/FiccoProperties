/**
 * Renders the FROZEN, self-contained HTML document of an incident report — the
 * record of exactly what the resident submitted and attested to. Stored in the
 * private bucket at submit time so it never depends on the live schema or
 * templates changing later. This is the artifact that goes to an attorney; it
 * prints to a clean PDF.
 */
import { esc } from "@/lib/email";

export type IncidentSnapshotData = {
  logNumber: string;
  submittedAt: string; // ISO
  reporterName: string;
  home: string;
  reporterPhone: string | null;
  reporterEmail: string | null;
  occurred: string;
  location: string | null;
  involved: string | null;
  narrative: string;
  anyoneHurt: string | null;
  hurtDetails: string | null;
  policeCalled: string | null;
  policeRef: string | null;
  hasEvidence: boolean;
  happenedBefore: string | null;
  beforeWhen: string | null;
  additional: string | null;
  photoNames: string[];
  attestationText: string;
  signedName: string;
  signedAt: string; // ISO
  submitterIp: string | null;
  submitterUserAgent: string | null;
  correctionOf: string | null; // log number of the report this corrects, if any
};

const hurt = (v: string | null) => (v === "yes" ? "Yes" : v === "no" ? "No" : "Not answered");
const police = (v: string | null) =>
  v === "yes" ? "Yes" : v === "unknown" ? "Don't know" : v === "no" ? "No" : "Not answered";

function fmt(iso: string): string {
  // Deterministic, timezone-explicit stamp for the record.
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function field(label: string, value: string): string {
  return `<tr><td style="padding:6px 14px 6px 0;color:#555;font-size:12px;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600">${value}</td></tr>`;
}

function block(label: string, value: string): string {
  return `<div style="margin:0 0 14px"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#555;border-bottom:1px solid #1a1a1a;padding-bottom:3px;margin-bottom:6px;font-weight:700">${label}</div><div style="font-size:13px;line-height:1.5;color:#1a1a1a;white-space:pre-wrap">${value || "—"}</div></div>`;
}

export function renderIncidentSnapshot(d: IncidentSnapshotData): string {
  const photos = d.photoNames.length
    ? d.photoNames.map((n) => `<li>${esc(n)}</li>`).join("")
    : "<li>None</li>";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Incident Report ${esc(d.logNumber)}</title></head>
<body style="margin:0;padding:28px 22px;background:#fff;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a">
<div style="max-width:720px;margin:0 auto">

  <div style="border-bottom:3px solid #1a1a1a;padding-bottom:10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:flex-end">
    <div>
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#555">38th Ave Properties · Property Management</div>
      <div style="font-size:25px;font-weight:700;text-transform:uppercase;letter-spacing:-.02em;margin-top:4px">Resident Incident Report</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#555;white-space:nowrap">
      <div style="font-size:15px;font-weight:700;color:#1a1a1a;letter-spacing:.04em">${esc(d.logNumber)}</div>
      <div>Official record</div>
    </div>
  </div>

  ${d.correctionOf ? `<div style="background:#fbeee6;border:1px solid #b4562f;color:#8a3d1f;font-size:12px;padding:8px 12px;margin:10px 0">This report is a correction/addendum to ${esc(d.correctionOf)}. The original remains on file unchanged.</div>` : ""}

  <table style="border-collapse:collapse;margin:12px 0 18px;width:100%">
    ${field("Reported by", esc(d.reporterName))}
    ${field("Home", esc(d.home))}
    ${field("Phone", esc(d.reporterPhone || "—"))}
    ${field("Email", esc(d.reporterEmail || "—"))}
    ${field("When it happened", esc(d.occurred))}
    ${field("Where", esc(d.location || "—"))}
  </table>

  ${block("Who was involved", esc(d.involved || "—"))}
  ${block("What happened", esc(d.narrative))}

  <table style="border-collapse:collapse;margin:4px 0 14px;width:100%">
    ${field("Anyone hurt?", hurt(d.anyoneHurt))}
    ${d.hurtDetails ? field("Injury details", esc(d.hurtDetails)) : ""}
    ${field("Police called?", police(d.policeCalled))}
    ${d.policeRef ? field("Case / report #", esc(d.policeRef)) : ""}
    ${field("Photos / video / texts?", d.hasEvidence ? "Yes" : "No")}
    ${field("Happened before?", d.happenedBefore === "yes" ? `Yes${d.beforeWhen ? ` (${esc(d.beforeWhen)})` : ""}` : hurt(d.happenedBefore))}
  </table>

  ${d.additional ? block("Anything else", esc(d.additional)) : ""}

  <div style="margin:0 0 14px"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#555;border-bottom:1px solid #1a1a1a;padding-bottom:3px;margin-bottom:6px;font-weight:700">Attached files</div><ul style="margin:0;padding-left:18px;font-size:13px;color:#1a1a1a">${photos}</ul></div>

  <div style="background:#f2f2f0;padding:12px 14px;margin:18px 0 10px;font-size:12.5px;line-height:1.5">
    <div style="font-weight:700;margin-bottom:6px">Signed attestation</div>
    <div style="white-space:pre-wrap;margin-bottom:10px">${esc(d.attestationText)}</div>
    <table style="border-collapse:collapse">
      ${field("Signed (typed name)", esc(d.signedName))}
      ${field("Signed at", esc(fmt(d.signedAt)))}
    </table>
  </div>

  <table style="border-collapse:collapse;margin:12px 0 0;width:100%;border-top:1px solid #9a9a9a;padding-top:10px">
    ${field("Submitted at (server)", esc(fmt(d.submittedAt)))}
    ${field("Submitted from IP", esc(d.submitterIp || "—"))}
    ${field("Device / browser", esc(d.submitterUserAgent || "—"))}
  </table>

  <p style="margin-top:16px;font-size:11.5px;color:#555;border-top:1px solid #9a9a9a;padding-top:10px">
    This document is the official record of the report as submitted by the resident and cannot be edited. Corrections are filed as new, linked reports. This form does not replace calling the police — in an emergency, always call 911 first.
  </p>
</div>
</body></html>`;
}
