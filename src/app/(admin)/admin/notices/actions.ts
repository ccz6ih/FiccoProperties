"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";

const NOTICE_TYPES = [
  "late_rent",
  "pay_or_quit",
  "lease_violation",
  "entry",
  "general",
];
const SERVED_METHODS = ["posted", "mailed", "hand", "email", "portal"];
const NOTICE_STATUSES = ["draft", "served", "cured", "expired", "withdrawn"];

// database.ts is regenerated centrally and may not yet know the notices table.
// Use a loose handle for writes to avoid build breaks.
function loose(supabase: Awaited<ReturnType<typeof createClient>>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** Create a draft notice. Staff only. Redirects to the new notice. */
export async function createNotice(form: FormData) {
  const { profile } = await requireProfile("/admin/notices/new");
  if (!isStaff(profile)) return;

  const resident_id = (form.get("resident_id") as string)?.trim();
  const type = (form.get("type") as string)?.trim();
  const title = (form.get("title") as string)?.trim();
  const body = (form.get("body") as string)?.trim();
  const amountRaw = (form.get("amount") as string)?.trim();
  const cure_by = (form.get("cure_by") as string)?.trim();

  if (!resident_id || !type || !NOTICE_TYPES.includes(type)) return;
  if (!title || !body) return;

  const supabase = await createClient();

  // Pull the resident's current unit from their occupancy, if any.
  const { data: occupancy } = await supabase
    .from("unit_occupancy")
    .select("unit_id")
    .eq("occupant_profile_id", resident_id)
    .maybeSingle<{ unit_id: string | null }>();

  const amountDollars = amountRaw ? parseFloat(amountRaw) : NaN;
  const amount_cents =
    !Number.isNaN(amountDollars) && amountDollars >= 0
      ? Math.round(amountDollars * 100)
      : null;

  const db = loose(supabase);
  const { data: notice, error } = await db
    .from("notices")
    .insert({
      resident_id,
      unit_id: occupancy?.unit_id ?? null,
      type,
      title,
      body,
      amount_cents,
      cure_by: cure_by || null,
      status: "draft",
      created_by: profile!.id,
    })
    .select("id")
    .single();

  if (error || !notice) return;

  revalidatePath("/admin/notices");
  redirect(`/admin/notices/${notice.id}`);
}

/** Record service: stamps served_at + served_method and sets status 'served'. */
export async function setNoticeServed(form: FormData) {
  const { profile } = await requireProfile("/admin/notices");
  if (!isStaff(profile)) return;

  const id = (form.get("id") as string)?.trim();
  const served_at = (form.get("served_at") as string)?.trim();
  const served_method = (form.get("served_method") as string)?.trim();
  if (!id || !served_at || !served_method || !SERVED_METHODS.includes(served_method))
    return;

  const supabase = await createClient();
  await loose(supabase)
    .from("notices")
    .update({ served_at, served_method, status: "served" })
    .eq("id", id);

  revalidatePath("/admin/notices");
  revalidatePath(`/admin/notices/${id}`);
  revalidatePath("/portal/notices");
}

/** Update a notice's status (cured / expired / withdrawn / etc.). */
export async function setNoticeStatus(form: FormData) {
  const { profile } = await requireProfile("/admin/notices");
  if (!isStaff(profile)) return;

  const id = (form.get("id") as string)?.trim();
  const status = (form.get("status") as string)?.trim();
  if (!id || !status || !NOTICE_STATUSES.includes(status)) return;

  const supabase = await createClient();
  await loose(supabase).from("notices").update({ status }).eq("id", id);

  revalidatePath("/admin/notices");
  revalidatePath(`/admin/notices/${id}`);
  revalidatePath("/portal/notices");
}
