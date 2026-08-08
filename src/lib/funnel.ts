import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/** Ordered marketing-funnel steps, top to bottom. */
export const FUNNEL_STEPS = [
  "listing_view",
  "prequal_start",
  "prequal_complete",
  "application_start",
  "application_complete",
  "waitlist_join",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

const VIEW_STEPS = new Set<FunnelStep>(["listing_view", "prequal_start", "application_start"]);

/**
 * Record a funnel event (service role — the public site has no auth session).
 * View-type steps are deduped per session/step/property within 12h so a page
 * refresh doesn't inflate the top of the funnel. Best-effort by design.
 */
export async function logFunnelEvent(opts: {
  step: FunnelStep;
  sessionId?: string | null;
  propertyId?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient() as unknown as SupabaseClient;
    const sessionId = opts.sessionId?.slice(0, 64) || `srv-${crypto.randomUUID()}`;
    const propertyId = opts.propertyId || null;

    if (VIEW_STEPS.has(opts.step) && opts.sessionId) {
      const since = new Date(Date.now() - 12 * 3600_000).toISOString();
      let q = admin
        .from("funnel_events")
        .select("id", { head: true, count: "exact" })
        .eq("session_id", sessionId)
        .eq("step", opts.step)
        .gte("created_at", since);
      q = propertyId ? q.eq("property_id", propertyId) : q.is("property_id", null);
      const { count } = await q;
      if ((count ?? 0) > 0) return;
    }

    await admin.from("funnel_events").insert({
      session_id: sessionId,
      step: opts.step,
      property_id: propertyId,
    });
  } catch {
    // analytics must never break the flow
  }
}
