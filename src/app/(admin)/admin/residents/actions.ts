"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";
import { sendNotification } from "@/lib/email";

export type ContactState = { ok: boolean; error?: string };

/**
 * Email a resident a one-click sign-in link to their portal (a magic link that
 * logs them in), plus instructions to set a password for future logins. Use it
 * for residents created from an application who never received credentials.
 */
export async function sendPortalLogin(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/residents");
  if (!isStaff(profile)) return;

  const id = (form.get("profile_id") as string)?.trim();
  if (!id) return;

  const admin = createAdminClient();
  const { data: p } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", id)
    .maybeSingle<{ full_name: string | null; email: string | null }>();

  const email = p?.email?.trim();
  if (!email) return;
  const greeting = p?.full_name?.split(" ")[0] ?? "there";
  const portal = "https://38thaveproperties.com/portal";

  let link = "https://38thaveproperties.com/login";
  try {
    const { data } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: portal },
    });
    if (data?.properties?.action_link) link = data.properties.action_link;
  } catch {
    // fall back to the login page + forgot-password instructions
  }

  await sendNotification({
    to: email,
    replyTo: "hello@38thaveproperties.com",
    subject: "Your 38th Ave Properties resident portal",
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;color:#2c2622;font-size:15px;line-height:1.7"><div style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#2f5d50;margin-bottom:12px">Welcome to your resident portal, ${greeting}</div><p>Your portal is where you can review and sign your lease, pay rent, request maintenance, and message our team.</p><p style="margin:22px 0"><a href="${link}" style="background:#2f5d50;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:9999px;display:inline-block">Open your resident portal →</a></p><p style="font-size:13px;color:#6f655a">This secure link signs you in. To set a password for next time, sign in at <a href="https://38thaveproperties.com/login" style="color:#2f5d50;font-weight:600">38thaveproperties.com/login</a> with <strong>${email}</strong> and use “Forgot password?”.</p><p style="margin-top:18px;color:#6f655a;font-size:14px">— The 38th Ave Properties team</p></div>`,
  });

  revalidatePath(`/admin/residents/${id}`);
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
