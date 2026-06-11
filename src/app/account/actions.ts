"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AccountState = { ok: boolean; error?: string };

export async function updateAccount(
  _prev: AccountState,
  form: FormData
): Promise<AccountState> {
  const full_name = (form.get("full_name") as string)?.trim() || null;
  const phone = (form.get("phone") as string)?.trim() || null;
  const emergency_contact_name =
    (form.get("emergency_contact_name") as string)?.trim() || null;
  const emergency_contact_phone =
    (form.get("emergency_contact_phone") as string)?.trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  // Optional avatar upload — server-side via the service-role client.
  let avatar_url: string | undefined;
  const file = form.get("avatar");
  if (file instanceof File && file.size > 0 && file.type.startsWith("image/")) {
    const admin = createAdminClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (!upErr) {
      avatar_url = admin.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }
  }

  const update: {
    full_name: string | null;
    phone: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    avatar_url?: string;
  } = {
    full_name,
    phone,
    emergency_contact_name,
    emergency_contact_phone,
  };
  if (avatar_url) update.avatar_url = avatar_url;

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return { ok: false, error: "Could not save your account. Please try again." };

  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/portal");
  return { ok: true };
}

/** Parse a form value to an integer, or null if blank/invalid. */
function num(value: FormDataEntryValue | null): number | null {
  const s = (value as string)?.trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export type VehicleState = { ok: boolean; error?: string };

export async function addVehicle(
  _prev: VehicleState,
  form: FormData
): Promise<VehicleState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const make = (form.get("make") as string)?.trim() || null;
  const model = (form.get("model") as string)?.trim() || null;

  if (!make && !model) {
    return { ok: false, error: "Add at least a make or model." };
  }

  const { error } = await supabase.from("vehicles").insert({
    profile_id: user.id,
    make,
    model,
    color: (form.get("color") as string)?.trim() || null,
    year: num(form.get("year")),
    plate: (form.get("plate") as string)?.trim() || null,
    state: (form.get("state") as string)?.trim() || null,
    notes: (form.get("notes") as string)?.trim() || null,
  });
  if (error) return { ok: false, error: "Could not add the vehicle. Please try again." };

  revalidatePath("/account");
  return { ok: true };
}

export async function deleteVehicle(form: FormData): Promise<void> {
  const id = form.get("id") as string;
  if (!id) return;

  const supabase = await createClient();
  // RLS restricts deletes to the owner.
  await supabase.from("vehicles").delete().eq("id", id);

  revalidatePath("/account");
}
