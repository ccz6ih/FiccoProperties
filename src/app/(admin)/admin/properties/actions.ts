"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";

const ALLOWED_STATUS = ["occupied", "available", "make_ready", "offline"];
const PROPERTY_BUCKET = "property-photos";

export type CoverState = { ok: boolean; error?: string };

/** Upload a community cover photo. Staff-only (uses the service-role client). */
export async function setPropertyCover(
  _prev: CoverState,
  form: FormData
): Promise<CoverState> {
  const propertyId = form.get("property_id") as string;
  const slug = (form.get("slug") as string) || "";
  const file = form.get("cover");

  if (!propertyId) return { ok: false, error: "Missing property." };
  if (!(file instanceof File) || file.size === 0 || !file.type.startsWith("image/")) {
    return { ok: false, error: "Choose an image to upload." };
  }

  const { profile } = await requireProfile(`/admin/properties/${slug}`);
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const admin = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${propertyId}/cover-${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from(PROPERTY_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, error: "Upload failed. Please try again." };

  const {
    data: { publicUrl },
  } = admin.storage.from(PROPERTY_BUCKET).getPublicUrl(path);

  await admin.from("properties").update({ hero_image: publicUrl }).eq("id", propertyId);

  revalidatePath("/admin/properties");
  if (slug) revalidatePath(`/admin/properties/${slug}`);
  revalidatePath("/");
  revalidatePath(`/properties/${slug}`);
  return { ok: true };
}

/** Clear a community cover photo. Staff-only. */
export async function removePropertyCover(form: FormData): Promise<void> {
  const propertyId = form.get("property_id") as string;
  const slug = (form.get("slug") as string) || "";
  if (!propertyId) return;

  const { profile } = await requireProfile(`/admin/properties/${slug}`);
  if (!isStaff(profile)) return;

  const admin = createAdminClient();
  await admin.from("properties").update({ hero_image: null }).eq("id", propertyId);

  revalidatePath("/admin/properties");
  if (slug) revalidatePath(`/admin/properties/${slug}`);
  revalidatePath("/");
  revalidatePath(`/properties/${slug}`);
}

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
  revalidatePath("/admin/properties/[slug]", "page");
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

  // Link the tenant's sign-in account. If none was picked but the tenant email
  // matches an existing account, link it automatically.
  let occupantId = str(form.get("occupant_profile_id"));
  const tenantEmail = str(form.get("tenant_email"));
  if (!occupantId && tenantEmail) {
    const { data: match } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", tenantEmail)
      .maybeSingle();
    if (match) occupantId = match.id;
  }

  await supabase.from("unit_occupancy").upsert(
    {
      unit_id: id,
      occupant_profile_id: occupantId,
      tenant_name: str(form.get("tenant_name")),
      tenant_email: tenantEmail,
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
  revalidatePath("/admin/properties/[slug]", "page");
  revalidatePath("/admin");
}
