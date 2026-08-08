"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";

export type ExpenseState = { ok: boolean; error?: string };

const DOC_BUCKET = "unit-cost-docs";
const DOC_TYPES = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
]);
const CATEGORIES = new Set([
  "advertising", "auto_travel", "cleaning_maintenance", "insurance",
  "legal_professional", "management_fees", "mortgage_interest", "repairs",
  "supplies", "taxes", "utilities", "other",
]);

function str(v: FormDataEntryValue | null): string | null {
  const s = ((v as string) ?? "").trim();
  return s || null;
}

/** Book a property-level expense (insurance, taxes, utilities…). Staff-only. */
export async function addPropertyExpense(
  _prev: ExpenseState,
  form: FormData
): Promise<ExpenseState> {
  const { user, profile } = await requireProfile("/admin/financials");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const propertyId = str(form.get("property_id"));
  const categoryRaw = str(form.get("category")) ?? "other";
  const category = CATEGORIES.has(categoryRaw) ? categoryRaw : "other";
  const incurredOn = str(form.get("incurred_on"));
  const amountRaw = str(form.get("amount"));
  const n = amountRaw ? Number(amountRaw.replace(/[$,\s]/g, "")) : NaN;

  if (!propertyId) return { ok: false, error: "Pick a community." };
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "Enter the amount." };
  if (!incurredOn) return { ok: false, error: "Pick the date." };

  const admin = createAdminClient();
  const db = admin as unknown as SupabaseClient;

  let docPath: string | null = null;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (!DOC_TYPES.has(file.type)) return { ok: false, error: "Receipt must be a PDF or image." };
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    docPath = `property/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(DOC_BUCKET)
      .upload(docPath, file, { contentType: file.type, upsert: false });
    if (upErr) return { ok: false, error: "Receipt upload failed. Try again." };
  }

  const { error } = await db.from("property_expenses").insert({
    property_id: propertyId,
    category,
    vendor: str(form.get("vendor")),
    memo: str(form.get("memo")),
    amount_cents: Math.round(n * 100),
    incurred_on: incurredOn,
    doc_path: docPath,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Could not save the expense." };

  revalidatePath("/admin/financials");
  return { ok: true };
}

/** Delete a property expense (and its receipt). Staff-only. */
export async function deletePropertyExpense(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/financials");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  if (!id) return;

  const admin = createAdminClient();
  const db = admin as unknown as SupabaseClient;
  const { data: row } = await db
    .from("property_expenses")
    .select("doc_path")
    .eq("id", id)
    .maybeSingle<{ doc_path: string | null }>();
  if (row?.doc_path) await admin.storage.from(DOC_BUCKET).remove([row.doc_path]);
  await db.from("property_expenses").delete().eq("id", id);

  revalidatePath("/admin/financials");
}
