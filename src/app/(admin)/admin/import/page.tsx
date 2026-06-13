import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageHeader } from "@/components/dashboard-ui";
import { LeaseImporter, type UnitRef } from "@/components/lease-importer";
import { BillingActivate } from "@/components/billing-activate";
import { createClient } from "@/lib/supabase/server";

type UnitRow = {
  id: string;
  label: string;
  properties: { name: string | null; slug: string } | null;
};

export default async function ImportTenants() {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: units }, { data: occ }, { data: activeLeases }] = await Promise.all([
    supabase
      .from("units")
      .select("id, label, properties(name, slug)")
      .returns<UnitRow[]>(),
    db
      .from("unit_occupancy")
      .select("unit_id, tenant_name, tenant_email, occupant_profile_id")
      .returns<
        {
          unit_id: string;
          tenant_name: string | null;
          tenant_email: string | null;
          occupant_profile_id: string | null;
        }[]
      >(),
    db
      .from("leases")
      .select("unit_id")
      .eq("status", "active")
      .returns<{ unit_id: string }[]>(),
  ]);

  const unitRefs: UnitRef[] = (units ?? []).map((u) => ({
    id: u.id,
    label: u.label,
    property: u.properties?.name ?? "",
    slug: u.properties?.slug ?? "",
  }));

  // Tenancies that have someone but no active lease yet = need billing setup.
  const activeUnits = new Set((activeLeases ?? []).map((l) => l.unit_id));
  const needsBilling = (occ ?? []).filter(
    (o) =>
      (o.tenant_name || o.tenant_email || o.occupant_profile_id) &&
      !activeUnits.has(o.unit_id)
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <PageHeader
          title="Import tenants"
          subtitle="Bring your existing renters in at once — names, move-in dates, lease terms, and rent."
          action={
            <Link href="/admin/tenants/new" className="text-sm text-pine hover:underline">
              + Add one manually
            </Link>
          }
        />
        <LeaseImporter units={unitRefs} />
      </div>

      <BillingActivate needsBilling={needsBilling} />
    </div>
  );
}
