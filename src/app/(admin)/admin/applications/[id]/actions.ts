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
