import { createClient } from "@/lib/supabase/server";

export type SearchItem = {
  unitId: string;
  unitLabel: string;
  property: string;
  slug: string;
  status: string;
  tenantName: string | null;
  email: string | null;
  phone: string | null;
  residentId: string | null;
  linked: boolean;
};

type UnitRow = {
  id: string;
  label: string;
  status: string;
  properties: { name: string | null; slug: string } | null;
};

type OccRow = {
  unit_id: string;
  occupant_profile_id: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  tenant_phone: string | null;
};

/** Every unit with its current tenancy, flattened for fast client search. */
export async function loadSearchItems(): Promise<SearchItem[]> {
  const supabase = await createClient();
  const [{ data: units }, { data: occ }] = await Promise.all([
    supabase
      .from("units")
      .select("id, label, status, properties(name, slug)")
      .returns<UnitRow[]>(),
    supabase
      .from("unit_occupancy")
      .select("unit_id, occupant_profile_id, tenant_name, tenant_email, tenant_phone")
      .returns<OccRow[]>(),
  ]);

  const occByUnit = new Map<string, OccRow>();
  for (const o of occ ?? []) occByUnit.set(o.unit_id, o);

  return (units ?? []).map((u) => {
    const o = occByUnit.get(u.id) ?? null;
    return {
      unitId: u.id,
      unitLabel: u.label,
      property: u.properties?.name ?? "—",
      slug: u.properties?.slug ?? "",
      status: u.status,
      tenantName: o?.tenant_name ?? null,
      email: o?.tenant_email ?? null,
      phone: o?.tenant_phone ?? null,
      residentId: o?.occupant_profile_id ?? null,
      linked: !!o?.occupant_profile_id,
    };
  });
}
