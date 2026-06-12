import Link from "next/link";
import { PageHeader } from "@/components/dashboard-ui";
import {
  NoticeCreateForm,
  type ResidentOption,
} from "@/components/notice-create-form";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

type OccupancyRow = {
  occupant_profile_id: string;
  units: {
    label: string;
    properties: {
      name: string | null;
      address_line1: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
    } | null;
  } | null;
};

export default async function NewNoticePage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: occupancies }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .order("full_name", { ascending: true })
      .returns<ProfileRow[]>(),
    supabase
      .from("unit_occupancy")
      .select(
        "occupant_profile_id, units(label, properties(name, address_line1, city, state, postal_code))"
      )
      .returns<OccupancyRow[]>(),
  ]);

  const homeByResident = new Map<string, OccupancyRow>();
  for (const o of occupancies ?? []) {
    if (o.occupant_profile_id) homeByResident.set(o.occupant_profile_id, o);
  }

  const residents: ResidentOption[] = (profiles ?? [])
    .filter((p) => p.role === "resident" || p.role === "applicant")
    .map((p) => {
      const occ = homeByResident.get(p.id);
      const unit = occ?.units;
      const prop = unit?.properties;
      const homeLabel = prop?.name ? `${prop.name} · ${unit?.label}` : null;
      const fullAddress = [
        prop?.address_line1,
        prop?.city,
        prop?.state,
        prop?.postal_code,
      ]
        .filter(Boolean)
        .join(", ");
      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        home_label: homeLabel,
        full_address: fullAddress || null,
      };
    });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New notice"
        subtitle="Pick a resident and type, generate the wording, then edit and save."
        action={
          <Link
            href="/admin/notices"
            className="text-sm text-pine hover:underline"
          >
            ← Back to notices
          </Link>
        }
      />
      <NoticeCreateForm residents={residents} />
    </div>
  );
}
