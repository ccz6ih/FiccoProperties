"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";

const RECEIPT_BUCKET = "receipts";
const DOC_TYPES = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
]);

export type CashState = { ok: boolean; error?: string };

function str(v: FormDataEntryValue | null): string | null {
  const s = ((v as string) ?? "").trim();
  return s || null;
}
function cents(v: FormDataEntryValue | null): number | null {
  const s = ((v as string) ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Log an expense against a staffer's envelope (with optional receipt upload). */
export async function addExpense(
  _prev: CashState,
  form: FormData
): Promise<CashState> {
  const { user, profile } = await requireProfile("/admin/petty-cash");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const staffId = str(form.get("staff_id"));
  const occurredOn = str(form.get("occurred_on"));
  const amount = cents(form.get("amount"));
  if (!staffId) return { ok: false, error: "Whose envelope?" };
  if (!occurredOn) return { ok: false, error: "Pick a date." };
  if (amount == null || amount <= 0) {
    return { ok: false, error: "Enter the business amount from petty cash." };
  }
  const receiptTotal = cents(form.get("receipt_total"));
  if (receiptTotal != null && amount > receiptTotal) {
    return { ok: false, error: "Business amount can't exceed the receipt total." };
  }

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  // Optional receipt upload — one or more files (multi-page receipts).
  const files = form
    .getAll("file")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const receiptPaths: string[] = [];
  if (files.length > 0) {
    const admin = createAdminClient();
    for (const file of files) {
      if (!DOC_TYPES.has(file.type)) {
        return { ok: false, error: "Receipts must be PDFs or images." };
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${staffId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await admin.storage
        .from(RECEIPT_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) return { ok: false, error: "Receipt upload failed." };
      receiptPaths.push(path);
    }
  }

  const { error } = await db.from("petty_cash_entries").insert({
    staff_id: staffId,
    kind: "expense",
    occurred_on: occurredOn,
    store: str(form.get("store")),
    description: str(form.get("description")),
    category: str(form.get("category")),
    property_id: str(form.get("property_id")),
    unit_id: str(form.get("unit_id")),
    receipt_total_cents: receiptTotal,
    amount_cents: amount,
    receipt_path: receiptPaths[0] ?? null,
    receipt_paths: receiptPaths.length > 0 ? receiptPaths : null,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Could not save the expense." };

  revalidatePath("/admin/petty-cash");
  return { ok: true };
}

/** Load cash into a staffer's envelope. */
export async function addTopup(
  _prev: CashState,
  form: FormData
): Promise<CashState> {
  const { user, profile } = await requireProfile("/admin/petty-cash");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const staffId = str(form.get("staff_id"));
  const occurredOn = str(form.get("occurred_on"));
  const amount = cents(form.get("amount"));
  if (!staffId) return { ok: false, error: "Whose envelope?" };
  if (!occurredOn) return { ok: false, error: "Pick a date." };
  if (amount == null || amount <= 0) return { ok: false, error: "Enter an amount." };

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { error } = await db.from("petty_cash_entries").insert({
    staff_id: staffId,
    kind: "topup",
    occurred_on: occurredOn,
    store: str(form.get("received_from")) ?? "Lou",
    description: str(form.get("description")),
    amount_cents: amount,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Could not record the cash." };

  revalidatePath("/admin/petty-cash");
  return { ok: true };
}

/** Edit an existing entry (expense or top-up). */
export async function editPettyEntry(
  _prev: CashState,
  form: FormData
): Promise<CashState> {
  const { profile } = await requireProfile("/admin/petty-cash");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const id = str(form.get("id"));
  if (!id) return { ok: false, error: "Missing entry." };
  const amount = cents(form.get("amount"));
  if (amount == null || amount <= 0) return { ok: false, error: "Enter an amount." };

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const updates: Record<string, unknown> = {
    amount_cents: amount,
    store: str(form.get("store")),
    description: str(form.get("description")),
  };
  const d = str(form.get("occurred_on"));
  if (d) updates.occurred_on = d;
  if (str(form.get("kind")) === "expense") {
    updates.category = str(form.get("category"));
    updates.receipt_total_cents = cents(form.get("receipt_total"));
    updates.property_id = str(form.get("property_id"));
    updates.unit_id = str(form.get("unit_id"));
  }

  const { error } = await db.from("petty_cash_entries").update(updates).eq("id", id);
  if (error) return { ok: false, error: "Could not save changes." };

  revalidatePath("/admin/petty-cash");
  return { ok: true };
}

/** Delete a petty-cash entry (and its receipt file). */
export async function deletePettyEntry(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/petty-cash");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  if (!id) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: row } = await db
    .from("petty_cash_entries")
    .select("receipt_path, receipt_paths")
    .eq("id", id)
    .maybeSingle<{ receipt_path: string | null; receipt_paths: string[] | null }>();

  const paths = [
    ...(row?.receipt_paths ?? []),
    ...(row?.receipt_path ? [row.receipt_path] : []),
  ];
  if (paths.length > 0) {
    const admin = createAdminClient();
    await admin.storage.from(RECEIPT_BUCKET).remove([...new Set(paths)]);
  }
  await db.from("petty_cash_entries").delete().eq("id", id);

  revalidatePath("/admin/petty-cash");
}
