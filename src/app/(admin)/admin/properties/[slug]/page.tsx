import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard-ui";
import { UnitStatusControl } from "@/components/unit-status-control";
import { UnitEditForm } from "@/components/unit-edit-form";
import { formatCents, formatDate } from "@/lib/format";
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
  label: string;
  status: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  rent_cents: number | null;
  notes: string | null;
};

type LeaseRow = {
  id: string;
  unit_id: string;
  rent_cents: number;
  start_date: string;
  end_date: string | null;
  profiles: { full_name: string | null; email: string | null; phone: string | null } | null;
};

const VACANT_STATUSES = new Set(["available", "make_ready"]);

/** Sort by the trailing number in a label ("Unit 7" -> 7); labels without a
 *  number (e.g. "House") sort last, then alphabetically as a tiebreaker. */
function labelSortKey(label: string): number {
  const m = label.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

export default async function PropertyDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id, name, slug, type, address_line1, city, state")
    .eq("slug", slug)
    .maybeSingle()
    .returns<PropertyRow>();

  if (!property) notFound();

  const [{ data: units }, { data: leases }] = await Promise.all([
    supabase
      .from("units")
      .select("id, label, status, bedrooms, bathrooms, sqft, rent_cents, notes")
      .eq("property_id", property.id)
      .returns<UnitRow[]>(),
    supabase
      .from("leases")
      .select(
        "id, unit_id, rent_cents, start_date, end_date, profiles(full_name, email, phone)"
      )
      .eq("status", "active")
      .returns<LeaseRow[]>(),
  ]);

  const unitList = [...(units ?? [])].sort((a, b) => {
    const ka = labelSortKey(a.label);
    const kb = labelSortKey(b.label);
    if (ka !== kb) return ka - kb;
    return a.label.localeCompare(b.label);
  });

  const leaseByUnit = new Map<string, LeaseRow>();
  for (const l of leases ?? []) leaseByUnit.set(l.unit_id, l);

  const total = unitList.length;
  const occupied = unitList.filter((u) => u.status === "occupied").length;
  const vacant = unitList.filter((u) => VACANT_STATUSES.has(u.status)).length;
  const address = [property.address_line1, property.city, property.state]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/admin/properties"
        className="mb-4 inline-block text-sm font-medium text-pine hover:text-pine-dark"
      >
        ← All properties
      </Link>

      <PageHeader title={property.name} subtitle={address || undefined} />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total units" value={total} />
        <StatCard label="Occupied" value={occupied} tone="pine" />
        <StatCard label="Vacant" value={vacant} tone="terracotta" />
      </div>

      {unitList.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Unit</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Current resident</th>
                  <th className="px-5 py-3 font-medium">Lease term</th>
                  <th className="px-5 py-3 font-medium">Rent</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {unitList.map((u) => {
                  const lease = leaseByUnit.get(u.id);
                  const specs = [
                    u.bedrooms != null ? `${u.bedrooms} bd` : null,
                    u.bathrooms != null ? `${u.bathrooms} ba` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <tr key={u.id} className="align-top hover:bg-sand/30">
                      <td className="px-5 py-3">
                        <Link href={`/admin/units/${u.id}`} className="block">
                          <div className="font-medium text-ink hover:text-pine">
                            {u.label}
                          </div>
                          {specs && (
                            <div className="text-xs text-ink-faint">{specs}</div>
                          )}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <UnitStatusControl id={u.id} status={u.status} />
                      </td>
                      <td className="px-5 py-3">
                        {lease ? (
                          <div>
                            <div className="font-medium text-ink">
                              {lease.profiles?.full_name ?? "—"}
                            </div>
                            <div className="text-xs text-ink-faint">
                              {lease.profiles?.email ?? lease.profiles?.phone ?? ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-ink-faint">Vacant</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        {lease ? (
                          <>
                            {formatDate(lease.start_date)} –{" "}
                            {lease.end_date ? formatDate(lease.end_date) : "ongoing"}
                          </>
                        ) : (
                          <Link
                            href={`/admin/leases/new?unit=${u.id}`}
                            className="whitespace-nowrap text-xs font-medium text-pine hover:text-pine-dark"
                          >
                            Start lease →
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        {formatCents(lease ? lease.rent_cents : u.rent_cents)}
                      </td>
                      <td className="px-5 py-3">
                        <UnitEditForm
                          unit={{
                            id: u.id,
                            label: u.label,
                            status: u.status,
                            bedrooms: u.bedrooms,
                            bathrooms: u.bathrooms,
                            sqft: u.sqft,
                            rent_cents: u.rent_cents,
                            notes: u.notes,
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No units yet"
          body="Units for this property will appear here once they're added."
        />
      )}
    </div>
  );
}
