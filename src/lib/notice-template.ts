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
  city?: string | null;
  county?: string | null;
  amount?: string | number | null; // dollars (past due)
  monthlyRent?: string | number | null; // dollars
  missedDates?: string | null; // e.g. "Jun 1, 2026, Jul 1, 2026"
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
  const city = data.city?.trim() || "";
  const county = data.county?.trim() || "";
  const amount = money(data.amount);
  const rent = money(data.monthlyRent);
  const missed = data.missedDates?.trim() || "";
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
        title: "Demand for Compliance — Notice to Pay Rent or Vacate (10-day)",
        body: `Date: ${today}

CERTIFIED FUNDS ONLY. Personal checks will not be accepted.

DEMAND FOR COMPLIANCE — RESIDENTIAL (C.R.S. § 13-40-104 and § 13-40-106)

To: ${tenant}, and any other occupants
Premises: ${addr}${city ? `, ${city}` : ""}, Colorado${county ? ` — ${county} County` : ""}
The rent for the premises is ${rent} per month.

GROUNDS: You are in default for non-payment of rent. Past rent due: ${amount}${missed ? `, for payment(s) due on: ${missed}` : ` for ${period}`}.

TIME TO COMPLY: Within TEN (10) DAYS after this notice is served on you — on or before ${cure} — you must either:
  (1) pay the full past-due amount stated above in certified funds, OR
  (2) move out and return possession of the premises to the Landlord.

If you do not pay or move out within ten (10) days, the Landlord may begin a court eviction case (Forcible Entry and Detainer, C.R.S. § 13-40-101 et seq.) to recover possession of the premises, the amounts owed, and court costs.

YOUR RIGHTS (C.R.S. § 13-40-106):
  • Mandatory mediation: If you receive Supplemental Security Income (SSI), Social Security Disability Insurance (SSDI), or Cash Assistance through the Colorado Works Program, you may be entitled to mandatory mediation at no cost before an eviction case is filed. Tell the Landlord in writing right away if you are enrolled in one of these programs.
  • Repayment plan: If you missed a rent payment because you are the victim-survivor of unlawful sexual behavior, stalking, or domestic violence or abuse, you may be entitled to a repayment plan of up to nine (9) months. Provide the Landlord with written documentation.

To pay or ask questions, contact the office at (720) 527-2596.

38th Ave Properties, Landlord
By: ____________________________
Date served: ____________   Method of service: ____________`,
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
