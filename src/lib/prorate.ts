/**
 * First month's rent, prorated from the move-in day.
 *
 * The convention was already set by the lease screen — days from the move-in
 * date through the end of that month, over the real number of days in it — and
 * is written into every existing charge description ("Prorated rent (5/30
 * days)"). This lifts it out so the resident's welcome page and the lease
 * screen can't drift apart: a tenant who is quoted one figure and billed
 * another has every right to be annoyed.
 */

export type Prorate = {
  /** Days they'll occupy, counting the move-in day itself. */
  days: number;
  daysInMonth: number;
  /** Rent for one day, kept unrounded for display of the working. */
  dailyCents: number;
  amountCents: number;
  /** "2026-11" — the billing period the charge belongs to. */
  period: string;
  /** The exact wording used on the charge, so the ledger matches the quote. */
  description: string;
  /** When the first FULL month falls due. */
  firstFullMonthOn: string;
  /** True when they move in on the 1st — nothing to prorate. */
  isWholeMonth: boolean;
};

export function prorateFirstMonth(moveInIso: string, rentCents: number): Prorate | null {
  const [y, m, d] = moveInIso.split("-").map(Number);
  if (!y || !m || !d || !Number.isFinite(rentCents) || rentCents <= 0) return null;

  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Math.max(1, daysInMonth - d + 1);
  const amountCents = Math.round((rentCents * days) / daysInMonth);

  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;

  return {
    days,
    daysInMonth,
    dailyCents: rentCents / daysInMonth,
    amountCents,
    period: `${y}-${String(m).padStart(2, "0")}`,
    description: `Prorated rent (${days}/${daysInMonth} days)`,
    firstFullMonthOn: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
    isWholeMonth: d === 1,
  };
}

/**
 * Everything owed before the keys change hands: the prorated first month plus
 * the deposit. Kept together because that's how it gets paid — one money order,
 * or two, handed over at the signing.
 */
export function moveInTotal(
  proration: Prorate | null,
  rentCents: number | null,
  depositCents: number | null
): { rentCents: number; depositCents: number; totalCents: number } {
  const rent = proration ? proration.amountCents : (rentCents ?? 0);
  const deposit = depositCents ?? 0;
  return { rentCents: rent, depositCents: deposit, totalCents: rent + deposit };
}
