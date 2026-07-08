"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";

/**
 * Link an existing resident account to a unit as a co-tenant (a second login for
 * the same home). The account must already exist — invite them first if needed.
 */
export async function linkResidentAccount(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  const email = (form.get("email") as string)?.trim().toLowerCase();
  if (!unitId || !email) return;

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: account } = await db
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle<{ id: string }>();
  if (!account) return; // no account with that email — invite them first

  await db
    .from("unit_occupants")
    .upsert({ unit_id: unitId, profile_id: account.id, is_primary: false }, { onConflict: "unit_id,profile_id" });

  revalidatePath(`/admin/units/${unitId}`);
}

/** Remove a co-tenant account link from a unit. */
export async function unlinkResidentAccount(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  const linkId = (form.get("link_id") as string)?.trim();
  if (!unitId || !linkId) return;

  const db = createAdminClient() as unknown as SupabaseClient;
  await db.from("unit_occupants").delete().eq("id", linkId);
  revalidatePath(`/admin/units/${unitId}`);
}

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
    rate_cents: costCents(form.get("rate")),
    incurred_on: str(form.get("incurred_on")) ?? undefined,
    doc_path: docPath,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Could not save the cost." };

  revalidatePath(`/admin/units/${unitId}`);
  return { ok: true };
}

/** Edit a unit cost's details (not its invoice file). Staff-only. */
export async function editUnitCost(
  _prev: CostState,
  form: FormData
): Promise<CostState> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const id = str(form.get("id"));
  const unitId = str(form.get("unit_id"));
  if (!id) return { ok: false, error: "Missing cost." };
  const amount = costCents(form.get("amount"));
  if (amount == null || amount <= 0) return { ok: false, error: "Enter an amount." };

  const hoursRaw = str(form.get("hours"));
  const hours = hoursRaw != null && Number.isFinite(Number(hoursRaw)) ? Number(hoursRaw) : null;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const updates: Record<string, unknown> = {
    vendor: str(form.get("vendor")),
    trade: str(form.get("trade")),
    description: str(form.get("description")),
    amount_cents: amount,
    hours,
    rate_cents: costCents(form.get("rate")),
  };
  const d = str(form.get("incurred_on"));
  if (d) updates.incurred_on = d;

  const { error } = await db.from("unit_costs").update(updates).eq("id", id);
  if (error) return { ok: false, error: "Could not save changes." };

  if (unitId) revalidatePath(`/admin/units/${unitId}`);
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

  const residentId = occ?.occupant_profile_id ?? null;
  // Only share on upload if asked AND there's a portal resident to share with.
  const share = str(form.get("share")) === "on" && !!residentId;

  await db.from("lease_documents").insert({
    unit_id: unitId,
    resident_id: residentId,
    label,
    path,
    uploaded_by: user.id,
    shared_with_resident: share,
  });

  revalidatePath(`/admin/units/${unitId}`);
  return { ok: true };
}

/** Show/hide a scanned lease in the resident's portal. Staff-only. */
export async function setLeaseDocumentShared(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  const unitId = str(form.get("unit_id"));
  const share = str(form.get("share")) === "1";
  if (!id) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db
    .from("lease_documents")
    .update({ shared_with_resident: share })
    .eq("id", id);

  if (unitId) revalidatePath(`/admin/units/${unitId}`);
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
