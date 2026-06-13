"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";

export type ContactState = { ok: boolean; error?: string };

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
