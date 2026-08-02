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
  address?: string;
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
  return `<td width="25%" style="padding:15px 8px;text-align:center;border:1px solid ${LINE};background:#faf7f1">
    <div style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.05em">${label}</div>
    <div style="font-size:23px;font-weight:700;color:${color};font-family:Georgia,'Times New Roman',serif;margin-top:4px">${value}</div>
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

  const lateColor = d.late.length ? TERRA : PINE;

  // Group the "late" list by community so each has its own clearly-labeled
  // header + address — larger type for easy reading.
  const lateByProp = new Map<string, ReportLate[]>();
  for (const l of d.late) {
    const arr = lateByProp.get(l.property) ?? [];
    arr.push(l);
    lateByProp.set(l.property, arr);
  }
  const lateGroups = [...lateByProp.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const lateSection = d.late.length
    ? lateGroups
        .map(([prop, items]) => {
          const addr = items[0]?.address ?? "";
          const groupDue = items.reduce((s, l) => s + l.dueCents, 0);
          const rows = items
            .map(
              (l) => `<tr>
                <td style="padding:12px 16px;border-bottom:1px solid ${LINE};color:${INK};font-size:16px;font-weight:600">${esc(l.unit)}</td>
                <td style="padding:12px 16px;border-bottom:1px solid ${LINE};color:${SOFT};font-size:15px">${esc(l.tenant)}</td>
                <td style="padding:12px 16px;border-bottom:1px solid ${LINE};color:${TERRA};font-size:16px;font-weight:700;text-align:right;white-space:nowrap">${formatCents(l.dueCents)}</td>
                <td style="padding:12px 16px;border-bottom:1px solid ${LINE};color:${SOFT};font-size:15px;text-align:right;white-space:nowrap">${l.daysLate} day${l.daysLate === 1 ? "" : "s"}</td>
              </tr>`
            )
            .join("");
          return `<div style="margin-bottom:20px;border:1px solid ${LINE};border-radius:10px;overflow:hidden">
            <div style="background:${PINE};padding:13px 16px">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:600;color:#f7f3ea">${esc(prop)}</div>
              ${addr ? `<div style="font-size:14px;color:#cfe0d8;margin-top:3px">${esc(addr)}</div>` : ""}
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
              <thead><tr style="text-align:left;color:${FAINT};font-size:11px;text-transform:uppercase;letter-spacing:.05em;background:${SAND}">
                <th style="padding:9px 16px">Home</th>
                <th style="padding:9px 16px">Tenant</th>
                <th style="padding:9px 16px;text-align:right">Amount due</th>
                <th style="padding:9px 16px;text-align:right">Days late</th>
              </tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr style="background:#faf7f1">
                <td colspan="2" style="padding:12px 16px;font-size:15px;color:${INK};font-weight:600">Total still owed</td>
                <td style="padding:12px 16px;font-size:17px;color:${TERRA};font-weight:700;text-align:right;white-space:nowrap">${formatCents(groupDue)}</td>
                <td style="padding:12px 16px"></td>
              </tr></tfoot>
            </table>
          </div>`;
        })
        .join("")
    : `<div style="padding:20px;text-align:center;color:${PINE};font-size:16px;font-weight:600;background:${SAND};border:1px solid ${LINE};border-radius:10px">Everyone's paid — nothing late this month. 🎉</div>`;

  const html = `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td align="center">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:640px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">

      <tr><td style="background:${PINE};padding:22px 28px">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:600;color:#f7f3ea">38th Ave Properties</div>
        <div style="font-size:11px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">Owner rent report &middot; ${esc(d.periodLabel)}</div>
      </td></tr>

      <tr><td style="padding:22px 28px 0">
        <div style="font-size:13px;color:${SOFT};margin-bottom:14px">Collection status as of ${esc(d.reportDate)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
          ${stat("Collected", formatCents(d.collectedCents), PINE)}
          ${stat("Outstanding", formatCents(d.outstandingCents), TERRA)}
          ${stat("Rate", `${d.pctCollected}%`)}
          ${stat("Late", `${d.lateCount}`, lateColor)}
        </tr></table>
        <div style="font-size:13px;color:${SOFT};margin-top:12px">${d.paidUnits} of ${d.totalUnits} units paid &middot; ${formatCents(d.billedCents)} billed</div>
      </td></tr>

      <tr><td style="padding:22px 28px 0">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${INK};margin-bottom:8px">By community</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
          <thead><tr style="text-align:left;color:${FAINT};font-size:11px;text-transform:uppercase;letter-spacing:.04em">
            <th style="padding:6px 10px">Community</th>
            <th style="padding:6px 10px;text-align:center">Paid</th>
            <th style="padding:6px 10px;text-align:right">Collected</th>
            <th style="padding:6px 10px;text-align:right">Outstanding</th>
            <th style="padding:6px 10px;text-align:right">Rate</th>
          </tr></thead>
          <tbody>${propRows}</tbody>
        </table>
      </td></tr>

      <tr><td style="padding:26px 28px 0">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${lateColor};margin-bottom:14px">Still owed — by community${d.late.length ? ` (${d.late.length} unit${d.late.length === 1 ? "" : "s"})` : ""}</div>
        ${lateSection}
      </td></tr>

      <tr><td style="padding:24px 28px 0">
        <a href="${d.appUrl}/admin/delinquency" style="display:inline-block;background:${PINE};color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;margin-right:8px">Open delinquency →</a>
        <a href="${d.appUrl}/owner-report" style="display:inline-block;border:1px solid ${LINE};color:${PINE};text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px">Full owner report</a>
      </td></tr>

      <tr><td style="padding:20px 28px 26px">
        <div style="border-top:1px solid #f0e9db;padding-top:14px">
          <p style="margin:0;font-size:12px;color:${FAINT};line-height:1.6">Automated rent report from the 38th Ave Properties portal. &ldquo;Late&rdquo; = a charge past its due date that&apos;s still unpaid; a partial payment still shows the remaining balance.</p>
        </div>
      </td></tr>

    </table>
  </td></tr></table>
</div>`;

  return { subject, html };
}
