/** Colorado caps a late fee at the GREATER of $50 or 5% of the overdue rent. */
export function lateFeeCapCents(overdueCents: number): number {
  return Math.max(5000, Math.round(overdueCents * 0.05));
}
