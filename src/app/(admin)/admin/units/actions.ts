"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";

export type LogState = { ok: boolean; error?: string };

function str(v: FormDataEntryValue | null): string | null {
  const s = ((v as string) ?? "").trim();
  return s || null;
}

/**
 * Add a note or a record of maintenance performed to a unit's running history.
 * Staff-only (admins + maintenance manager). Auto-stamps the author and links
 * the unit's current resident when one is on file.
 */
export async function addLogEntry(
  _prev: LogState,
  form: FormData
): Promise<LogState> {
  const { user, profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = str(form.get("unit_id"));
  const body = str(form.get("body"));
  const kind = str(form.get("kind")) === "maintenance" ? "maintenance" : "note";
  const performedOn = str(form.get("performed_on"));
  const costDollars = str(form.get("cost"));
  if (!unitId) return { ok: false, error: "Missing unit." };
  if (!body) return { ok: false, error: "Write something first." };

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  // Link the current occupant, if any.
  const { data: occ } = await supabase
    .from("unit_occupancy")
    .select("occupant_profile_id")
    .eq("unit_id", unitId)
    .maybeSingle<{ occupant_profile_id: string | null }>();

  let costCents: number | null = null;
  if (costDollars) {
    const n = Number(costDollars.replace(/[$,\s]/g, ""));
    if (Number.isFinite(n) && n >= 0) costCents = Math.round(n * 100);
  }

  const { error } = await db.from("unit_log_entries").insert({
    unit_id: unitId,
    resident_id: occ?.occupant_profile_id ?? null,
    kind,
    body,
    performed_on: performedOn,
    cost_cents: costCents,
    author_id: user.id,
  });
  if (error) return { ok: false, error: "Could not save the entry." };

  revalidatePath(`/admin/units/${unitId}`);
  return { ok: true };
}

/** Remove a log entry (staff-only). */
export async function deleteLogEntry(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  const unitId = str(form.get("unit_id"));
  if (!id) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("unit_log_entries").delete().eq("id", id);

  if (unitId) revalidatePath(`/admin/units/${unitId}`);
}
