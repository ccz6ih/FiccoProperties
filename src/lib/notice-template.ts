/**
 * 38th Ave Properties notice/posting templates — original wording.
 * Generates a prefilled title + body for common resident notices. These are
 * staff convenience templates, not legal advice; for an eviction filing use
 * Colorado's official JDF forms and/or your attorney. Staff can edit any field
 * before printing/serving.
 */
export type NoticeType =
  | "late_rent"
  | "pay_or_quit"
  | "lease_violation"
  | "entry"
  | "general";

export const NOTICE_LABELS: Record<NoticeType, string> = {
  late_rent: "Late rent reminder",
  pay_or_quit: "Notice to pay rent or vacate (10-day)",
  lease_violation: "Notice of lease violation",
  entry: "Notice of intent to enter",
  general: "General notice",
};

export type NoticeData = {
  tenantName?: string | null;
  homeLabel?: string | null; // e.g. "The Villa — Unit 7"
  fullAddress?: string | null;
  amount?: string | number | null; // dollars
  period?: string | null; // e.g. "July 2026"
  dueDate?: string | null; // display string
  cureBy?: string | null; // display string (e.g. 10 days out)
  reason?: string | null; // violation description / entry reason
  entryDate?: string | null;
  entryTime?: string | null;
  customTitle?: string | null;
  customBody?: string | null;
  today?: string; // display string for the notice date
};

function money(v: string | number | null | undefined): string {
  if (v == null || v === "") return "$________";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "$________";
  return `$${n.toLocaleString("en-US")}`;
}

export function buildNotice(
  type: NoticeType,
  data: NoticeData
): { title: string; body: string } {
  const tenant = data.tenantName?.trim() || "Resident";
  const home = data.homeLabel?.trim() || "your unit";
  const addr = data.fullAddress?.trim() || home;
  const amount = money(data.amount);
  const period = data.period?.trim() || "the current period";
  const due = data.dueDate?.trim() || "the due date";
  const cure = data.cureBy?.trim() || "the date stated below";
  const today = data.today?.trim() || "____________";

  switch (type) {
    case "late_rent":
      return {
        title: "Late rent reminder",
        body: `Date: ${today}

To: ${tenant}
Re: ${addr}

This is a friendly reminder that rent of ${amount} for ${period} was due on ${due} and our records show it remains unpaid. A late fee may apply under your lease.

Please bring your balance current as soon as possible. If you have already paid, thank you — please disregard this notice. If you have questions or need to make arrangements, call our office at (720) 527-2596.

Thank you,
38th Ave Properties`,
      };

    case "pay_or_quit":
      return {
        title: "Notice to pay rent or vacate",
        body: `Date: ${today}

To: ${tenant}, and all others in possession
Premises: ${addr}

YOU ARE HEREBY NOTIFIED that rent in the amount of ${amount} for ${period} is past due and owing. You are in default under your lease.

You are required, within TEN (10) DAYS after service of this notice, on or before ${cure}, to either:
  (1) pay the full amount of rent due, or
  (2) vacate and surrender possession of the premises.

If you neither pay nor vacate within ten (10) days, the Landlord may begin a Forcible Entry and Detainer (eviction) action under Colorado law (C.R.S. § 13-40-101 et seq.) to recover possession, rent, and costs.

You may pay or contact the office at (720) 527-2596.

38th Ave Properties, Landlord
By: ____________________________`,
      };

    case "lease_violation":
      return {
        title: "Notice of lease violation",
        body: `Date: ${today}

To: ${tenant}
Premises: ${addr}

This notice is to inform you of a violation of your lease and the community rules:

${data.reason?.trim() || "[Describe the violation]"}

Please correct this violation on or before ${cure}. Failure to correct it may result in further action, including termination of your tenancy as allowed by law.

If you have questions, call our office at (720) 527-2596.

38th Ave Properties, Landlord
By: ____________________________`,
      };

    case "entry":
      return {
        title: "Notice of intent to enter",
        body: `Date: ${today}

To: ${tenant}
Premises: ${addr}

Please be advised that the Landlord or its agents intend to enter the above premises on ${data.entryDate?.trim() || "____________"}${data.entryTime?.trim() ? ` at approximately ${data.entryTime.trim()}` : ""} for the following purpose:

${data.reason?.trim() || "[Reason for entry — e.g. repairs, inspection, or to show the unit]"}

You do not need to be present. If this time is not workable, please call our office at (720) 527-2596 to arrange another time.

Thank you,
38th Ave Properties`,
      };

    case "general":
    default:
      return {
        title: data.customTitle?.trim() || "Notice",
        body:
          data.customBody?.trim() ||
          `Date: ${today}

To: ${tenant}
Premises: ${addr}

[Write your notice here.]

38th Ave Properties`,
      };
  }
}
