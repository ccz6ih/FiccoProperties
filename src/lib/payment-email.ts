/** Payment confirmation / receipt email to a tenant when rent is recorded. */
import { formatCents } from "@/lib/format";
import { esc } from "@/lib/email";

const PINE = "#2f5d50";
const INK = "#2c2622";
const FAINT = "#9b9286";
const LINE = "#e6dcc8";
const TERRA = "#b4562f";

export function paymentReceiptEmail(d: {
  name: string;
  home: string;
  amountCents: number;
  remainingCents: number;
  period: string | null;
  refLabel: string | null;
  hasPortal: boolean;
  appUrl: string;
}): { subject: string; html: string } {
  const amount = formatCents(d.amountCents);
  const forLine = [d.period ? `for ${esc(d.period)}` : "", "rent"].filter(Boolean).join(" ");
  const subject = `Payment received — ${amount}`;

  const rows: [string, string][] = [
    ["Amount received", amount],
    ["Home", esc(d.home)],
  ];
  if (d.refLabel) rows.push(["Reference", esc(d.refLabel)]);
  if (d.remainingCents > 0) rows.push(["Balance remaining", formatCents(d.remainingCents)]);
  const table = `<table style="border-collapse:collapse;margin:10px 0 4px">${rows
    .map(
      ([k, v], i) =>
        `<tr><td style="padding:4px 16px 4px 0;color:${FAINT};font-size:13px">${k}</td><td style="padding:4px 0;font-size:13px;font-weight:600;color:${i === rows.length - 1 && d.remainingCents > 0 ? TERRA : INK}">${v}</td></tr>`
    )
    .join("")}</table>`;

  const portalLink = d.hasPortal
    ? `<p style="margin:14px 0 0;font-size:13px"><a href="${d.appUrl}/portal/payments" style="color:${PINE};font-weight:600;text-decoration:none">View your payment history →</a></p>`
    : "";

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:${INK}">
    <div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:${PINE};margin-bottom:2px">38th Ave Properties</div>
    <div style="font-size:13px;color:${FAINT};margin-bottom:16px">Payment confirmation</div>

    <div style="font-family:Georgia,serif;font-size:18px;color:${PINE};margin-bottom:8px">Thank you, ${esc(d.name)} — we received your payment ✓</div>
    <p style="margin:0 0 6px;font-size:14px;line-height:1.6">We've recorded your ${forLine} payment. Here's your receipt:</p>
    ${table}
    ${d.remainingCents > 0 ? `<p style="margin:6px 0 0;font-size:13px;color:${TERRA}">A balance of ${formatCents(d.remainingCents)} is still outstanding for this charge.</p>` : ""}
    ${portalLink}
    <p style="margin:16px 0 0;font-size:12px;color:${FAINT}">Questions about this payment? Reply to this email or call (720) 527-2596. Please keep this receipt for your records.</p>
    <p style="margin:12px 0 0;font-size:12px;color:${FAINT}">38th Ave Properties · W 38th Ave, Wheat Ridge, CO · Equal Housing Opportunity</p>
  </div>`;

  return { subject, html };
}
