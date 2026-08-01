"use client";

import { useRouter } from "next/navigation";

/** "2026-08" → "August 2026". */
function periodLabel(p: string): string {
  const [y, m] = p.split("-").map(Number);
  if (!y || !m) return p;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Page-level month picker for the payments board. Navigates via ?period= so the
 * server re-renders the whole page (cards, community breakdown, and table) for
 * the chosen month. "all" shows the lifetime view.
 */
export function PaymentsMonthFilter({
  periods,
  selected,
}: {
  periods: string[];
  selected: string;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        Month
      </span>
      <select
        value={selected}
        onChange={(e) => router.push(`/admin/payments?period=${e.target.value}`)}
        className="rounded-lg border border-clay-deep bg-white px-3 py-1.5 text-sm text-ink"
      >
        {periods.map((p) => (
          <option key={p} value={p}>
            {periodLabel(p)}
          </option>
        ))}
        <option value="all">All months</option>
      </select>
    </label>
  );
}
