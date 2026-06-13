import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageHeader } from "@/components/dashboard-ui";
import {
  AddTenantForm,
  type UnitOption,
  type ExistingTenant,
} from "@/components/add-tenant-form";
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
  tenant_email: string | null;
};

export default async function AddTenantPage() {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: units }, { data: occ }] = await Promise.all([
    supabase
      .from("units")
      .select("id, label, rent_cents, properties(name)")
      .returns<UnitRow[]>(),
    db
      .from("unit_occupancy")
      .select("unit_id, tenant_name, tenant_email")
      .returns<OccRow[]>(),
  ]);

  const occByUnit = new Map<string, OccRow>();
  for (const o of occ ?? []) occByUnit.set(o.unit_id, o);

  const whereByUnit = new Map<string, string>();
  const options: UnitOption[] = (units ?? [])
    .map((u) => {
      const where = `${u.properties?.name ?? "—"} · ${u.label}`;
      whereByUnit.set(u.id, where);
      const o = occByUnit.get(u.id);
      return {
        id: u.id,
        label: u.label,
        property: u.properties?.name ?? "—",
        rentCents: u.rent_cents,
        occupiedBy: o?.tenant_name ?? o?.tenant_email ?? null,
      };
    })
    .sort(
      (a, b) =>
        a.property.localeCompare(b.property) ||
        a.label.localeCompare(b.label, undefined, { numeric: true })
    );

  const existing: ExistingTenant[] = (occ ?? [])
    .filter((o) => o.tenant_name || o.tenant_email)
    .map((o) => ({
      unitId: o.unit_id,
      name: o.tenant_name,
      email: o.tenant_email,
      where: whereByUnit.get(o.unit_id) ?? "another unit",
    }));

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
      <AddTenantForm units={options} existing={existing} />
    </div>
  );
}
