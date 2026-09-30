/**
 * Move-out notice to the owners.
 *
 * A move-out is the one event where the clock starts the moment it happens:
 * Colorado gives the landlord 30 days from the day possession comes back to
 * return the deposit or itemise deductions, and it has to go to a forwarding
 * address. So this email leads with the deadline and the address, says plainly
 * when one is missing, and lists what the walk-through found — Lou and Tony
 * read these on paper, so it is big type and short lines.
 */
import { sendNotification, esc } from "@/lib/email";
import { getOwnerRecipients, sendToEachOwner } from "@/lib/owners";
import { formatCents, formatDate } from "@/lib/format";

const PINE = "#2f5d50";
const INK = "#2c2622";
const FAINT = "#9b9286";
const TERRA = "#b4562f";
const LINE = "#e6dcc8";
const APP = "https://38thaveproperties.com";

export type MoveOutSummary = {
  unitId: string;
  home: string;
  tenantName: string;
  moveInDate: string | null;
  moveOutDate: string;
  rentCents: number | null;
  depositCents: number | null;
  forwardingAddress: string | null;
  reason: string | null;
  noticeGivenOn: string | null;
  checklist: { label: string; ok: boolean; note?: string }[];
  voidedCharges: number;
};

/** "4 years" / "8 months" — how long they were here, in plain words. */
function tenure(from: string | null, to: string): string | null {
  if (!from) return null;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const months = Math.max(
    0,
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  );
  const years = Math.floor(months / 12);
  if (years >= 1) return `${years} year${years === 1 ? "" : "s"}`;
  return `${months} month${months === 1 ? "" : "s"}`;
}

const row = (label: string, value: string, tone: "normal" | "warn" = "normal") =>
  `<tr><td style="padding:9px 0;border-bottom:1px solid ${LINE};color:${FAINT};font-size:14px;width:44%">${esc(
    label
  )}</td><td style="padding:9px 0;border-bottom:1px solid ${LINE};font-size:16px;font-weight:600;color:${
    tone === "warn" ? TERRA : INK
  }">${value}</td></tr>`;

export function moveOutEmail(s: MoveOutSummary): { subject: string; html: string } {
  // 30 days from the day possession came back (C.R.S. 38-12-103).
  const deadline = new Date(`${s.moveOutDate}T00:00:00`);
  deadline.setDate(deadline.getDate() + 30);
  const deadlineIso = deadline.toISOString().slice(0, 10);

  const stay = tenure(s.moveInDate, s.moveOutDate);
  const done = s.checklist.filter((c) => c.ok).length;
  const problems = s.checklist.filter((c) => !c.ok);

  const checklistHtml = s.checklist
    .map(
      (c) =>
        `<li style="padding:7px 0;border-bottom:1px solid #f0e9db;font-size:15px;color:${
          c.ok ? INK : TERRA
        };line-height:1.5">${c.ok ? "✅" : "⚠️"} ${esc(c.label)}${
          c.note ? ` <span style="color:${FAINT}">— ${esc(c.note)}</span>` : ""
        }</li>`
    )
    .join("");

  const subject = `Move-out — ${s.home} · ${s.tenantName}`;

  const html = `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" style="border-collapse:collapse"><tr><td align="center">
  <table role="presentation" width="620" style="width:620px;max-width:620px;background:#fff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
    <tr><td style="background:${PINE};padding:22px 28px">
      <div style="font-family:Georgia,serif;font-size:21px;font-weight:600;color:#f7f3ea">38th Ave Properties</div>
      <div style="font-size:12px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">Move-out recorded</div>
    </td></tr>

    <tr><td style="padding:26px 28px 6px">
      <div style="font-family:Georgia,serif;font-size:24px;color:${INK};line-height:1.35;margin-bottom:6px">
        ${esc(s.tenantName)} moved out of ${esc(s.home)}
      </div>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:${INK}">
        Keys back ${esc(formatDate(s.moveOutDate))}${stay ? ` after ${esc(stay)} here` : ""}.
        ${s.reason ? `Reason given: ${esc(s.reason)}.` : ""}
        The home is empty and in make-ready.
      </p>

      <!-- The deposit clock: the one thing that can go wrong by doing nothing -->
      <div style="background:${s.forwardingAddress ? "#faf7f1" : "#fdf2ee"};border:2px solid ${
        s.forwardingAddress ? LINE : "rgba(180,86,47,.45)"
      };border-radius:12px;padding:16px 18px;margin-bottom:22px">
        <div style="font-size:12px;color:${FAINT};text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Deposit — return by ${esc(
          formatDate(deadlineIso)
        )}</div>
        <div style="font-size:19px;font-weight:700;color:${INK};margin-bottom:8px">
          ${s.depositCents ? formatCents(s.depositCents) : "No deposit on file"} held
        </div>
        <div style="font-size:15px;line-height:1.6;color:${INK}">
          ${
            s.forwardingAddress
              ? `Mail it to:<br><strong style="font-size:16px">${esc(s.forwardingAddress).replace(/\n/g, "<br>")}</strong>`
              : `<strong style="color:${TERRA}">No forwarding address on file yet.</strong> Colorado gives us 30 days from move-out to return the deposit or send an itemised list of deductions — get an address before that date.`
          }
        </div>
      </div>

      <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:22px">
        ${row("Home", esc(s.home))}
        ${row("Resident", esc(s.tenantName))}
        ${s.moveInDate ? row("Moved in", esc(formatDate(s.moveInDate))) : ""}
        ${row("Moved out", esc(formatDate(s.moveOutDate)))}
        ${s.noticeGivenOn ? row("Notice given", esc(formatDate(s.noticeGivenOn))) : row("Notice given", "Not recorded", "warn")}
        ${s.rentCents ? row("Rent was", formatCents(s.rentCents)) : ""}
        ${s.voidedCharges > 0 ? row("Rent voided after move-out", `${s.voidedCharges} charge${s.voidedCharges === 1 ? "" : "s"}`) : ""}
      </table>

      <div style="font-family:Georgia,serif;font-size:19px;color:${
        problems.length > 0 ? TERRA : PINE
      };margin-bottom:6px">Move-out checklist — ${done} of ${s.checklist.length} clear</div>
      <ul style="margin:0 0 22px;padding:0;list-style:none">${checklistHtml}</ul>

      <div style="background:#faf7f1;border:1px solid ${LINE};border-radius:10px;padding:14px 18px">
        <a href="${APP}/admin/move-out/${s.unitId}" style="color:${PINE};font-weight:700;text-decoration:none;font-size:16px">Open the deposit statement →</a>
        <div style="font-size:14px;color:${FAINT};margin-top:4px">Itemise any deductions there, then print it for the file.</div>
      </div>
    </td></tr>

    <tr><td style="padding:8px 28px 26px">
      <p style="margin:0;font-size:13px;color:${FAINT};line-height:1.6;border-top:1px solid #f0e9db;padding-top:12px">
        Sent to the owners of 38th Ave Properties whenever a move-out is recorded. Reply to reach the office.
      </p>
    </td></tr>
  </table></td></tr></table></div>`;

  return { subject, html };
}

/** Email the owners that a home has come empty. Best-effort. */
export async function notifyOwnersOfMoveOut(s: MoveOutSummary): Promise<void> {
  const { subject, html } = moveOutEmail(s);
  const recipients = await getOwnerRecipients();
  if (recipients.length === 0) {
    await sendNotification({ subject, html, meta: { kind: "move_out" } });
    return;
  }
  await sendToEachOwner(recipients, { subject, html, meta: { kind: "move_out" } });
}
