"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification, notificationHtml } from "@/lib/email";
import { getOwnerRecipients } from "@/lib/owners";
import { CONDITION_BUCKET } from "@/lib/unit-photos";
import type { SupabaseClient } from "@supabase/supabase-js";

const PHOTO_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
]);

export type MaintenanceState = { ok: boolean; error?: string };

export async function createMaintenanceRequest(
  _prev: MaintenanceState,
  form: FormData
): Promise<MaintenanceState> {
  const title = (form.get("title") as string)?.trim();
  const description = (form.get("description") as string)?.trim();
  const category = (form.get("category") as string) || "general";
  const priority = (form.get("priority") as string) || "normal";

  if (!title) return { ok: false, error: "Please describe the issue." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  // Link to the resident's unit, primarily via unit_occupancy (their home),
  // falling back to their active-lease unit if no occupancy row exists.
  const { data: occupancy } = await supabase
    .from("unit_occupancy")
    .select("unit_id")
    .eq("occupant_profile_id", user.id)
    .maybeSingle();

  let unitId = occupancy?.unit_id ?? null;
  if (!unitId) {
    const { data: lease } = await supabase
      .from("leases")
      .select("unit_id")
      .eq("resident_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    unitId = lease?.unit_id ?? null;
  }

  const { data: inserted, error } = await supabase
    .from("maintenance_requests")
    .insert({
      title,
      description: description || null,
      category,
      priority,
      created_by: user.id,
      unit_id: unitId,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !inserted) return { ok: false, error: "Could not submit your request. Please try again." };

  // Photos (optional, up to 6) — private bucket, best-effort.
  const admin = createAdminClient();
  const adb = admin as unknown as SupabaseClient;
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  let photoCount = 0;
  for (const file of files.slice(0, 6)) {
    if (!PHOTO_TYPES.has(file.type)) continue;
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `maintenance/${inserted.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(CONDITION_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) continue;
    await adb.from("maintenance_photos").insert({
      request_id: inserted.id,
      path,
      created_by: user.id,
    });
    photoCount++;
  }

  // Alert — emergencies go straight to every owner; the rest to the staff inbox.
  const rows: [string, string][] = [
    ["Request", title],
    ["Priority", priority],
    ["Category", category],
    ["Photos", photoCount > 0 ? String(photoCount) : "None"],
    ["Open board", "https://38thaveproperties.com/admin/maintenance"],
  ];
  if (priority === "emergency") {
    const owners = await getOwnerRecipients();
    await sendNotification({
      to: owners.length > 0 ? owners.join(",") : undefined,
      subject: `🚨 EMERGENCY maintenance — ${title}`,
      html: notificationHtml("Emergency maintenance request", rows),
      meta: { kind: "maintenance_emergency", refType: "maintenance", refId: inserted.id },
    });
  } else {
    await sendNotification({
      subject: `New maintenance request — ${title}`,
      html: notificationHtml("New maintenance request", rows),
    });
  }

  revalidatePath("/portal/maintenance");
  revalidatePath("/portal");
  return { ok: true };
}

/**
 * Resident reply to one of their own requests. RLS enforces that the request
 * belongs to them and that the comment is never internal.
 */
export async function addResidentComment(form: FormData) {
  const requestId = form.get("request_id") as string;
  const body = (form.get("body") as string)?.trim();
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
    internal: false,
  });

  // Scoped notification: only the assigned staffer (fall back to the shared
  // inbox if nobody has claimed it yet).
  const { data: req } = await supabase
    .from("maintenance_requests")
    .select("title, assigned_to")
    .eq("id", requestId)
    .maybeSingle();
  let to: string | undefined;
  if (req?.assigned_to) {
    const { data: assignee } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", req.assigned_to)
      .maybeSingle();
    to = assignee?.email ?? undefined;
  }
  await sendNotification({
    to,
    subject: `New reply — ${req?.title ?? "maintenance request"}`,
    html: notificationHtml("Resident replied on a maintenance request", [
      ["Request", req?.title ?? "—"],
      ["Message", body.slice(0, 240)],
      ["Open", `https://38thaveproperties.com/admin/maintenance/${requestId}`],
    ]),
  });

  revalidatePath("/portal/maintenance");
  revalidatePath(`/admin/maintenance/${requestId}`);
}
