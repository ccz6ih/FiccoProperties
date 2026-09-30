"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResidentUnitId } from "@/lib/occupancy";
import { CONDITION_BUCKET } from "@/lib/unit-photos";

export type CheckInState = { ok: boolean; error?: string; notice?: string };

/** Supabase's condition bucket caps uploads at 25 MB; stop a big one earlier. */
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

const IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
]);
const PROGRAMS = ["ssi", "ssdi", "colorado_works"];

/** The signed-in resident's current unit, or null (co-tenant aware). */
async function residentUnitId(userId: string): Promise<string | null> {
  return getResidentUnitId(userId);
}

/**
 * Resident self-discloses benefit-program enrollment. This IS the written
 * notice the statute contemplates — it's stamped with today's date and recorded
 * on the tenancy so staff see mediation eligibility up front.
 */
export async function discloseAssistance(
  _prev: CheckInState,
  form: FormData
): Promise<CheckInState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const programs = form
    .getAll("assistance_programs")
    .map((v) => String(v).trim())
    .filter((v) => PROGRAMS.includes(v));

  const unitId = await residentUnitId(user.id);
  if (!unitId) return { ok: false, error: "No home is on file for your account yet." };

  const admin = createAdminClient() as unknown as SupabaseClient;
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await admin
    .from("unit_occupancy")
    .update({
      assistance_programs: programs,
      // Only stamp a disclosure date when they actually report a program.
      assistance_disclosed_at: programs.length > 0 ? today : null,
    })
    .eq("unit_id", unitId);

  if (error) return { ok: false, error: "Could not save. Please try again." };

  revalidatePath("/portal/check-in");
  return {
    ok: true,
    notice:
      programs.length > 0
        ? "Thank you — your disclosure has been recorded."
        : "Saved — no programs selected.",
  };
}

/** Shared: resident uploads a condition photo (private bucket, service role). */
async function uploadPhoto(
  kind: "move_in" | "move_out",
  redirectPath: string,
  form: FormData
): Promise<CheckInState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const unitId = await residentUnitId(user.id);
  if (!unitId) return { ok: false, error: "No home is on file for your account yet." };

  // Documenting a whole home is a dozen photos, not one — taking them one at a
  // time is why residents gave up on this. Accept the lot in a single pick.
  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  const caption = (form.get("caption") as string)?.trim() || null;
  if (files.length === 0) return { ok: false, error: "Choose at least one photo to upload." };

  const admin = createAdminClient();
  const rows: { unit_id: string; kind: string; path: string; caption: string | null; created_by: string }[] = [];
  const rejected: string[] = [];

  for (const file of files) {
    if (!IMAGE_TYPES.has(file.type)) {
      rejected.push(`${file.name} isn't a photo`);
      continue;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      rejected.push(`${file.name} is too large`);
      continue;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${unitId}/${kind}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(CONDITION_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      rejected.push(`${file.name} failed to upload`);
      continue;
    }
    rows.push({ unit_id: unitId, kind, path, caption, created_by: user.id });
  }

  // One bad photo out of twenty shouldn't lose the other nineteen, so save what
  // worked and name what didn't.
  if (rows.length > 0) {
    await (admin as unknown as SupabaseClient).from("unit_photos").insert(rows);
  }

  revalidatePath(redirectPath);

  if (rows.length === 0) {
    return { ok: false, error: rejected[0] ?? "Upload failed. Please try again." };
  }
  const added = `${rows.length} photo${rows.length === 1 ? "" : "s"} added.`;
  return {
    ok: true,
    notice: rejected.length > 0 ? `${added} ${rejected.length} skipped — ${rejected[0]}.` : added,
  };
}

export async function uploadMoveInPhoto(_prev: CheckInState, form: FormData) {
  return uploadPhoto("move_in", "/portal/check-in", form);
}
export async function uploadMoveOutPhoto(_prev: CheckInState, form: FormData) {
  return uploadPhoto("move_out", "/portal/move-out", form);
}

/** Resident deletes one of their own move-in / move-out photos. */
export async function deleteOwnPhoto(form: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const id = (form.get("id") as string)?.trim();
  const back = (form.get("back") as string)?.trim() || "/portal/check-in";
  if (!id) return;

  const admin = createAdminClient();
  const db = admin as unknown as SupabaseClient;
  const { data: photo } = await db
    .from("unit_photos")
    .select("path, created_by, kind")
    .eq("id", id)
    .maybeSingle<{ path: string; created_by: string | null; kind: string }>();
  if (!photo || photo.created_by !== user.id || !["move_in", "move_out"].includes(photo.kind)) return;

  await admin.storage.from(CONDITION_BUCKET).remove([photo.path]);
  await db.from("unit_photos").delete().eq("id", id);

  revalidatePath(back);
}

/** Resident saves their forwarding address + planned move-out date. */
export async function saveForwarding(
  _prev: CheckInState,
  form: FormData
): Promise<CheckInState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const forwarding = (form.get("forwarding_address") as string)?.trim() || null;
  const moveOut = (form.get("move_out_date") as string)?.trim() || null;

  const unitId = await residentUnitId(user.id);
  if (!unitId) return { ok: false, error: "No home is on file for your account yet." };

  const admin = createAdminClient() as unknown as SupabaseClient;
  const { error } = await admin
    .from("unit_occupancy")
    .update({ forwarding_address: forwarding, move_out_date: moveOut })
    .eq("unit_id", unitId);

  if (error) return { ok: false, error: "Could not save. Please try again." };
  revalidatePath("/portal/move-out");
  return { ok: true, notice: "Saved. Thank you." };
}
