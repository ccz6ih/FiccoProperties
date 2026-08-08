"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";
import { sendNotification } from "@/lib/email";
import { signInLink } from "@/lib/portal-invite";
import { renewalOfferEmail } from "@/lib/renewal-email";
import { applyRenewalOffer } from "@/lib/renewals";
import { formatDate } from "@/lib/format";

export type RenewalState = { ok: boolean; error?: string; notice?: string };

function str(v: FormDataEntryValue | null): string | null {
  const s = ((v as string) ?? "").trim();
  return s || null;
}

function dollarsToCents(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

/** Create a renewal offer for a unit. */
export async function createRenewalOffer(
  _prev: RenewalState,
  form: FormData
): Promise<RenewalState> {
  const { user, profile } = await requireProfile("/admin/renewals");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = str(form.get("unit_id"));
  const newRent = dollarsToCents(str(form.get("new_rent")));
  const effective = str(form.get("effective_date"));
  const termMonths = Number(str(form.get("term_months")) ?? "12");
  if (!unitId) return { ok: false, error: "Missing unit." };
  if (!newRent) return { ok: false, error: "Enter the new monthly rent." };
  if (!effective || !/^\d{4}-\d{2}-\d{2}$/.test(effective)) {
    return { ok: false, error: "Pick the date the new terms start." };
  }
  if (![0, 6, 12].includes(termMonths)) return { ok: false, error: "Pick a term." };

  const db = createAdminClient() as unknown as SupabaseClient;

  // Current rent + linked account from the tenancy (lease preferred for rent).
  const [{ data: occ }, { data: lease }] = await Promise.all([
    db
      .from("unit_occupancy")
      .select("occupant_profile_id, rent_cents")
      .eq("unit_id", unitId)
      .maybeSingle<{ occupant_profile_id: string | null; rent_cents: number | null }>(),
    db
      .from("leases")
      .select("rent_cents")
      .eq("unit_id", unitId)
      .eq("status", "active")
      .maybeSingle<{ rent_cents: number | null }>(),
  ]);
  const currentRent = lease?.rent_cents || occ?.rent_cents || 0;

  // End date: effective + term, minus one day (12 mo from Jan 1 ends Dec 31).
  let newEnd: string | null = null;
  if (termMonths > 0) {
    const [y, m, d] = effective.split("-").map(Number);
    const end = new Date(y, m - 1 + termMonths, d);
    end.setDate(end.getDate() - 1);
    newEnd = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  }

  const { error } = await db.from("renewal_offers").insert({
    unit_id: unitId,
    resident_id: occ?.occupant_profile_id ?? null,
    current_rent_cents: currentRent,
    new_rent_cents: newRent,
    term_months: termMonths,
    effective_date: effective,
    new_end_date: newEnd,
    note: str(form.get("note")),
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Could not create the offer." };

  revalidatePath("/admin/renewals");
  return { ok: true, notice: "Offer created — open it to send the notice." };
}

type OfferForEmail = {
  id: string;
  unit_id: string;
  resident_id: string | null;
  current_rent_cents: number;
  new_rent_cents: number;
  term_months: number;
  effective_date: string;
  status: string;
};

/** Email the offer to the tenant with a one-click portal link. */
export async function emailRenewalOffer(
  _prev: RenewalState,
  form: FormData
): Promise<RenewalState> {
  const { profile } = await requireProfile("/admin/renewals");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const id = str(form.get("id"));
  if (!id) return { ok: false, error: "Missing offer." };

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: offer } = await db
    .from("renewal_offers")
    .select("id, unit_id, resident_id, current_rent_cents, new_rent_cents, term_months, effective_date, status")
    .eq("id", id)
    .maybeSingle<OfferForEmail>();
  if (!offer) return { ok: false, error: "Offer not found." };
  if (["withdrawn", "applied"].includes(offer.status)) {
    return { ok: false, error: "This offer is closed." };
  }

  // Tenant email: portal account first, tenancy record as fallback.
  const [{ data: unit }, { data: occ }] = await Promise.all([
    db
      .from("units")
      .select("label, properties(name)")
      .eq("id", offer.unit_id)
      .maybeSingle<{ label: string; properties: { name: string | null } | null }>(),
    db
      .from("unit_occupancy")
      .select("tenant_name, tenant_email")
      .eq("unit_id", offer.unit_id)
      .maybeSingle<{ tenant_name: string | null; tenant_email: string | null }>(),
  ]);
  let email: string | null = occ?.tenant_email ?? null;
  let name: string | null = occ?.tenant_name ?? null;
  if (offer.resident_id) {
    const { data: p } = await db
      .from("profiles")
      .select("full_name, email")
      .eq("id", offer.resident_id)
      .maybeSingle<{ full_name: string | null; email: string | null }>();
    email = p?.email ?? email;
    name = p?.full_name ?? name;
  }
  if (!email) return { ok: false, error: "No tenant email on file for this unit." };

  const home = unit ? `${unit.properties?.name ? `${unit.properties.name} · ` : ""}${unit.label}` : "your home";
  const link = await signInLink(email, "/portal/renewal");
  const { subject, html } = renewalOfferEmail({
    firstName: name?.split(" ")[0] ?? "there",
    home,
    currentRentCents: offer.current_rent_cents,
    newRentCents: offer.new_rent_cents,
    termMonths: offer.term_months,
    effectiveDate: formatDate(offer.effective_date),
    link,
  });
  const res = await sendNotification({
    to: email,
    subject,
    html,
    meta: { kind: "renewal_offer", refType: "renewal", refId: offer.id },
  });
  if (!res.sent) return { ok: false, error: "Could not send the email." };

  await db
    .from("renewal_offers")
    .update({ status: offer.status === "draft" ? "sent" : offer.status, sent_at: new Date().toISOString() })
    .eq("id", offer.id);

  revalidatePath(`/admin/renewals/${offer.id}`);
  revalidatePath("/admin/renewals");
  return { ok: true, notice: `Offer emailed to ${email}.` };
}

/** Record how/when the paper notice was served. */
export async function markRenewalServed(
  _prev: RenewalState,
  form: FormData
): Promise<RenewalState> {
  const { profile } = await requireProfile("/admin/renewals");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const id = str(form.get("id"));
  const servedOn = str(form.get("served_on"));
  const method = str(form.get("method"));
  if (!id || !servedOn) return { ok: false, error: "Pick the date it was served." };

  const db = createAdminClient() as unknown as SupabaseClient;
  const { error } = await db
    .from("renewal_offers")
    .update({ notice_served_on: servedOn, served_method: method ?? "posted" })
    .eq("id", id);
  if (error) return { ok: false, error: "Could not save." };

  revalidatePath(`/admin/renewals/${id}`);
  return { ok: true, notice: "Service recorded." };
}

/** Withdraw an offer that hasn't been accepted. */
export async function withdrawRenewalOffer(form: FormData): Promise<void> {
  const { profile } = await requireProfile("/admin/renewals");
  if (!isStaff(profile)) return;

  const id = str(form.get("id"));
  if (!id) return;

  const db = createAdminClient() as unknown as SupabaseClient;
  await db
    .from("renewal_offers")
    .update({ status: "withdrawn" })
    .eq("id", id)
    .in("status", ["draft", "sent", "declined"]);

  revalidatePath(`/admin/renewals/${id}`);
  revalidatePath("/admin/renewals");
}

/** Apply an accepted offer to the tenancy right now. */
export async function applyRenewalNow(
  _prev: RenewalState,
  form: FormData
): Promise<RenewalState> {
  const { profile } = await requireProfile("/admin/renewals");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const id = str(form.get("id"));
  if (!id) return { ok: false, error: "Missing offer." };

  const ok = await applyRenewalOffer(id);
  if (!ok) return { ok: false, error: "Only an accepted, un-applied offer can be applied." };

  revalidatePath(`/admin/renewals/${id}`);
  revalidatePath("/admin/renewals");
  revalidatePath("/admin/rents");
  revalidatePath("/admin/rent-board");
  return { ok: true, notice: "New terms applied to the tenancy." };
}
