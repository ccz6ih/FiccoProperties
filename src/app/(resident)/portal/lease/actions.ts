"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type SignState = { ok: boolean; error?: string };

/** Resident e-signs their own pending lease, flipping it to active. */
export async function signLease(
  _prev: SignState,
  form: FormData
): Promise<SignState> {
  const lease_id = (form.get("lease_id") as string)?.trim();
  const signature_name = (form.get("signature_name") as string)?.trim();
  const consent = form.get("consent");

  if (!lease_id) return { ok: false, error: "Missing lease reference." };
  if (!signature_name) return { ok: false, error: "Please type your full legal name." };
  if (!consent) return { ok: false, error: "Please check the consent box to sign." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  // Confirm the lease belongs to this resident and is awaiting signature. RLS
  // also enforces this, but we check to give a clear message.
  const { data: lease } = await supabase
    .from("leases")
    .select("id, status, resident_id")
    .eq("id", lease_id)
    .maybeSingle();

  if (!lease || lease.resident_id !== user.id)
    return { ok: false, error: "Lease not found." };
  if (lease.status !== "pending_signature")
    return { ok: false, error: "This lease is not awaiting your signature." };

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    null;

  const db = supabase as unknown as SupabaseClient;

  const { error } = await db
    .from("leases")
    .update({
      status: "active",
      signature_name,
      signature_ip: ip,
      signed_at: new Date().toISOString(),
    })
    .eq("id", lease_id);

  if (error) return { ok: false, error: "Could not record your signature. Please try again." };

  await db.from("lease_events").insert({
    lease_id,
    actor_id: user.id,
    type: "signed",
    note: `Signed electronically by ${signature_name}`,
  });

  revalidatePath("/portal/lease");
  revalidatePath("/portal");
  revalidatePath(`/admin/leases/${lease_id}`);
  return { ok: true };
}
