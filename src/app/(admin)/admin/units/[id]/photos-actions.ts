"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, isStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { bucketForKind, type PhotoKind } from "@/lib/unit-photos";

export type PhotoState = {
  ok: boolean;
  error?: string;
  uploaded?: number;
};

function str(form: FormData, key: string): string {
  return (form.get(key) as string | null)?.trim() ?? "";
}

function normalizeKind(value: string): PhotoKind {
  return value === "condition" ? "condition" : "listing";
}

/**
 * Upload one-or-more listing/condition photos for a unit. Staff-only;
 * storage writes go through the service-role client (anon has no write
 * access to either bucket).
 */
export async function uploadUnitPhotos(
  _prev: PhotoState,
  form: FormData
): Promise<PhotoState> {
  const unit_id = str(form, "unit_id");
  const kind = normalizeKind(str(form, "kind"));
  const caption = str(form, "caption");

  if (!unit_id) return { ok: false, error: "Missing unit." };

  const { user, profile } = await requireProfile(`/admin/units/${unit_id}`);
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const files = form
    .getAll("photos")
    .filter(
      (f): f is File =>
        f instanceof File && f.size > 0 && f.type.startsWith("image/")
    );

  if (files.length === 0) return { ok: false, error: "Choose at least one image." };

  const admin = createAdminClient();
  const bucket = bucketForKind(kind);

  let uploaded = 0;
  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${unit_id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) continue;

    const { error: insertError } = await admin.from("unit_photos").insert({
      unit_id,
      kind,
      path,
      caption: caption || null,
      created_by: user.id,
    });
    if (insertError) {
      // Roll back the orphaned object so we don't leave dangling files.
      await admin.storage.from(bucket).remove([path]);
      continue;
    }
    uploaded += 1;
  }

  revalidatePath(`/admin/units/${unit_id}`);

  if (uploaded === 0) {
    return { ok: false, error: "Upload failed. Please try again." };
  }
  return { ok: true, uploaded };
}

/** Delete a single unit photo (storage object + row). Staff-only. */
export async function deleteUnitPhoto(form: FormData): Promise<void> {
  const id = str(form, "id");
  if (!id) return;

  const { profile } = await requireProfile("/admin/units");
  if (!isStaff(profile)) return;

  const admin = createAdminClient();

  const { data: photo } = await admin
    .from("unit_photos")
    .select("unit_id, kind, path")
    .eq("id", id)
    .maybeSingle();

  if (!photo) return;

  await admin.storage.from(bucketForKind(photo.kind)).remove([photo.path]);
  await admin.from("unit_photos").delete().eq("id", id);

  revalidatePath(`/admin/units/${photo.unit_id}`);
}
