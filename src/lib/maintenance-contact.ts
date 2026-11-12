/**
 * Who a maintenance message should actually reach.
 *
 * Both the scheduling email and the note composer used to email whoever
 * *raised* the request. That is right when a resident reports something
 * themselves, and wrong the rest of the time: staff log jobs on a tenant's
 * behalf constantly, and the notice then went to the member of staff who
 * typed it while the screen said "tenant notified".
 *
 * The Villa Unit 18 is the case that surfaced it — a visit booked for Monday
 * the 16th, confirmation emailed to the office, and Joshua Colby, who has an
 * address on file, never told anyone was coming to his home.
 *
 * So resolve the resident from the home first and treat the reporter as a last
 * resort, and say plainly which one it was so the screen cannot claim a
 * tenant was told when they were not.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type MaintenanceRecipient = {
  email: string;
  name: string | null;
  /** False when we fell back to the member of staff who logged it. */
  isResident: boolean;
};

async function emailOf(
  db: SupabaseClient,
  profileId: string | null | undefined
): Promise<{ email: string | null; name: string | null }> {
  if (!profileId) return { email: null, name: null };
  const { data } = await db
    .from("profiles")
    .select("email, full_name")
    .eq("id", profileId)
    .maybeSingle<{ email: string | null; full_name: string | null }>();
  return { email: data?.email ?? null, name: data?.full_name ?? null };
}

export async function maintenanceRecipient(
  db: SupabaseClient,
  unitId: string | null,
  reportedBy: string | null
): Promise<MaintenanceRecipient | null> {
  if (unitId) {
    const { data: occ } = await db
      .from("unit_occupancy")
      .select("tenant_name, tenant_email, occupant_profile_id")
      .eq("unit_id", unitId)
      .maybeSingle<{
        tenant_name: string | null;
        tenant_email: string | null;
        occupant_profile_id: string | null;
      }>();

    if (occ?.tenant_email) {
      return { email: occ.tenant_email, name: occ.tenant_name, isResident: true };
    }

    const linked = await emailOf(db, occ?.occupant_profile_id);
    if (linked.email) {
      return { email: linked.email, name: linked.name ?? occ?.tenant_name ?? null, isResident: true };
    }

    // Co-tenants: a household where the second name holds the account.
    const { data: members } = await db
      .from("unit_occupants")
      .select("profile_id, is_primary")
      .eq("unit_id", unitId)
      .order("is_primary", { ascending: false })
      .returns<{ profile_id: string; is_primary: boolean }[]>();
    for (const m of members ?? []) {
      const who = await emailOf(db, m.profile_id);
      if (who.email) return { email: who.email, name: who.name, isResident: true };
    }
  }

  // Nobody reachable at the home. Falling back to whoever raised it is better
  // than silence, but it is NOT the tenant and must not be reported as such.
  const reporter = await emailOf(db, reportedBy);
  if (reporter.email) {
    return { email: reporter.email, name: reporter.name, isResident: false };
  }
  return null;
}
