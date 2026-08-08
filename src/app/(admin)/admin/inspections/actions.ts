"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";
import { sendNotification } from "@/lib/email";
import { entryNoticeEmail } from "@/lib/inspection-email";
import { CONDITION_BUCKET } from "@/lib/unit-photos";
import { formatDate } from "@/lib/format";

export type InspectionState = { ok: boolean; error?: string; notice?: string };

const KINDS = new Set(["annual", "seasonal", "move_in", "move_out", "follow_up", "complaint"]);
const CONDITIONS = new Set(["good", "fair", "needs_attention", "urgent"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function str(v: FormDataEntryValue | null): string | null {
  const s = ((v as string) ?? "").trim();
  return s || null;
}

/** Schedule an inspection for a unit. */
export async function scheduleInspection(
  _prev: InspectionState,
  form: FormData
): Promise<InspectionState> {
  const { user, profile } = await requireProfile("/admin/inspections");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = str(form.get("unit_id"));
  const kindRaw = str(form.get("kind")) ?? "annual";
  const date = str(form.get("scheduled_for"));
  if (!unitId) return { ok: false, error: "Pick a unit." };
  if (!date) return { ok: false, error: "Pick the date." };

  const db = createAdminClient() as unknown as SupabaseClient;
  const { error } = await db.from("inspections").insert({
    unit_id: unitId,
    kind: KINDS.has(kindRaw) ? kindRaw : "annual",
    scheduled_for: date,
    time_window: str(form.get("time_window")),
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Could not schedule it." };

  revalidatePath("/admin/inspections");
  return { ok: true, notice: "Scheduled — open it to send the entry notice." };
}

/** Email the resident their written entry notice. */
export async function sendInspectionNotice(
  _prev: InspectionState,
  form: FormData
): Promise<InspectionState> {
  const { profile } = await requireProfile("/admin/inspections");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const id = str(form.get("id"));
  if (!id) return { ok: false, error: "Missing inspection." };

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: insp } = await db
    .from("inspections")
    .select("id, unit_id, kind, scheduled_for, time_window, status")
    .eq("id", id)
    .maybeSingle<{ id: string; unit_id: string; kind: string; scheduled_for: string; time_window: string | null; status: string }>();
  if (!insp) return { ok: false, error: "Inspection not found." };
  if (["completed", "canceled"].includes(insp.status)) {
    return { ok: false, error: "This inspection is closed." };
  }

  const [{ data: unit }, { data: occ }] = await Promise.all([
    db
      .from("units")
      .select("label, properties(name)")
      .eq("id", insp.unit_id)
      .maybeSingle<{ label: string; properties: { name: string | null } | null }>(),
    db
      .from("unit_occupancy")
      .select("tenant_name, tenant_email, occupant_profile_id")
      .eq("unit_id", insp.unit_id)
      .maybeSingle<{ tenant_name: string | null; tenant_email: string | null; occupant_profile_id: string | null }>(),
  ]);

  let email = occ?.tenant_email ?? null;
  let name = occ?.tenant_name ?? null;
  if (occ?.occupant_profile_id) {
    const { data: p } = await db
      .from("profiles")
      .select("full_name, email")
      .eq("id", occ.occupant_profile_id)
      .maybeSingle<{ full_name: string | null; email: string | null }>();
    email = p?.email ?? email;
    name = p?.full_name ?? name;
  }
  if (!email) return { ok: false, error: "No tenant email on file — post a paper notice instead." };

  const home = unit ? `${unit.properties?.name ? `${unit.properties.name} · ` : ""}${unit.label}` : "your home";
  const [y, m, d] = insp.scheduled_for.split("-").map(Number);
  const dateLabel = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const { subject, html } = entryNoticeEmail({
    firstName: name?.split(" ")[0] ?? "there",
    home,
    kind: insp.kind,
    dateLabel,
    timeWindow: insp.time_window,
  });
  const res = await sendNotification({
    to: email,
    subject,
    html,
    meta: { kind: "inspection_notice", refType: "inspection", refId: insp.id },
  });
  if (!res.sent) return { ok: false, error: "Could not send the notice." };

  await db
    .from("inspections")
    .update({ status: "notice_sent", notice_sent_at: new Date().toISOString() })
    .eq("id", insp.id);

  revalidatePath(`/admin/inspections/${insp.id}`);
  revalidatePath("/admin/inspections");
  return { ok: true, notice: `Entry notice emailed to ${email}.` };
}

/** Add a checklist finding (optionally with a photo). */
export async function addInspectionItem(
  _prev: InspectionState,
  form: FormData
): Promise<InspectionState> {
  const { profile } = await requireProfile("/admin/inspections");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const inspectionId = str(form.get("inspection_id"));
  const area = str(form.get("area")) ?? "other";
  const conditionRaw = str(form.get("condition")) ?? "good";
  if (!inspectionId) return { ok: false, error: "Missing inspection." };

  const admin = createAdminClient();
  const db = admin as unknown as SupabaseClient;

  let photoPath: string | null = null;
  const file = form.get("photo");
  if (file instanceof File && file.size > 0) {
    if (!IMAGE_TYPES.has(file.type)) return { ok: false, error: "Photo must be an image." };
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    photoPath = `inspections/${inspectionId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(CONDITION_BUCKET)
      .upload(photoPath, file, { contentType: file.type, upsert: false });
    if (upErr) return { ok: false, error: "Photo upload failed." };
  }

  const { error } = await db.from("inspection_items").insert({
    inspection_id: inspectionId,
    area,
    condition: CONDITIONS.has(conditionRaw) ? conditionRaw : "good",
    note: str(form.get("note")),
    photo_path: photoPath,
  });
  if (error) return { ok: false, error: "Could not save the finding." };

  revalidatePath(`/admin/inspections/${inspectionId}`);
  return { ok: true };
}

/** Turn a finding into a unit-tagged task on the Tasks board. */
export async function escalateInspectionItem(form: FormData): Promise<void> {
  const { user, profile } = await requireProfile("/admin/inspections");
  if (!isStaff(profile)) return;

  const itemId = str(form.get("item_id"));
  if (!itemId) return;

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: item } = await db
    .from("inspection_items")
    .select("id, inspection_id, area, condition, note, task_id, inspections:inspection_id(unit_id, scheduled_for)")
    .eq("id", itemId)
    .maybeSingle<{
      id: string;
      inspection_id: string;
      area: string;
      condition: string;
      note: string | null;
      task_id: string | null;
      inspections: { unit_id: string; scheduled_for: string } | null;
    }>();
  if (!item || item.task_id || !item.inspections) return;

  const { data: task } = await db
    .from("tasks")
    .insert({
      title: `Inspection: ${item.area}${item.note ? ` — ${item.note.slice(0, 80)}` : ""}`,
      details: `From the ${formatDate(item.inspections.scheduled_for)} inspection (${item.condition.replace("_", " ")}).`,
      category: "repair",
      priority: item.condition === "urgent" ? "urgent" : "normal",
      unit_id: item.inspections.unit_id,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (task) {
    await db.from("inspection_items").update({ task_id: task.id }).eq("id", item.id);
  }

  revalidatePath(`/admin/inspections/${item.inspection_id}`);
  revalidatePath("/admin/tasks");
}

/** Delete a finding (and its photo). */
export async function deleteInspectionItem(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/inspections");
  if (!isStaff(profile)) return;

  const itemId = str(form.get("item_id"));
  if (!itemId) return;

  const admin = createAdminClient();
  const db = admin as unknown as SupabaseClient;
  const { data: item } = await db
    .from("inspection_items")
    .select("inspection_id, photo_path")
    .eq("id", itemId)
    .maybeSingle<{ inspection_id: string; photo_path: string | null }>();
  if (item?.photo_path) await admin.storage.from(CONDITION_BUCKET).remove([item.photo_path]);
  await db.from("inspection_items").delete().eq("id", itemId);
  if (item) revalidatePath(`/admin/inspections/${item.inspection_id}`);
}

/** Complete (with summary) or cancel an inspection. */
export async function closeInspection(
  _prev: InspectionState,
  form: FormData
): Promise<InspectionState> {
  const { profile } = await requireProfile("/admin/inspections");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const id = str(form.get("id"));
  const mode = str(form.get("mode")); // complete | cancel
  if (!id || !mode) return { ok: false, error: "Missing inspection." };

  const db = createAdminClient() as unknown as SupabaseClient;
  const patch =
    mode === "cancel"
      ? { status: "canceled" }
      : {
          status: "completed",
          completed_at: new Date().toISOString(),
          summary: str(form.get("summary")),
        };
  const { error } = await db.from("inspections").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Could not update." };

  revalidatePath(`/admin/inspections/${id}`);
  revalidatePath("/admin/inspections");
  return { ok: true, notice: mode === "cancel" ? "Canceled." : "Inspection completed." };
}
