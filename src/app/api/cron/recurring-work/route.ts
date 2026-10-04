import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { raiseDueRecurringWork } from "@/lib/recurring-work";

export const dynamic = "force-dynamic";

/**
 * Raises the seasonal jobs whose lead window has opened — gutters, filters,
 * sprinkler blow-out. Runs every morning; `last_raised_on` is what stops a
 * daily run creating the same job over and over.
 *
 * Auth: CRON_SECRET via `Authorization: Bearer` (Vercel Cron) or `?key=`.
 * `?dry=1` reports what it would raise without creating anything.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const authed =
    !secret || auth === `Bearer ${secret}` || url.searchParams.get("key") === secret;
  if (!authed) return NextResponse.json({ ok: false }, { status: 401 });

  const db = createAdminClient() as unknown as SupabaseClient;

  // The table arrives with migration 0058; until that's run, do nothing rather
  // than fail the cron every morning.
  const { error: probe } = await db.from("recurring_work").select("id").limit(1);
  if (probe) {
    return NextResponse.json({ ok: true, skipped: "recurring_work not set up yet" });
  }

  if (url.searchParams.get("dry") === "1") {
    const { data } = await db
      .from("recurring_work")
      .select("title, months, day_of_month, lead_days, last_raised_on, active")
      .eq("active", true);
    return NextResponse.json({ ok: true, dryRun: true, schedules: data ?? [] });
  }

  const raised = await raiseDueRecurringWork(db);
  return NextResponse.json({ ok: true, raised: raised.length, items: raised });
}
