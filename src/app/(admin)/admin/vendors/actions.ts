"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";

export type VendorState = { ok: boolean; error?: string };

function str(v: FormDataEntryValue | null): string | null {
  const s = ((v as string) ?? "").trim();
  return s || null;
}

/** Add a vendor, or update one when `id` is present. Staff-only. */
export async function saveVendor(
  _prev: VendorState,
  form: FormData
): Promise<VendorState> {
  const { user, profile } = await requireProfile("/admin/vendors");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const name = str(form.get("name"));
  if (!name) return { ok: false, error: "Vendor name is required." };

  const record = {
    name,
    trade: str(form.get("trade")),
    phone: str(form.get("phone")),
    email: str(form.get("email")),
    notes: str(form.get("notes")),
    coi_expires_on: str(form.get("coi_expires_on")),
    w9_on_file: form.get("w9_on_file") === "on",
  };

  const db = createAdminClient() as unknown as SupabaseClient;
  const id = str(form.get("id"));
  const { error } = id
    ? await db.from("vendors").update(record).eq("id", id)
    : await db.from("vendors").insert({ ...record, created_by: user.id });
  if (error) return { ok: false, error: "Could not save the vendor." };

  revalidatePath("/admin/vendors");
  return { ok: true };
}

/** Archive / restore a vendor. */
export async function toggleVendorActive(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/vendors");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  const active = form.get("active") === "1";
  if (!id) return;

  const db = createAdminClient() as unknown as SupabaseClient;
  await db.from("vendors").update({ active }).eq("id", id);
  revalidatePath("/admin/vendors");
}
