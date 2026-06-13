import { PageHeader } from "@/components/dashboard-ui";
import { LeaseImporter, type UnitRef } from "@/components/lease-importer";
import { createClient } from "@/lib/supabase/server";

type UnitRow = {
  id: string;
  label: string;
  properties: { name: string | null; slug: string } | null;
};

export default async function ImportTenants() {
  const supabase = await createClient();

  const { data: units } = await supabase
    .from("units")
    .select("id, label, properties(name, slug)")
    .returns<UnitRow[]>();

  const unitRefs: UnitRef[] = (units ?? []).map((u) => ({
    id: u.id,
    label: u.label,
    property: u.properties?.name ?? "",
    slug: u.properties?.slug ?? "",
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Import tenants"
        subtitle="Bring your existing renters in at once — names, move-in dates, lease terms, and rent."
      />
      <LeaseImporter units={unitRefs} />
    </div>
  );
}
