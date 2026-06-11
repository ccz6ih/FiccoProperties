/**
 * 38th Ave Properties standard residential lease terms — original wording.
 * Fills the lease's specifics (tenant, unit, rent, dates, deposit) into a
 * plain-language template that captures the property's standard rules and
 * additional provisions. Staff can edit the result before sending. This is a
 * convenience template, not legal advice — have it reviewed by an attorney.
 */
export type LeaseTemplateData = {
  tenantName?: string | null;
  propertyName?: string | null;
  unitLabel?: string | null;
  rentDollars?: string | number | null;
  depositDollars?: string | number | null;
  startDate?: string | null; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  /** Include the $150 garage deposit clause (only the Villa Victoria house). */
  includeGarage?: boolean;
};

function money(v: string | number | null | undefined): string {
  if (v == null || v === "") return "$________";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "$________";
  return `$${n.toLocaleString("en-US")}`;
}

function longDate(iso: string | null | undefined): string {
  if (!iso) return "________";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return "________";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function buildLeaseTerms(data: LeaseTemplateData): string {
  const tenant = data.tenantName?.trim() || "________________________";
  const home =
    [data.propertyName, data.unitLabel].filter(Boolean).join(" — ") ||
    "________________________";
  const rent = money(data.rentDollars);
  const deposit = money(data.depositDollars);
  const start = longDate(data.startDate);
  const end = data.endDate
    ? longDate(data.endDate)
    : "month-to-month until terminated as provided below";

  const provisions = [
    "Notice to vacate. Tenant shall give at least thirty (30) days' written notice before moving out, and that notice must be given on the 1st day of a month.",
    "No pets. No dogs, cats, or other pets are permitted. (Assistance animals are not pets and may be requested as a reasonable accommodation under fair housing law.)",
    "No satellite dishes may be installed on the building or Premises.",
    "Renters insurance. Tenant shall provide proof of renters insurance on or before the move-in date and keep it in force throughout the tenancy.",
  ];
  if (data.includeGarage) {
    provisions.push(
      "Garage. A $150.00 non-refundable garage deposit applies. Tenant is responsible for the keypad and remote."
    );
  }
  const provisionLines = provisions
    .map((p, i) => `   ${String.fromCharCode(97 + i)}. ${p}`)
    .join("\n");

  return `RESIDENTIAL LEASE AGREEMENT — 38TH AVE PROPERTIES

1. Parties. This Lease is made between 38th Ave Properties ("Landlord") and ${tenant} ("Tenant").

2. Premises. Landlord leases to Tenant the residence located at ${home}, W 38th Ave, Wheat Ridge, CO 80033 (the "Premises"), to be used only as a private residence for the Tenant and the Tenant's household.

3. Term. The lease term begins on ${start} and runs ${end}. Possession is delivered at 12:00 noon on the start date.

4. Rent. Tenant shall pay rent of ${rent} per month, due in advance on or before the 1st day of each month, at the office of the Landlord or as otherwise directed.

5. Late charge. If rent is not received within five (5) days after its due date, Tenant shall pay a late charge equal to ten percent (10%) of the monthly rent (applied within the limits allowed by Colorado law).

6. Security deposit. Tenant has deposited ${deposit} as a security deposit. Landlord will return the deposit within sixty (60) days after the Tenant moves out and returns possession, less any amounts properly withheld for unpaid rent, damage beyond ordinary wear and tear, or cleaning, together with an itemized statement as required by Colorado law.

7. Additional provisions.
${provisionLines}

8. Parking & vehicles. Tenant shall keep a current, valid license plate on each vehicle at all times. No vehicle repairs or maintenance may be performed in the parking lots or common areas. Townhome residents may park one vehicle in front of the unit and one vehicle in the rear.

9. Trash. Household trash must be placed in the dumpsters on collection days. No furniture, mattresses, or large/bulk items may be placed in or beside the dumpsters; improper dumping will be charged to the responsible Tenant.

10. Care, conduct & rules. Tenant shall keep the Premises clean and in good condition, shall not disturb neighbors or interfere with their peaceful enjoyment, and shall comply with the community rules. Tenant shall not make alterations or install additional locks without the Landlord's written consent.

11. Maintenance & entry. Tenant shall promptly report needed repairs through the resident portal. Landlord may enter the Premises at reasonable times, with reasonable notice, to inspect, make repairs or improvements, or show the unit to prospective residents or buyers.

12. Assignment & subletting. Tenant shall not sublet the Premises or assign this Lease without the Landlord's prior written consent.

13. Default. If Tenant fails to pay rent or breaches this Lease, Landlord may pursue all remedies available under the Colorado Forcible Entry and Detainer statute and other applicable law, after any notice required by law.

14. Governing law. This Lease is governed by the laws of the State of Colorado.

By signing below electronically, Tenant acknowledges that Tenant has read and agrees to the terms of this Lease.`;
}
