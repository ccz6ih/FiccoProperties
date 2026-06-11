"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type MaintenanceState = { ok: boolean; error?: string };

export async function createMaintenanceRequest(
  _prev: MaintenanceState,
  form: FormData
): Promise<MaintenanceState> {
  const title = (form.get("title") as string)?.trim();
  const description = (form.get("description") as string)?.trim();
  const category = (form.get("category") as string) || "general";
  const priority = (form.get("priority") as string) || "normal";

  if (!title) return { ok: false, error: "Please describe the issue." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  // Link to the resident's active-lease unit if there is one.
  const { data: lease } = await supabase
    .from("leases")
    .select("unit_id")
    .eq("resident_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const { error } = await supabase.from("maintenance_requests").insert({
    title,
    description: description || null,
    category,
    priority,
    created_by: user.id,
    unit_id: lease?.unit_id ?? null,
  });

  if (error) return { ok: false, error: "Could not submit your request. Please try again." };

  revalidatePath("/portal/maintenance");
  revalidatePath("/portal");
  return { ok: true };
}
