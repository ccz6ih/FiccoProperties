import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { AccountForm } from "@/components/account-form";
import { VehiclesManager } from "@/components/vehicles-manager";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account" };

type VehicleRow = {
  id: string;
  make: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  plate: string | null;
  state: string | null;
};

export default async function AccountPage() {
  const { user, profile } = await requireProfile("/account");
  const backHref = isStaff(profile) ? "/admin" : "/portal";

  const supabase = await createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, make, model, color, year, plate, state")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: true })
    .returns<VehicleRow[]>();

  return (
    <main className="min-h-dvh bg-grain py-12">
      <Container className="max-w-2xl">
        <Link
          href={backHref}
          className="mb-4 inline-block text-sm font-medium text-pine hover:text-pine-dark"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mb-1 font-display text-3xl font-semibold text-ink">Your account</h1>
        <p className="mb-8 text-ink-soft">
          Update your photo and contact details.
        </p>
        <AccountForm
          fullName={profile?.full_name ?? null}
          phone={profile?.phone ?? null}
          email={user.email ?? null}
          avatarUrl={profile?.avatar_url ?? null}
          emergencyName={profile?.emergency_contact_name ?? null}
          emergencyPhone={profile?.emergency_contact_phone ?? null}
          insuranceProvider={profile?.insurance_provider ?? null}
          insurancePolicyNumber={profile?.insurance_policy_number ?? null}
          insuranceExpiresOn={profile?.insurance_expires_on ?? null}
          hasInsuranceDoc={!!profile?.insurance_doc_path}
        />

        <h2 className="mb-3 mt-10 font-display text-2xl font-semibold text-ink">Vehicles</h2>
        <VehiclesManager vehicles={vehicles ?? []} />
      </Container>
    </main>
  );
}
