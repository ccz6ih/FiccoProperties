"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type LeaseFormState = { ok: boolean; error?: string };

// The typed client doesn't yet know the new lease columns / lease_events table
// (database.ts is regenerated centrally). Use a loose handle for writes.
function loose(supabase: Awaited<ReturnType<typeof createClient>>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

async function requireStaff(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !["owner", "admin"].includes(profile.role)) return null;
  return user;
}

/** Create a draft lease, optionally from an approved application. */
export async function createLease(
  _prev: LeaseFormState,
  form: FormData
): Promise<LeaseFormState> {
  const unit_id = (form.get("unit_id") as string)?.trim();
  const resident_id = (form.get("resident_id") as string)?.trim();
  const start_date = (form.get("start_date") as string)?.trim();
  const end_date = (form.get("end_date") as string)?.trim();
  const application_id = (form.get("application_id") as string)?.trim();
  const terms = (form.get("terms") as string)?.trim();
  const rentDollars = parseFloat((form.get("rent") as string) ?? "");
  const depositDollars = parseFloat((form.get("deposit") as string) ?? "");

  if (!unit_id) return { ok: false, error: "Please choose a unit." };
  if (!resident_id) return { ok: false, error: "Please choose a resident." };
  if (!start_date) return { ok: false, error: "Please set a start date." };
  if (Number.isNaN(rentDollars) || rentDollars < 0)
    return { ok: false, error: "Enter a valid monthly rent." };

  const supabase = await createClient();
  const user = await requireStaff(supabase);
  if (!user) return { ok: false, error: "Only staff may create leases." };

  const db = loose(supabase);
  const { data: lease, error } = await db
    .from("leases")
    .insert({
      unit_id,
      resident_id,
      start_date,
      end_date: end_date || null,
      rent_cents: Math.round(rentDollars * 100),
      deposit_cents: Number.isNaN(depositDollars) ? 0 : Math.round(depositDollars * 100),
      status: "draft",
      terms: terms || null,
      application_id: application_id || null,
    })
    .select("id")
    .single();

  if (error || !lease) return { ok: false, error: "Could not create the lease. Please try again." };

  await db.from("lease_events").insert({
    lease_id: lease.id,
    actor_id: user.id,
    type: "created",
    note: "Lease drafted",
  });

  revalidatePath("/admin/leases");
  revalidatePath("/admin");
  redirect(`/admin/leases/${lease.id}`);
}

/** Move a draft lease to pending_signature so the resident can e-sign. */
export async function sendForSignature(form: FormData) {
  const id = (form.get("id") as string)?.trim();
  if (!id) return;

  const supabase = await createClient();
  const user = await requireStaff(supabase);
  if (!user) return;

  const db = loose(supabase);
  await db.from("leases").update({ status: "pending_signature" }).eq("id", id);
  await db.from("lease_events").insert({
    lease_id: id,
    actor_id: user.id,
    type: "sent",
    note: "Sent to resident for signature",
  });

  revalidatePath(`/admin/leases/${id}`);
  revalidatePath("/admin/leases");
  revalidatePath("/portal/lease");
}

/** End an active lease (normal expiry/move-out). */
export async function endLease(form: FormData) {
  const id = (form.get("id") as string)?.trim();
  if (!id) return;

  const supabase = await createClient();
  const user = await requireStaff(supabase);
  if (!user) return;

  const db = loose(supabase);
  await db
    .from("leases")
    .update({ status: "ended", end_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  await db.from("lease_events").insert({
    lease_id: id,
    actor_id: user.id,
    type: "ended",
    note: "Lease ended",
  });

  revalidatePath(`/admin/leases/${id}`);
  revalidatePath("/admin/leases");
  revalidatePath("/portal/lease");
}

/** Terminate a lease early. */
export async function terminateLease(form: FormData) {
  const id = (form.get("id") as string)?.trim();
  const note = (form.get("note") as string)?.trim();
  if (!id) return;

  const supabase = await createClient();
  const user = await requireStaff(supabase);
  if (!user) return;

  const db = loose(supabase);
  await db
    .from("leases")
    .update({ status: "terminated", end_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  await db.from("lease_events").insert({
    lease_id: id,
    actor_id: user.id,
    type: "terminated",
    note: note || "Lease terminated",
  });

  revalidatePath(`/admin/leases/${id}`);
  revalidatePath("/admin/leases");
  revalidatePath("/portal/lease");
}
