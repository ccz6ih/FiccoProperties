"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification, notificationHtml, customerHtml, esc } from "@/lib/email";

export type ApplyState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function str(form: FormData, key: string): string {
  return (form.get(key) as string | null)?.trim() ?? "";
}

function bool(form: FormData, key: string): boolean {
  return form.get(key) != null;
}

export async function submitApplication(
  _prev: ApplyState,
  form: FormData
): Promise<ApplyState> {
  const first_name = str(form, "first_name");
  const last_name = str(form, "last_name");
  const email = str(form, "email");
  const phone = str(form, "phone");
  const property_id = str(form, "property_id");
  const desired_move_in = str(form, "desired_move_in");
  const household_size = str(form, "household_size");
  const monthly_income = str(form, "monthly_income");
  const message = str(form, "message");

  // New screening fields
  const date_of_birth = str(form, "date_of_birth");
  const current_address = str(form, "current_address");
  const current_residency_length = str(form, "current_residency_length");
  const reason_for_moving = str(form, "reason_for_moving");
  const employer_name = str(form, "employer_name");
  const employer_phone = str(form, "employer_phone");
  const landlord_name = str(form, "landlord_name");
  const landlord_phone = str(form, "landlord_phone");
  const landlord_email = str(form, "landlord_email");
  const signature_name = str(form, "signature_name");

  const pets_ack = bool(form, "pets_ack");
  const authorize_screening = bool(form, "authorize_screening");
  const authorize_landlord_contact = bool(form, "authorize_landlord_contact");

  const fieldErrors: Record<string, string> = {};
  if (!first_name) fieldErrors.first_name = "Required";
  if (!last_name) fieldErrors.last_name = "Required";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    fieldErrors.email = "Enter a valid email";
  if (!property_id) fieldErrors.property_id = "Choose a community";
  if (!date_of_birth) fieldErrors.date_of_birth = "Required";
  if (!current_address) fieldErrors.current_address = "Required";
  if (!current_residency_length) fieldErrors.current_residency_length = "Required";
  if (!landlord_name) fieldErrors.landlord_name = "Required";
  if (!landlord_phone) fieldErrors.landlord_phone = "Required";
  if (!signature_name) fieldErrors.signature_name = "Type your name to sign";
  if (!pets_ack) fieldErrors.pets_ack = "Please acknowledge";
  if (!authorize_screening) fieldErrors.authorize_screening = "Required";
  if (!authorize_landlord_contact) fieldErrors.authorize_landlord_contact = "Required";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Optional ID-photo upload, server-side via the service-role client (the
  // anon key has no access to the private application-docs bucket).
  let id_photo_path: string | null = null;
  const idPhoto = form.get("id_photo");
  if (idPhoto instanceof File && idPhoto.size > 0) {
    const admin = createAdminClient();
    const ext = idPhoto.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `applications/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("application-docs")
      .upload(path, idPhoto, {
        contentType: idPhoto.type || "application/octet-stream",
        upsert: false,
      });
    if (!uploadError) {
      id_photo_path = path;
    }
  }

  const { error } = await supabase.from("applications").insert({
    first_name,
    last_name,
    email,
    phone: phone || null,
    property_id: property_id || null,
    desired_move_in: desired_move_in || null,
    household_size: household_size ? Number(household_size) : null,
    monthly_income_cents: monthly_income
      ? Math.round(Number(monthly_income) * 100)
      : null,
    message: message || null,
    date_of_birth: date_of_birth || null,
    current_address: current_address || null,
    current_residency_length: current_residency_length || null,
    reason_for_moving: reason_for_moving || null,
    employer_name: employer_name || null,
    employer_phone: employer_phone || null,
    landlord_name: landlord_name || null,
    landlord_phone: landlord_phone || null,
    landlord_email: landlord_email || null,
    signature_name: signature_name || null,
    pets_ack,
    authorize_screening,
    authorize_landlord_contact,
    id_photo_path,
    created_by: user?.id ?? null,
  });

  if (error) {
    return {
      ok: false,
      error: "Something went wrong submitting your application. Please try again.",
    };
  }

  // Notify staff (no-ops until email is configured).
  let propertyName = "—";
  if (property_id) {
    const { data: prop } = await supabase
      .from("properties")
      .select("name")
      .eq("id", property_id)
      .maybeSingle();
    propertyName = prop?.name ?? "—";
  }
  await sendNotification({
    subject: `New application — ${first_name} ${last_name}`,
    replyTo: email,
    html: notificationHtml("New rental application", [
      ["Name", `${first_name} ${last_name}`],
      ["Community", propertyName],
      ["Email", email],
      ["Phone", phone],
      ["Desired move-in", desired_move_in],
      ["Review", "https://ficcoproperties.com/admin/applications"],
    ]),
  });

  // Confirmation to the applicant (delivers once the Resend domain is verified).
  await sendNotification({
    to: email,
    replyTo: "hello@ficcoproperties.com",
    subject: `We received your application — ${propertyName}`,
    html: customerHtml(`Thanks for applying, ${esc(first_name)}!`, [
      `We've received your application for <strong>${esc(propertyName)}</strong> and our team reviews every one personally.`,
      `We'll be in touch by email within a few business days. If we move forward, the next step is a quick credit &amp; background check (about $40, paid directly to TransUnion SmartMove) — we'll send you a secure link.`,
      `Questions in the meantime? Just reply to this email.`,
    ]),
  });

  return { ok: true };
}
