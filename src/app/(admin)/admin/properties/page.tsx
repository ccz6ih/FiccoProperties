import Link from "next/link";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { propertyTypeLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type PropertyRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
};

type UnitRow = {
  id: string;
  property_id: string;
  status: string;
};

type OccRow = {
  unit_id: string;
  occupant_profile_id: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
};

const VACANT_STATUSES = new Set(["available", "make_ready"]);

export default async function AdminProperties() {
  const supabase = await createClient();

  const [{ data: properties }, { data: units }, { data: occ }] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, slug, type, address_line1, city, state")
      .order("created_at")
      .returns<PropertyRow[]>(),
    supabase.from("units").select("id, property_id, status").returns<UnitRow[]>(),
    supabase
      .from("unit_occupancy")
      .select("unit_id, occupant_profile_id, tenant_name, tenant_email")
      .returns<OccRow[]>(),
  ]);

  const unitProperty = new Map<string, string>();
  const counts = new Map<
    string,
    { total: number; occupied: number; vacant: number; tenanted: number; linked: number }
  >();
  for (const u of units ?? []) {
    unitProperty.set(u.id, u.property_id);
    const agg =
      counts.get(u.property_id) ??
      { total: 0, occupied: 0, vacant: 0, tenanted: 0, linked: 0 };
    agg.total += 1;
    if (u.status === "occupied") agg.occupied += 1;
    if (VACANT_STATUSES.has(u.status)) agg.vacant += 1;
    counts.set(u.property_id, agg);
  }

  // Tenant-account linkage per community.
  for (const o of occ ?? []) {
    const pid = unitProperty.get(o.unit_id);
    if (!pid) continue;
    const agg = counts.get(pid);
    if (!agg) continue;
    if (o.occupant_profile_id || o.tenant_name || o.tenant_email) agg.tenanted += 1;
    if (o.occupant_profile_id) agg.linked += 1;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Properties"
        subtitle="Every community, unit, and who lives where."
      />

      {properties && properties.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {properties.map((p) => {
            const c =
              counts.get(p.id) ??
              { total: 0, occupied: 0, vacant: 0, tenanted: 0, linked: 0 };
            const occupiedPct = c.total > 0 ? Math.round((c.occupied / c.total) * 100) : 0;
            const needsLink = c.tenanted - c.linked;
            const address = [p.address_line1, p.city, p.state].filter(Boolean).join(", ");

            return (
              <Link key={p.id} href={`/admin/properties/${p.slug}`} className="block">
                <Card className="h-full p-6 transition-colors hover:border-clay-deep">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-semibold text-ink">
                        {p.name}
                      </h2>
                      {address && (
                        <p className="mt-0.5 text-sm text-ink-faint">{address}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-terracotta">
                      {propertyTypeLabel(p.type)}
                    </span>
                  </div>

                  <div className="mt-5 flex items-baseline gap-4 text-sm">
                    <span className="text-ink-soft">
                      <span className="font-display text-2xl font-semibold text-ink">
                        {c.total}
                      </span>{" "}
                      units
                    </span>
                    <span className="text-pine">{c.occupied} occupied</span>
                    <span className="text-terracotta">{c.vacant} vacant</span>
                  </div>

                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-sand">
                      <div
                        className="h-full rounded-full bg-pine"
                        style={{ width: `${occupiedPct}%` }}
                      />
                    </div>
                    <div className="mt-1.5 text-xs text-ink-faint">
                      {occupiedPct}% occupied
                    </div>
                  </div>

                  {c.tenanted > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <span className="text-ink-soft">
                        {c.linked} of {c.tenanted} tenants linked
                      </span>
                      {needsLink > 0 && (
                        <span className="rounded-full bg-sand px-2 py-0.5 font-medium text-ink-soft">
                          {needsLink} need connecting
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No properties yet"
          body="Communities and their units will appear here once they're added."
        />
      )}
    </div>
  );
}
