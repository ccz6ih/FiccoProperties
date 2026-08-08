"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification, notificationHtml } from "@/lib/email";
import { requireProfile, isStaff } from "@/lib/auth";
import { workOrderEmail } from "@/lib/workorder-email";
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

export type WorkOrderState = { ok: boolean; error?: string; notice?: string };

/** Assign (or clear) a vendor on a maintenance request. Staff-only. */
export async function setMaintenanceVendor(form: FormData) {
  const { profile } = await requireProfile("/admin/maintenance");
  if (!isStaff(profile)) return;

  const id = form.get("id") as string;
  const vendorId = ((form.get("vendor_id") as string) || "").trim();
  if (!id) return;

  const db = createAdminClient() as unknown as SupabaseClient;
  await db
    .from("maintenance_requests")
    .update({ vendor_id: vendorId || null })
    .eq("id", id);
  revalidatePath(`/admin/maintenance/${id}`);
}

/** Email the assigned vendor a branded work order. Staff-only. */
export async function emailWorkOrder(
  _prev: WorkOrderState,
  form: FormData
): Promise<WorkOrderState> {
  const { user, profile } = await requireProfile("/admin/maintenance");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const id = (form.get("id") as string)?.trim();
  if (!id) return { ok: false, error: "Missing request." };

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: req } = await db
    .from("maintenance_requests")
    .select(
      "id, title, description, priority, vendor_id, unit_id, units(label, properties(name, address_line1, city, state, postal_code))"
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      title: string;
      description: string | null;
      priority: string;
      vendor_id: string | null;
      unit_id: string | null;
      units: {
        label: string;
        properties: {
          name: string | null;
          address_line1: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
        } | null;
      } | null;
    }>();
  if (!req) return { ok: false, error: "Request not found." };
  if (!req.vendor_id) return { ok: false, error: "Assign a vendor first." };

  const { data: vendor } = await db
    .from("vendors")
    .select("name, email, coi_expires_on")
    .eq("id", req.vendor_id)
    .maybeSingle<{ name: string; email: string | null; coi_expires_on: string | null }>();
  if (!vendor?.email) return { ok: false, error: "That vendor has no email on file — call them instead." };

  let tenantName: string | null = null;
  let tenantPhone: string | null = null;
  if (req.unit_id) {
    const { data: occ } = await db
      .from("unit_occupancy")
      .select("tenant_name, tenant_phone")
      .eq("unit_id", req.unit_id)
      .maybeSingle<{ tenant_name: string | null; tenant_phone: string | null }>();
    tenantName = occ?.tenant_name ?? null;
    tenantPhone = occ?.tenant_phone ?? null;
  }

  const prop = req.units?.properties;
  const address = [prop?.address_line1, prop?.city, prop?.state, prop?.postal_code]
    .filter(Boolean)
    .join(", ");
  const workOrderNo = `WO-${req.id.slice(0, 8).toUpperCase()}`;

  const { subject, html } = workOrderEmail({
    vendorName: vendor.name,
    workOrderNo,
    property: prop?.name ?? "38th Ave Properties",
    address: address || "Wheat Ridge, CO",
    unit: req.units?.label ?? "—",
    issue: req.title,
    description: req.description,
    priority: req.priority,
    tenantName,
    tenantPhone,
  });
  const res = await sendNotification({
    to: vendor.email,
    subject,
    html,
    meta: { kind: "work_order", refType: "maintenance", refId: req.id },
  });
  if (!res.sent) return { ok: false, error: "Could not send the work order." };

  await db
    .from("maintenance_requests")
    .update({ work_order_sent_at: new Date().toISOString() })
    .eq("id", req.id);
  await db.from("maintenance_comments").insert({
    request_id: req.id,
    author_id: user.id,
    body: `Work order ${workOrderNo} emailed to ${vendor.name} (${vendor.email}).`,
    internal: true,
  });

  revalidatePath(`/admin/maintenance/${req.id}`);
  return { ok: true, notice: `Work order sent to ${vendor.name}.` };
}

/** Record the completed job's cost into the unit's cost history. Staff-only. */
export async function recordMaintenanceCost(
  _prev: WorkOrderState,
  form: FormData
): Promise<WorkOrderState> {
  const { user, profile } = await requireProfile("/admin/maintenance");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const id = (form.get("id") as string)?.trim();
  const amountRaw = ((form.get("amount") as string) || "").replace(/[$,\s]/g, "");
  const n = Number(amountRaw);
  if (!id) return { ok: false, error: "Missing request." };
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "Enter the amount." };

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: req } = await db
    .from("maintenance_requests")
    .select("id, title, category, unit_id, vendor_id")
    .eq("id", id)
    .maybeSingle<{ id: string; title: string; category: string; unit_id: string | null; vendor_id: string | null }>();
  if (!req?.unit_id) return { ok: false, error: "This request isn't tied to a unit." };

  let vendorName: string | null = null;
  if (req.vendor_id) {
    const { data: v } = await db
      .from("vendors")
      .select("name")
      .eq("id", req.vendor_id)
      .maybeSingle<{ name: string }>();
    vendorName = v?.name ?? null;
  }

  const { error } = await db.from("unit_costs").insert({
    unit_id: req.unit_id,
    vendor: vendorName,
    trade: req.category,
    description: `Maintenance: ${req.title}`,
    amount_cents: Math.round(n * 100),
    incurred_on: ((form.get("incurred_on") as string) || "").trim() || new Date().toISOString().slice(0, 10),
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Could not record the cost." };

  await db.from("maintenance_comments").insert({
    request_id: req.id,
    author_id: user.id,
    body: `Cost recorded: $${n.toFixed(2)}${vendorName ? ` (${vendorName})` : ""} — added to the unit's cost history.`,
    internal: true,
  });

  revalidatePath(`/admin/maintenance/${req.id}`);
  return { ok: true, notice: "Cost recorded to the unit." };
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
