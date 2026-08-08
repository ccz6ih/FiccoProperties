import type { SupabaseClient } from "@supabase/supabase-js";
import { PageHeader } from "@/components/dashboard-ui";
import { RenewalBoard, type RenewalRow, type StaggerMonth } from "@/components/renewal-board";
import { createClient } from "@/lib/supabase/server";

type UnitRow = {
  id: string;
  label: string;
  rent_cents: number | null;
  properties: { name: string | null } | null;
};
type OccRow = {
  unit_id: string;
  tenant_name: string | null;
  occupant_profile_id: string | null;
  rent_cents: number | null;
  lease_end_date: string | null;
};
type LeaseRow = { unit_id: string | null; rent_cents: number | null; end_date: string | null };
type OfferRow = {
  id: string;
  unit_id: string;
  status: string;
  new_rent_cents: number;
  effective_date: string;
  created_at: string;
};

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function AdminRenewals() {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: units }, { data: occ }, { data: leases }, { data: offers }] = await Promise.all([
    db.from("units").select("id, label, rent_cents, properties(name)").returns<UnitRow[]>(),
    db
      .from("unit_occupancy")
      .select("unit_id, tenant_name, occupant_profile_id, rent_cents, lease_end_date")
      .returns<OccRow[]>(),
    db
      .from("leases")
      .select("unit_id, rent_cents, end_date")
      .eq("status", "active")
      .returns<LeaseRow[]>(),
    db
      .from("renewal_offers")
      .select("id, unit_id, status, new_rent_cents, effective_date, created_at")
      .order("created_at", { ascending: false })
      .returns<OfferRow[]>(),
  ]);

  const occByUnit = new Map<string, OccRow>();
  for (const o of occ ?? []) occByUnit.set(o.unit_id, o);
  const leaseByUnit = new Map<string, LeaseRow>();
  for (const l of leases ?? []) if (l.unit_id) leaseByUnit.set(l.unit_id, l);
  // Newest offer per unit, ignoring withdrawn ones (they're history).
  const offerByUnit = new Map<string, OfferRow>();
  for (const of_ of offers ?? []) {
    if (of_.status === "withdrawn") continue;
    if (!offerByUnit.has(of_.unit_id)) offerByUnit.set(of_.unit_id, of_);
  }

  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const sixtyOneOut = new Date(todayMid);
  sixtyOneOut.setDate(sixtyOneOut.getDate() + 61);

  const rows: RenewalRow[] = [];
  for (const u of units ?? []) {
    const o = occByUnit.get(u.id);
    if (!o || !(o.tenant_name || o.occupant_profile_id)) continue; // vacant

    const lease = leaseByUnit.get(u.id);
    const endDate = o.lease_end_date ?? lease?.end_date ?? null;
    const rentCents = lease?.rent_cents || o.rent_cents || u.rent_cents || 0;

    let daysLeft: number | null = null;
    let suggested = iso(sixtyOneOut);
    if (endDate) {
      const [y, m, d] = endDate.split("-").map(Number);
      const end = new Date(y, m - 1, d);
      daysLeft = Math.round((end.getTime() - todayMid.getTime()) / 86_400_000);
      const dayAfterEnd = new Date(end);
      dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);
      suggested = iso(dayAfterEnd > sixtyOneOut ? dayAfterEnd : sixtyOneOut);
    }

    const of_ = offerByUnit.get(u.id);
    rows.push({
      unitId: u.id,
      unit: u.label,
      property: u.properties?.name ?? "—",
      tenant: o.tenant_name ?? "—",
      rentCents,
      endDate,
      daysLeft,
      suggestedEffective: suggested,
      offer: of_
        ? { id: of_.id, status: of_.status, newRentCents: of_.new_rent_cents, effectiveDate: of_.effective_date }
        : null,
    });
  }

  // Sort inside buckets: soonest end first, then property/unit.
  rows.sort(
    (a, b) =>
      (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999) ||
      a.property.localeCompare(b.property) ||
      a.unit.localeCompare(b.unit, undefined, { numeric: true })
  );

  // Endings per month for the next 12 months.
  const stagger: StaggerMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const m = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    const count = rows.filter((r) => r.endDate?.startsWith(key)).length;
    stagger.push({ label: m.toLocaleDateString("en-US", { month: "short" }), count });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Lease renewals"
        subtitle="Who's expiring, who's month-to-month, and where every renewal offer stands."
      />
      <RenewalBoard rows={rows} stagger={stagger} />
    </div>
  );
}
