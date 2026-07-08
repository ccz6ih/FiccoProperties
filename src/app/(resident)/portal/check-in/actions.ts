"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResidentUnitId } from "@/lib/occupancy";
import { CONDITION_BUCKET } from "@/lib/unit-photos";

export type CheckInState = { ok: boolean; error?: string; notice?: string };

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

  const file = form.get("file");
  const caption = (form.get("caption") as string)?.trim() || null;
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a photo to upload." };
  if (!IMAGE_TYPES.has(file.type)) return { ok: false, error: "Upload a photo (JPG, PNG, HEIC…)." };

  const admin = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${unitId}/${kind}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from(CONDITION_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: "Upload failed. Please try again." };

  await (admin as unknown as SupabaseClient).from("unit_photos").insert({
    unit_id: unitId,
    kind,
    path,
    caption,
    created_by: user.id,
  });

  revalidatePath(redirectPath);
  return { ok: true, notice: "Photo added." };
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
