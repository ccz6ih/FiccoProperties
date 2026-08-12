import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/email";
import { getUnitRecipients } from "@/lib/unit-recipients";
import { renderReminderEmail, type ReminderStage } from "@/lib/rent-reminder";
import { applyDueRenewals } from "@/lib/renewals";

export const dynamic = "force-dynamic";

type ChargeRow = {
  id: string;
  unit_id: string | null;
  amount_cents: number;
  resident_id: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};
type OccRow = { unit_id: string; tenant_name: string | null; tenant_email: string | null };
type PaySum = { charge_id: string | null; amount_cents: number };

function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Tenant rent-reminder ladder. Off a daily Vercel cron, sends:
 *   • the 1st  → "rent is due"        (everyone with a charge this month)
 *   • the 3rd  → friendly follow-up   (only those still unpaid)
 *   • the 6th  → grace-ends-tomorrow  (only those still unpaid)
 * One email per unit (its total still owed). Deduped per stage/day via
 * report_log. Auth: CRON_SECRET (Bearer or ?key=). ?force=1&stage=due|followup|
 * grace bypasses the date gate + dedupe for testing.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const authed =
    !secret || req.headers.get("authorization") === `Bearer ${secret}` || key === secret;
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  // Piggyback on the daily run: roll any accepted renewals whose effective
  // date has arrived into the tenancy (idempotent; never blocks reminders).
  try {
    await applyDueRenewals();
  } catch {
    /* best-effort */
  }

  const force = url.searchParams.get("force") === "1";
  const today = new Date();
  const day = today.getDate();

  const byDay: Record<number, ReminderStage> = { 1: "due", 3: "followup", 6: "grace" };
  const stageParam = url.searchParams.get("stage") as ReminderStage | null;
  const stage: ReminderStage | null = force && stageParam ? stageParam : byDay[day] ?? null;
  if (!stage) return NextResponse.json({ ok: true, skipped: "not a reminder day", day });

  const db = createAdminClient() as unknown as SupabaseClient;
  const todayIso = today.toISOString().slice(0, 10);
  const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const kind = `rent_reminder_${stage}`;

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
      .select("id, unit_id, amount_cents, resident_id, profiles:resident_id(full_name, email), units:unit_id(label, properties(name))")
      .eq("period", period)
      .in("status", ["open", "past_due"])
      .returns<ChargeRow[]>(),
    db.from("unit_occupancy").select("unit_id, tenant_name, tenant_email").returns<OccRow[]>(),
  ]);

  const all = charges ?? [];
  if (all.length === 0) return NextResponse.json({ ok: true, skipped: "no open charges", period });

  const occByUnit = new Map<string, OccRow>();
  for (const o of occRows ?? []) occByUnit.set(o.unit_id, o);

  // Amount already paid per charge (so partials show the remaining balance).
  const paidByCharge = new Map<string, number>();
  const { data: pays } = await db
    .from("payments")
    .select("charge_id, amount_cents")
    .in("charge_id", all.map((c) => c.id))
    .eq("status", "succeeded")
    .returns<PaySum[]>();
  for (const p of pays ?? []) {
    if (p.charge_id) paidByCharge.set(p.charge_id, (paidByCharge.get(p.charge_id) ?? 0) + p.amount_cents);
  }

  // Group open balances by unit → one reminder per tenant.
  type Grp = { unitId: string; name: string; home: string; email: string | null; hasPortal: boolean; remaining: number };
  const groups = new Map<string, Grp>();
  for (const c of all) {
    if (!c.unit_id) continue;
    const remaining = Math.max(0, c.amount_cents - (paidByCharge.get(c.id) ?? 0));
    if (remaining <= 0) continue;
    const occ = occByUnit.get(c.unit_id) ?? null;
    const email = c.profiles?.email ?? occ?.tenant_email ?? null; // widened below
    const name = (c.profiles?.full_name ?? occ?.tenant_name ?? "there").split(" ")[0];
    const home = `${c.units?.properties?.name ?? ""} · ${c.units?.label ?? ""}`.trim();
    const g = groups.get(c.unit_id) ?? {
      unitId: c.unit_id,
      name,
      home,
      email,
      hasPortal: !!c.resident_id,
      remaining: 0,
    };
    g.remaining += remaining;
    if (c.resident_id) g.hasPortal = true;
    groups.set(c.unit_id, g);
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://38thaveproperties.com").replace(/\/$/, "");
  let sent = 0;
  let noEmail = 0;
  // Widen each unit's recipient to every address on the home (co-tenants).
  for (const g of groups.values()) {
    const recips = await getUnitRecipients(g.unitId);
    if (recips.to) g.email = recips.to;
  }

  for (const g of groups.values()) {
    if (!g.email) {
      noEmail += 1;
      continue;
    }
    const { subject, html } = renderReminderEmail({
      stage,
      name: g.name,
      home: g.home,
      monthLabel: monthLabel(period),
      amountCents: g.remaining,
      hasPortal: g.hasPortal,
      appUrl,
    });
    const { sent: ok } = await sendNotification({
      to: g.email,
      subject,
      html,
    });
    if (ok) sent += 1;
  }

  if (sent > 0 && !force) await db.from("report_log").upsert({ kind, sent_on: todayIso });

  return NextResponse.json({ ok: true, stage, period, sent, noEmail, candidates: groups.size });
}
