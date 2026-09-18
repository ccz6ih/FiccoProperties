import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { TerminationNoticeForm, type TermUnit } from "@/components/termination-notice-form";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type OccRow = {
  unit_id: string;
  tenant_name: string | null;
  occupant_profile_id: string | null;
  move_in_date: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

/** Whole months lived in the home — the C.R.S. 38-12-1302 12-month threshold. */
function monthsResident(moveIn: string | null): number | null {
  if (!moveIn) return null;
  const start = new Date(`${moveIn}T00:00:00`);
  const now = new Date();
  let m = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) m -= 1;
  return Math.max(0, m);
}

export default async function TerminateTenancy({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { profile } = await requireProfile("/admin/notices/terminate");
  if (!isStaff(profile)) redirect("/portal");

  const { unit: defaultUnit } = await searchParams;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: occ } = await db
    .from("unit_occupancy")
    .select("unit_id, tenant_name, occupant_profile_id, move_in_date, units:unit_id(label, properties(name))")
    .returns<OccRow[]>();

  const units: TermUnit[] = (occ ?? [])
    .filter((o) => o.unit_id && (o.tenant_name || o.occupant_profile_id))
    .map((o) => ({
      id: o.unit_id,
      label: o.units?.label ?? "—",
      property: o.units?.properties?.name ?? "—",
      tenant: o.tenant_name ?? "—",
      monthsResident: monthsResident(o.move_in_date),
    }))
    .sort((a, b) => a.property.localeCompare(b.property) || a.label.localeCompare(b.label, undefined, { numeric: true }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Terminate tenancy (JDF 99B)"
        subtitle="Create a Notice to Terminate Tenancy for a lease/conduct violation or a non-renewal."
        action={
          <Link href="/admin/notices" className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand">
            ← Notices
          </Link>
        }
      />
      {units.length > 0 ? (
        <Card className="p-6">
          <TerminationNoticeForm units={units} defaultUnit={defaultUnit} />
        </Card>
      ) : (
        <EmptyState title="No occupied units" body="Add a tenancy to a unit first." />
      )}
      <p className="mt-4 text-xs text-ink-faint">
        Substantial-violation (3-day) and repeat-violation (10-day) notices are for conduct/lease
        breaches. Non-renewal without cause is limited to exempt situations or tenants under 12
        months — otherwise use the 90-day no-fault. This is a workflow aid, not legal advice; for a
        court filing use Colorado&apos;s official JDF forms and consult your attorney.
      </p>
    </div>
  );
}
