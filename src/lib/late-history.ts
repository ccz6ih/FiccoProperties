import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A home's record of paying rent late — month by month, how many days past due,
 * and whether a late fee was charged.
 *
 * Notices that rest on a pattern ("more than two late payments" under C.R.S.
 * 38-12-1303(3)(f)) are far stronger for showing the pattern than asserting it,
 * and a tenant who receives one deserves to see the months being counted rather
 * than a bare claim. Rent still unpaid counts as late as of today.
 */
export type LateMonth = {
  period: string; // "2026-08"
  dueDate: string; // ISO
  paidDate: string | null; // ISO, null while still unpaid
  daysLate: number;
  feeCents: number;
  stillOwed: boolean;
};

type ChargeRow = {
  id: string;
  period: string | null;
  description: string | null;
  due_date: string | null;
  status: string;
  amount_cents: number;
};

const daysBetween = (fromIso: string, toIso: string) =>
  Math.round(
    (new Date(`${toIso}T00:00:00`).getTime() - new Date(`${fromIso}T00:00:00`).getTime()) /
      86_400_000
  );

/**
 * Late months for a home, oldest first. `graceDays` mirrors the lease's 7-day
 * grace: a payment inside it isn't counted late.
 */
export async function getLateHistory(
  db: SupabaseClient,
  unitId: string,
  graceDays = 7
): Promise<LateMonth[]> {
  const { data: charges } = await db
    .from("charges")
    .select("id, period, description, due_date, status, amount_cents")
    .eq("unit_id", unitId)
    .neq("status", "void")
    .order("due_date", { ascending: true })
    .returns<ChargeRow[]>();

  const rows = charges ?? [];
  const rent = rows.filter(
    (c) => c.due_date && !(c.description ?? "").toLowerCase().includes("late fee")
  );
  if (rent.length === 0) return [];

  // When each rent charge was actually settled.
  const { data: payments } = await db
    .from("payments")
    .select("charge_id, created_at")
    .in(
      "charge_id",
      rent.map((c) => c.id)
    )
    .eq("status", "succeeded")
    .returns<{ charge_id: string | null; created_at: string }[]>();

  const paidOn = new Map<string, string>();
  for (const p of payments ?? []) {
    if (!p.charge_id) continue;
    const iso = p.created_at.slice(0, 10);
    const cur = paidOn.get(p.charge_id);
    if (!cur || iso < cur) paidOn.set(p.charge_id, iso); // first payment settles it
  }

  // Late fees charged for a period, so the notice can show what it cost them.
  const feeByPeriod = new Map<string, number>();
  for (const c of rows) {
    if (!(c.description ?? "").toLowerCase().includes("late fee")) continue;
    const key = c.period ?? "";
    feeByPeriod.set(key, (feeByPeriod.get(key) ?? 0) + c.amount_cents);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const out: LateMonth[] = [];

  for (const c of rent) {
    const due = c.due_date!;
    const paid = paidOn.get(c.id) ?? null;
    const settled = c.status === "paid" && paid;
    // Unpaid rent is late as of today; paid rent as of the day it landed.
    const asOf = settled ? paid! : todayIso;
    const daysLate = daysBetween(due, asOf);
    if (daysLate <= graceDays) continue;

    out.push({
      period: c.period ?? due.slice(0, 7),
      dueDate: due,
      paidDate: settled ? paid : null,
      daysLate,
      feeCents: feeByPeriod.get(c.period ?? "") ?? 0,
      stillOwed: !settled,
    });
  }

  return out;
}
