/**
 * Renewal application — rolls an ACCEPTED offer into the live tenancy.
 * Updates unit_occupancy (rent + lease window) AND the unit's active lease row
 * (billing prefers lease.rent_cents, so both must move together).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type RenewalOfferRow = {
  id: string;
  unit_id: string;
  status: string;
  new_rent_cents: number;
  effective_date: string;
  new_end_date: string | null;
  applied_at: string | null;
};

/** Apply one accepted offer to the tenancy. Returns true when applied. */
export async function applyRenewalOffer(offerId: string): Promise<boolean> {
  const db = createAdminClient() as unknown as SupabaseClient;

  const { data: offer } = await db
    .from("renewal_offers")
    .select("id, unit_id, status, new_rent_cents, effective_date, new_end_date, applied_at")
    .eq("id", offerId)
    .maybeSingle<RenewalOfferRow>();
  if (!offer || offer.status !== "accepted" || offer.applied_at) return false;

  // Tenancy record — drives the rent board, statements, and billing fallback.
  await db
    .from("unit_occupancy")
    .update({
      rent_cents: offer.new_rent_cents,
      lease_start_date: offer.effective_date,
      lease_end_date: offer.new_end_date,
    })
    .eq("unit_id", offer.unit_id);

  // Active lease — billing prefers this rent, so keep it in step.
  await db
    .from("leases")
    .update({ rent_cents: offer.new_rent_cents, end_date: offer.new_end_date })
    .eq("unit_id", offer.unit_id)
    .eq("status", "active");

  await db
    .from("renewal_offers")
    .update({ status: "applied", applied_at: new Date().toISOString() })
    .eq("id", offer.id);

  return true;
}

/**
 * Apply every accepted offer whose effective date has arrived. Called by the
 * daily cron (and safe to call any time — it's idempotent).
 */
export async function applyDueRenewals(): Promise<number> {
  const db = createAdminClient() as unknown as SupabaseClient;
  const today = new Date().toISOString().slice(0, 10);

  const { data: due } = await db
    .from("renewal_offers")
    .select("id")
    .eq("status", "accepted")
    .is("applied_at", null)
    .lte("effective_date", today)
    .returns<{ id: string }[]>();

  let applied = 0;
  for (const o of due ?? []) {
    if (await applyRenewalOffer(o.id)) applied++;
  }
  return applied;
}
