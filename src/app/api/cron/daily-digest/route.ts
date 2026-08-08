import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDailyDigest } from "@/lib/daily-digest";
import { getOwnerRecipients } from "@/lib/owners";
import { sendNotification } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Owner digest — cron fires daily (~7am Mountain), but the digest only goes
 * out Monday / Wednesday / Friday, each edition covering everything since the
 * previous one. Auth: CRON_SECRET via `Authorization: Bearer` (Vercel Cron)
 * or `?key=`. `?force=1` bypasses the day gate + dedupe for manual testing.
 */
const SEND_DAYS = new Set([1]); // Mondays — one weekly edition covering the whole prior week

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const authed =
    !!secret && (auth === `Bearer ${secret}` || url.searchParams.get("key") === secret);
  if (!authed) return NextResponse.json({ ok: false }, { status: 401 });

  const force = url.searchParams.get("force") === "1";
  const kind = "daily_digest";
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  if (!force && !SEND_DAYS.has(now.getUTCDay())) {
    return NextResponse.json({ ok: true, skipped: "not Monday" });
  }

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

  // Cover everything since the previous edition (fallback inside the builder).
  const { data: last } = await db
    .from("report_log")
    .select("sent_on")
    .eq("kind", kind)
    .order("sent_on", { ascending: false })
    .limit(1)
    .maybeSingle<{ sent_on: string }>();
  const sinceIso = last?.sent_on ? `${last.sent_on}T13:00:00Z` : null;

  const { subject, html } = await buildDailyDigest(sinceIso);
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
