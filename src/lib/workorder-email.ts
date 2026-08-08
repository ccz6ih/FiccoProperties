/** Work-order email sent to a vendor for a maintenance request. */
import { esc } from "@/lib/email";

const PINE = "#2f5d50";
const INK = "#2c2622";
const FAINT = "#9b9286";
const LINE = "#e6dcc8";

function row(label: string, value: string): string {
  return `<tr><td style="padding:8px 0;border-bottom:1px solid ${LINE};color:${FAINT};font-size:13px;white-space:nowrap;padding-right:16px;vertical-align:top">${label}</td><td style="padding:8px 0;border-bottom:1px solid ${LINE};color:${INK};font-size:14px;font-weight:600">${value}</td></tr>`;
}

export function workOrderEmail(d: {
  vendorName: string;
  workOrderNo: string;
  property: string;
  address: string;
  unit: string;
  issue: string;
  description: string | null;
  priority: string;
  tenantName: string | null;
  tenantPhone: string | null;
}): { subject: string; html: string } {
  const access = d.tenantName
    ? `${esc(d.tenantName)}${d.tenantPhone ? ` · ${esc(d.tenantPhone)}` : ""} — please coordinate a time directly, or call us.`
    : "Call our office to arrange access.";

  const inner = `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:${INK}">Hi ${esc(d.vendorName)},</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:${INK}">Please take care of the following job for 38th Ave Properties. Reply to this email or call <strong>(720) 527-2596</strong> with any questions or to confirm scheduling.</p>
    <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:16px">
      ${row("Work order", esc(d.workOrderNo))}
      ${row("Property", esc(d.property))}
      ${row("Address", esc(d.address))}
      ${row("Unit", esc(d.unit))}
      ${row("Priority", esc(d.priority))}
      ${row("Access / tenant", access)}
    </table>
    <div style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">The job</div>
    <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:${INK}">${esc(d.issue)}</p>
    ${d.description ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${INK};white-space:pre-wrap">${esc(d.description)}</p>` : ""}
    <p style="margin:16px 0 0;font-size:12px;color:${FAINT}">Please reference the work order number on your invoice, and bill to <strong>Ficco Brothers</strong>. Proof of current insurance may be required before work begins.</p>`;

  return {
    subject: `Work order ${d.workOrderNo} — ${d.issue} · ${d.property} ${d.unit}`,
    html: `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><table role="presentation" width="100%" style="border-collapse:collapse"><tr><td align="center"><table role="presentation" width="600" style="width:600px;max-width:600px;background:#fff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
      <tr><td style="background:${PINE};padding:22px 28px"><div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#f7f3ea">38th Ave Properties</div><div style="font-size:11px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">Work order</div></td></tr>
      <tr><td style="padding:26px 28px 8px"><div style="font-family:Georgia,serif;font-size:21px;color:${INK};margin-bottom:8px">Job request</div>${inner}</td></tr>
      <tr><td style="padding:8px 28px 26px"><div style="border-top:1px solid #f0e9db;padding-top:14px"><p style="margin:0;font-size:12px;color:${FAINT};line-height:1.6">38th Ave Properties · W 38th Ave, Wheat Ridge, CO · (720) 527-2596</p></div></td></tr>
    </table></td></tr></table></div>`,
  };
}
