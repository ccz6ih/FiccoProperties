"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { formatCents } from "@/lib/format";
import {
  recordOfflinePayments,
  type AdminPaymentsState,
} from "@/app/(admin)/admin/payments/actions";

const initial: AdminPaymentsState = { ok: false };

export type BoardCharge = {
  id: string | null;
  name: string;
  unit: string;
  amountCents: number;
  status: "paid" | "open" | "overdue" | "unbilled" | "vacant";
  paidRef?: string | null;
};
export type BoardGroup = {
  property: string;
  charges: BoardCharge[];
  paid: number;
  total: number;
  collectedCents: number;
  outstandingCents: number;
};

const STATUS: Record<BoardCharge["status"], { dot: string; row: string; label: string; text: string }> = {
  paid: { dot: "bg-pine", row: "border-l-pine bg-pine/5", label: "Paid", text: "text-pine" },
  open: { dot: "bg-gold", row: "border-l-gold bg-gold/10", label: "Due", text: "text-ink-soft" },
  overdue: { dot: "bg-terracotta", row: "border-l-terracotta bg-terracotta-soft/40", label: "Overdue", text: "text-terracotta-dark" },
  unbilled: { dot: "bg-clay-deep", row: "border-l-clay-deep bg-sand/40", label: "Not billed", text: "text-ink-soft" },
  vacant: { dot: "bg-clay", row: "border-l-clay bg-cream", label: "Vacant", text: "text-ink-faint" },
};

const isMarkable = (c: BoardCharge) => !!c.id && (c.status === "open" || c.status === "overdue");

export function RentBoard({
  groups,
  periodLabel,
}: {
  groups: BoardGroup[];
  periodLabel: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState(recordOfflinePayments, initial);
  // When set, only this property prints; null = print everything.
  const [printOnly, setPrintOnly] = useState<string | null>(null);

  useEffect(() => {
    if (!printOnly) return;
    const reset = () => setPrintOnly(null);
    window.addEventListener("afterprint", reset, { once: true });
    window.print();
    return () => window.removeEventListener("afterprint", reset);
  }, [printOnly]);

  const markable = groups.flatMap((g) => g.charges.filter(isMarkable));
  const selectedRows = markable.filter((c) => c.id && selected.has(c.id));
  const selectedCents = selectedRows.reduce((s, c) => s + c.amountCents, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalPaid = groups.reduce((s, g) => s + g.paid, 0);
  const totalUnits = groups.reduce((s, g) => s + g.total, 0);
  const collected = groups.reduce((s, g) => s + g.collectedCents, 0);
  const outstanding = groups.reduce((s, g) => s + g.outstandingCents, 0);

  return (
    <form action={action}>
      {selectedRows.map((c) => (
        <input key={c.id} type="hidden" name="charge_ids" value={c.id!} />
      ))}

      {/* Overall summary + legend + print (hidden in print when printing one property) */}
      <div
        className={`mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-clay bg-cream p-5 ${
          printOnly ? "print:hidden" : ""
        }`}
      >
        <div>
          <div className="text-sm text-ink-soft">{periodLabel}</div>
          <div className="font-display text-2xl font-semibold text-ink">
            {totalPaid} of {totalUnits} paid
          </div>
          <div className="mt-1 flex flex-wrap gap-4 text-sm">
            <span className="text-pine">Collected {formatCents(collected)}</span>
            <span className="text-terracotta-dark">Outstanding {formatCents(outstanding)}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-wrap gap-3 text-xs text-ink-soft">
            <Legend dot="bg-pine" label="Paid" />
            <Legend dot="bg-gold" label="Due" />
            <Legend dot="bg-terracotta" label="Overdue" />
            <Legend dot="bg-clay" label="Vacant" />
          </div>
          <span className="print:hidden">
            <PrintButton label="Print all" />
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {groups.map((g) => {
          const pct = g.total > 0 ? Math.round((g.paid / g.total) * 100) : 0;
          const expectedCents = g.collectedCents + g.outstandingCents;
          return (
            <div
              key={g.property}
              className={`overflow-hidden rounded-2xl border border-clay print:overflow-visible print:rounded-none print:border-0 ${
                printOnly && printOnly !== g.property ? "print:hidden" : ""
              }`}
            >
              {/* Print-only header so a single-property printout is clearly labelled. */}
              <div className="hidden px-4 pt-4 print:block print:break-after-avoid">
                <div className="font-display text-lg font-semibold text-ink">
                  38th Ave Properties — {g.property}
                </div>
                <div className="text-sm text-ink-soft">Rent board · {periodLabel}</div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clay bg-sand/50 px-4 py-3 print:break-after-avoid">
                <div>
                  <div className="font-display text-base font-semibold text-ink">{g.property}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    <span className="font-medium text-ink-soft">{g.paid}/{g.total} paid</span>
                    <span className="text-pine">Collected {formatCents(g.collectedCents)}</span>
                    <span className="text-terracotta-dark">
                      Outstanding {formatCents(g.outstandingCents)}
                    </span>
                    <span className="text-ink-faint">Expected {formatCents(expectedCents)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-clay print:hidden">
                    <div className="h-full rounded-full bg-pine" style={{ width: `${pct}%` }} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrintOnly(g.property)}
                    className="whitespace-nowrap rounded-lg border border-clay-deep px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-sand print:hidden"
                  >
                    Print this
                  </button>
                </div>
              </div>
              <ul className="divide-y divide-clay">
                {g.charges.map((c, i) => {
                  const meta = STATUS[c.status];
                  return (
                    <li
                      key={c.id ?? `${g.property}-${i}`}
                      className={`flex items-center justify-between gap-3 border-l-4 px-4 py-2.5 break-inside-avoid ${meta.row}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {isMarkable(c) && (
                          <input
                            type="checkbox"
                            checked={selected.has(c.id!)}
                            onChange={() => toggle(c.id!)}
                            className="h-4 w-4 shrink-0 rounded border-clay-deep accent-pine print:hidden"
                            aria-label={`Mark ${c.name} paid`}
                          />
                        )}
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                        <span className="truncate text-sm font-medium text-ink">{c.name}</span>
                        <span className="shrink-0 text-xs text-ink-faint">{c.unit}</span>
                        {c.paidRef && (
                          <span className="shrink-0 rounded-full bg-pine/10 px-2 py-0.5 text-xs text-pine">
                            {c.paidRef}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className={`text-xs font-medium ${meta.text}`}>{meta.label}</span>
                        <span className="text-sm font-medium text-ink">{formatCents(c.amountCents)}</span>
                      </div>
                    </li>
                  );
                })}
                {g.charges.length === 0 && (
                  <li className="px-4 py-3 text-sm text-ink-faint">No charges.</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {selectedRows.length > 0 && (
        <div className="sticky bottom-4 z-30 mt-4 print:hidden">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-pine/30 bg-cream px-5 py-3 shadow-xl">
            <div className="text-sm">
              <span className="font-semibold text-ink">{selectedRows.length} selected</span>
              <span className="text-ink-faint"> · {formatCents(selectedCents)}</span>
              {state.error && <div className="text-xs text-terracotta-dark">{state.error}</div>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                name="method"
                defaultValue="Check"
                className="rounded-lg border border-clay-deep bg-white px-2 py-1.5 text-sm text-ink"
              >
                <option value="Check">Check</option>
                <option value="Money order">Money order</option>
                <option value="Cash">Cash</option>
                <option value="Other">Other</option>
              </select>
              <input
                name="reference"
                placeholder="Check / MO #"
                className="w-32 rounded-lg border border-clay-deep bg-white px-2 py-1.5 text-sm text-ink"
              />
              <Button type="submit" variant="primary" size="md" disabled={pending}>
                {pending ? "Recording…" : "Mark paid"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
