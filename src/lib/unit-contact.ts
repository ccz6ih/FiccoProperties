/**
 * Everything you need to turn up at a home or ring whoever lives there —
 * resolved once, for the maintenance page, the alert emails and the work order.
 *
 * A request that names only "The Villa · Unit 9" means looking the resident up
 * somewhere else before you can arrange anything, which is the step that gets
 * skipped when you're busy. Name, phone, email and street address travel with
 * the job instead.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhone } from "@/lib/format";

export type UnitContact = {
  /** "The Villa · Unit 9", or null when the unit is unknown. */
  home: string | null;
  /** Street line including the unit, then city/state/zip. */
  address: string | null;
  /** The household as it reads on the tenancy ("Dan Barone / Geimy Sundheim"). */
  tenantName: string | null;
  phone: string | null;
  /** Every address on file for the home, tenancy contact first. */
  emails: string[];
};

const EMPTY: UnitContact = {
  home: null,
  address: null,
  tenantName: null,
  phone: null,
  emails: [],
};

type UnitRow = {
  label: string;
  properties: {
    name: string | null;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
  } | null;
};

export async function getUnitContact(unitId: string | null): Promise<UnitContact> {
  if (!unitId) return EMPTY;
  const db = createAdminClient() as unknown as SupabaseClient;

  // Occupancy and occupants fetched separately — a nested embed under units
  // comes back empty here, which is why record-only tenants used to show blank.
  const [{ data: unit }, { data: occ }, { data: links }] = await Promise.all([
    db
      .from("units")
      .select("label, properties(name, address_line1, city, state, postal_code)")
      .eq("id", unitId)
      .maybeSingle<UnitRow>(),
    db
      .from("unit_occupancy")
      .select("tenant_name, tenant_email, tenant_phone, occupant_profile_id")
      .eq("unit_id", unitId)
      .maybeSingle<{
        tenant_name: string | null;
        tenant_email: string | null;
        tenant_phone: string | null;
        occupant_profile_id: string | null;
      }>(),
    db
      .from("unit_occupants")
      .select("profile_id, is_primary")
      .eq("unit_id", unitId)
      .returns<{ profile_id: string; is_primary: boolean }[]>(),
  ]);

  const profileIds = [
    ...new Set(
      [occ?.occupant_profile_id, ...(links ?? []).map((l) => l.profile_id)].filter(
        (v): v is string => !!v
      )
    ),
  ];
  let profiles: { id: string; full_name: string | null; email: string | null; phone: string | null }[] =
    [];
  if (profileIds.length > 0) {
    const { data } = await db
      .from("profiles")
      .select("id, full_name, email, phone")
      .in("id", profileIds)
      .returns<{ id: string; full_name: string | null; email: string | null; phone: string | null }[]>();
    profiles = data ?? [];
  }

  const seen = new Set<string>();
  const emails: string[] = [];
  for (const raw of [occ?.tenant_email, ...profiles.map((p) => p.email)]) {
    const e = raw?.trim();
    if (!e || seen.has(e.toLowerCase())) continue;
    seen.add(e.toLowerCase());
    emails.push(e);
  }

  const p = unit?.properties ?? null;
  const street = [p?.address_line1, unit?.label].filter(Boolean).join(", ");
  const region = [p?.city, p?.state, p?.postal_code].filter(Boolean).join(", ");

  const primaryId =
    (links ?? []).find((l) => l.is_primary)?.profile_id ?? occ?.occupant_profile_id ?? null;
  const primary = profiles.find((x) => x.id === primaryId) ?? null;

  return {
    home: unit ? `${p?.name ? `${p.name} · ` : ""}${unit.label}` : null,
    address: [street, region].filter(Boolean).join(" · ") || null,
    tenantName: occ?.tenant_name ?? primary?.full_name ?? null,
    // The tenancy phone is the one the office keeps current; fall back to the
    // primary account's.
    phone: formatPhone(occ?.tenant_phone) ?? formatPhone(primary?.phone) ?? null,
    emails,
  };
}
