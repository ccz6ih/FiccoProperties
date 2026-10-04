import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getWorkItems } from "@/lib/work-items";

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

/**
 * A job — a maintenance request or a task — in the same flattened shape, so one
 * search box finds "the faucet at Unit 5" as readily as it finds Unit 5. The
 * search used to cover homes and people only, which meant knowing which board
 * a thing lived on before you could look for it.
 */
export type WorkSearchItem = {
  id: string;
  source: "maintenance" | "task";
  title: string;
  details: string | null;
  where: string | null;
  assignee: string | null;
  state: string;
  dateLabel: string;
  href: string;
};

export async function loadWorkSearchItems(): Promise<WorkSearchItem[]> {
  const supabase = await createClient();
  const items = await getWorkItems(supabase as unknown as SupabaseClient);
  return items.map((w) => ({
    id: w.id,
    source: w.source,
    title: w.title,
    details: w.details,
    where: [w.propertyName, w.unitLabel].filter(Boolean).join(" · ") || null,
    assignee: w.assigneeName,
    state: w.state,
    dateLabel: (w.completedAt ?? w.dueDate ?? w.createdAt).slice(0, 10),
    href: w.href,
  }));
}

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
