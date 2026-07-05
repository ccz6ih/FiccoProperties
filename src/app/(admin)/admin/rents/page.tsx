import Link from "next/link";
import { Card } from "@/components/ui";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard-ui";
import { RentRowForm } from "@/components/rent-row-form";
import { formatCents } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type OccRow = {
  unit_id: string;
  tenant_name: string | null;
  occupant_profile_id: string | null;
  rent_cents: number | null;
  units: {
    label: string;
    rent_cents: number | null;
    properties: { name: string | null } | null;
  } | null;
};

type LeaseRow = { unit_id: string | null; rent_cents: number | null };

type UnitRent = {
  unitId: string;
  tenant: string;
  unit: string;
  property: string;
  effectiveCents: number;
  source: "Lease" | "Tenancy" | "Unit default" | "None";
  tenancyDollars: number | "";
};

export default async function AdminRents() {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: occ }, { data: leases }] = await Promise.all([
    db
      .from("unit_occupancy")
      .select(
        "unit_id, tenant_name, occupant_profile_id, rent_cents, units(label, rent_cents, properties(name))"
      )
      .returns<OccRow[]>(),
    db
      .from("leases")
      .select("unit_id, rent_cents")
      .eq("status", "active")
      .returns<LeaseRow[]>(),
  ]);

  const leaseRentByUnit = new Map<string, number>();
  for (const l of leases ?? []) {
    if (l.unit_id && l.rent_cents) leaseRentByUnit.set(l.unit_id, l.rent_cents);
  }

  const occupied = (occ ?? []).filter(
    (o) => o.unit_id && (o.tenant_name || o.occupant_profile_id)
  );

  const rows: UnitRent[] = occupied.map((o) => {
    const leaseRent = leaseRentByUnit.get(o.unit_id);
    let effectiveCents = 0;
    let source: UnitRent["source"] = "None";
    if (leaseRent) {
      effectiveCents = leaseRent;
      source = "Lease";
    } else if (o.rent_cents) {
      effectiveCents = o.rent_cents;
      source = "Tenancy";
    } else if (o.units?.rent_cents) {
      effectiveCents = o.units.rent_cents;
      source = "Unit default";
    }
    return {
      unitId: o.unit_id,
      tenant: o.tenant_name ?? "—",
      unit: o.units?.label ?? "—",
      property: o.units?.properties?.name ?? "—",
      effectiveCents,
      source,
      tenancyDollars: o.rent_cents ? o.rent_cents / 100 : "",
    };
  });

  rows.sort(
    (a, b) =>
      a.property.localeCompare(b.property) || a.unit.localeCompare(b.unit, undefined, { numeric: true })
  );

  const missing = rows.filter((r) => r.effectiveCents <= 0);
  const totalMonthly = rows.reduce((s, r) => s + r.effectiveCents, 0);

  // Group by property.
  const byProperty = new Map<string, UnitRent[]>();
  for (const r of rows) {
    const list = byProperty.get(r.property) ?? [];
    list.push(r);
    byProperty.set(r.property, list);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Set rents"
        subtitle="Set each occupied unit's monthly rent before you generate charges. Units without a rent are flagged — they'd be skipped at billing time."
        action={
          <Link
            href="/admin/payments"
            className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
          >
            Payments →
          </Link>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Occupied units" value={rows.length} tone="pine" />
        <StatCard
          label="Missing a rent"
          value={missing.length}
          tone={missing.length > 0 ? "terracotta" : "gold"}
          hint="Skipped when billing"
        />
        <StatCard
          label="Monthly total"
          value={formatCents(totalMonthly)}
          tone="gold"
          hint="If billed today"
        />
      </div>

      {missing.length > 0 && (
        <div className="mb-6 rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-3 text-sm text-terracotta-dark">
          <span className="font-semibold">{missing.length}</span> occupied unit
          {missing.length === 1 ? "" : "s"} {missing.length === 1 ? "has" : "have"} no
          rent set: {missing.map((m) => `${m.property} · ${m.unit}`).join(", ")}. Set
          {" "}them below so they&apos;re billed.
        </div>
      )}

      {rows.length > 0 ? (
        <div className="space-y-6">
          {[...byProperty.entries()].map(([property, units]) => (
            <Card key={property} className="overflow-hidden">
              <div className="border-b border-clay bg-sand/50 px-5 py-3">
                <h2 className="font-display text-sm font-semibold text-ink">{property}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-clay text-left text-xs uppercase tracking-wide text-ink-faint">
                      <th className="px-5 py-2.5 font-medium">Unit</th>
                      <th className="px-5 py-2.5 font-medium">Tenant</th>
                      <th className="px-5 py-2.5 font-medium">Billed rent</th>
                      <th className="px-5 py-2.5 text-right font-medium">Tenancy rent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-clay">
                    {units.map((r) => (
                      <tr
                        key={r.unitId}
                        className={r.effectiveCents <= 0 ? "bg-terracotta-soft/40" : "hover:bg-sand/30"}
                      >
                        <td className="px-5 py-3 font-medium text-ink">{r.unit}</td>
                        <td className="px-5 py-3 text-ink-soft">{r.tenant}</td>
                        <td className="px-5 py-3">
                          {r.effectiveCents > 0 ? (
                            <span className="text-ink">
                              {formatCents(r.effectiveCents)}
                              <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-xs text-ink-faint">
                                {r.source}
                              </span>
                            </span>
                          ) : (
                            <span className="rounded-full bg-terracotta/15 px-2 py-0.5 text-xs font-medium text-terracotta-dark">
                              Not set
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <RentRowForm unitId={r.unitId} rentDollars={r.tenancyDollars} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No occupied units"
          body="Units with a current tenancy show up here so you can set their rent."
        />
      )}

      <p className="mt-6 text-xs text-ink-faint">
        Editing the tenancy rent updates what billing charges when there&apos;s no
        active lease. If a unit has an active lease, that lease&apos;s rent takes
        precedence (shown as the &ldquo;Lease&rdquo; source).
      </p>
    </div>
  );
}
