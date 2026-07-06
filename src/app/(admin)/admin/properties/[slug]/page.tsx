import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard-ui";
import { UnitStatusControl } from "@/components/unit-status-control";
import {
  UnitEditForm,
  type OccupancyValues,
  type ResidentOption,
} from "@/components/unit-edit-form";
import { PropertyCoverForm } from "@/components/property-cover-form";
import { TenantAccountControl } from "@/components/tenant-account-control";
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
  hero_image: string | null;
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

type OccupancyRow = {
  unit_id: string;
  occupant_profile_id: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  tenant_phone: string | null;
  rent_cents: number | null;
  lease_start_date: string | null;
  lease_signed_date: string | null;
  lease_end_date: string | null;
  move_in_date: string | null;
  assistance_programs: string[] | null;
  assistance_disclosed_at: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  profiles: { id: string; full_name: string | null; email: string | null } | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const { slug } = await params;
  const { show } = await searchParams;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id, name, slug, type, address_line1, city, state, hero_image")
    .eq("slug", slug)
    .maybeSingle()
    .returns<PropertyRow>();

  if (!property) notFound();

  const [{ data: units }, { data: occupancies }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("units")
        .select("id, label, status, bedrooms, bathrooms, sqft, rent_cents, notes")
        .eq("property_id", property.id)
        .returns<UnitRow[]>(),
      supabase
        .from("unit_occupancy")
        .select(
          "unit_id, occupant_profile_id, tenant_name, tenant_email, tenant_phone, rent_cents, lease_start_date, lease_signed_date, lease_end_date, move_in_date, assistance_programs, assistance_disclosed_at, emergency_contact_name, emergency_contact_phone, notes, profiles(id, full_name, email)"
        )
        .returns<OccupancyRow[]>(),
      supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .order("full_name")
        .returns<ProfileRow[]>(),
    ]);

  const unitList = [...(units ?? [])].sort((a, b) => {
    const ka = labelSortKey(a.label);
    const kb = labelSortKey(b.label);
    if (ka !== kb) return ka - kb;
    return a.label.localeCompare(b.label);
  });

  const occByUnit = new Map<string, OccupancyRow>();
  for (const o of occupancies ?? []) occByUnit.set(o.unit_id, o);

  // Spend per unit = contractor bills + petty-cash expenses tagged to the unit.
  const db = supabase as unknown as SupabaseClient;
  const unitIds = unitList.map((u) => u.id);
  const spendByUnit = new Map<string, number>();
  if (unitIds.length > 0) {
    const [{ data: costAgg }, { data: pettyAgg }] = await Promise.all([
      db
        .from("unit_costs")
        .select("unit_id, amount_cents")
        .in("unit_id", unitIds)
        .returns<{ unit_id: string; amount_cents: number }[]>(),
      db
        .from("petty_cash_entries")
        .select("unit_id, amount_cents")
        .eq("kind", "expense")
        .in("unit_id", unitIds)
        .returns<{ unit_id: string; amount_cents: number }[]>(),
    ]);
    for (const c of costAgg ?? [])
      spendByUnit.set(c.unit_id, (spendByUnit.get(c.unit_id) ?? 0) + c.amount_cents);
    for (const p of pettyAgg ?? [])
      spendByUnit.set(p.unit_id, (spendByUnit.get(p.unit_id) ?? 0) + p.amount_cents);
  }

  const residentOptions: ResidentOption[] = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
  }));

  const total = unitList.length;
  const occupied = unitList.filter((u) => u.status === "occupied").length;
  const vacant = unitList.filter((u) => VACANT_STATUSES.has(u.status)).length;
  const address = [property.address_line1, property.city, property.state]
    .filter(Boolean)
    .join(", ");

  // Tenant-account linkage + the "records only" filter.
  const isTenanted = (u: UnitRow) => {
    const o = occByUnit.get(u.id);
    return !!o && !!(o.occupant_profile_id || o.tenant_name || o.tenant_email);
  };
  const isLinked = (u: UnitRow) => !!occByUnit.get(u.id)?.occupant_profile_id;
  const tenantedUnits = unitList.filter(isTenanted);
  const tenanted = tenantedUnits.length;
  const linked = tenantedUnits.filter(isLinked).length;
  const recordsOnly = tenanted - linked;

  const recordsOnlyView = show === "records-only";
  const displayList = recordsOnlyView
    ? tenantedUnits.filter((u) => !isLinked(u))
    : unitList;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/admin/properties"
        className="mb-4 inline-block text-sm font-medium text-pine hover:text-pine-dark"
      >
        ← All properties
      </Link>

      <PageHeader title={property.name} subtitle={address || undefined} />

      <div className="mb-8">
        <PropertyCoverForm
          propertyId={property.id}
          slug={property.slug}
          heroImage={property.hero_image}
        />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total units" value={total} />
        <StatCard label="Occupied" value={occupied} tone="pine" />
        <StatCard label="Vacant" value={vacant} tone="terracotta" />
        <StatCard
          label="Accounts linked"
          value={`${linked}/${tenanted}`}
          tone="gold"
          hint={recordsOnly > 0 ? `${recordsOnly} records-only` : "All connected"}
        />
      </div>

      {tenanted > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <Link
            href={`/admin/properties/${slug}`}
            className={`rounded-lg px-3 py-1.5 font-medium ${
              recordsOnlyView
                ? "text-ink-soft hover:bg-sand"
                : "bg-pine text-cream"
            }`}
          >
            All units ({total})
          </Link>
          <Link
            href={`/admin/properties/${slug}?show=records-only`}
            className={`rounded-lg px-3 py-1.5 font-medium ${
              recordsOnlyView
                ? "bg-pine text-cream"
                : "text-ink-soft hover:bg-sand"
            }`}
          >
            Records only ({recordsOnly})
          </Link>
        </div>
      )}

      {displayList.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Unit</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Tenant</th>
                  <th className="px-5 py-3 font-medium">Rent</th>
                  <th className="px-5 py-3 font-medium">Spent</th>
                  <th className="px-5 py-3 font-medium">Lease signed</th>
                  <th className="px-5 py-3 font-medium">Term</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {displayList.map((u) => {
                  const occ = occByUnit.get(u.id);
                  const specs = [
                    u.bedrooms != null ? `${u.bedrooms} bd` : null,
                    u.bathrooms != null ? `${u.bathrooms} ba` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  const occProfile = occ?.profiles ?? null;
                  const rentCents = occ?.rent_cents ?? u.rent_cents;
                  const hasTerm = occ?.lease_start_date || occ?.lease_end_date;

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
                        {occProfile ? (
                          <div>
                            <Link
                              href={`/admin/residents/${occProfile.id}`}
                              className="font-medium text-pine hover:text-pine-dark"
                            >
                              {occProfile.full_name ?? occProfile.email ?? "Resident"}
                            </Link>
                            <span className="mt-1 block w-fit rounded-full bg-pine/10 px-2 py-0.5 text-[11px] font-medium text-pine">
                              Account linked ✓
                            </span>
                          </div>
                        ) : occ?.tenant_name ? (
                          <div>
                            <div className="font-medium text-ink">
                              {occ.tenant_name}
                            </div>
                            <div className="text-xs text-ink-faint">
                              {occ.tenant_email ?? occ.tenant_phone ?? "No email on file"}
                            </div>
                            <span className="mt-1 inline-block rounded-full bg-sand px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                              Records only
                            </span>
                            <TenantAccountControl unitId={u.id} email={occ.tenant_email} />
                          </div>
                        ) : (
                          <span className="text-ink-faint">Vacant</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        {formatCents(rentCents)}
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        {spendByUnit.has(u.id) ? (
                          <Link href={`/admin/units/${u.id}`} className="font-medium text-ink hover:text-pine">
                            {formatCents(spendByUnit.get(u.id)!)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        {formatDate(occ?.lease_signed_date)}
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        {hasTerm ? (
                          <>
                            {formatDate(occ?.lease_start_date)} –{" "}
                            {occ?.lease_end_date
                              ? formatDate(occ.lease_end_date)
                              : "ongoing"}
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
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/admin/units/${u.id}`}
                            className="whitespace-nowrap text-xs font-medium text-pine hover:text-pine-dark"
                          >
                            Photos
                          </Link>
                          <UnitEditForm
                          propertySlug={property.slug}
                          residents={residentOptions}
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
                          occupancy={
                            occ
                              ? ({
                                  occupant_profile_id: occ.occupant_profile_id,
                                  tenant_name: occ.tenant_name,
                                  tenant_email: occ.tenant_email,
                                  tenant_phone: occ.tenant_phone,
                                  rent_cents: occ.rent_cents,
                                  lease_start_date: occ.lease_start_date,
                                  lease_signed_date: occ.lease_signed_date,
                                  lease_end_date: occ.lease_end_date,
                                  move_in_date: occ.move_in_date,
                                  assistance_programs: occ.assistance_programs,
                                  assistance_disclosed_at: occ.assistance_disclosed_at,
                                  emergency_contact_name: occ.emergency_contact_name,
                                  emergency_contact_phone: occ.emergency_contact_phone,
                                  notes: occ.notes,
                                } satisfies OccupancyValues)
                              : null
                          }
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : recordsOnlyView ? (
        <EmptyState
          title="Everyone's connected 🎉"
          body="Every tenant in this community has a linked portal account."
        />
      ) : (
        <EmptyState
          title="No units yet"
          body="Units for this property will appear here once they're added."
        />
      )}
    </div>
  );
}
