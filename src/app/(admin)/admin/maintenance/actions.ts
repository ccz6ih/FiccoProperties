"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendNotification, notificationHtml } from "@/lib/email";
import { requireProfile, isStaff } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

const STATUSES = ["open", "in_progress", "on_hold", "completed", "cancelled"];
const PRIORITIES = ["low", "normal", "high", "emergency"];

export type NewRequestState = { ok: boolean; error?: string };

/** Staff-opened maintenance request (e.g. a tenant told you in person). */
export async function createAdminMaintenanceRequest(
  _prev: NewRequestState,
  form: FormData
): Promise<NewRequestState> {
  const { user, profile } = await requireProfile("/admin/maintenance");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const title = (form.get("title") as string)?.trim();
  if (!title) return { ok: false, error: "Give the request a title." };

  const description = (form.get("description") as string)?.trim() || null;
  const category = (form.get("category") as string) || "general";
  const priority = PRIORITIES.includes(form.get("priority") as string)
    ? (form.get("priority") as string)
    : "normal";
  const unitId = (form.get("unit_id") as string) || null;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { error } = await db.from("maintenance_requests").insert({
    title,
    description,
    category,
    priority,
    unit_id: unitId,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Could not create the request." };

  revalidatePath("/admin/maintenance");
  revalidatePath("/admin");
  if (unitId) revalidatePath(`/admin/units/${unitId}`);
  return { ok: true };
}

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
