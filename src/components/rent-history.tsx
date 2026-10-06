import Link from "next/link";
import { Card } from "@/components/ui";
import { formatCents, formatDate } from "@/lib/format";
import type { RentHistory as RentHistoryData } from "@/lib/rent-history";

/**
 * Rent, month by month, with when it was actually paid.
 *
 * The question this answers is "have they been paying, and were they on time?",
 * so the paid date and the days-late sit next to the amount rather than being
 * something to work out. Shown on both the home and the resident, since that
 * question gets asked from either direction.
 */
export function RentHistory({
  history,
  unitId,
  limit = 14,
}: {
  history: RentHistoryData;
  unitId: string;
  limit?: number;
}) {
  const { rows, totalPaidCents, outstandingCents, lateCount, onTimeCount } = history;

  if (rows.length === 0) {
    return (
      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Rent history</h2>
        <p className="mt-1 text-sm text-ink-faint">
          Nothing billed to this home yet. It appears here once rent is generated.
        </p>
      </Card>
    );
  }

  const shown = rows.slice(0, limit);
  const settled = onTimeCount + lateCount;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-clay px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Rent history</h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            {formatCents(totalPaidCents)} paid
            {outstandingCents > 0 ? ` · ${formatCents(outstandingCents)} still owed` : " · nothing owed"}
            {settled > 0
              ? ` · ${onTimeCount} of ${settled} month${settled === 1 ? "" : "s"} on time`
              : ""}
          </p>
        </div>
        {/* A pattern of lateness is worth saying out loud, not leaving to be
            counted off the rows. */}
        {lateCount > 0 && (
          <span className="rounded-full bg-terracotta/15 px-2.5 py-1 text-xs font-medium text-terracotta-dark">
            {lateCount} paid late
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-clay text-left text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="px-5 py-2 font-medium">Month</th>
              <th className="px-5 py-2 font-medium">What</th>
              <th className="px-5 py-2 text-right font-medium">Amount</th>
              <th className="px-5 py-2 font-medium">Due</th>
              <th className="px-5 py-2 font-medium">Paid</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const unpaid = r.remainingCents > 0;
              return (
                <tr key={r.id} className="border-b border-clay/60 align-top">
                  <td className="whitespace-nowrap px-5 py-2.5 font-medium text-ink">
                    {r.period ?? (r.dueDate ? formatDate(r.dueDate) : "—")}
                  </td>
                  <td className="px-5 py-2.5 text-ink-soft">
                    {r.description}
                    {r.reference && r.reference !== "offline" && (
                      <span className="block text-[11px] text-ink-faint">{r.reference}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums text-ink">
                    {formatCents(r.amountCents)}
                    {r.paidCents > 0 && unpaid && (
                      <span className="block text-[11px] text-ink-faint">
                        {formatCents(r.paidCents)} paid
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-ink-soft">
                    {r.dueDate ? formatDate(r.dueDate) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5">
                    {r.paidOn ? (
                      <>
                        <span className="text-ink-soft">{formatDate(r.paidOn)}</span>
                        <span
                          className={`block text-[11px] ${
                            r.daysLate > 7 ? "font-medium text-terracotta-dark" : "text-pine"
                          }`}
                        >
                          {r.daysLate === 0
                            ? "on the day"
                            : r.daysLate <= 7
                              ? `${r.daysLate} day${r.daysLate === 1 ? "" : "s"} — within grace`
                              : `${r.daysLate} days late`}
                        </span>
                      </>
                    ) : (
                      <span className="font-medium text-terracotta-dark">
                        Unpaid
                        {r.daysLate > 0 && (
                          <span className="block text-[11px] font-normal">
                            {r.daysLate} days past due
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > limit && (
        <div className="border-t border-clay px-5 py-2.5 text-center text-xs text-ink-faint">
          Showing the last {limit} of {rows.length} —{" "}
          <Link href={`/admin/case-file/${unitId}`} className="font-medium text-pine hover:underline">
            the full ledger is in the case file →
          </Link>
        </div>
      )}
    </Card>
  );
}
