"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";
import { resetPortalPassword } from "@/lib/portal-invite";
import type { EmailActionState } from "@/lib/action-state";

export type ContactState = { ok: boolean; error?: string };
export type DocState = { ok: boolean; error?: string };

/**
 * Match a self-signed-up resident to the unit they said they're renting: links
 * their account to that unit's tenancy (occupancy + co-tenant membership), which
 * syncs their address + rent, and clears the pending claim. Staff-confirmed so
 * nobody can claim a home that isn't theirs.
 */
export async function matchClaimedUnit(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/residents");
  if (!isStaff(profile)) return;

  const profileId = (form.get("profile_id") as string)?.trim();
  const unitId = (form.get("unit_id") as string)?.trim();
  if (!profileId || !unitId) return;

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: person } = await db
    .from("profiles")
    .select("full_name, email, phone, signup_unit_id")
    .eq("id", profileId)
    .maybeSingle<{ full_name: string | null; email: string | null; phone: string | null; signup_unit_id: string | null }>();
  if (!person) return;

  const { data: existing } = await db
    .from("unit_occupancy")
    .select("unit_id, tenant_name, tenant_email, tenant_phone")
    .eq("unit_id", unitId)
    .maybeSingle<{ unit_id: string; tenant_name: string | null; tenant_email: string | null; tenant_phone: string | null }>();

  if (existing) {
    await db
      .from("unit_occupancy")
      .update({
        occupant_profile_id: profileId,
        tenant_name: existing.tenant_name ?? person.full_name,
        tenant_email: existing.tenant_email ?? person.email,
        tenant_phone: existing.tenant_phone ?? person.phone,
      })
      .eq("unit_id", unitId);
  } else {
    await db.from("unit_occupancy").insert({
      unit_id: unitId,
      occupant_profile_id: profileId,
      tenant_name: person.full_name,
      tenant_email: person.email,
      tenant_phone: person.phone,
    });
  }

  await db
    .from("unit_occupants")
    .upsert({ unit_id: unitId, profile_id: profileId, is_primary: true }, { onConflict: "unit_id,profile_id" });
  await db.from("profiles").update({ signup_unit_id: null }).eq("id", profileId);

  revalidatePath(`/admin/residents/${profileId}`);
  revalidatePath("/admin/residents");
  revalidatePath(`/admin/units/${unitId}`);
}

const RESIDENT_DOC_BUCKET = "resident-docs";
const DOC_TYPES = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
]);

function strField(v: FormDataEntryValue | null): string | null {
  const s = ((v as string) ?? "").trim();
  return s || null;
}

/** Add an admin-only document and/or note to a resident. Staff-only. */
export async function addResidentDocument(
  _prev: DocState,
  form: FormData
): Promise<DocState> {
  const { user, profile } = await requireProfile("/admin/residents");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const residentId = strField(form.get("resident_id"));
  if (!residentId) return { ok: false, error: "Missing resident." };
  const label = strField(form.get("label"));
  const note = strField(form.get("note"));
  const file = form.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (!label && !note && !hasFile) {
    return { ok: false, error: "Add a label, note, or file." };
  }

  const admin = createAdminClient();
  let path: string | null = null;
  if (hasFile) {
    if (!DOC_TYPES.has(file.type)) {
      return { ok: false, error: "File must be a PDF or image." };
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    path = `${residentId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(RESIDENT_DOC_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) return { ok: false, error: "Upload failed. Please try again." };
  }

  const { error } = await (admin as unknown as SupabaseClient)
    .from("resident_documents")
    .insert({
      resident_id: residentId,
      label,
      note,
      path,
      uploaded_by: user.id,
    });
  if (error) return { ok: false, error: "Could not save. Please try again." };

  revalidatePath(`/admin/residents/${residentId}`);
  return { ok: true };
}

/** Delete a resident document (and its file). Staff-only. */
export async function deleteResidentDocument(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/residents");
  if (!isStaff(profile)) return;

  const id = strField(form.get("id"));
  const residentId = strField(form.get("resident_id"));
  if (!id) return;

  const admin = createAdminClient();
  const adb = admin as unknown as SupabaseClient;
  const { data: row } = await adb
    .from("resident_documents")
    .select("path")
    .eq("id", id)
    .maybeSingle<{ path: string | null }>();
  if (row?.path) {
    await admin.storage.from(RESIDENT_DOC_BUCKET).remove([row.path]);
  }
  await adb.from("resident_documents").delete().eq("id", id);

  if (residentId) revalidatePath(`/admin/residents/${residentId}`);
}

/**
 * Email a resident a one-click sign-in link to their portal, for accounts
 * created from an application that never received credentials.
 */
export async function sendPortalLogin(
  _prev: EmailActionState,
  form: FormData
): Promise<EmailActionState> {
  const { profile } = await requireProfile("/admin/residents");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const id = (form.get("profile_id") as string)?.trim();
  if (!id) return { ok: false, error: "Missing resident." };

  const admin = createAdminClient();
  const { data: p } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", id)
    .maybeSingle<{ full_name: string | null; email: string | null }>();

  const email = p?.email?.trim();
  if (!email) return { ok: false, error: "No email on file." };

  const ok = await resetPortalPassword(id, email, p?.full_name ?? null);
  if (!ok) return { ok: false, error: "Could not set a login. Please try again." };
  revalidatePath(`/admin/residents/${id}`);
  return { ok: true, sentTo: email };
}

function str(v: FormDataEntryValue | null): string | null {
  const s = ((v as string) ?? "").trim();
  return s || null;
}

/**
 * Staff edit of a resident's contact details. Uses the service-role client so
 * staff can update another user's profile (never touches role). Also syncs the
 * phone onto the linked unit tenancy so the two stay in agreement.
 */
export async function updateResidentContact(
  _prev: ContactState,
  form: FormData
): Promise<ContactState> {
  const { profile } = await requireProfile("/admin/residents");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const profileId = str(form.get("profile_id"));
  if (!profileId) return { ok: false, error: "Missing resident." };

  const fullName = str(form.get("full_name"));
  const phone = str(form.get("phone"));

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      phone,
      emergency_contact_name: str(form.get("emergency_contact_name")),
      emergency_contact_phone: str(form.get("emergency_contact_phone")),
    })
    .eq("id", profileId);
  if (error) return { ok: false, error: "Could not save. Please try again." };

  // Keep the linked tenancy record's phone in step.
  await admin
    .from("unit_occupancy")
    .update({ tenant_phone: phone })
    .eq("occupant_profile_id", profileId);

  revalidatePath(`/admin/residents/${profileId}`);
  revalidatePath("/admin/residents");
  return { ok: true };
}
