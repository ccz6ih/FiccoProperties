/**
 * 38th Ave Properties standard residential lease terms — ORIGINAL wording.
 * Covers the same provisions a full residential lease would, written in plain
 * Colorado-current language. Staff can edit the result before sending. This is
 * a convenience template, not legal advice — have it reviewed by an attorney.
 */
import { TOWN_HOME_RULES } from "@/lib/house-guides";

export type LeaseTemplateData = {
  tenantName?: string | null;
  propertyName?: string | null;
  unitLabel?: string | null;
  rentDollars?: string | number | null;
  depositDollars?: string | number | null;
  startDate?: string | null; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  /** Include the $150 garage fee clause (only the Villa Victoria house). */
  includeGarage?: boolean;
  /** Append the full Town Home community-rules addendum (The Villa / Villa Victoria). */
  includeTownhomeRules?: boolean;
  /** Who pays utilities. Defaults to "standard" (landlord: water/sewer/trash). */
  utilities?: "standard" | "tenant" | "landlord";
};

function utilitiesClause(mode: "standard" | "tenant" | "landlord" | undefined): string {
  if (mode === "tenant") {
    return `Utilities. Tenant is responsible for all utilities and services to the Premises — water, sewer, trash, electricity, and natural gas — and shall place those accounts in Tenant's name by the move-in date. Landlord is not liable for any interruption of a utility or service caused by anything beyond the Landlord's reasonable control.`;
  }
  if (mode === "landlord") {
    return `Utilities. Landlord provides water, sewer, trash, electricity, and natural gas service to the Premises. Tenant shall use utilities reasonably and shall not waste them. Landlord is not liable for any interruption of a utility or service caused by anything beyond the Landlord's reasonable control.`;
  }
  return `Utilities. Unless stated otherwise in writing, Landlord provides water, sewer, and trash service, and Tenant is responsible for electricity and natural gas service to the Premises and for placing those accounts in Tenant's name by the move-in date. Landlord is not liable for any interruption of a utility or service caused by anything beyond the Landlord's reasonable control.`;
}

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

  const sections: string[] = [
    `Parties. This Lease is made between 38th Ave Properties ("Landlord") and ${tenant} ("Tenant"). If more than one person signs as Tenant, each is jointly and individually responsible for the full performance of this Lease.`,
    `Premises. Landlord leases to Tenant the residence located at ${home}, W 38th Ave, Wheat Ridge, CO 80033 (the "Premises"), to be used only as a private home for the Tenant and the members of the Tenant's household listed on the application.`,
    `Term. The lease term begins on ${start} and runs ${end}. Possession of the Premises is delivered at 12:00 noon on the start date.`,
    `Rent. Tenant shall pay rent of ${rent} per month, in advance, on or before the 1st day of each month, at the Landlord's office or as the Landlord otherwise directs. Rent is due in full regardless of any setoff or claim.`,
    `Late charge & returned payments. If rent is not received within five (5) days after its due date, Tenant shall pay a late charge equal to ten percent (10%) of the monthly rent, treated as additional rent, all within the limits allowed by Colorado law. Acceptance of a late or partial payment does not waive the Landlord's rights or the default. A reasonable fee applies to any payment returned unpaid by the bank.`,
    `Security deposit. Tenant has deposited ${deposit} as a security deposit, held as security for the full performance of this Lease. Landlord may apply it to unpaid rent, charges, cleaning, or damage beyond ordinary wear and tear. The deposit may not be used by Tenant as last month's rent. Landlord will return the deposit, without interest, within sixty (60) days after Tenant returns possession and the Premises are left clean and undamaged, together with an itemized statement of any amounts withheld, as required by Colorado law.`,
    utilitiesClause(data.utilities),
    `Use & lawful conduct. Tenant shall use the Premises only as a private residence and shall obey all applicable laws, ordinances, and health, fire, and safety codes. Tenant shall not use the Premises for any business, unlawful, hazardous, or improper purpose, shall not keep flammable or dangerous materials on the Premises, and shall not create or allow any odor, condition, or activity that is offensive or a nuisance to neighbors.`,
    `Occupancy & guests. Only the household members named on the application may occupy the Premises. The Premises may not be used to take in roomers or boarders. A guest may not stay more than fourteen (14) days in any six-month period without the Landlord's written consent.`,
    `Pets. No dogs, cats, or other animals are permitted on the Premises or property. (An assistance animal is not a pet and may be requested as a reasonable accommodation under fair housing law.)`,
    `Renters insurance. Tenant shall obtain renters insurance on or before the move-in date and keep it in force throughout the tenancy, and shall provide proof on request.`,
    `Condition & care. Tenant accepts the Premises in good condition and shall keep them clean, sanitary, and free of refuse. Tenant shall not damage the Premises and is responsible for damage caused by Tenant, the household, or guests, beyond ordinary wear and tear. At move-out Tenant shall leave the Premises clean and in the condition received, ordinary wear and tear excepted.`,
    `Alterations, fixtures & locks. Tenant shall not paint, alter, or make holes in the Premises beyond ordinary picture hanging, and shall not install antennas, satellite dishes, wiring, appliances, or additional or changed locks, without the Landlord's prior written consent. Anything affixed to the Premises becomes part of the Premises unless agreed otherwise in writing.`,
    `Plumbing & drains. Only human waste and toilet paper may be flushed. Wipes (including those labeled "flushable"), paper towels, hygiene products, diapers, grease, and similar items must never be flushed or poured down any drain. Tenant is responsible for the cost of clearing clogs and repairing damage caused by improper use of the plumbing.`,
    `Trash. Household trash must be bagged and placed in the dumpsters on collection days. No furniture, mattresses, or large or bulk items may be placed in or beside the dumpsters; improper dumping is a code violation and the cost of removal will be charged to the responsible Tenant.`,
    `Parking & vehicles. Each vehicle must display a current, valid license plate and be operable. No vehicle repairs, maintenance, or washing may be performed in the parking lots or common areas, and no vehicle may be stored on jacks. Townhome residents may park one vehicle in front of the unit; additional vehicles and visitors use the rear lot. No parking in fire lanes. The Landlord may have improperly parked or inoperable vehicles towed at the owner's expense.`,
    `Noise & nuisance. Tenant shall not play any sound system, instrument, or device at a volume that disturbs others, and shall not allow noise, conduct, or activity that interferes with the peaceful enjoyment of other residents or neighbors.`,
    `Common areas & storage. Hallways, stairways, walkways, and entries are for access only and must be kept clear. Any storage area provided is used at Tenant's sole risk; Landlord is not responsible for loss of or damage to property kept there.`,
    `Maintenance & repair requests. Tenant shall promptly report needed repairs through the resident portal. Tenant shall not obstruct or misuse the plumbing or fixtures.`,
    `Landlord's entry. Landlord may enter the Premises at reasonable times, with reasonable notice (or without notice in an emergency), to inspect, make repairs or improvements, provide services, or show the Premises to prospective residents, buyers, or lenders.`,
    `Liability. Except to the extent caused by the Landlord's negligence or required by law, Landlord is not liable for injury to any person or for loss of or damage to any property on the Premises or property, including loss caused by fire, water, theft, or the acts of others. Tenant is encouraged to insure Tenant's own belongings.`,
    `Assignment & subletting. Tenant shall not sublet the Premises or assign this Lease without the Landlord's prior written consent.`,
    `Abandonment & reletting. If Tenant moves out before the term ends or the Premises are left vacant with rent unpaid, Landlord may retake possession and re-rent the Premises, using reasonable efforts to mitigate, and Tenant remains responsible for the difference between the rent owed under this Lease and the rent actually received, plus the reasonable costs of re-renting.`,
    `Holdover. If Tenant stays after the term ends without a new written agreement, the tenancy becomes month-to-month at the same monthly rent, subject to all other terms of this Lease, and may be ended by either party with the notice required by Colorado law.`,
    `Default & remedies. If Tenant fails to pay rent or otherwise breaches this Lease, Landlord may, after giving any notice required by law, declare the term ended and recover possession under the Colorado Forcible Entry and Detainer statute, recover unpaid and future rent and damages and the costs of re-renting, and pursue any other remedy available in law or equity. Landlord will mitigate damages as required by Colorado law (including C.R.S. 13-40-104 and 13-40-107.5). In a dispute over this Lease, the prevailing party is entitled to its reasonable attorney's fees and costs.`,
  ];

  if (data.includeGarage) {
    sections.push(
      `Garage. A non-refundable garage fee of $150.00 applies to this Premises. Tenant is responsible for the keypad and remote and for returning both in working order at move-out; the cost of any unreturned or damaged keypad or remote may be deducted from the deposit.`
    );
  }

  sections.push(
    `Fire & casualty. If the Premises are made unfit to live in by fire or other casualty not caused by Tenant, Landlord may either end this Lease (with rent paid only to the date of the casualty) or repair the Premises with reasonable diligence, in which case rent is reduced in proportion to the part of the Premises that cannot be used until repairs are complete.`,
    `Surrender & keys. At the end of the tenancy Tenant shall return possession of the Premises and all keys, remotes, and access devices to the Landlord.`,
    `Notice to vacate. After the lease term is met, Tenant shall give at least thirty (30) days' written notice before moving out, and that notice must be given on the 1st day of a month.`,
    `Subordination. This Lease is subordinate to any current or future mortgage or deed of trust on the property.`,
    `General. This Lease, with any signed addenda, is the entire agreement between the parties and may be changed only in a writing signed by both. No Landlord agent has authority to change it orally. The Landlord's failure to enforce any term at any time is not a waiver of that term. The words "Landlord" and "Tenant" include the plural and any successors. If any term is unenforceable, the rest of the Lease remains in effect.`,
    `Governing law. This Lease is governed by the laws of the State of Colorado.`
  );

  const body = sections.map((s, i) => `${i + 1}. ${s}`).join("\n\n");

  const townhomeAddendum = data.includeTownhomeRules
    ? `

COMMUNITY RULES ADDENDUM — TOWN HOMES

These rules are part of this Lease for our town home communities (The Villa and Villa Victoria). They keep the community clean, safe, and in compliance with City of Wheat Ridge code. Tenant agrees to follow them; violations may be charged to the Tenant and may be grounds for lease enforcement.

${TOWN_HOME_RULES.map((r, i) => `   ${i + 1}. ${r.title}. ${r.body}`).join("\n")}`
    : "";

  return `RESIDENTIAL LEASE AGREEMENT — 38TH AVE PROPERTIES

${body}
${townhomeAddendum}

By signing below electronically, Tenant acknowledges that Tenant has read, understands, and agrees to the terms of this Lease${data.includeTownhomeRules ? ", including the Community Rules Addendum above" : ""}.`;
}
