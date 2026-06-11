import Link from "next/link";
import { PageHeader } from "@/components/dashboard-ui";
import {
  LeaseCreateForm,
  type UnitOption,
  type ResidentOption,
} from "@/components/lease-create-form";
import { createClient } from "@/lib/supabase/server";

type UnitRow = {
  id: string;
  label: string;
  rent_cents: number | null;
  properties: { name: string | null } | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

type ApplicationRow = {
  id: string;
  unit_id: string | null;
  email: string | null;
};

export default async function NewLeasePage({
  searchParams,
}: {
  searchParams: Promise<{ application?: string }>;
}) {
  const { application } = await searchParams;
  const supabase = await createClient();

  const [{ data: units }, { data: profiles }] = await Promise.all([
    supabase
      .from("units")
      .select("id, label, rent_cents, properties(name)")
      .order("label", { ascending: true })
      .returns<UnitRow[]>(),
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .order("full_name", { ascending: true })
      .returns<ProfileRow[]>(),
  ]);

  // Prefill from an approved application, if one was passed.
  let defaults:
    | { unit_id?: string | null; resident_id?: string | null; rent?: string; application_id?: string | null }
    | undefined;

  if (application) {
    const { data: app } = await supabase
      .from("applications")
      .select("id, unit_id, email")
      .eq("id", application)
      .maybeSingle<ApplicationRow>();

    if (app) {
      const matchedProfile = app.email
        ? profiles?.find((p) => p.email?.toLowerCase() === app.email?.toLowerCase())
        : undefined;
      const matchedUnit = app.unit_id
        ? units?.find((u) => u.id === app.unit_id)
        : undefined;
      defaults = {
        application_id: app.id,
        unit_id: app.unit_id,
        resident_id: matchedProfile?.id ?? null,
        rent: matchedUnit?.rent_cents != null ? String(matchedUnit.rent_cents / 100) : undefined,
      };
    }
  }

  const unitOptions: UnitOption[] = (units ?? []).map((u) => ({
    id: u.id,
    label: u.label,
    property_name: u.properties?.name ?? null,
    rent_cents: u.rent_cents,
  }));

  const residentOptions: ResidentOption[] = (profiles ?? [])
    .filter((p) => p.role === "resident" || p.role === "applicant")
    .map((p) => ({ id: p.id, full_name: p.full_name, email: p.email }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New lease"
        subtitle="Draft a lease, then send it to the resident for e-signature."
        action={
          <Link href="/admin/leases" className="text-sm text-pine hover:underline">
            ← Back to leases
          </Link>
        }
      />
      <LeaseCreateForm
        units={unitOptions}
        residents={residentOptions}
        defaults={defaults}
      />
    </div>
  );
}
