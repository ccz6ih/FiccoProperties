/**
 * Tenant rent-reminder emails — the "prevent" ladder. Gentle on the 1st, a
 * friendly nudge on the 3rd, and a last heads-up before the grace period ends
 * on the 6th. Email-safe inline styles.
 */
import { formatCents } from "@/lib/format";
import { esc } from "@/lib/email";

export type ReminderStage = "due" | "followup" | "grace";

const PINE = "#2f5d50";
const INK = "#2c2622";
const SOFT = "#6f655a";
const FAINT = "#9b9286";
const TERRA = "#b4562f";
const LINE = "#e6dcc8";

const COPY: Record<
  ReminderStage,
  { subject: (m: string) => string; heading: string; lead: (a: string) => string; tone: string }
> = {
  due: {
    subject: (m) => `Friendly reminder: ${m} rent is due`,
    heading: "Rent is due",
    lead: (a) => `This is a friendly reminder that your rent of <strong>${a}</strong> is due. Thank you for being a great resident!`,
    tone: PINE,
  },
  followup: {
    subject: (m) => `Reminder: ${m} rent is still open`,
    heading: "A quick reminder",
    lead: (a) => `Our records show <strong>${a}</strong> in rent is still open for this month. If you've already paid, thank you — please disregard. Otherwise, please bring it current when you can.`,
    tone: PINE,
  },
  grace: {
    subject: (m) => `Last reminder before a late fee — ${m} rent`,
    heading: "Grace period ends tomorrow",
    lead: (a) => `Your rent of <strong>${a}</strong> is still open. The grace period ends tomorrow — please pay by then to avoid a late fee.`,
    tone: TERRA,
  },
};

export function renderReminderEmail(opts: {
  stage: ReminderStage;
  name: string;
  home: string;
  monthLabel: string;
  amountCents: number;
  hasPortal: boolean;
  appUrl: string;
}): { subject: string; html: string } {
  const c = COPY[opts.stage];
  const amount = formatCents(opts.amountCents);
  const subject = c.subject(opts.monthLabel);
  const dropBox = `<div style="border:1px solid ${LINE};border-radius:10px;padding:10px 14px;margin:4px 0 8px"><div style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.04em">Rent drop box (check or money order)</div><div style="font-size:14px;font-weight:600;color:${INK}">11080 W 38th Ave, #7 · Wheat Ridge, CO 80033</div><div style="font-size:13px;color:${INK};margin-top:3px">Make checks / money orders payable to <strong>Ficco Brothers</strong>.</div><div style="font-size:12px;color:${FAINT}">Please write your unit number on your payment.</div></div>`;
  const payLine = opts.hasPortal
    ? `${dropBox}<a href="${opts.appUrl}/portal/payments" style="display:inline-block;background:${PINE};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">See your balance in the portal</a>`
    : `${dropBox}<div style="font-size:13px;color:${INK}">Questions? Call <strong>(720) 527-2596</strong>.</div>`;

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:${INK}">
    <div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:${PINE};margin-bottom:4px">38th Ave Properties</div>
    <div style="font-size:13px;color:${FAINT};margin-bottom:16px">${esc(opts.home)} · ${esc(opts.monthLabel)}</div>

    <div style="font-family:Georgia,serif;font-size:18px;font-weight:600;color:${c.tone};margin-bottom:8px">${c.heading}</div>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${INK}">Hi ${esc(opts.name)},</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${INK}">${c.lead(amount)}</p>

    <table role="presentation" style="border-collapse:collapse;margin:0 0 18px">
      <tr>
        <td style="border:1px solid ${LINE};border-radius:10px;padding:12px 18px">
          <div style="font-size:11px;color:${FAINT};text-transform:uppercase;letter-spacing:.04em">Amount due</div>
          <div style="font-size:22px;font-weight:700;color:${INK};font-family:Georgia,serif">${amount}</div>
        </td>
      </tr>
    </table>

    <div style="margin-bottom:18px">${payLine}</div>

    <p style="margin:0;font-size:12px;color:${FAINT}">Questions or need to make arrangements? Reply to this email or call (720) 527-2596. If you've already paid, thank you and please disregard.</p>
    <p style="margin:14px 0 0;font-size:12px;color:${FAINT}">38th Ave Properties · W 38th Ave, Wheat Ridge, CO · Equal Housing Opportunity</p>
  </div>`;

  return { subject, html };
}
