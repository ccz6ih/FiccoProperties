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

  const update: { full_name: string | null; phone: string | null; avatar_url?: string } = {
    full_name,
    phone,
  };
  if (avatar_url) update.avatar_url = avatar_url;

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return { ok: false, error: "Could not save your account. Please try again." };

  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/portal");
  return { ok: true };
}
