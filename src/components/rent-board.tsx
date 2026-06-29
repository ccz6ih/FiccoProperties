"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { formatCents } from "@/lib/format";
import {
  recordOfflinePayments,
  type AdminPaymentsState,
} from "@/app/(admin)/admin/payments/actions";

const initial: AdminPaymentsState = { ok: false };

export type BoardCharge = {
  id: string;
  name: string;
  unit: string;
  amountCents: number;
  status: "paid" | "open" | "overdue";
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
};

export function RentBoard({
  groups,
  periodLabel,
}: {
  groups: BoardGroup[];
  periodLabel: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState(recordOfflinePayments, initial);

  const unpaid = groups.flatMap((g) => g.charges.filter((c) => c.status !== "paid"));
  const selectedRows = unpaid.filter((c) => selected.has(c.id));
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
        <input key={c.id} type="hidden" name="charge_ids" value={c.id} />
      ))}

      {/* Overall summary + legend + print */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-clay bg-cream p-5">
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
          </div>
          <span className="print:hidden">
            <PrintButton label="Print" />
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {groups.map((g) => {
          const pct = g.total > 0 ? Math.round((g.paid / g.total) * 100) : 0;
          return (
            <div key={g.property} className="break-inside-avoid overflow-hidden rounded-2xl border border-clay">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clay bg-sand/50 px-4 py-3">
                <div>
                  <div className="font-display text-base font-semibold text-ink">{g.property}</div>
                  <div className="text-xs text-ink-faint">
                    {g.paid}/{g.total} paid · {formatCents(g.collectedCents)} in ·{" "}
                    {formatCents(g.outstandingCents)} out
                  </div>
                </div>
                <div className="h-2 w-32 overflow-hidden rounded-full bg-clay">
                  <div className="h-full rounded-full bg-pine" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <ul className="divide-y divide-clay">
                {g.charges.map((c) => {
                  const meta = STATUS[c.status];
                  return (
                    <li
                      key={c.id}
                      className={`flex items-center justify-between gap-3 border-l-4 px-4 py-2.5 ${meta.row}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {c.status !== "paid" && (
                          <input
                            type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() => toggle(c.id)}
                            className="h-4 w-4 shrink-0 rounded border-clay-deep accent-pine print:hidden"
                            aria-label={`Mark ${c.name} paid`}
                          />
                        )}
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                        <span className="truncate text-sm font-medium text-ink">{c.name}</span>
                        <span className="shrink-0 text-xs text-ink-faint">{c.unit}</span>
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
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 rounded-2xl border border-pine/30 bg-cream px-5 py-3 shadow-xl">
            <div className="text-sm">
              <span className="font-semibold text-ink">{selectedRows.length} selected</span>
              <span className="text-ink-faint"> · {formatCents(selectedCents)}</span>
              {state.error && <div className="text-xs text-terracotta-dark">{state.error}</div>}
            </div>
            <Button type="submit" variant="primary" size="md" disabled={pending}>
              {pending ? "Recording…" : "Mark selected as paid"}
            </Button>
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
