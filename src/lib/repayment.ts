/** Repayment-plan schedule maths. Pure — no I/O. */

export type Cadence = "weekly" | "biweekly" | "monthly";

export type Installment = { seq: number; dueDate: string; amountCents: number };

export const CADENCE_LABEL: Record<Cadence, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

/** ISO date `n` cadence-steps after `startIso`. */
export function addCadence(startIso: string, n: number, cadence: Cadence): string {
  const d = new Date(`${startIso}T00:00:00`);
  if (cadence === "weekly") d.setDate(d.getDate() + n * 7);
  else if (cadence === "biweekly") d.setDate(d.getDate() + n * 14);
  else d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Split the financed balance (total − down payment) into `installments` equal
 * payments; the final installment absorbs any rounding remainder so the plan
 * sums exactly to the balance owed.
 */
export function buildSchedule(opts: {
  totalCents: number;
  downPaymentCents: number;
  installments: number;
  cadence: Cadence;
  startDate: string;
}): Installment[] {
  const financed = Math.max(0, opts.totalCents - opts.downPaymentCents);
  const n = Math.max(1, Math.floor(opts.installments));
  const base = Math.floor(financed / n);
  const items: Installment[] = [];
  let allocated = 0;
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const amount = isLast ? financed - allocated : base;
    allocated += amount;
    items.push({ seq: i + 1, dueDate: addCadence(opts.startDate, i, opts.cadence), amountCents: amount });
  }
  return items;
}
