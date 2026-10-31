import Link from "next/link";
import { Card } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { FollowUp } from "@/lib/follow-ups";
import {
  markNoticeCured,
  markDepositSettled,
  markTurnComplete,
} from "@/app/(admin)/admin/follow-ups/actions";

type QuickKind = NonNullable<FollowUp["quick"]>["kind"];

const QUICK: Record<QuickKind, (form: FormData) => Promise<void>> = {
  notice_cured: markNoticeCured,
  deposit_settled: markDepositSettled,
  turn_complete: markTurnComplete,
};

const FIELD: Record<QuickKind, string> = {
  notice_cured: "notice_id",
  deposit_settled: "unit_id",
  turn_complete: "turn_id",
};

const TONE: Record<FollowUp["urgency"], { chip: string; label: string }> = {
  overdue: { chip: "bg-terracotta/20 text-terracotta-dark", label: "Overdue" },
  soon: { chip: "bg-gold/20 text-[#8a6a1f]", label: "Soon" },
  watch: { chip: "bg-sand text-ink-soft", label: "Keep an eye" },
};

/**
 * "What did I start that's still waiting on me."
 *
 * Deliberately a list of sentences rather than counts — a number tells you
 * there's a problem, a sentence tells you what to do about it, and the whole
 * reason these loops stayed open is that nobody had the second thing to hand.
 */
export function FollowUpsCard({
  items,
  limit = 6,
  showAllHref = "/admin/follow-ups",
}: {
  items: FollowUp[];
  limit?: number;
  showAllHref?: string;
}) {
  if (items.length === 0) {
    return (
      <Card className="mb-8 border-pine/30 bg-pine/5 p-5">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-lg">
            ✓
          </span>
          <h2 className="font-display text-lg font-semibold text-ink">Nothing hanging</h2>
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          No overdue notices, unsettled deposits or open turns. Everything you&apos;ve
          started has been finished.
        </p>
      </Card>
    );
  }

  const overdue = items.filter((i) => i.urgency === "overdue").length;
  const shown = items.slice(0, limit);

  return (
    <Card className="mb-8 overflow-hidden p-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-clay bg-sand/50 px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Waiting on you</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Things that were started and not closed off.
          </p>
        </div>
        {overdue > 0 && (
          <span className="rounded-full bg-terracotta/20 px-2.5 py-1 text-xs font-semibold text-terracotta-dark">
            {overdue} overdue
          </span>
        )}
      </div>

      <ul className="divide-y divide-clay">
        {shown.map((f) => (
          <li key={f.id} className="px-5 py-3.5">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      TONE[f.urgency].chip
                    }`}
                  >
                    {f.kind}
                  </span>
                  {f.onDate && (
                    <span className="text-[11px] text-ink-faint">{formatDate(f.onDate)}</span>
                  )}
                </div>
                <div className="mt-1 text-[15px] font-semibold text-ink">{f.title}</div>
                <div className="mt-0.5 text-sm leading-relaxed text-ink-soft">{f.detail}</div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {/* Closable right here. The work is nearly always already done
                    — what hasn't happened is the record catching up. */}
                {f.quick && (
                  <form action={QUICK[f.quick.kind]} className="flex items-center gap-1.5">
                    <input type="hidden" name={FIELD[f.quick.kind]} value={f.quick.target} />
                    {f.quick.kind === "turn_complete" && (
                      <input
                        type="date"
                        name="completed_on"
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        max={new Date().toISOString().slice(0, 10)}
                        title="The day the work was finished — not today, if they differ"
                        className="rounded-lg border border-clay-deep bg-white px-2 py-1 text-xs text-ink"
                      />
                    )}
                    <button
                      type="submit"
                      className="rounded-full bg-pine px-3 py-1.5 text-xs font-medium text-cream hover:bg-pine-dark"
                    >
                      ✓ {f.quick.label}
                    </button>
                  </form>
                )}
                <Link
                  href={f.href}
                  className="rounded-full border border-clay-deep px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand"
                >
                  {f.quick ? "Open it" : f.action} →
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {items.length > limit && (
        <div className="border-t border-clay px-5 py-2.5 text-center text-xs">
          <Link href={showAllHref} className="font-medium text-pine hover:underline">
            All {items.length} →
          </Link>
        </div>
      )}
    </Card>
  );
}
