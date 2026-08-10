import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/email";
import {
  renderRentReportEmail,
  type ReportProperty,
  type ReportLate,
  type ReportPaid,
} from "@/lib/rent-report";

export const dynamic = "force-dynamic";

type ChargeRow = {
  id: string;
  unit_id: string | null;
  amount_cents: number;
  due_date: string | null;
  status: string;
  description: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};
type OccRow = { unit_id: string; tenant_name: string | null; tenant_phone: string | null };
type PaySum = { charge_id: string | null; amount_cents: number };
type PropAddrRow = {
  name: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
};

function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Scheduled owner rent report. Sends on the 3rd, 5th, and 8th of the month, then
 * every Monday thereafter until month-end. Emails collection stats, per-
 * community breakdown, and the list of late tenants to the owners.
 *
 * Auth: CRON_SECRET via `Authorization: Bearer` (Vercel Cron) or `?key=`.
 * `?force=1` bypasses the date gate + dedupe for manual testing.
 * Recipients: every owner account (profiles.role = 'owner') with an email, plus
 * any addresses in OWNER_REPORT_EMAILS — falls back to Craig if none.
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
  // Early nudges on the 3rd & 5th, end-of-grace on the 8th, then weekly (Mon).
  const shouldSend = day === 3 || day === 5 || day === 8 || (day > 8 && dow === 1);
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

  const [{ data: charges }, { data: occRows }, { data: propRows }] = await Promise.all([
    db
      .from("charges")
      .select(
        "id, unit_id, amount_cents, due_date, status, description, units:unit_id(label, properties(name))"
      )
      .eq("period", period)
      .neq("status", "void")
      .returns<ChargeRow[]>(),
    db.from("unit_occupancy").select("unit_id, tenant_name, tenant_phone").returns<OccRow[]>(),
    db
      .from("properties")
      .select("name, address_line1, city, state, postal_code")
      .returns<PropAddrRow[]>(),
  ]);

  // Community name → single-line address, for the grouped "late" headers.
  const addrByProperty = new Map<string, string>();
  for (const p of propRows ?? []) {
    if (!p.name) continue;
    const addr = [p.address_line1, p.city, p.state, p.postal_code].filter(Boolean).join(", ");
    if (addr) addrByProperty.set(p.name, addr);
  }

  const all = charges ?? [];
  if (all.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no charges for period", period });
  }

  const occByUnit = new Map<string, { name: string | null; phone: string | null }>();
  for (const o of occRows ?? []) occByUnit.set(o.unit_id, { name: o.tenant_name, phone: o.tenant_phone });

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
  const paidList: ReportPaid[] = [];
  let billedCents = 0;
  let collectedCents = 0;
  let outstandingCents = 0;
  let paidUnits = 0;

  // Aggregate PER UNIT, not per charge — a unit's rent + late fee reads as one
  // line ("$1,575 · rent + late fee"), and every count is a count of homes, so
  // the report never makes 4 late tenants look like 7.
  type UnitAgg = {
    property: string;
    unit: string;
    tenant: string;
    phone?: string;
    address?: string;
    billed: number;
    paid: number;
    remaining: number;
    maxDaysLate: number;
    owedParts: string[];
    paidParts: string[];
  };
  const units = new Map<string, UnitAgg>();

  for (const c of all) {
    const paid = paidByCharge.get(c.id) ?? 0;
    const remaining = Math.max(0, c.amount_cents - paid);
    const propName = c.units?.properties?.name ?? "Unassigned";
    const occ = c.unit_id ? occByUnit.get(c.unit_id) : null;
    const key = c.unit_id ?? c.id;

    const agg =
      units.get(key) ??
      {
        property: propName,
        unit: c.units?.label ?? "—",
        tenant: occ?.name ?? "—",
        phone: occ?.phone ?? undefined,
        address: addrByProperty.get(propName),
        billed: 0,
        paid: 0,
        remaining: 0,
        maxDaysLate: 0,
        owedParts: [],
        paidParts: [],
      };

    const label = (c.description ?? "charge").toLowerCase().includes("late fee")
      ? "late fee"
      : "rent";
    agg.billed += c.amount_cents;
    agg.paid += paid;
    agg.remaining += remaining;
    if (remaining > 0) {
      agg.owedParts.push(label);
      if (c.due_date && c.due_date < todayIso) {
        const days = Math.max(
          0,
          Math.floor((today.getTime() - new Date(c.due_date).getTime()) / 86_400_000)
        );
        agg.maxDaysLate = Math.max(agg.maxDaysLate, days);
      }
    } else if (paid > 0) {
      agg.paidParts.push(label);
    }
    units.set(key, agg);
  }

  const partsNote = (parts: string[]): string | undefined => {
    const uniq = [...new Set(parts)];
    return uniq.length > 1 || (uniq.length === 1 && uniq[0] === "late fee")
      ? uniq.sort().reverse().join(" + ") // "rent + late fee"
      : undefined;
  };

  for (const agg of units.values()) {
    billedCents += agg.billed;
    collectedCents += agg.paid;
    outstandingCents += agg.remaining;
    if (agg.remaining === 0) paidUnits += 1;

    const b =
      buckets.get(agg.property) ??
      { name: agg.property, paid: 0, total: 0, collectedCents: 0, outstandingCents: 0 };
    b.total += 1;
    b.collectedCents += agg.paid;
    b.outstandingCents += agg.remaining;
    if (agg.remaining === 0) b.paid += 1;
    buckets.set(agg.property, b);

    if (agg.remaining === 0 && agg.paid > 0) {
      paidList.push({
        property: agg.property,
        unit: agg.unit,
        tenant: agg.tenant,
        paidCents: agg.paid,
        address: agg.address,
        note: partsNote(agg.paidParts),
      });
    }

    if (agg.remaining > 0 && agg.maxDaysLate > 0) {
      late.push({
        property: agg.property,
        unit: agg.unit,
        tenant: agg.tenant,
        dueCents: agg.remaining,
        daysLate: agg.maxDaysLate,
        address: agg.address,
        phone: agg.phone,
        note: partsNote(agg.owedParts),
      });
    }
  }

  paidList.sort(
    (a, b) =>
      a.property.localeCompare(b.property) ||
      a.unit.localeCompare(b.unit, undefined, { numeric: true })
  );

  const properties = [...buckets.values()].sort((a, b) => a.name.localeCompare(b.name));
  late.sort(
    (a, b) =>
      a.property.localeCompare(b.property) ||
      a.unit.localeCompare(b.unit, undefined, { numeric: true })
  );

  // Trend: how much was collected by this same day last month (recorded on or
  // before the same day-of-month), so owners can gauge if they're on track.
  const lastDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastPeriod = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, "0")}`;
  const daysInLast = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  const cutoffDay = Math.min(today.getDate(), daysInLast);
  const cutoffIso = `${lastPeriod}-${String(cutoffDay).padStart(2, "0")}T23:59:59`;
  let lastMonthCollectedCents: number | null = null;
  const { data: lastCharges } = await db
    .from("charges")
    .select("id")
    .eq("period", lastPeriod)
    .neq("status", "void")
    .returns<{ id: string }[]>();
  const lastIds = (lastCharges ?? []).map((c) => c.id);
  if (lastIds.length > 0) {
    const { data: lastPays } = await db
      .from("payments")
      .select("amount_cents")
      .in("charge_id", lastIds)
      .eq("status", "succeeded")
      .lte("created_at", cutoffIso)
      .returns<{ amount_cents: number }[]>();
    lastMonthCollectedCents = (lastPays ?? []).reduce((s, p) => s + p.amount_cents, 0);
  }
  const lastMonthLabel = lastDate.toLocaleDateString("en-US", { month: "long" });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://38thaveproperties.com").replace(/\/$/, "");
  const { subject, html } = renderRentReportEmail({
    periodLabel: periodLabel(period),
    reportDate: today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    billedCents,
    collectedCents,
    outstandingCents,
    paidUnits,
    totalUnits: units.size,
    lateCount: late.length,
    pctCollected: billedCents > 0 ? Math.round((collectedCents / billedCents) * 100) : 0,
    properties,
    late,
    paid: paidList,
    lastMonthCollectedCents,
    lastMonthLabel,
    appUrl,
  });

  // Recipients: every owner account with an email, plus any env overrides.
  const { data: owners } = await db
    .from("profiles")
    .select("email")
    .eq("role", "owner")
    .not("email", "is", null)
    .returns<{ email: string | null }[]>();
  const ownerEmails = (owners ?? []).map((o) => o.email?.trim()).filter(Boolean) as string[];
  const envEmails = (process.env.OWNER_REPORT_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const recipientList = [...new Set([...ownerEmails, ...envEmails])];
  const recipients = recipientList.length ? recipientList.join(",") : "craigcarda2@gmail.com";

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
