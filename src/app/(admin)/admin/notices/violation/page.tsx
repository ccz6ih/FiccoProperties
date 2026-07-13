import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { LeaseViolationForm } from "@/components/lease-violation-form";
import type { TermUnit } from "@/components/termination-notice-form";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type OccRow = {
  unit_id: string;
  tenant_name: string | null;
  occupant_profile_id: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

export default async function LeaseViolation({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { profile } = await requireProfile("/admin/notices/violation");
  if (!isStaff(profile)) redirect("/portal");

  const { unit: defaultUnit } = await searchParams;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: occ } = await db
    .from("unit_occupancy")
    .select("unit_id, tenant_name, occupant_profile_id, units:unit_id(label, properties(name))")
    .returns<OccRow[]>();

  const units: TermUnit[] = (occ ?? [])
    .filter((o) => o.unit_id && (o.tenant_name || o.occupant_profile_id))
    .map((o) => ({
      id: o.unit_id,
      label: o.units?.label ?? "—",
      property: o.units?.properties?.name ?? "—",
      tenant: o.tenant_name ?? "—",
    }))
    .sort((a, b) => a.property.localeCompare(b.property) || a.label.localeCompare(b.label, undefined, { numeric: true }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Lease violation notice"
        subtitle="Create a Notice of Lease Violation (Demand to Comply) for any unit."
        action={
          <Link href="/admin/notices" className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand">
            ← Notices
          </Link>
        }
      />
      {units.length > 0 ? (
        <Card className="p-6">
          <LeaseViolationForm units={units} defaultUnit={defaultUnit} />
        </Card>
      ) : (
        <EmptyState title="No occupied units" body="Add a tenancy to a unit first." />
      )}
      <p className="mt-4 text-xs text-ink-faint">
        This is a workflow aid, not legal advice. A lease violation is generally curable — give a
        reasonable time to fix it and keep the served copy. For a court filing use Colorado&apos;s
        official JDF forms and consult your attorney.
      </p>
    </div>
  );
}
