"use client";

import { useRouter } from "next/navigation";

/**
 * Month picker for the rent board. Navigates to ?period=YYYY-MM on change so the
 * server re-renders the board for that month (any month, past or future).
 */
export function RentBoardMonthNav({ period }: { period: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        Month
      </span>
      <input
        type="month"
        defaultValue={period}
        onChange={(e) => {
          const v = e.target.value;
          if (/^\d{4}-\d{2}$/.test(v)) router.push(`/admin/rent-board?period=${v}`);
        }}
        aria-label="Rent board month"
        className="rounded-lg border border-clay-deep bg-white px-3 py-1.5 text-sm text-ink"
      />
    </label>
  );
}
