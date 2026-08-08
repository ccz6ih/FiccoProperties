import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDailyDigest } from "@/lib/daily-digest";
import { getOwnerRecipients } from "@/lib/owners";
import { sendNotification } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Owner morning digest — runs daily via Vercel Cron (~7am Mountain).
 * Auth: CRON_SECRET via `Authorization: Bearer` (Vercel Cron) or `?key=`.
 * `?force=1` bypasses the once-a-day dedupe for manual testing.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const authed =
    !!secret && (auth === `Bearer ${secret}` || url.searchParams.get("key") === secret);
  if (!authed) return NextResponse.json({ ok: false }, { status: 401 });

  const force = url.searchParams.get("force") === "1";
  const kind = "daily_digest";
  const todayIso = new Date().toISOString().slice(0, 10);

  const db = createAdminClient() as unknown as SupabaseClient;
  if (!force) {
    const { data: already } = await db
      .from("report_log")
      .select("id")
      .eq("kind", kind)
      .eq("sent_on", todayIso)
      .maybeSingle<{ id: string }>();
    if (already) return NextResponse.json({ ok: true, skipped: "already sent today" });
  }

  const { subject, html } = await buildDailyDigest();
  const recipients = await getOwnerRecipients();
  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, error: "no recipients" }, { status: 500 });
  }

  const res = await sendNotification({
    to: recipients.join(","),
    subject,
    html,
    meta: { kind: "daily_digest" },
  });
  if (!res.sent) return NextResponse.json({ ok: false, error: "send failed" }, { status: 500 });

  await db.from("report_log").upsert({ kind, sent_on: todayIso });
  return NextResponse.json({ ok: true, sentTo: recipients.length });
}
