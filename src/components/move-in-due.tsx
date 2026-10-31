import { formatCents, formatDate } from "@/lib/format";
import { RENT_DROPBOX } from "@/lib/rent-dropbox";
import type { Prorate } from "@/lib/prorate";

function Line({
  what,
  note,
  amount,
  paid,
}: {
  what: string;
  note?: string | null;
  amount: number;
  paid: number;
}) {
  const settled = paid >= amount && amount > 0;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-clay/60 py-3 last:border-0">
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-ink">
          {settled && <span className="mr-1.5 text-pine">✓</span>}
          {what}
        </div>
        {note && <div className="mt-0.5 text-[13px] text-ink-faint">{note}</div>}
        {paid > 0 && !settled && (
          <div className="mt-0.5 text-[13px] text-pine">{formatCents(paid)} received so far</div>
        )}
      </div>
      <div
        className={`shrink-0 text-right text-base font-semibold tabular-nums ${
          settled ? "text-ink-faint line-through" : "text-ink"
        }`}
      >
        {formatCents(amount)}
      </div>
    </div>
  );
}

/**
 * What's owed before the keys change hands, with the arithmetic shown.
 *
 * A part month that arrives as a bare number looks like a mistake, and the
 * call that follows — "why isn't it the full rent?" — costs more than the two
 * lines it takes to explain. So the daily rate and the day count are on the
 * page, not behind a question.
 */
export function MoveInDue({
  proration,
  rentCents,
  depositCents,
  totalCents,
  rentPaidCents,
  depositReceivedCents,
  monthlyRentCents,
}: {
  proration: Prorate | null;
  rentCents: number;
  depositCents: number;
  totalCents: number;
  rentPaidCents: number;
  depositReceivedCents: number;
  monthlyRentCents: number | null;
}) {
  const outstanding = Math.max(0, totalCents - rentPaidCents - depositReceivedCents);
  const partMonth = proration && !proration.isWholeMonth;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-clay bg-white px-4 py-1">
        <Line
          what="First month's rent"
          note={
            partMonth
              ? `${formatCents(Math.round(proration.dailyCents))} a day × ${proration.days} days — you only pay for the days you're here`
              : "Your first full month"
          }
          amount={rentCents}
          paid={rentPaidCents}
        />
        {depositCents > 0 && (
          <Line
            what="Security deposit"
            note="Held while you live here, and returned when you move out"
            amount={depositCents}
            paid={depositReceivedCents}
          />
        )}
      </div>

      <div className="flex items-baseline justify-between gap-4 rounded-xl bg-sand/60 px-4 py-3">
        <div className="text-base font-semibold text-ink">
          {outstanding > 0 ? "Total to bring" : "All received"}
        </div>
        <div className="font-display text-2xl font-bold text-pine tabular-nums">
          {formatCents(outstanding > 0 ? outstanding : totalCents)}
        </div>
      </div>

      {partMonth && monthlyRentCents && (
        <p className="text-sm text-ink-soft">
          After that, rent is <strong className="text-ink">{formatCents(monthlyRentCents)}</strong>{" "}
          on the 1st of each month, starting {formatDate(proration.firstFullMonthOn)}.
        </p>
      )}

      {outstanding > 0 && (
        <div className="rounded-xl border border-pine/30 bg-pine/5 p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">How to pay it</div>
          <div className="mt-1 text-lg font-semibold text-ink">
            Check or money order, payable to {RENT_DROPBOX.payee}
          </div>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
            Bring it when you come to sign the lease and collect your keys — Craig will be
            there to sign with you. Two money orders is fine if that&apos;s easier, as long as
            they add up.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            Or drop it at the office: <strong className="text-ink">{RENT_DROPBOX.full}</strong>.
            Please write your unit number on it.
          </p>
          <p className="mt-2 text-[13px] text-ink-faint">
            This page updates as soon as we&apos;ve recorded it — you don&apos;t need to send
            us a receipt.
          </p>
        </div>
      )}
    </div>
  );
}
