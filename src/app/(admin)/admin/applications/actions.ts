"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendNotification, notificationHtml } from "@/lib/email";

const ALLOWED = ["new", "reviewing", "approved", "denied", "withdrawn"];

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
