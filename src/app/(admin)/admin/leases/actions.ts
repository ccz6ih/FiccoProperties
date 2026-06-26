"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/email";
import type { EmailActionState } from "@/lib/action-state";

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

export type LeaseTermsState = { ok: boolean; error?: string };

/** Save edited / regenerated terms onto a DRAFT lease. */
export async function updateLeaseTerms(
  _prev: LeaseTermsState,
  form: FormData
): Promise<LeaseTermsState> {
  const supabase = await createClient();
  if (!(await requireStaff(supabase))) return { ok: false, error: "Staff only." };

  const id = (form.get("id") as string)?.trim();
  const terms = (form.get("terms") as string) ?? "";
  if (!id) return { ok: false, error: "Missing lease." };

  const { error } = await loose(supabase)
    .from("leases")
    .update({ terms: terms.trim() || null })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return { ok: false, error: "Could not save the terms." };

  revalidatePath(`/admin/leases/${id}`);
  return { ok: true };
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

type LeaseForSend = {
  status: string;
  profiles: { full_name: string | null; email: string | null } | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

/**
 * Move a draft lease to pending_signature AND email the resident a sign link.
 * Re-runnable as a "resend" — it generates a fresh magic sign-in link that
 * lands the resident right on the portal lease page to review and e-sign.
 */
export async function sendForSignature(
  _prev: EmailActionState,
  form: FormData
): Promise<EmailActionState> {
  const id = (form.get("id") as string)?.trim();
  if (!id) return { ok: false, error: "Missing lease." };

  const supabase = await createClient();
  const user = await requireStaff(supabase);
  if (!user) return { ok: false, error: "Staff only." };

  const db = loose(supabase);

  const { data: lease } = await db
    .from("leases")
    .select("status, profiles(full_name, email), units(label, properties(name))")
    .eq("id", id)
    .maybeSingle<LeaseForSend>();

  const resend = lease?.status === "pending_signature";
  if (!resend) {
    await db.from("leases").update({ status: "pending_signature" }).eq("id", id);
  }
  await db.from("lease_events").insert({
    lease_id: id,
    actor_id: user.id,
    type: "sent",
    note: resend ? "Resent signature request" : "Sent to resident for signature",
  });

  // Email the resident a link to review & sign.
  const email = lease?.profiles?.email?.trim();
  if (email) {
    const home = lease?.units?.properties?.name
      ? `${lease.units.properties.name} — ${lease.units.label}`
      : "your home";
    const greeting = lease?.profiles?.full_name?.split(" ")[0] ?? "there";
    const signUrl = "https://38thaveproperties.com/portal/lease";

    // A magic link signs the resident in and drops them on the lease page.
    let link = signUrl;
    try {
      const admin = createAdminClient();
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: signUrl },
      });
      if (linkData?.properties?.action_link) link = linkData.properties.action_link;
    } catch {
      // fall back to the plain portal URL + login instructions below
    }

    await sendNotification({
      to: email,
      replyTo: "hello@38thaveproperties.com",
      subject: `Action needed: sign your lease for ${home}`,
      html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;color:#2c2622;font-size:15px;line-height:1.7"><div style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#2f5d50;margin-bottom:12px">Your lease is ready to sign, ${greeting}</div><p>Your lease for <strong>${home}</strong> is ready for your review and electronic signature.</p><p style="margin:22px 0"><a href="${link}" style="background:#2f5d50;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:9999px;display:inline-block">Review &amp; sign your lease →</a></p><p style="font-size:13px;color:#6f655a">This secure link signs you in and takes you straight to your lease. If it has expired, go to <a href="https://38thaveproperties.com/login" style="color:#2f5d50;font-weight:600">38thaveproperties.com/login</a> (email: ${email}) and use “Forgot password?” to set a password, then open Lease in your resident portal.</p><p style="margin-top:18px;color:#6f655a;font-size:14px">— The 38th Ave Properties team</p></div>`,
    });
  }

  revalidatePath(`/admin/leases/${id}`);
  revalidatePath("/admin/leases");
  revalidatePath("/portal/lease");
  return email
    ? { ok: true, sentTo: email }
    : { ok: true, error: "No email on file — add one to email a sign link." };
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

/**
 * Record the move-in and set up the operational tenancy: link the unit to the
 * resident's account (so their portal/statements/maintenance connect), copy the
 * lease dates + rent into unit_occupancy, and mark the unit occupied.
 */
export async function setupTenancy(form: FormData) {
  const id = (form.get("id") as string)?.trim();
  const moveIn = (form.get("move_in_date") as string)?.trim() || null;
  if (!id) return;

  const supabase = await createClient();
  const user = await requireStaff(supabase);
  if (!user) return;

  const { data: lease } = await supabase
    .from("leases")
    .select("unit_id, resident_id, rent_cents, start_date, end_date, signed_at")
    .eq("id", id)
    .maybeSingle();
  if (!lease) return;

  await supabase.from("unit_occupancy").upsert(
    {
      unit_id: lease.unit_id,
      occupant_profile_id: lease.resident_id,
      rent_cents: lease.rent_cents,
      lease_start_date: lease.start_date,
      lease_signed_date: lease.signed_at ? lease.signed_at.slice(0, 10) : null,
      lease_end_date: lease.end_date,
      move_in_date: moveIn,
    },
    { onConflict: "unit_id" }
  );
  await supabase.from("units").update({ status: "occupied" }).eq("id", lease.unit_id);

  await loose(supabase).from("lease_events").insert({
    lease_id: id,
    actor_id: user.id,
    type: "note",
    note: `Move-in ${moveIn ?? "recorded"} — tenancy set up`,
  });

  revalidatePath(`/admin/leases/${id}`);
  revalidatePath("/admin/properties");
  revalidatePath("/admin/properties/[slug]", "page");
  revalidatePath("/admin");
}

/**
 * Create a prorated first-month rent charge: charges only the days from the
 * move-in date through the end of that month, based on the monthly rent.
 */
export async function createProratedCharge(form: FormData) {
  const id = (form.get("id") as string)?.trim();
  const moveIn = (form.get("move_in_date") as string)?.trim();
  if (!id || !moveIn) return;

  const supabase = await createClient();
  const user = await requireStaff(supabase);
  if (!user) return;

  const { data: lease } = await supabase
    .from("leases")
    .select("resident_id, rent_cents")
    .eq("id", id)
    .maybeSingle();
  if (!lease) return;

  const [y, m, d] = moveIn.split("-").map(Number);
  if (!y || !m || !d) return;
  const daysInMonth = new Date(y, m, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - d + 1);
  const amount = Math.round((lease.rent_cents * daysRemaining) / daysInMonth);
  const period = `${y}-${String(m).padStart(2, "0")}`;

  const { data: charge, error } = await supabase
    .from("charges")
    .insert({
      lease_id: id,
      resident_id: lease.resident_id,
      amount_cents: amount,
      description: `Prorated rent (${daysRemaining}/${daysInMonth} days)`,
      due_date: moveIn,
      status: "open",
      period,
    })
    .select("id")
    .maybeSingle();
  if (error || !charge) return;

  await supabase.from("ledger_entries").insert({
    resident_id: lease.resident_id,
    lease_id: id,
    kind: "charge",
    amount_cents: amount,
    ref_id: charge.id,
    memo: `Prorated rent ${period}`,
  });

  revalidatePath("/admin/payments");
  revalidatePath(`/admin/leases/${id}`);
  revalidatePath("/admin");
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
