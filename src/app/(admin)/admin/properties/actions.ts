"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_STATUS = ["occupied", "available", "make_ready", "offline"];

function num(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: FormDataEntryValue | null): string | null {
  const s = ((value as string) ?? "").trim();
  return s || null;
}

function dollarsToCents(value: FormDataEntryValue | null): number | null {
  const d = num(value);
  return d == null ? null : Math.round(d * 100);
}

export async function setUnitStatus(form: FormData) {
  const id = form.get("id") as string;
  const status = form.get("status") as string;
  if (!id || !ALLOWED_STATUS.includes(status)) return;

  const supabase = await createClient();
  await supabase.from("units").update({ status }).eq("id", id);

  revalidatePath("/admin/properties");
  revalidatePath("/admin");
}

/** One submit: update the unit and upsert its current tenancy (unit_occupancy). */
export async function saveUnit(form: FormData) {
  const id = form.get("id") as string;
  const status = form.get("status") as string;
  if (!id || !ALLOWED_STATUS.includes(status)) return;

  const label = (form.get("label") as string)?.trim();
  if (!label) return;

  const slug = str(form.get("property_slug"));

  const supabase = await createClient();

  await supabase
    .from("units")
    .update({
      label,
      status,
      bedrooms: num(form.get("bedrooms")),
      bathrooms: num(form.get("bathrooms")),
      sqft: num(form.get("sqft")),
      rent_cents: dollarsToCents(form.get("rent_dollars")),
      notes: str(form.get("notes")),
    })
    .eq("id", id);

  await supabase.from("unit_occupancy").upsert(
    {
      unit_id: id,
      occupant_profile_id: str(form.get("occupant_profile_id")),
      tenant_name: str(form.get("tenant_name")),
      tenant_email: str(form.get("tenant_email")),
      tenant_phone: str(form.get("tenant_phone")),
      rent_cents: dollarsToCents(form.get("tenant_rent_dollars")),
      lease_start_date: str(form.get("lease_start_date")),
      lease_signed_date: str(form.get("lease_signed_date")),
      lease_end_date: str(form.get("lease_end_date")),
      move_in_date: str(form.get("move_in_date")),
      notes: str(form.get("tenancy_notes")),
    },
    { onConflict: "unit_id" }
  );

  revalidatePath("/admin/properties");
  if (slug) revalidatePath(`/admin/properties/${slug}`);
  revalidatePath("/admin");
}
