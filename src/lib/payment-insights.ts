/**
 * Per-resident payment insights used to make paying rent feel rewarding:
 * an on-time "streak" of consecutive fully-paid months, the total months paid,
 * and the lifetime amount paid. Shared by the receipt email, the portal
 * "paid up" moment, and the year-in-review.
 *
 * A month counts as "paid" when every charge billed for that period is fully
 * paid (charge.status === "paid"). The streak is the run of consecutive most-
 * recent billed months that are fully paid.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentInsights = {
  /** Consecutive most-recent billed months that are fully paid. */
  streak: number;
  /** Total distinct months fully paid. */
  monthsPaid: number;
  /** Lifetime succeeded payments, in cents. */
  totalPaidCents: number;
  /** Fully-paid periods (YYYY-MM), newest first. */
  paidPeriods: string[];
};

export async function getResidentPaymentInsights(
  db: SupabaseClient,
  residentId: string
): Promise<PaymentInsights> {
  const [{ data: charges }, { data: pays }] = await Promise.all([
    db
      .from("charges")
      .select("period, status")
      .eq("resident_id", residentId)
      .neq("status", "void")
      .returns<{ period: string | null; status: string }[]>(),
    db
      .from("payments")
      .select("amount_cents")
      .eq("resident_id", residentId)
      .eq("status", "succeeded")
      .returns<{ amount_cents: number }[]>(),
  ]);

  // Roll charges up per period: a period is "paid" only if all its charges are.
  const byPeriod = new Map<string, { total: number; paid: number }>();
  for (const c of charges ?? []) {
    if (!c.period) continue;
    const b = byPeriod.get(c.period) ?? { total: 0, paid: 0 };
    b.total += 1;
    if (c.status === "paid") b.paid += 1;
    byPeriod.set(c.period, b);
  }

  const periods = [...byPeriod.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const paidPeriods = periods
    .filter(([, b]) => b.total > 0 && b.paid === b.total)
    .map(([p]) => p);

  let streak = 0;
  for (const [, b] of periods) {
    if (b.total > 0 && b.paid === b.total) streak++;
    else break;
  }

  const totalPaidCents = (pays ?? []).reduce((s, p) => s + p.amount_cents, 0);
  return { streak, monthsPaid: paidPeriods.length, totalPaidCents, paidPeriods };
}
