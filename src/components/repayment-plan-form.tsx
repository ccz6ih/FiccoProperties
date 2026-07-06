"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { formatCents } from "@/lib/format";
import { buildSchedule, CADENCE_LABEL, type Cadence } from "@/lib/repayment";
import { createRepaymentPlan } from "@/app/(admin)/admin/repayment-plans/actions";

const input =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function RepaymentPlanForm({
  unitId,
  tenant,
  home,
  defaultTotalDollars,
  defaultStart,
}: {
  unitId: string;
  tenant: string;
  home: string;
  defaultTotalDollars: string;
  defaultStart: string;
}) {
  const [total, setTotal] = useState(defaultTotalDollars);
  const [down, setDown] = useState("0");
  const [installments, setInstallments] = useState("3");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [start, setStart] = useState(defaultStart);

  const totalCents = Math.round((Number(total) || 0) * 100);
  const downCents = Math.round((Number(down) || 0) * 100);
  const n = Math.max(1, Math.floor(Number(installments) || 1));
  const preview =
    totalCents > 0 && start
      ? buildSchedule({ totalCents, downPaymentCents: downCents, installments: n, cadence, startDate: start })
      : [];

  return (
    <form action={createRepaymentPlan} className="space-y-5">
      <input type="hidden" name="unit_id" value={unitId} />

      <div className="rounded-xl border border-clay bg-sand/40 px-4 py-3 text-sm text-ink-soft">
        <span className="font-medium text-ink">{tenant}</span> · {home}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ink">Balance to repay</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">$</span>
            <input name="total_dollars" type="number" min={0} step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} className={`${input} pl-6`} />
          </div>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ink">Down payment (optional)</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">$</span>
            <input name="down_dollars" type="number" min={0} step="0.01" value={down} onChange={(e) => setDown(e.target.value)} className={`${input} pl-6`} />
          </div>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ink">Number of installments</span>
          <input name="installments" type="number" min={1} max={12} value={installments} onChange={(e) => setInstallments(e.target.value)} className={input} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ink">Frequency</span>
          <select name="cadence" value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)} className={input}>
            <option value="monthly">{CADENCE_LABEL.monthly}</option>
            <option value="biweekly">{CADENCE_LABEL.biweekly}</option>
            <option value="weekly">{CADENCE_LABEL.weekly}</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ink">First installment due</span>
          <input name="start_date" type="date" value={start} onChange={(e) => setStart(e.target.value)} className={input} />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium text-ink">Notes (optional)</span>
          <input name="notes" type="text" placeholder="e.g. tenant requested; victim-survivor plan" className={input} />
        </label>
      </div>

      {preview.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-clay">
          <div className="border-b border-clay bg-sand/50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
            Preview · {preview.length} payment{preview.length === 1 ? "" : "s"}
            {downCents > 0 ? ` after ${formatCents(downCents)} down` : ""}
          </div>
          <ul className="divide-y divide-clay text-sm">
            {preview.slice(0, 12).map((p) => (
              <li key={p.seq} className="flex items-center justify-between px-4 py-2">
                <span className="text-ink-soft">#{p.seq} · {p.dueDate}</span>
                <span className="font-medium text-ink">{formatCents(p.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button type="submit" variant="primary">Create plan</Button>
    </form>
  );
}
