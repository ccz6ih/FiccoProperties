/**
 * A home's rent history — every charge, what was paid against it, and when.
 *
 * The resident page listed only OPEN charges and the unit page had nothing at
 * all, so the ordinary question — "have they been paying, and were they on
 * time?" — could only be answered from the case file, which is laid out for a
 * court rather than for a glance.
 *
 * Keyed by unit rather than resident: charges always carry a unit, but a
 * record-only tenant has no account for them to hang off.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RentHistoryRow = {
  id: string;
  period: string | null;
  description: string;
  dueDate: string | null;
  amountCents: number;
  paidCents: number;
  remainingCents: number;
  /** When it was settled — the first payment that cleared it. */
  paidOn: string | null;
  /** Check or money-order reference, where one was recorded. */
  reference: string | null;
  status: string;
  /** Days past the due date it was settled, or stands unpaid today. */
  daysLate: number;
  isLateFee: boolean;
};

export type RentHistory = {
  rows: RentHistoryRow[];
  totalBilledCents: number;
  totalPaidCents: number;
  outstandingCents: number;
  /** Months settled after the grace period — the "are they reliable" number. */
  lateCount: number;
  onTimeCount: number;
};

const daysBetween = (from: string, to: string) =>
  Math.round(
    (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000
  );

export async function getRentHistory(
  db: SupabaseClient,
  unitId: string,
  graceDays = 7
): Promise<RentHistory> {
  const empty: RentHistory = {
    rows: [],
    totalBilledCents: 0,
    totalPaidCents: 0,
    outstandingCents: 0,
    lateCount: 0,
    onTimeCount: 0,
  };
  if (!unitId) return empty;

  const { data: charges } = await db
    .from("charges")
    .select("id, period, description, due_date, amount_cents, status")
    .eq("unit_id", unitId)
    .neq("status", "void")
    .order("due_date", { ascending: false })
    .returns<
      {
        id: string;
        period: string | null;
        description: string | null;
        due_date: string | null;
        amount_cents: number;
        status: string;
      }[]
    >();

  const list = charges ?? [];
  if (list.length === 0) return empty;

  const { data: payments } = await db
    .from("payments")
    .select("charge_id, amount_cents, created_at, provider_ref")
    .in(
      "charge_id",
      list.map((c) => c.id)
    )
    .eq("status", "succeeded")
    .returns<
      { charge_id: string | null; amount_cents: number; created_at: string; provider_ref: string | null }[]
    >();

  const paidByCharge = new Map<string, number>();
  const firstPaid = new Map<string, { on: string; ref: string | null }>();
  for (const p of payments ?? []) {
    if (!p.charge_id) continue;
    paidByCharge.set(p.charge_id, (paidByCharge.get(p.charge_id) ?? 0) + p.amount_cents);
    const on = p.created_at.slice(0, 10);
    const cur = firstPaid.get(p.charge_id);
    if (!cur || on < cur.on) firstPaid.set(p.charge_id, { on, ref: p.provider_ref });
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  let lateCount = 0;
  let onTimeCount = 0;

  const rows: RentHistoryRow[] = list.map((c) => {
    const paid = paidByCharge.get(c.id) ?? 0;
    const remaining = Math.max(0, c.amount_cents - paid);
    const settled = remaining === 0 && paid > 0;
    const paidOn = firstPaid.get(c.id)?.on ?? null;
    const isLateFee = (c.description ?? "").toLowerCase().includes("late fee");

    // Unpaid rent is "late" as of today; settled rent as of the day it landed.
    const daysLate = c.due_date
      ? Math.max(0, daysBetween(c.due_date, settled && paidOn ? paidOn : todayIso))
      : 0;

    // Only rent counts toward the reliability tally — a late fee's own due date
    // would double-count the month it came from.
    if (!isLateFee && c.due_date) {
      if (daysLate > graceDays) lateCount += 1;
      else if (settled) onTimeCount += 1;
    }

    return {
      id: c.id,
      period: c.period,
      description: c.description ?? "Charge",
      dueDate: c.due_date,
      amountCents: c.amount_cents,
      paidCents: paid,
      remainingCents: remaining,
      paidOn: settled ? paidOn : null,
      reference: firstPaid.get(c.id)?.ref ?? null,
      status: remaining === 0 ? "paid" : paid > 0 ? "partial" : c.status,
      daysLate,
      isLateFee,
    };
  });

  return {
    rows,
    totalBilledCents: rows.reduce((s, r) => s + r.amountCents, 0),
    totalPaidCents: rows.reduce((s, r) => s + r.paidCents, 0),
    outstandingCents: rows.reduce((s, r) => s + r.remainingCents, 0),
    lateCount,
    onTimeCount,
  };
}
