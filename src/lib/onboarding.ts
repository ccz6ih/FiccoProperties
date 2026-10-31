/**
 * Is this resident still working through their welcome steps?
 *
 * Gated on onboarding_completed_at, which migration 0060 backfilled for every
 * tenancy that already existed — so this is false for the residents who were
 * already here and true only for someone genuinely new.
 *
 * Wrapped in a try/catch because it runs in the portal layout, on every page:
 * if the column isn't there yet the nav should quietly not grow an extra item,
 * not take the whole portal down.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResidentUnitId } from "@/lib/occupancy";

export async function needsOnboarding(userId: string): Promise<boolean> {
  try {
    const unitId = await getResidentUnitId(userId);
    if (!unitId) return false;

    const db = createAdminClient() as unknown as SupabaseClient;
    const { data, error } = await db
      .from("unit_occupancy")
      .select("onboarding_completed_at")
      .eq("unit_id", unitId)
      .maybeSingle<{ onboarding_completed_at: string | null }>();

    if (error || !data) return false;
    return data.onboarding_completed_at == null;
  } catch {
    return false;
  }
}
