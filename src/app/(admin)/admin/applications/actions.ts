"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";
import { sendNotification, notificationHtml } from "@/lib/email";
import { emailLoginCredentials } from "@/lib/portal-invite";

const ALLOWED = ["new", "reviewing", "approved", "denied", "withdrawn"];

/**
 * Turn an approved applicant into a resident account (if they don't have one
 * yet), then go to the lease form with them pre-selected. A lease needs a real
 * profile, and applicants live only in the applications table until now.
 */
export async function startLeaseFromApplication(form: FormData) {
  const { profile } = await requireProfile("/admin/applications");
  if (!isStaff(profile)) return;

  const appId = (form.get("application_id") as string)?.trim();
  if (!appId) return;

  const supabase = await createClient();
  const { data: app } = await supabase
    .from("applications")
    .select("first_name, last_name, email, phone")
    .eq("id", appId)
    .maybeSingle<{
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
    }>();

  const email = app?.email?.trim().toLowerCase();
  if (email) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (!existing) {
      const admin = createAdminClient();
      const fullName = [app!.first_name, app!.last_name].filter(Boolean).join(" ") || null;
      const tempPassword = `38thAve-${crypto.randomUUID().slice(0, 8)}`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (!error && data.user) {
        // Copy the applicant's phone onto the new account (no role change).
        if (app!.phone) {
          await admin.from("profiles").update({ phone: app!.phone }).eq("id", data.user.id);
        }
        // Email them email + password sign-in credentials so they can get in.
        await emailLoginCredentials(email, fullName, tempPassword);
      }
    }
  }

  redirect(`/admin/leases/new?application=${appId}`);
}

export async function setApplicationStatus(form: FormData) {
  const id = form.get("id") as string;
  const status = form.get("status") as string;
  if (!id || !ALLOWED.includes(status)) return;

  const supabase = await createClient();

  // Read the current row first — used for the denial reminder and to avoid
  // re-sending it if the application was already denied.
  const { data: before } = await supabase
    .from("applications")
    .select("first_name, last_name, email, status, property_id")
    .eq("id", id)
    .maybeSingle();

  await supabase.from("applications").update({ status }).eq("id", id);
  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${id}`);
  revalidatePath("/admin");

  // On a NEW denial, email staff the FCRA adverse-action reminder.
  if (status === "denied" && before && before.status !== "denied") {
    let propertyName = "—";
    if (before.property_id) {
      const { data: prop } = await supabase
        .from("properties")
        .select("name")
        .eq("id", before.property_id)
        .maybeSingle();
      propertyName = prop?.name ?? "—";
    }
    await sendNotification({
      subject: `Action needed — adverse-action notice for ${before.first_name} ${before.last_name}`,
      replyTo: before.email,
      html: notificationHtml("Application denied — send an adverse-action notice", [
        ["Applicant", `${before.first_name} ${before.last_name}`],
        ["Community", propertyName],
        ["Applicant email", before.email],
        [
          "Required",
          "If the denial used the screening or credit report, the FCRA requires an adverse-action notice. Use the SmartMove letter, send it, then mark it sent.",
        ],
        ["Open application", `https://38thaveproperties.com/admin/applications/${id}`],
      ]),
    });
  }
}
