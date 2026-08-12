/**
 * Everyone who should receive tenant mail for a unit — the tenancy's contact
 * email PLUS every linked resident account (co-tenants). A household where a
 * couple each gave an address gets both copies of receipts, reminders, and
 * notices instead of one spouse having to forward everything.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type UnitRecipients = {
  /** Distinct, lowercase addresses. Empty when nothing is on file. */
  emails: string[];
  /** Comma-joined for sendNotification's `to`, or null when empty. */
  to: string | null;
  /** Best display name for greetings (tenancy name, else the primary account). */
  name: string | null;
};

export async function getUnitRecipients(unitId: string | null): Promise<UnitRecipients> {
  const empty: UnitRecipients = { emails: [], to: null, name: null };
  if (!unitId) return empty;

  const db = createAdminClient() as unknown as SupabaseClient;

  const [{ data: occ }, { data: links }] = await Promise.all([
    db
      .from("unit_occupancy")
      .select("tenant_name, tenant_email, occupant_profile_id")
      .eq("unit_id", unitId)
      .maybeSingle<{ tenant_name: string | null; tenant_email: string | null; occupant_profile_id: string | null }>(),
    db
      .from("unit_occupants")
      .select("profile_id, is_primary")
      .eq("unit_id", unitId)
      .returns<{ profile_id: string; is_primary: boolean }[]>(),
  ]);

  const profileIds = [
    ...new Set(
      [occ?.occupant_profile_id, ...(links ?? []).map((l) => l.profile_id)].filter(
        (v): v is string => !!v
      )
    ),
  ];

  let profiles: { id: string; full_name: string | null; email: string | null }[] = [];
  if (profileIds.length > 0) {
    const { data } = await db
      .from("profiles")
      .select("id, full_name, email")
      .in("id", profileIds)
      .returns<{ id: string; full_name: string | null; email: string | null }[]>();
    profiles = data ?? [];
  }

  const seen = new Set<string>();
  const emails: string[] = [];
  const add = (raw: string | null | undefined) => {
    const e = raw?.trim().toLowerCase();
    if (!e || seen.has(e)) return;
    seen.add(e);
    emails.push(e);
  };

  add(occ?.tenant_email);
  for (const p of profiles) add(p.email);

  const primaryId =
    (links ?? []).find((l) => l.is_primary)?.profile_id ?? occ?.occupant_profile_id ?? null;
  const primaryName = profiles.find((p) => p.id === primaryId)?.full_name ?? null;

  return {
    emails,
    to: emails.length > 0 ? emails.join(",") : null,
    name: occ?.tenant_name ?? primaryName,
  };
}
