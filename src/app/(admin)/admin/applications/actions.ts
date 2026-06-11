"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = ["new", "reviewing", "approved", "denied", "withdrawn"];

export async function setApplicationStatus(form: FormData) {
  const id = form.get("id") as string;
  const status = form.get("status") as string;
  if (!id || !ALLOWED.includes(status)) return;

  const supabase = await createClient();
  await supabase.from("applications").update({ status }).eq("id", id);
  revalidatePath("/admin/applications");
  revalidatePath("/admin");
}
