"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";

const LEASE_BUCKET = "lease-docs";
const COST_BUCKET = "unit-cost-docs";
const COST_DOC_TYPES = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
]);

export type LogState = { ok: boolean; error?: string };
export type CostState = { ok: boolean; error?: string };

function costCents(v: FormDataEntryValue | null): number | null {
  const s = ((v as string) ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Book an outside contractor bill / cost against a unit (optional invoice). */
export async function addUnitCost(
  _prev: CostState,
  form: FormData
): Promise<CostState> {
  const { user, profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = str(form.get("unit_id"));
  const amount = costCents(form.get("amount"));
  if (!unitId) return { ok: false, error: "Missing unit." };
  if (amount == null || amount <= 0) return { ok: false, error: "Enter an amount." };

  const hoursRaw = str(form.get("hours"));
  const hours = hoursRaw != null && Number.isFinite(Number(hoursRaw)) ? Number(hoursRaw) : null;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  let docPath: string | null = null;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (!COST_DOC_TYPES.has(file.type)) {
      return { ok: false, error: "Invoice must be a PDF or image." };
    }
    const admin = createAdminClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    docPath = `${unitId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(COST_BUCKET)
      .upload(docPath, file, { contentType: file.type, upsert: false });
    if (upErr) return { ok: false, error: "Invoice upload failed." };
  }

  const { error } = await db.from("unit_costs").insert({
    unit_id: unitId,
    vendor: str(form.get("vendor")),
    trade: str(form.get("trade")),
    description: str(form.get("description")),
    amount_cents: amount,
    hours,
    incurred_on: str(form.get("incurred_on")) ?? undefined,
    doc_path: docPath,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Could not save the cost." };

  revalidatePath(`/admin/units/${unitId}`);
  return { ok: true };
}

/** Delete a unit cost (and its invoice file). Staff-only. */
export async function deleteUnitCost(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  const unitId = str(form.get("unit_id"));
  if (!id) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: row } = await db
    .from("unit_costs")
    .select("doc_path")
    .eq("id", id)
    .maybeSingle<{ doc_path: string | null }>();

  if (row?.doc_path) {
    const admin = createAdminClient();
    await admin.storage.from(COST_BUCKET).remove([row.doc_path]);
  }
  await db.from("unit_costs").delete().eq("id", id);

  if (unitId) revalidatePath(`/admin/units/${unitId}`);
}

function str(v: FormDataEntryValue | null): string | null {
  const s = ((v as string) ?? "").trim();
  return s || null;
}

/**
 * Add a note or a record of maintenance performed to a unit's running history.
 * Staff-only (admins + maintenance manager). Auto-stamps the author and links
 * the unit's current resident when one is on file.
 */
export async function addLogEntry(
  _prev: LogState,
  form: FormData
): Promise<LogState> {
  const { user, profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = str(form.get("unit_id"));
  const body = str(form.get("body"));
  const kind = str(form.get("kind")) === "maintenance" ? "maintenance" : "note";
  const performedOn = str(form.get("performed_on"));
  const costDollars = str(form.get("cost"));
  if (!unitId) return { ok: false, error: "Missing unit." };
  if (!body) return { ok: false, error: "Write something first." };

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  // Link the current occupant, if any.
  const { data: occ } = await supabase
    .from("unit_occupancy")
    .select("occupant_profile_id")
    .eq("unit_id", unitId)
    .maybeSingle<{ occupant_profile_id: string | null }>();

  let costCents: number | null = null;
  if (costDollars) {
    const n = Number(costDollars.replace(/[$,\s]/g, ""));
    if (Number.isFinite(n) && n >= 0) costCents = Math.round(n * 100);
  }

  const { error } = await db.from("unit_log_entries").insert({
    unit_id: unitId,
    resident_id: occ?.occupant_profile_id ?? null,
    kind,
    body,
    performed_on: performedOn,
    cost_cents: costCents,
    author_id: user.id,
  });
  if (error) return { ok: false, error: "Could not save the entry." };

  revalidatePath(`/admin/units/${unitId}`);
  return { ok: true };
}

export type DocState = { ok: boolean; error?: string };

const DOC_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** Upload an existing signed lease (PDF/scan) for a unit. Staff-only. */
export async function uploadLeaseDocument(
  _prev: DocState,
  form: FormData
): Promise<DocState> {
  const { user, profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = str(form.get("unit_id"));
  const label = str(form.get("label"));
  const file = form.get("file");
  if (!unitId) return { ok: false, error: "Missing unit." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (!DOC_TYPES.has(file.type)) {
    return { ok: false, error: "Upload a PDF or image." };
  }

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const admin = createAdminClient();

  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `${unitId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from(LEASE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: "Upload failed. Please try again." };

  const { data: occ } = await supabase
    .from("unit_occupancy")
    .select("occupant_profile_id")
    .eq("unit_id", unitId)
    .maybeSingle<{ occupant_profile_id: string | null }>();

  await db.from("lease_documents").insert({
    unit_id: unitId,
    resident_id: occ?.occupant_profile_id ?? null,
    label,
    path,
    uploaded_by: user.id,
  });

  revalidatePath(`/admin/units/${unitId}`);
  return { ok: true };
}

/** Delete a lease document (removes the file + row). Staff-only. */
export async function deleteLeaseDocument(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  const unitId = str(form.get("unit_id"));
  if (!id) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: doc } = await db
    .from("lease_documents")
    .select("path")
    .eq("id", id)
    .maybeSingle<{ path: string }>();

  if (doc?.path) {
    const admin = createAdminClient();
    await admin.storage.from(LEASE_BUCKET).remove([doc.path]);
  }
  await db.from("lease_documents").delete().eq("id", id);

  if (unitId) revalidatePath(`/admin/units/${unitId}`);
}

/** Remove a log entry (staff-only). */
export async function deleteLogEntry(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  const unitId = str(form.get("unit_id"));
  if (!id) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("unit_log_entries").delete().eq("id", id);

  if (unitId) revalidatePath(`/admin/units/${unitId}`);
}
