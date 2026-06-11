"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendNotification, notificationHtml } from "@/lib/email";
import type { SupabaseClient } from "@supabase/supabase-js";

const STATUSES = ["open", "in_progress", "on_hold", "completed", "cancelled"];
const PRIORITIES = ["low", "normal", "high", "emergency"];

export async function setMaintenanceStatus(form: FormData) {
  const id = form.get("id") as string;
  const status = form.get("status") as string;
  if (!id || !STATUSES.includes(status)) return;

  const supabase = await createClient();
  const patch: { status: string; completed_at: string | null } = {
    status,
    completed_at: status === "completed" ? new Date().toISOString() : null,
  };
  await supabase.from("maintenance_requests").update(patch).eq("id", id);
  revalidatePath(`/admin/maintenance/${id}`);
  revalidatePath("/admin/maintenance");
  revalidatePath("/admin");
}

export async function setMaintenancePriority(form: FormData) {
  const id = form.get("id") as string;
  const priority = form.get("priority") as string;
  if (!id || !PRIORITIES.includes(priority)) return;

  const supabase = await createClient();
  await supabase.from("maintenance_requests").update({ priority }).eq("id", id);
  revalidatePath(`/admin/maintenance/${id}`);
  revalidatePath("/admin/maintenance");
}

export async function setMaintenanceAssignee(form: FormData) {
  const id = form.get("id") as string;
  const assignedTo = (form.get("assigned_to") as string) || "";
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("maintenance_requests")
    .update({ assigned_to: assignedTo || null })
    .eq("id", id);

  // Notify the new assignee — but not if they just claimed it themselves.
  if (assignedTo && assignedTo !== user?.id) {
    const [{ data: req }, { data: assignee }] = await Promise.all([
      supabase.from("maintenance_requests").select("title").eq("id", id).maybeSingle(),
      supabase.from("profiles").select("email").eq("id", assignedTo).maybeSingle(),
    ]);
    if (assignee?.email) {
      await sendNotification({
        to: assignee.email,
        subject: `Assigned to you — ${req?.title ?? "maintenance request"}`,
        html: notificationHtml("A maintenance request was assigned to you", [
          ["Request", req?.title ?? "—"],
          ["Open", `https://38thaveproperties.com/admin/maintenance/${id}`],
        ]),
      });
    }
  }

  revalidatePath(`/admin/maintenance/${id}`);
  revalidatePath("/admin/maintenance");
}

export async function addMaintenanceComment(form: FormData) {
  const requestId = form.get("request_id") as string;
  const body = (form.get("body") as string)?.trim();
  const internal = form.get("internal") === "on";
  if (!requestId || !body) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const db = supabase as unknown as SupabaseClient;
  await db.from("maintenance_comments").insert({
    request_id: requestId,
    author_id: user.id,
    body,
    internal,
  });
  revalidatePath(`/admin/maintenance/${requestId}`);
  revalidatePath("/portal/maintenance");
}
