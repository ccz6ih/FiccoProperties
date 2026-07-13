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
  | "no_fault_late"
  | "terminate_substantial"
  | "terminate_repeat"
  | "terminate_nonrenewal"
  | "lease_violation"
  | "entry"
  | "general";

export const NOTICE_LABELS: Record<NoticeType, string> = {
  late_rent: "Late rent reminder",
  pay_or_quit: "Notice to pay rent or vacate (10-day)",
  no_fault_late: "No-fault eviction — repeated late payment (90-day)",
  terminate_substantial: "Terminate tenancy — substantial violation (3-day)",
  terminate_repeat: "Terminate tenancy — repeat violation (10-day)",
  terminate_nonrenewal: "Terminate tenancy — non-renewal",
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
  moveOutDate?: string | null; // display string (move-out date) for termination notices
  demandCount?: number | null; // # of served demands on record
  demandDates?: string | null; // e.g. "May 9, 2026; Jun 9, 2026"
  priorDemandDate?: string | null; // served date of the prior demand (repeat violation)
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
  const moveOut = data.moveOutDate?.trim() || data.cureBy?.trim() || "the date stated below";
  const demandCount = data.demandCount ?? 0;
  const demandDates = data.demandDates?.trim() || "";
  const priorDemand = data.priorDemandDate?.trim() || "____________";
  const reasonText = data.reason?.trim() || "[Describe the violation and which lease term or community rule was broken.]";
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

    case "no_fault_late":
      return {
        title: "Notice of No-Fault Eviction — Termination for Repeated Late Payment (90-day)",
        body: `Date: ${today}

NOTICE OF NO-FAULT EVICTION — RESIDENTIAL (C.R.S. § 38-12-1303(3)(f))

To: ${tenant}, and any other occupants
Premises: ${addr}${city ? `, ${city}` : ""}, Colorado${county ? ` — ${county} County` : ""}

TERMINATION OF TENANCY: The Landlord is ending your tenancy and will begin the eviction process. This is NOT a demand to pay rent — no payment will cure or stop this notice.

MOVE-OUT DATE: You must move out and return possession of the premises on or before ${moveOut} (at least ninety (90) days after this notice is served on you). If you do not move out by that date, the Landlord may file a court eviction case (C.R.S. § 13-40-101 et seq.).

CAUSE — HISTORY OF LATE PAYMENTS (C.R.S. § 38-12-1303(3)(f)):
Your tenancy is being terminated because you have been late with more than two (2) rent payments. Each of those payments was made more than ten (10) days after it was due, and for each the Landlord served you a written Demand for Compliance before this notice.
${demandCount ? `Demands for Compliance served: ${demandCount}${demandDates ? ` (on ${demandDates})` : ""}.` : "Demands for Compliance were served for each late payment; copies are on file."}

YOUR RIGHTS (C.R.S. § 13-40-106(2)):
If you receive Supplemental Security Income (SSI), Social Security Disability Insurance (SSDI), or Cash Assistance through the Colorado Works Program, you may be entitled to mandatory mediation at no cost before the Landlord can file an eviction case. Notify the Landlord in writing right away if you are enrolled in one of these programs. Mediation can be scheduled at www.ColoradoODR.org.

This notice is served under C.R.S. § 38-12-1303 and § 13-40-108. Personal service was attempted; if personal service could not be completed after two attempts, this notice was posted on the premises.

To ask questions, contact the office at (720) 527-2596.

38th Ave Properties, Landlord
By: ____________________________  (Landlord / Agent / Attorney)
Date served: ____________   Method of service: ____________`,
      };

    case "terminate_substantial":
      return {
        title: "Notice to Terminate Tenancy — Substantial Violation (3-day)",
        body: `Date: ${today}

NOTICE TO TERMINATE TENANCY — SUBSTANTIAL VIOLATION (C.R.S. § 13-40-104(1)(d.5) and § 13-40-107.5)

To: ${tenant}, and any other occupants
Premises: ${addr}${city ? `, ${city}` : ""}, Colorado${county ? ` — ${county} County` : ""}

TERMINATION: The Landlord is ending your tenancy for a substantial violation. This is NOT a cure notice — the violation cannot be cured.

MOVE-OUT DATE: You must move out and return possession of the premises on or before ${moveOut} (at least THREE (3) DAYS after this notice is served on you). If you do not move out, the Landlord may file a court eviction case (C.R.S. § 13-40-101 et seq.).

GROUNDS — SUBSTANTIAL VIOLATION: You, or a person you invited onto the property, committed a substantial violation under C.R.S. § 13-40-107.5 — that is, an act that (a) willfully and substantially endangered the premises or other residents, (b) was a violent or drug-related felony, or (c) was a criminal act that constitutes a public nuisance and could result in jail time of 180 days or more.

Description: ${reasonText}

YOUR RIGHTS (C.R.S. § 13-40-106(2)): If you receive Supplemental Security Income (SSI), Social Security Disability Insurance (SSDI), or Cash Assistance through the Colorado Works Program, you may be entitled to mandatory mediation at no cost before the Landlord files an eviction case. Notify the Landlord in writing right away. Mediation: www.ColoradoODR.org.

This notice is served under C.R.S. § 13-40-107.5 and § 13-40-108. For a substantial violation, only one attempt at personal service is required before posting.

38th Ave Properties, Landlord
By: ____________________________  (Landlord / Agent / Attorney)
Date served: ____________   Method of service: ____________`,
      };

    case "terminate_repeat":
      return {
        title: "Notice to Terminate Tenancy — Repeat Lease Violation (10-day)",
        body: `Date: ${today}

NOTICE TO TERMINATE TENANCY — REPEAT LEASE VIOLATION (C.R.S. § 13-40-104(1)(e.5))

To: ${tenant}, and any other occupants
Premises: ${addr}${city ? `, ${city}` : ""}, Colorado${county ? ` — ${county} County` : ""}

TERMINATION: The Landlord is ending your tenancy for repeating a lease violation for which you were already given written notice and an opportunity to comply.

MOVE-OUT DATE: You must move out and return possession of the premises on or before ${moveOut} (at least TEN (10) DAYS after this notice is served on you). If you do not move out, the Landlord may file a court eviction case (C.R.S. § 13-40-101 et seq.).

GROUNDS — REPEAT VIOLATION: You have again violated the same term of your lease or the community rules. A Demand for Compliance (JDF 99A) detailing the prior violation was served on you on ${priorDemand}. Because the violation has recurred, no further opportunity to cure is required.

Description: ${reasonText}

YOUR RIGHTS (C.R.S. § 13-40-106(2)): If you receive Supplemental Security Income (SSI), Social Security Disability Insurance (SSDI), or Cash Assistance through the Colorado Works Program, you may be entitled to mandatory mediation at no cost before the Landlord files an eviction case. Notify the Landlord in writing right away. Mediation: www.ColoradoODR.org.

This notice is served under C.R.S. § 13-40-104 and § 13-40-108. Personal service was attempted; if it could not be completed after two attempts, this notice was posted on the premises.

38th Ave Properties, Landlord
By: ____________________________  (Landlord / Agent / Attorney)
Date served: ____________   Method of service: ____________`,
      };

    case "terminate_nonrenewal":
      return {
        title: "Notice to Terminate Tenancy — Non-Renewal",
        body: `Date: ${today}

NOTICE TO TERMINATE TENANCY — NON-RENEWAL (C.R.S. § 13-40-107)

To: ${tenant}, and any other occupants
Premises: ${addr}${city ? `, ${city}` : ""}, Colorado${county ? ` — ${county} County` : ""}

TERMINATION: The Landlord is ending your tenancy. Your rental agreement will not be renewed and your tenancy will end.

MOVE-OUT DATE: You must move out and return possession of the premises on or before ${moveOut}. If you do not move out, the Landlord may file a court eviction case (C.R.S. § 13-40-101 et seq.).

${reasonText === "[Describe the violation and which lease term or community rule was broken.]" ? "" : `Note: ${reasonText}\n\n`}YOUR RIGHTS (C.R.S. § 13-40-106(2)): If you receive Supplemental Security Income (SSI), Social Security Disability Insurance (SSDI), or Cash Assistance through the Colorado Works Program, you may be entitled to mandatory mediation at no cost before the Landlord files an eviction case. Notify the Landlord in writing right away. Mediation: www.ColoradoODR.org.

This notice is served under C.R.S. § 13-40-107 and § 13-40-108.

38th Ave Properties, Landlord
By: ____________________________  (Landlord / Agent / Attorney)
Date served: ____________   Method of service: ____________`,
      };

    case "lease_violation":
      return {
        title: "Demand for Compliance — Lease Violation (Comply or Vacate)",
        body: `Date: ${today}

DEMAND FOR COMPLIANCE — RESIDENTIAL (C.R.S. § 13-40-104(1)(e) and § 13-40-106)

To: ${tenant}, and any other occupants
Premises: ${addr}${city ? `, ${city}` : ""}, Colorado${county ? ` — ${county} County` : ""}

GROUNDS: You are in violation of your Residential Lease Agreement and/or the Community Rules:

${reasonText}

TIME TO COMPLY: On or before ${cure} — the compliance deadline stated in this notice — you must EITHER:
  (1) fully correct the violation described above and comply with the lease, OR
  (2) move out and deliver possession of the premises to the Landlord.

If you do not do one of these by the date above, the Landlord may begin a court eviction case (Forcible Entry and Detainer, C.R.S. § 13-40-101 et seq.) to recover possession of the premises and the costs allowed by law. Any cost the Landlord incurs to cure the violation may be charged as additional rent; eviction for non-payment, however, applies only to rent, not to fees.

YOUR RIGHTS (C.R.S. § 13-40-106):
  • Mandatory mediation: If you receive Supplemental Security Income (SSI), Social Security Disability Insurance (SSDI), or Cash Assistance through the Colorado Works Program, you may be entitled to mandatory mediation at no cost before an eviction case is filed. Tell the Landlord in writing right away if you are enrolled in one of these programs.
  • Survivor protections: If this condition or violation results from domestic violence, abuse, stalking, or unlawful sexual behavior — including a lock change made for your safety — you may have protections and defenses under Colorado law, and you cannot be penalized for it. Please notify the Landlord in writing and provide the documentation the law requires; the Landlord will work with you on a lawful arrangement (such as a lock addendum and key) rather than take adverse action.

To resolve this or ask questions, contact the office at (720) 527-2596.

38th Ave Properties, Landlord
By: ____________________________  (Landlord / Agent)
Date served: ____________   Method of service: ____________`,
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
