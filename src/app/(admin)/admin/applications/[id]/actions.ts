"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";

const ALLOWED = ["not_started", "invited", "in_progress", "passed", "failed", "waived"];

export async function setScreeningStatus(form: FormData) {
  const id = form.get("id") as string;
  const screening_status = form.get("screening_status") as string;
  if (!id || !ALLOWED.includes(screening_status)) return;

  const { profile } = await requireProfile("/admin/applications");
  if (!isStaff(profile)) return;

  const supabase = await createClient();
  await supabase.from("applications").update({ screening_status }).eq("id", id);
  revalidatePath(`/admin/applications/${id}`);
  revalidatePath("/admin/applications");
}

export type ScreeningState = { ok: boolean; error?: string };

/** Record the screening outcome: status + the SmartMove report link + notes. */
export async function saveScreening(
  _prev: ScreeningState,
  form: FormData
): Promise<ScreeningState> {
  const id = form.get("id") as string;
  const screening_status = form.get("screening_status") as string;
  const reportUrl = (form.get("screening_report_url") as string)?.trim() || null;
  const notes = (form.get("screening_notes") as string)?.trim() || null;

  if (!id || !ALLOWED.includes(screening_status)) {
    return { ok: false, error: "Invalid status." };
  }

  const { profile } = await requireProfile(`/admin/applications/${id}`);
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const update: {
    screening_status: string;
    screening_report_url: string | null;
    screening_notes: string | null;
    screening_requested_at?: string;
  } = {
    screening_status,
    screening_report_url: reportUrl,
    screening_notes: notes,
  };
  // Stamp when the screening is first put in motion.
  if (screening_status === "invited") {
    update.screening_requested_at = new Date().toISOString();
  }

  const supabase = await createClient();
  await supabase.from("applications").update(update).eq("id", id);
  revalidatePath(`/admin/applications/${id}`);
  revalidatePath("/admin/applications");
  return { ok: true };
}
