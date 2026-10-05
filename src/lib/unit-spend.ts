/**
 * What each home has actually cost — contractor bills plus the petty cash
 * tagged to it.
 *
 * Both halves already existed, but only ever one home at a time, so the
 * question that matters at renewal — "is this home eating money, and is the
 * rent keeping up?" — couldn't be asked. Ranking them is the whole point.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type UnitSpend = {
  unitId: string;
  home: string;
  property: string;
  tenantName: string | null;
  rentCents: number | null;
  /** Contractor bills and recorded maintenance costs. */
  billedCents: number;
  /** Out-of-pocket spend tagged to this home. */
  pettyCents: number;
  totalCents: number;
  entries: number;
  /** Months of rent the spend represents — the renewal-time comparison. */
  monthsOfRent: number | null;
};

export async function getUnitSpend(
  db: SupabaseClient,
  opts: { from?: string | null; to?: string | null } = {}
): Promise<UnitSpend[]> {
  const [{ data: units }, { data: costs }, { data: petty }, { data: occ }] = await Promise.all([
    db
      .from("units")
      .select("id, label, rent_cents, properties(name)")
      .returns<{ id: string; label: string; rent_cents: number | null; properties: { name: string | null } | null }[]>(),
    // Built up step by step rather than through a generic helper — Supabase's
    // builder types recurse badly when the chain is abstracted.
    (() => {
      let q = db.from("unit_costs").select("unit_id, amount_cents, incurred_on");
      if (opts.from) q = q.gte("incurred_on", opts.from);
      if (opts.to) q = q.lte("incurred_on", opts.to);
      return q.returns<{ unit_id: string; amount_cents: number; incurred_on: string }[]>();
    })(),
    (() => {
      let q = db
        .from("petty_cash_entries")
        .select("unit_id, amount_cents, occurred_on, kind")
        .eq("kind", "expense")
        .not("unit_id", "is", null);
      if (opts.from) q = q.gte("occurred_on", opts.from);
      if (opts.to) q = q.lte("occurred_on", opts.to);
      return q.returns<{ unit_id: string | null; amount_cents: number; occurred_on: string }[]>();
    })(),
    db
      .from("unit_occupancy")
      .select("unit_id, tenant_name, rent_cents")
      .returns<{ unit_id: string; tenant_name: string | null; rent_cents: number | null }[]>(),
  ]);

  const occByUnit = new Map((occ ?? []).map((o) => [o.unit_id, o]));
  const byUnit = new Map<string, { billed: number; petty: number; entries: number }>();
  const bump = (id: string | null, field: "billed" | "petty", cents: number) => {
    if (!id) return;
    const cur = byUnit.get(id) ?? { billed: 0, petty: 0, entries: 0 };
    cur[field] += cents;
    cur.entries += 1;
    byUnit.set(id, cur);
  };

  for (const c of costs ?? []) bump(c.unit_id, "billed", c.amount_cents);
  for (const p of petty ?? []) bump(p.unit_id, "petty", p.amount_cents);

  const rows: UnitSpend[] = (units ?? []).map((u) => {
    const agg = byUnit.get(u.id) ?? { billed: 0, petty: 0, entries: 0 };
    const total = agg.billed + agg.petty;
    // The tenancy's rent is the one being charged; the unit's is the asking rent.
    const rent = occByUnit.get(u.id)?.rent_cents ?? u.rent_cents ?? null;
    return {
      unitId: u.id,
      home: `${u.properties?.name ? `${u.properties.name} · ` : ""}${u.label}`,
      property: u.properties?.name ?? "Unassigned",
      tenantName: occByUnit.get(u.id)?.tenant_name ?? null,
      rentCents: rent,
      billedCents: agg.billed,
      pettyCents: agg.petty,
      totalCents: total,
      entries: agg.entries,
      monthsOfRent: rent && rent > 0 ? total / rent : null,
    };
  });

  return rows.sort((a, b) => b.totalCents - a.totalCents);
}
