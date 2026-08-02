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
  phone?: string;
};

export type ReportPaid = {
  property: string;
  unit: string;
  tenant: string;
  paidCents: number;
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
  paid: ReportPaid[];
  /** Collected by this same day last month, for a trend line (null if none). */
  lastMonthCollectedCents?: number | null;
  lastMonthLabel?: string;
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

type SectionRow = {
  property: string;
  unit: string;
  tenant: string;
  address?: string;
  amountCents: number;
  phone?: string;
  extra?: string;
};

/**
 * Render a list grouped into per-community blocks — bold header + address,
 * big readable rows, and a subtotal. Used for both the "paid" and "still owed"
 * sections. `showPhone` stacks the tenant's phone under their name (for calls).
 */
function communitySection(
  items: SectionRow[],
  opts: {
    amountColor: string;
    amountHeader: string;
    subtotalLabel: string;
    extraHeader?: string;
    showPhone?: boolean;
    emptyMsg: string;
  }
): string {
  if (!items.length) {
    return `<div style="padding:20px;text-align:center;color:${PINE};font-size:16px;font-weight:600;background:${SAND};border:1px solid ${LINE};border-radius:10px">${opts.emptyMsg}</div>`;
  }
  const byProp = new Map<string, SectionRow[]>();
  for (const it of items) {
    const arr = byProp.get(it.property) ?? [];
    arr.push(it);
    byProp.set(it.property, arr);
  }
  const groups = [...byProp.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const hasExtra = !!opts.extraHeader;

  return groups
    .map(([prop, list]) => {
      const addr = list[0]?.address ?? "";
      const subtotal = list.reduce((s, it) => s + it.amountCents, 0);
      const rows = list
        .map((it) => {
          const phoneLine = opts.showPhone
            ? it.phone
              ? `<div style="font-size:14px;margin-top:2px"><a href="tel:${esc(it.phone.replace(/[^0-9+]/g, ""))}" style="color:${PINE};text-decoration:none;font-weight:600">${esc(it.phone)}</a></div>`
              : `<div style="font-size:13px;color:${FAINT};margin-top:2px">No phone on file</div>`
            : "";
          const extraCell = hasExtra
            ? `<td style="padding:12px 16px;border-bottom:1px solid ${LINE};color:${SOFT};font-size:15px;text-align:right;white-space:nowrap">${esc(it.extra ?? "")}</td>`
            : "";
          return `<tr>
            <td style="padding:12px 16px;border-bottom:1px solid ${LINE};color:${INK};font-size:16px;font-weight:600;white-space:nowrap">${esc(it.unit)}</td>
            <td style="padding:12px 16px;border-bottom:1px solid ${LINE};color:${SOFT};font-size:15px">${esc(it.tenant)}${phoneLine}</td>
            <td style="padding:12px 16px;border-bottom:1px solid ${LINE};color:${opts.amountColor};font-size:16px;font-weight:700;text-align:right;white-space:nowrap">${formatCents(it.amountCents)}</td>
            ${extraCell}
          </tr>`;
        })
        .join("");
      return `<div style="margin-bottom:20px;border:1px solid ${LINE};border-radius:10px;overflow:hidden">
        <div style="background:${PINE};padding:13px 16px">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:600;color:#f7f3ea">${esc(prop)}</div>
          ${addr ? `<div style="font-size:14px;color:#cfe0d8;margin-top:3px">${esc(addr)}</div>` : ""}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          <thead><tr style="text-align:left;color:${FAINT};font-size:11px;text-transform:uppercase;letter-spacing:.05em;background:${SAND}">
            <th style="padding:9px 16px">Home</th>
            <th style="padding:9px 16px">Tenant${opts.showPhone ? " &amp; phone" : ""}</th>
            <th style="padding:9px 16px;text-align:right">${opts.amountHeader}</th>
            ${hasExtra ? `<th style="padding:9px 16px;text-align:right">${opts.extraHeader}</th>` : ""}
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="background:#faf7f1">
            <td colspan="2" style="padding:12px 16px;font-size:15px;color:${INK};font-weight:600">${opts.subtotalLabel}</td>
            <td style="padding:12px 16px;font-size:17px;color:${opts.amountColor};font-weight:700;text-align:right;white-space:nowrap">${formatCents(subtotal)}</td>
            ${hasExtra ? `<td style="padding:12px 16px"></td>` : ""}
          </tr></tfoot>
        </table>
      </div>`;
    })
    .join("");
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

  // Plain-English summary sentence.
  const summaryLine =
    d.lateCount === 0
      ? `As of <strong>${esc(d.reportDate)}</strong>, you've collected <strong>${formatCents(d.collectedCents)}</strong> of ${formatCents(d.billedCents)} billed — <strong>everyone's paid</strong>. 🎉`
      : `As of <strong>${esc(d.reportDate)}</strong>, you've collected <strong>${formatCents(d.collectedCents)}</strong> of ${formatCents(d.billedCents)} billed (${d.pctCollected}%). <strong>${d.lateCount}</strong> unit${d.lateCount === 1 ? "" : "s"} still owe <strong>${formatCents(d.outstandingCents)}</strong>.`;

  // Trend vs the same point last month.
  let vsLastLine = "";
  if (d.lastMonthCollectedCents != null) {
    const delta = d.collectedCents - d.lastMonthCollectedCents;
    const ref = d.lastMonthLabel ? ` (${esc(d.lastMonthLabel)})` : "";
    vsLastLine =
      Math.abs(delta) < 100
        ? ` That's about even with this same day last month${ref}.`
        : ` That's <strong>${formatCents(Math.abs(delta))}</strong> ${delta > 0 ? "ahead of" : "behind"} this same day last month${ref}.`;
  }

  const paidSection = communitySection(
    d.paid.map((p) => ({
      property: p.property,
      unit: p.unit,
      tenant: p.tenant,
      address: p.address,
      amountCents: p.paidCents,
    })),
    {
      amountColor: PINE,
      amountHeader: "Amount paid",
      subtotalLabel: "Total collected",
      emptyMsg: "No rent recorded yet this month.",
    }
  );

  const lateSection = communitySection(
    d.late.map((l) => ({
      property: l.property,
      unit: l.unit,
      tenant: l.tenant,
      address: l.address,
      amountCents: l.dueCents,
      phone: l.phone,
      extra: `${l.daysLate} day${l.daysLate === 1 ? "" : "s"}`,
    })),
    {
      amountColor: TERRA,
      amountHeader: "Amount due",
      extraHeader: "Days late",
      showPhone: true,
      subtotalLabel: "Total still owed",
      emptyMsg: "Everyone's paid — nothing late this month. 🎉",
    }
  );

  const html = `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td align="center">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:640px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">

      <tr><td style="background:${PINE};padding:22px 28px">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:600;color:#f7f3ea">38th Ave Properties</div>
        <div style="font-size:11px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">Owner rent report &middot; ${esc(d.periodLabel)}</div>
      </td></tr>

      <tr><td style="padding:24px 28px 0">
        <div style="font-size:16px;color:${INK};line-height:1.65;margin-bottom:16px">${summaryLine}${vsLastLine}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
          ${stat("Collected", formatCents(d.collectedCents), PINE)}
          ${stat("Still owed", formatCents(d.outstandingCents), TERRA)}
          ${stat("% In", `${d.pctCollected}%`)}
          ${stat("Late", `${d.lateCount}`, lateColor)}
        </tr></table>
        <div style="font-size:13px;color:${SOFT};margin-top:12px">${d.paidUnits} of ${d.totalUnits} units paid &middot; ${formatCents(d.billedCents)} billed</div>
      </td></tr>

      <tr><td style="padding:24px 28px 0">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${INK};margin-bottom:8px">By community</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
          <thead><tr style="text-align:left;color:${FAINT};font-size:11px;text-transform:uppercase;letter-spacing:.04em">
            <th style="padding:6px 10px">Community</th>
            <th style="padding:6px 10px;text-align:center">Paid</th>
            <th style="padding:6px 10px;text-align:right">Collected</th>
            <th style="padding:6px 10px;text-align:right">Still owed</th>
            <th style="padding:6px 10px;text-align:right">% In</th>
          </tr></thead>
          <tbody>${propRows}</tbody>
        </table>
      </td></tr>

      <tr><td style="padding:26px 28px 0">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${lateColor};margin-bottom:14px">Still owed — by community${d.late.length ? ` (${d.late.length} unit${d.late.length === 1 ? "" : "s"})` : ""}</div>
        ${lateSection}
      </td></tr>

      <tr><td style="padding:8px 28px 0">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${PINE};margin-bottom:14px">Paid this month — by community${d.paid.length ? ` (${d.paid.length} unit${d.paid.length === 1 ? "" : "s"})` : ""}</div>
        ${paidSection}
      </td></tr>

      <tr><td style="padding:16px 28px 0">
        <a href="${d.appUrl}/admin/delinquency" style="display:inline-block;background:${PINE};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;margin-right:8px">Open delinquency →</a>
        <a href="${d.appUrl}/owner-report" style="display:inline-block;border:1px solid ${LINE};color:${PINE};text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px">Full owner report</a>
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
