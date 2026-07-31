import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/email";
import {
  renderRentReportEmail,
  type ReportProperty,
  type ReportLate,
} from "@/lib/rent-report";

export const dynamic = "force-dynamic";

type ChargeRow = {
  id: string;
  unit_id: string | null;
  amount_cents: number;
  due_date: string | null;
  status: string;
  units: { label: string; properties: { name: string | null } | null } | null;
};
type OccRow = { unit_id: string; tenant_name: string | null };
type PaySum = { charge_id: string | null; amount_cents: number };

function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Scheduled owner rent report. Sends on the 8th of the month (after the 7th
 * grace period) and every Monday thereafter until month-end. Emails collection
 * stats, per-community breakdown, and the list of late tenants to the owners.
 *
 * Auth: CRON_SECRET via `Authorization: Bearer` (Vercel Cron) or `?key=`.
 * `?force=1` bypasses the date gate + dedupe for manual testing.
 * Recipients: OWNER_REPORT_EMAILS (comma-separated) — falls back to Craig.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const authed =
    !secret || req.headers.get("authorization") === `Bearer ${secret}` || key === secret;
  if (!authed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const force = url.searchParams.get("force") === "1";
  const today = new Date();
  const day = today.getDate();
  const dow = today.getDay(); // 0 Sun … 1 Mon
  const shouldSend = day === 8 || (day > 8 && dow === 1);
  if (!force && !shouldSend) {
    return NextResponse.json({ ok: true, skipped: "not a scheduled day", day, dow });
  }

  const db = createAdminClient() as unknown as SupabaseClient;
  const todayIso = today.toISOString().slice(0, 10);
  const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const kind = "rent_report";

  // Dedupe: at most one send per calendar day (unless forced).
  if (!force) {
    const { data: prior } = await db
      .from("report_log")
      .select("sent_on")
      .eq("kind", kind)
      .eq("sent_on", todayIso)
      .maybeSingle<{ sent_on: string }>();
    if (prior) return NextResponse.json({ ok: true, skipped: "already sent today" });
  }

  const [{ data: charges }, { data: occRows }] = await Promise.all([
    db
      .from("charges")
      .select(
        "id, unit_id, amount_cents, due_date, status, units:unit_id(label, properties(name))"
      )
      .eq("period", period)
      .neq("status", "void")
      .returns<ChargeRow[]>(),
    db.from("unit_occupancy").select("unit_id, tenant_name").returns<OccRow[]>(),
  ]);

  const all = charges ?? [];
  if (all.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no charges for period", period });
  }

  const occByUnit = new Map<string, string | null>();
  for (const o of occRows ?? []) occByUnit.set(o.unit_id, o.tenant_name);

  // Actual money recorded per charge (supports partials).
  const paidByCharge = new Map<string, number>();
  const { data: paySums } = await db
    .from("payments")
    .select("charge_id, amount_cents")
    .in("charge_id", all.map((c) => c.id))
    .eq("status", "succeeded")
    .returns<PaySum[]>();
  for (const p of paySums ?? []) {
    if (!p.charge_id) continue;
    paidByCharge.set(p.charge_id, (paidByCharge.get(p.charge_id) ?? 0) + p.amount_cents);
  }

  type Bucket = ReportProperty;
  const buckets = new Map<string, Bucket>();
  const late: ReportLate[] = [];
  let billedCents = 0;
  let collectedCents = 0;
  let outstandingCents = 0;
  let paidUnits = 0;

  for (const c of all) {
    const paid = paidByCharge.get(c.id) ?? 0;
    const remaining = Math.max(0, c.amount_cents - paid);
    const propName = c.units?.properties?.name ?? "Unassigned";

    billedCents += c.amount_cents;
    collectedCents += paid;
    outstandingCents += remaining;
    if (remaining === 0) paidUnits += 1;

    const b =
      buckets.get(propName) ??
      { name: propName, paid: 0, total: 0, collectedCents: 0, outstandingCents: 0 };
    b.total += 1;
    b.collectedCents += paid;
    b.outstandingCents += remaining;
    if (remaining === 0) b.paid += 1;
    buckets.set(propName, b);

    if (remaining > 0 && c.due_date && c.due_date < todayIso) {
      const ms = today.getTime() - new Date(c.due_date).getTime();
      late.push({
        property: propName,
        unit: c.units?.label ?? "—",
        tenant: (c.unit_id ? occByUnit.get(c.unit_id) : null) ?? "—",
        dueCents: remaining,
        daysLate: Math.max(0, Math.floor(ms / 86_400_000)),
      });
    }
  }

  const properties = [...buckets.values()].sort((a, b) => a.name.localeCompare(b.name));
  late.sort(
    (a, b) =>
      a.property.localeCompare(b.property) ||
      a.unit.localeCompare(b.unit, undefined, { numeric: true })
  );

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://38thaveproperties.com").replace(/\/$/, "");
  const { subject, html } = renderRentReportEmail({
    periodLabel: periodLabel(period),
    reportDate: today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    billedCents,
    collectedCents,
    outstandingCents,
    paidUnits,
    totalUnits: all.length,
    lateCount: late.length,
    pctCollected: billedCents > 0 ? Math.round((collectedCents / billedCents) * 100) : 0,
    properties,
    late,
    appUrl,
  });

  const recipients = process.env.OWNER_REPORT_EMAILS || "craigcarda2@gmail.com";
  const { sent } = await sendNotification({
    to: recipients,
    subject,
    html,
  });

  if (sent && !force) {
    await db.from("report_log").upsert({ kind, sent_on: todayIso });
  }

  return NextResponse.json({
    ok: true,
    sent,
    period,
    recipients: recipients.split(",").length,
    lateCount: late.length,
    collectedCents,
  });
}
