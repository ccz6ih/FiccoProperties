/**
 * Builds the owner rent-report email — collection stats + who's late this month.
 * Email-safe inline styles / tables (no external CSS). Data is assembled by the
 * cron route; this only renders it.
 */
import { formatCents } from "@/lib/format";
import { esc } from "@/lib/email";

export type ReportProperty = {
  name: string;
  paid: number;
  total: number;
  collectedCents: number;
  outstandingCents: number;
};

export type ReportLate = {
  property: string;
  unit: string;
  tenant: string;
  dueCents: number;
  daysLate: number;
};

export type RentReportData = {
  periodLabel: string;
  reportDate: string;
  billedCents: number;
  collectedCents: number;
  outstandingCents: number;
  paidUnits: number;
  totalUnits: number;
  lateCount: number;
  pctCollected: number;
  properties: ReportProperty[];
  late: ReportLate[];
  appUrl: string;
};

const PINE = "#2f5d50";
const INK = "#2c2622";
const SOFT = "#6f655a";
const FAINT = "#9b9286";
const TERRA = "#b4562f";
const LINE = "#e6dcc8";
const SAND = "#f6f1e6";

function stat(label: string, value: string, color = INK): string {
  return `<td style="padding:10px 14px;text-align:center;border:1px solid ${LINE};background:#fff">
    <div style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.04em">${label}</div>
    <div style="font-size:20px;font-weight:700;color:${color};font-family:Georgia,serif;margin-top:2px">${value}</div>
  </td>`;
}

export function renderRentReportEmail(d: RentReportData): { subject: string; html: string } {
  const subject = `Rent — ${d.periodLabel}: ${formatCents(d.collectedCents)} in · ${d.lateCount} late`;

  const propRows = d.properties
    .map((p) => {
      const pct = p.collectedCents + p.outstandingCents > 0
        ? Math.round((p.collectedCents / (p.collectedCents + p.outstandingCents)) * 100)
        : 0;
      const barColor = pct >= 100 ? PINE : pct >= 60 ? "#c79a3e" : TERRA;
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid ${LINE};color:${INK};font-weight:600">${esc(p.name)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${LINE};color:${SOFT};text-align:center">${p.paid}/${p.total}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${LINE};color:${PINE};text-align:right">${formatCents(p.collectedCents)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${LINE};color:${p.outstandingCents > 0 ? TERRA : FAINT};text-align:right">${formatCents(p.outstandingCents)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${LINE};text-align:right;color:${barColor};font-weight:700">${pct}%</td>
      </tr>`;
    })
    .join("");

  const lateRows = d.late.length
    ? d.late
        .map(
          (l) => `<tr>
            <td style="padding:7px 10px;border-bottom:1px solid ${LINE};color:${INK}">${esc(l.unit)} <span style="color:${FAINT}">· ${esc(l.property)}</span></td>
            <td style="padding:7px 10px;border-bottom:1px solid ${LINE};color:${SOFT}">${esc(l.tenant)}</td>
            <td style="padding:7px 10px;border-bottom:1px solid ${LINE};color:${TERRA};text-align:right;font-weight:600">${formatCents(l.dueCents)}</td>
            <td style="padding:7px 10px;border-bottom:1px solid ${LINE};color:${SOFT};text-align:right">${l.daysLate}d</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="padding:14px;text-align:center;color:${PINE}">Everyone's paid — nothing late. 🎉</td></tr>`;

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:${INK}">
    <div style="border-bottom:2px solid ${LINE};padding-bottom:12px;margin-bottom:16px">
      <div style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:${PINE}">38th Ave Properties</div>
      <div style="font-size:13px;color:${SOFT}">Rent report · ${d.periodLabel} · as of ${d.reportDate}</div>
    </div>

    <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:18px"><tr>
      ${stat("Collected", formatCents(d.collectedCents), PINE)}
      ${stat("Outstanding", formatCents(d.outstandingCents), TERRA)}
      ${stat("Collected", `${d.pctCollected}%`)}
      ${stat("Late", `${d.lateCount}`)}
    </tr></table>

    <div style="font-size:13px;color:${SOFT};margin-bottom:6px">
      ${d.paidUnits} of ${d.totalUnits} units paid · ${formatCents(d.billedCents)} billed
    </div>

    <h3 style="font-size:14px;color:${INK};margin:18px 0 6px">By community</h3>
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:13px">
      <thead><tr style="text-align:left;color:${FAINT};font-size:11px;text-transform:uppercase;letter-spacing:.04em">
        <th style="padding:6px 10px">Community</th>
        <th style="padding:6px 10px;text-align:center">Paid</th>
        <th style="padding:6px 10px;text-align:right">Collected</th>
        <th style="padding:6px 10px;text-align:right">Outstanding</th>
        <th style="padding:6px 10px;text-align:right">Rate</th>
      </tr></thead>
      <tbody>${propRows}</tbody>
    </table>

    <h3 style="font-size:14px;color:${TERRA};margin:20px 0 6px">Late — needs follow-up (${d.late.length})</h3>
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:13px;background:${SAND};border:1px solid ${LINE}">
      <thead><tr style="text-align:left;color:${FAINT};font-size:11px;text-transform:uppercase;letter-spacing:.04em">
        <th style="padding:6px 10px">Home</th>
        <th style="padding:6px 10px">Tenant</th>
        <th style="padding:6px 10px;text-align:right">Due</th>
        <th style="padding:6px 10px;text-align:right">Late</th>
      </tr></thead>
      <tbody>${lateRows}</tbody>
    </table>

    <div style="margin:22px 0 6px">
      <a href="${d.appUrl}/admin/delinquency" style="display:inline-block;background:${PINE};color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:9px 16px;border-radius:8px;margin-right:8px">Open delinquency</a>
      <a href="${d.appUrl}/owner-report" style="display:inline-block;border:1px solid ${LINE};color:${PINE};text-decoration:none;font-size:13px;font-weight:600;padding:9px 16px;border-radius:8px">Full owner report</a>
    </div>

    <p style="margin:18px 0 0;font-size:12px;color:${FAINT}">
      Automated rent report from the 38th Ave Properties portal. &ldquo;Late&rdquo; = a charge past its due date that&apos;s still unpaid; a partial payment still shows the remaining balance.
    </p>
  </div>`;

  return { subject, html };
}
