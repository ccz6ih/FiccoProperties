"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";

const ALLOWED = ["new", "scheduled", "completed", "cancelled"];

export async function setTourStatus(form: FormData) {
  const id = form.get("id") as string;
  const status = form.get("status") as string;
  if (!id || !ALLOWED.includes(status)) return;

  const { profile } = await requireProfile("/admin/tours");
  if (!isStaff(profile)) return;

  const supabase = await createClient();
  await supabase.from("tour_requests").update({ status }).eq("id", id);
  revalidatePath("/admin/tours");
}
