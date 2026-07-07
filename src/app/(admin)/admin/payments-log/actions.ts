"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";

export type ReceiptState = { ok: boolean; error?: string; notice?: string };

const BUCKET = "payment-receipts";
const TYPES = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
]);

/**
 * Attach a receipt to a payment — a note (money-order / check #) and an optional
 * scanned image. Shown to the renter in their portal payment history.
 */
export async function savePaymentReceipt(
  _prev: ReceiptState,
  form: FormData
): Promise<ReceiptState> {
  const { profile } = await requireProfile("/admin/payments-log");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const paymentId = (form.get("payment_id") as string)?.trim();
  if (!paymentId) return { ok: false, error: "Missing payment." };
  const note = (form.get("note") as string)?.trim() || null;
  const file = form.get("file");

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const update: Record<string, string | null> = { receipt_note: note };

  if (file instanceof File && file.size > 0) {
    if (!TYPES.has(file.type)) return { ok: false, error: "Upload a PDF or image." };
    const admin = createAdminClient();
    // Replace any existing receipt file.
    const { data: existing } = await db
      .from("payments")
      .select("receipt_path")
      .eq("id", paymentId)
      .maybeSingle<{ receipt_path: string | null }>();
    if (existing?.receipt_path) {
      await admin.storage.from(BUCKET).remove([existing.receipt_path]);
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${paymentId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) return { ok: false, error: "Upload failed. Please try again." };
    update.receipt_path = path;
  }

  await db.from("payments").update(update).eq("id", paymentId);
  revalidatePath("/admin/payments-log");
  return { ok: true, notice: "Receipt saved." };
}
