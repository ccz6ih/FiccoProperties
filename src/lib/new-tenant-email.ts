/**
 * "We rented it" — the note to the owners when a home is let.
 *
 * Lou and Tony read these on paper and want two things in the first five
 * seconds: who's moving in, and what it rents for compared to last time. So
 * the rent change leads, in big type, and the detail sits under it.
 *
 * The paperwork list is honest about what's still outstanding. A congratulatory
 * email that implies the lease is signed when it isn't is how a home gets
 * occupied with nothing on file.
 */
import { sendNotification, esc } from "@/lib/email";
import { getOwnerRecipients, sendToEachOwner } from "@/lib/owners";
import { formatCents, formatDate } from "@/lib/format";
import { RENT_DROPBOX } from "@/lib/rent-dropbox";

const PINE = "#2f5d50";
const INK = "#2c2622";
const FAINT = "#9b9286";
const TERRA = "#b4562f";
const LINE = "#e6dcc8";
const APP = "https://38thaveproperties.com";

export type NewTenantSummary = {
  unitId: string;
  home: string;
  /** The household as it'll read on the rent board. */
  tenantName: string;
  email: string | null;
  phone: string | null;
  rentCents: number | null;
  /** What the last resident paid, for the comparison. */
  priorRentCents: number | null;
  priorTenantName: string | null;
  depositCents: number | null;
  moveInDate: string | null;
  moveInConfirmed: boolean;
  /** "Money order, payable to Ficco Brothers" — already worded for reading. */
  paymentPreferenceLabel: string | null;
  /** Plain-English screening points, already vetted for what's shareable. */
  screening: string[];
  paperwork: { label: string; ok: boolean; note?: string }[];
  /** The day the keys came back, which is when the home started costing us. */
  vacantSince: string | null;
  /** When the make-ready finished — most of "empty" is usually this, not market. */
  turnCompletedOn: string | null;
  /** Whole months that earned nothing, and what they were worth at the old rent. */
  monthsVacant: number | null;
  lostRentCents: number | null;
  /** The day we took the application — how fast it let, separate from the turn. */
  rentedOn: string | null;
};

/** Whole days between two ISO dates. */
const dayGap = (from: string, to: string) =>
  Math.max(
    0,
    Math.round(
      (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000
    )
  );

const row = (label: string, value: string) =>
  `<tr><td style="padding:9px 0;border-bottom:1px solid ${LINE};color:${FAINT};font-size:14px;width:40%">${esc(
    label
  )}</td><td style="padding:9px 0;border-bottom:1px solid ${LINE};font-size:16px;font-weight:600;color:${INK}">${value}</td></tr>`;

export function newTenantEmail(s: NewTenantSummary): { subject: string; html: string } {
  const rent = s.rentCents;
  const prior = s.priorRentCents;
  const up = rent != null && prior != null && rent > prior ? rent - prior : null;
  const down = rent != null && prior != null && rent < prior ? prior - rent : null;

  const outstanding = s.paperwork.filter((p) => !p.ok);
  const done = s.paperwork.length - outstanding.length;

  const paperworkHtml = s.paperwork
    .map(
      (p) =>
        `<li style="padding:8px 0;border-bottom:1px solid #f0e9db;font-size:16px;color:${
          p.ok ? INK : TERRA
        };line-height:1.5">${p.ok ? "✅" : "⬜"} ${esc(p.label)}${
          p.note ? ` <span style="color:${FAINT};font-size:15px">— ${esc(p.note)}</span>` : ""
        }</li>`
    )
    .join("");

  const screeningHtml = s.screening
    .map(
      (line) =>
        `<li style="padding:6px 0;font-size:16px;line-height:1.55;color:${INK}">• ${esc(line)}</li>`
    )
    .join("");

  const subject = `Rented — ${s.home} · ${s.tenantName}`;

  const html = `<div style="background:#f2ece0;margin:0;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" style="border-collapse:collapse"><tr><td align="center">
  <table role="presentation" width="620" style="width:620px;max-width:620px;background:#fff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
    <tr><td style="background:${PINE};padding:22px 28px">
      <div style="font-family:Georgia,serif;font-size:21px;font-weight:600;color:#f7f3ea">38th Ave Properties</div>
      <div style="font-size:12px;color:#bcd2c8;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">A home is rented</div>
    </td></tr>

    <tr><td style="padding:26px 28px 6px">
      <div style="font-family:Georgia,serif;font-size:26px;color:${INK};line-height:1.3;margin-bottom:10px">
        Good news — ${esc(s.home)} is rented 🎉
      </div>
      <p style="margin:0 0 22px;font-size:17px;line-height:1.6;color:${INK}">
        <strong>${esc(s.tenantName)}</strong> will be moving in${
          s.moveInDate
            ? ` on ${esc(formatDate(s.moveInDate))}${s.moveInConfirmed ? "" : " (not yet confirmed by them)"}`
            : ", and we're waiting on them to tell us the day"
        }.
      </p>

      ${
        s.vacantSince
          ? `<div style="background:#faf7f1;border:1px solid ${LINE};border-radius:12px;padding:16px 18px;margin-bottom:22px">
               <div style="font-size:12px;color:${FAINT};text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">How the turn went</div>
               <div style="font-size:16px;line-height:1.65;color:${INK}">
                 Keys came back ${esc(formatDate(s.vacantSince))}${
                   s.turnCompletedOn
                     ? `, and the make-ready finished ${esc(formatDate(s.turnCompletedOn))} — ${esc(
                         String(dayGap(s.vacantSince, s.turnCompletedOn))
                       )} days of work on the home`
                     : ""
                 }. ${
                   s.rentedOn && s.turnCompletedOn && s.rentedOn <= s.turnCompletedOn
                     ? "It was rented before the work was even finished."
                     : s.rentedOn
                       ? `Rented ${esc(formatDate(s.rentedOn))}.`
                       : ""
                 }
               </div>
               ${
                 s.lostRentCents && s.monthsVacant
                   ? `<div style="font-size:16px;line-height:1.65;color:${INK};margin-top:8px">
                        ${esc(String(s.monthsVacant))} month${s.monthsVacant === 1 ? "" : "s"} earned nothing while we turned it — ${esc(
                          formatCents(s.lostRentCents)
                        )} at the old rent.${
                          up != null && up > 0
                            ? ` At the new rent that's back in ${esc(
                                String(Math.ceil(s.lostRentCents / up))
                              )} months.`
                            : ""
                        }
                      </div>`
                   : ""
               }
             </div>`
          : ""
      }

      <!-- The number they want first: what it rents for now. -->
      <div style="background:#faf7f1;border:2px solid ${LINE};border-radius:12px;padding:18px;margin-bottom:24px;text-align:center">
        <div style="font-size:12px;color:${FAINT};text-transform:uppercase;letter-spacing:.06em">Rent</div>
        <div style="font-family:Georgia,serif;font-size:36px;font-weight:700;color:${PINE};line-height:1.15;margin:4px 0">
          ${rent != null ? esc(formatCents(rent)) : "Not set"}<span style="font-size:19px;font-weight:400;color:${FAINT}"> / month</span>
        </div>
        ${
          up != null
            ? `<div style="font-size:17px;font-weight:600;color:${PINE}">That's ${esc(
                formatCents(up)
              )} a month more than ${esc(s.priorTenantName ?? "the last resident")} paid — ${esc(
                formatCents(up * 12)
              )} more over a year.</div>`
            : down != null
              ? `<div style="font-size:16px;color:${TERRA}">That's ${esc(
                  formatCents(down)
                )} a month less than before.</div>`
              : prior != null
                ? `<div style="font-size:16px;color:${FAINT}">Same as before.</div>`
                : ""
        }
      </div>

      <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:24px">
        ${row("Home", esc(s.home))}
        ${row("Who's moving in", esc(s.tenantName))}
        ${s.email ? row("Email", esc(s.email)) : ""}
        ${s.phone ? row("Phone", esc(s.phone)) : ""}
        ${row("Deposit", s.depositCents ? esc(formatCents(s.depositCents)) : "Not set yet")}
        ${row(
          "Paying by",
          s.paymentPreferenceLabel ?? "They haven't told us yet"
        )}
      </table>

      ${
        screeningHtml
          ? `<div style="font-family:Georgia,serif;font-size:20px;color:${INK};margin-bottom:4px">What the background check showed</div>
             <ul style="margin:0 0 24px;padding:0;list-style:none">${screeningHtml}</ul>`
          : ""
      }

      <div style="font-family:Georgia,serif;font-size:20px;color:${
        outstanding.length > 0 ? TERRA : PINE
      };margin-bottom:4px">Paperwork — ${done} of ${s.paperwork.length} done</div>
      <ul style="margin:0 0 10px;padding:0;list-style:none">${paperworkHtml}</ul>
      ${
        outstanding.length > 0
          ? `<p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:${INK}">
               Nothing for either of you to do — Craig is handling the rest. The empty boxes
               above are just what's still to come.
             </p>`
          : `<p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:${INK}">
               Everything is signed and on file.
             </p>`
      }

      <div style="background:#faf7f1;border:1px solid ${LINE};border-radius:10px;padding:14px 18px">
        <a href="${APP}/admin/units/${s.unitId}" style="color:${PINE};font-weight:700;text-decoration:none;font-size:16px">See the home and the file →</a>
        <div style="font-size:14px;color:${FAINT};margin-top:4px">Rent, paperwork, photos and history, all in one place.</div>
      </div>
    </td></tr>

    <tr><td style="padding:8px 28px 26px">
      <p style="margin:0;font-size:13px;color:${FAINT};line-height:1.6;border-top:1px solid #f0e9db;padding-top:12px">
        Sent to the owners of 38th Ave Properties whenever a home is rented.
        Questions? Call the office on ${esc(RENT_DROPBOX.phone)} or just reply to this email.
      </p>
    </td></tr>
  </table></td></tr></table></div>`;

  return { subject, html };
}

/** Email the owners that a home is let. Best-effort — never blocks the save. */
export async function notifyOwnersOfNewTenant(s: NewTenantSummary): Promise<void> {
  const { subject, html } = newTenantEmail(s);
  const recipients = await getOwnerRecipients();
  if (recipients.length === 0) {
    await sendNotification({ subject, html, meta: { kind: "new_tenant" } });
    return;
  }
  await sendToEachOwner(recipients, { subject, html, meta: { kind: "new_tenant" } });
}
