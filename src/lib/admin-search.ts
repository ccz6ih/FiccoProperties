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

type Row = {
  id: string;
  label: string;
  status: string;
  properties: { name: string | null; slug: string } | null;
  unit_occupancy: {
    occupant_profile_id: string | null;
    tenant_name: string | null;
    tenant_email: string | null;
    tenant_phone: string | null;
  }[];
};

/** Every unit with its current tenancy, flattened for fast client search. */
export async function loadSearchItems(): Promise<SearchItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select(
      "id, label, status, properties(name, slug), unit_occupancy(occupant_profile_id, tenant_name, tenant_email, tenant_phone)"
    )
    .returns<Row[]>();

  return (data ?? []).map((u) => {
    const occ = u.unit_occupancy?.[0] ?? null;
    return {
      unitId: u.id,
      unitLabel: u.label,
      property: u.properties?.name ?? "—",
      slug: u.properties?.slug ?? "",
      status: u.status,
      tenantName: occ?.tenant_name ?? null,
      email: occ?.tenant_email ?? null,
      phone: occ?.tenant_phone ?? null,
      residentId: occ?.occupant_profile_id ?? null,
      linked: !!occ?.occupant_profile_id,
    };
  });
}
