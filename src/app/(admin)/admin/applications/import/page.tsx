import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { ZillowImportForm } from "@/components/zillow-import-form";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Import a Zillow application" };
export const dynamic = "force-dynamic";

type UnitRow = {
  id: string;
  label: string;
  status: string;
  rent_cents: number | null;
  properties: { name: string | null } | null;
};

export default async function ImportApplication() {
  const { profile } = await requireProfile("/admin/applications/import");
  if (!isStaff(profile)) redirect("/portal");

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data } = await db
    .from("units")
    .select("id, label, status, rent_cents, properties(name)")
    .order("label")
    .returns<UnitRow[]>();

  // Vacant homes first — that's almost always the one being let — but every
  // home stays selectable, because a tenancy sometimes gets set up before the
  // current resident's move-out has been recorded.
  const rank = (s: string) => (s === "available" ? 0 : s === "make_ready" ? 1 : 2);
  const homes = (data ?? [])
    .slice()
    .sort((a, b) => rank(a.status) - rank(b.status) || a.label.localeCompare(b.label))
    .map((u) => ({
      id: u.id,
      label: u.status === "occupied" ? `${u.label} (occupied)` : u.label,
      property: u.properties?.name ?? "—",
      rentCents: u.rent_cents,
    }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Import a Zillow application"
        subtitle="Bring an approved applicant across without making them apply again."
      />

      <Card className="mb-5 border-pine/30 bg-pine/5 p-5">
        <p className="text-sm leading-relaxed text-ink">
          Zillow has already taken their application, verified who they are and run the
          background check. Everything below is you copying that across — the applicant
          does nothing. When it&apos;s saved, the home is theirs and their welcome steps
          are waiting for them.
        </p>
      </Card>

      <Card className="p-6">
        <ZillowImportForm homes={homes} />
      </Card>
    </div>
  );
}
