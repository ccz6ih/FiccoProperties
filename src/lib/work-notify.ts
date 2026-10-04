/**
 * The alert that goes out when work is logged — one shape for a maintenance
 * request and for a task.
 *
 * Tasks sent nothing at all, so a job assigned to someone lived only on a board
 * they had to remember to open. And an alert that names the job without naming
 * the home, the resident or a phone number can't be acted on from a phone,
 * which is where these are read.
 */
import { sendNotification, esc } from "@/lib/email";
import { getOwnerRecipients, sendToEachOwner } from "@/lib/owners";
import { getUnitContact } from "@/lib/unit-contact";
import { formatDate, humanize } from "@/lib/format";

const PINE = "#2f5d50";
const INK = "#2c2622";
const FAINT = "#9b9286";
const TERRA = "#b4562f";
const LINE = "#e6dcc8";
const APP = "https://38thaveproperties.com";

export type WorkNotice = {
  kind: "maintenance" | "task";
  id: string;
  title: string;
  details: string | null;
  category: string;
  priority: string;
  unitId: string | null;
  /** For property-wide work with no unit — "The Villa". */
  propertyName?: string | null;
  dueDate?: string | null;
  assigneeName?: string | null;
  /** Who raised it, when a resident did. */
  reportedBy?: string | null;
  photoCount?: number;
};

const row = (label: string, value: string, tone: "normal" | "warn" = "normal") =>
  `<tr><td style="padding:8px 0;border-bottom:1px solid ${LINE};color:${FAINT};font-size:13px;width:34%;vertical-align:top">${esc(
    label
  )}</td><td style="padding:8px 0;border-bottom:1px solid ${LINE};font-size:15px;color:${
    tone === "warn" ? TERRA : INK
  };font-weight:${tone === "warn" ? 700 : 600}">${value}</td></tr>`;

export function workNoticeEmail(w: WorkNotice, contact: Awaited<ReturnType<typeof getUnitContact>>) {
  const urgent = w.priority === "emergency" || w.priority === "urgent";
  const where = contact.home ?? w.propertyName ?? "No home set";
  const label = w.kind === "maintenance" ? "Maintenance request" : "Task";

  const phone = contact.phone
    ? `<a href="tel:${esc(contact.phone.replace(/[^0-9+]/g, ""))}" style="color:${PINE};font-weight:700;text-decoration:none">${esc(contact.phone)}</a>`
    : `<span style="color:${FAINT}">No phone on file</span>`;
  const mail =
    contact.emails.length > 0
      ? contact.emails
          .map(
            (e) =>
              `<a href="mailto:${esc(e)}" style="color:${PINE};font-weight:600;text-decoration:none">${esc(e)}</a>`
          )
          .join("<br>")
      : `<span style="color:${FAINT}">No email on file</span>`;

  const href =
    w.kind === "maintenance" ? `${APP}/admin/maintenance/${w.id}` : `${APP}/admin/work?q=${encodeURIComponent(w.title)}`;

  const subject = `${urgent ? "🚨 " : ""}${urgent ? "URGENT " : "New "}${
    w.kind === "maintenance" ? "maintenance" : "task"
  } — ${where} — ${w.title}`;

  const html = `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" style="border-collapse:collapse"><tr><td align="center">
  <table role="presentation" width="600" style="width:600px;max-width:600px;background:#fff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
    <tr><td style="background:${urgent ? TERRA : PINE};padding:20px 26px">
      <div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#f7f3ea">38th Ave Properties</div>
      <div style="font-size:11px;color:#e8dfd2;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">${esc(
        urgent ? `Urgent ${label.toLowerCase()}` : label
      )}</div>
    </td></tr>

    <tr><td style="padding:24px 26px 6px">
      <div style="font-family:Georgia,serif;font-size:21px;color:${INK};line-height:1.35;margin-bottom:4px">${esc(
        w.title
      )}</div>
      <div style="font-size:15px;color:${FAINT};margin-bottom:18px">${esc(where)}</div>

      ${
        w.details
          ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:${INK};white-space:pre-line">${esc(
              w.details
            )}</p>`
          : ""
      }

      <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:18px">
        ${contact.address ? row("Address", esc(contact.address)) : ""}
        ${contact.tenantName ? row("Resident", esc(contact.tenantName)) : ""}
        ${w.unitId ? row("Phone", phone) : ""}
        ${w.unitId ? row("Email", mail) : ""}
        ${row("Priority", esc(humanize(w.priority)), urgent ? "warn" : "normal")}
        ${row("Category", esc(humanize(w.category)))}
        ${w.assigneeName ? row("Assigned to", esc(w.assigneeName)) : row("Assigned to", "Nobody yet", "warn")}
        ${w.dueDate ? row("Due", esc(formatDate(w.dueDate))) : ""}
        ${w.reportedBy ? row("Reported by", esc(w.reportedBy)) : ""}
        ${w.photoCount ? row("Photos", String(w.photoCount)) : ""}
      </table>

      <div style="background:#faf7f1;border:1px solid ${LINE};border-radius:10px;padding:13px 16px">
        <a href="${href}" style="color:${PINE};font-weight:700;text-decoration:none;font-size:15px">Open it →</a>
        <span style="color:${FAINT};font-size:13px"> · </span>
        <a href="${APP}/admin/work" style="color:${PINE};font-weight:600;text-decoration:none;font-size:14px">All work</a>
      </div>
    </td></tr>

    <tr><td style="padding:6px 26px 22px">
      <p style="margin:0;font-size:12px;color:${FAINT};line-height:1.6;border-top:1px solid #f0e9db;padding-top:11px">
        38th Ave Properties · reply to this email to reach the office.
      </p>
    </td></tr>
  </table></td></tr></table></div>`;

  return { subject, html };
}

/**
 * Send it. Urgent work goes to every owner; the rest to the staff inbox, so a
 * routine task doesn't wake Lou and Tony.
 */
export async function notifyWorkLogged(w: WorkNotice): Promise<void> {
  const contact = await getUnitContact(w.unitId);
  const { subject, html } = workNoticeEmail(w, contact);
  const meta = {
    kind: w.kind === "maintenance" ? "maintenance_new" : "task_new",
    refType: w.kind,
    refId: w.id,
  };

  if (w.priority === "emergency" || w.priority === "urgent") {
    const owners = await getOwnerRecipients();
    if (owners.length > 0) {
      await sendToEachOwner(owners, { subject, html, meta });
      return;
    }
  }
  await sendNotification({ subject, html, meta });
}
