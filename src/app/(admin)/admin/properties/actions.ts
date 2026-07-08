"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";
import { sendNotification } from "@/lib/email";

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

  // Voluntary assistance-program disclosure (mediation eligibility) + contact.
  const programs = form
    .getAll("assistance_programs")
    .map((v) => String(v).trim())
    .filter((v) => ["ssi", "ssdi", "colorado_works"].includes(v));

  // Loose handle: new tenancy columns aren't in the generated types yet.
  await (supabase as unknown as SupabaseClient).from("unit_occupancy").upsert(
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
      assistance_programs: programs,
      assistance_disclosed_at: str(form.get("assistance_disclosed_at")),
      emergency_contact_name: str(form.get("emergency_contact_name")),
      emergency_contact_phone: str(form.get("emergency_contact_phone")),
      notes: str(form.get("tenancy_notes")),
    },
    { onConflict: "unit_id" }
  );

  // Keep the primary co-tenant link in sync with the linked occupant.
  if (occupantId) {
    await (supabase as unknown as SupabaseClient)
      .from("unit_occupants")
      .upsert({ unit_id: id, profile_id: occupantId, is_primary: true }, { onConflict: "unit_id,profile_id" });
  }

  revalidatePath("/admin/properties");
  if (slug) revalidatePath(`/admin/properties/${slug}`);
  revalidatePath("/admin/properties/[slug]", "page");
  revalidatePath("/admin");
}

export type InviteState = { ok: boolean; error?: string; notice?: string };

/**
 * Invite a unit's current tenant to the resident portal. Creates (or links) an
 * account from the tenancy's tenant_email + tenant_name, links it as the unit's
 * occupant, and emails them a login. Staff-only.
 */
export async function inviteTenant(
  _prev: InviteState,
  form: FormData
): Promise<InviteState> {
  const unitId = (form.get("unit_id") as string)?.trim();
  if (!unitId) return { ok: false, error: "Missing unit." };

  const supabase = await createClient();
  const { profile } = await requireProfile("/admin/properties");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const { data: occ } = await supabase
    .from("unit_occupancy")
    .select("tenant_name, tenant_email, occupant_profile_id, units(label, properties(name))")
    .eq("unit_id", unitId)
    .maybeSingle<{
      tenant_name: string | null;
      tenant_email: string | null;
      occupant_profile_id: string | null;
      units: { label: string; properties: { name: string | null } | null } | null;
    }>();

  if (occ?.occupant_profile_id) return { ok: true, notice: "Already linked to an account." };

  // Optionally take an email supplied inline (for records entered without one).
  const emailInput = (form.get("email") as string)?.trim().toLowerCase() || null;
  const email = emailInput ?? occ?.tenant_email?.trim().toLowerCase();
  if (!email) return { ok: false, error: "Add a tenant email first, then save." };
  if (emailInput && emailInput !== occ?.tenant_email?.trim().toLowerCase()) {
    await supabase
      .from("unit_occupancy")
      .update({ tenant_email: emailInput })
      .eq("unit_id", unitId);
  }

  const home = occ?.units?.properties?.name
    ? `${occ.units.properties.name} — ${occ.units.label}`
    : "your home";

  // Reuse an existing account if one already has this email; else create one.
  let profileId: string | null = null;
  let tempPassword: string | null = null;
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    profileId = existing.id;
  } else {
    const admin = createAdminClient();
    tempPassword = `38thAve-${crypto.randomUUID().slice(0, 8)}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: occ?.tenant_name ?? undefined },
    });
    if (error || !data.user) {
      return { ok: false, error: "Could not create the account. Check the email and try again." };
    }
    profileId = data.user.id;
  }

  await supabase
    .from("unit_occupancy")
    .update({ occupant_profile_id: profileId })
    .eq("unit_id", unitId);

  revalidatePath("/admin/properties");
  revalidatePath("/admin/properties/[slug]", "page");
  revalidatePath("/admin/residents");

  const greeting = occ?.tenant_name?.split(" ")[0] ?? "there";
  if (tempPassword) {
    await sendNotification({
      to: email,
      replyTo: "hello@38thaveproperties.com",
      subject: "Your 38th Ave Properties resident portal",
      html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;color:#2c2622;font-size:15px;line-height:1.7"><div style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#2f5d50;margin-bottom:12px">Welcome, ${greeting} 👋</div><p>We've set up a resident portal for <strong>${home}</strong>. You can pay rent, request maintenance, view your lease and rent statement, and message our team — all in one place.</p><p style="margin:18px 0 8px;font-weight:600">How to sign in:</p><ol style="padding-left:20px;margin:0 0 18px"><li style="margin-bottom:6px">Go to <a href="https://38thaveproperties.com/login" style="color:#2f5d50;font-weight:600">38thaveproperties.com/login</a></li><li style="margin-bottom:6px">Email: <strong>${email}</strong></li><li style="margin-bottom:6px">Temporary password: <strong>${tempPassword}</strong></li></ol><p style="font-size:14px;color:#6f655a">We recommend setting your own password — on the sign-in page click “Forgot password?”. Reply to this email if you need any help.</p><p style="margin-top:18px;color:#6f655a;font-size:14px">— The 38th Ave Properties team</p></div>`,
    });
    return { ok: true, notice: "Account created & login emailed." };
  }

  await sendNotification({
    to: email,
    replyTo: "hello@38thaveproperties.com",
    subject: "Your 38th Ave Properties resident portal is ready",
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;color:#2c2622;font-size:15px;line-height:1.7"><div style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#2f5d50;margin-bottom:12px">You're all set, ${greeting} 👋</div><p>Your account is now linked to <strong>${home}</strong>. Sign in at <a href="https://38thaveproperties.com/login" style="color:#2f5d50;font-weight:600">38thaveproperties.com/login</a> to pay rent, request maintenance, view your lease and statement, and message our team. Use “Forgot password?” if you need to reset it.</p><p style="margin-top:18px;color:#6f655a;font-size:14px">— The 38th Ave Properties team</p></div>`,
  });
  return { ok: true, notice: "Linked & emailed." };
}
