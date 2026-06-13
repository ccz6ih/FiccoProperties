import Link from "next/link";
import { PageHeader } from "@/components/dashboard-ui";
import { AddTenantForm, type UnitOption } from "@/components/add-tenant-form";
import { createClient } from "@/lib/supabase/server";

type UnitRow = {
  id: string;
  label: string;
  rent_cents: number | null;
  properties: { name: string | null } | null;
};

export default async function AddTenantPage() {
  const supabase = await createClient();

  const { data: units } = await supabase
    .from("units")
    .select("id, label, rent_cents, properties(name)")
    .returns<UnitRow[]>();

  const options: UnitOption[] = (units ?? [])
    .map((u) => ({
      id: u.id,
      label: u.label,
      property: u.properties?.name ?? "—",
      rentCents: u.rent_cents,
    }))
    .sort(
      (a, b) =>
        a.property.localeCompare(b.property) ||
        a.label.localeCompare(b.label, undefined, { numeric: true })
    );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Add tenant"
        subtitle="Record a renter's details for a unit — accounts and billing are optional."
        action={
          <Link href="/admin/import" className="text-sm text-pine hover:underline">
            Import many →
          </Link>
        }
      />
      <AddTenantForm units={options} />
    </div>
  );
}
