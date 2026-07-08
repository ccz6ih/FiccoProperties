import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The unit a resident account is linked to — co-tenant aware. Prefers the
 * unit_occupants membership (primary first), falling back to the legacy
 * unit_occupancy.occupant_profile_id for any account not yet migrated. Uses the
 * service-role client so a co-tenant resolves regardless of RLS.
 */
export async function getResidentUnitId(userId: string): Promise<string | null> {
  const admin = createAdminClient() as unknown as SupabaseClient;

  const { data: membership } = await admin
    .from("unit_occupants")
    .select("unit_id, is_primary")
    .eq("profile_id", userId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle<{ unit_id: string }>();
  if (membership?.unit_id) return membership.unit_id;

  const { data: occ } = await admin
    .from("unit_occupancy")
    .select("unit_id")
    .eq("occupant_profile_id", userId)
    .maybeSingle<{ unit_id: string | null }>();
  return occ?.unit_id ?? null;
}
