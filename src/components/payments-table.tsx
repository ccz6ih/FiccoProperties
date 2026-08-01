"use client";

import { Fragment, useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { StatusPill } from "@/components/dashboard-ui";
import { PaymentReceipt } from "@/components/payment-receipt-form";
import { formatCents, formatDate } from "@/lib/format";
import {
  recordOfflinePayments,
  recordManualPayment,
  type AdminPaymentsState,
} from "@/app/(admin)/admin/payments/actions";

export type PaymentRow = {
  id: string;
  residentName: string | null;
  residentEmail: string | null;
  unit: string | null;
  property: string | null;
  paidCents: number;
  paidRef: string | null;
  description: string | null;
  period: string | null;
  dueDate: string | null;
  amountCents: number;
  status: string;
};

const initial: AdminPaymentsState = { ok: false };

const remainingOf = (c: PaymentRow) => Math.max(0, c.amountCents - c.paidCents);
const isOpenRow = (c: PaymentRow) => remainingOf(c) > 0 && c.status !== "void";

/** "2026-08" → "August 2026". */
function periodLabel(p: string): string {
  const [y, m] = p.split("-").map(Number);
  if (!y || !m) return p;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

const inputSm =
  "rounded-lg border border-clay-deep bg-white px-2 py-1.5 text-sm text-ink";

export function PaymentsTable({ charges }: { charges: PaymentRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [state, action, pending] = useActionState(recordOfflinePayments, initial);

  const propertyNames = [...new Set(charges.map((c) => c.property).filter(Boolean))] as string[];
  propertyNames.sort();
  const [activeProps, setActiveProps] = useState<Set<string>>(new Set());

  // Month filter — newest first. Default to the latest month so the board shows
  // one row per unit for the current period instead of every month at once.
  const periods = [...new Set(charges.map((c) => c.period).filter(Boolean))] as string[];
  periods.sort((a, b) => b.localeCompare(a));
  const [activePeriod, setActivePeriod] = useState<string>(periods[0] ?? "all");

  function toggleProp(name: string) {
    setSelected(new Set());
    setActiveProps((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const visible = charges.filter(
    (c) =>
      (activePeriod === "all" || c.period === activePeriod) &&
      (activeProps.size === 0 || (c.property != null && activeProps.has(c.property)))
  );

  const openRows = visible.filter(isOpenRow);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(openRows.map((c) => c.id)));
  }

  const selectedRows = openRows.filter((c) => selected.has(c.id));
  const selectedCount = selectedRows.length;
  const selectedCents = selectedRows.reduce((s, c) => s + remainingOf(c), 0);
  const allChecked = openRows.length > 0 && selectedCount === openRows.length;

  // Group the visible rows by property so the table reads as sections instead
  // of one long list. Order is preserved from the incoming (already sorted) rows.
  const groups: { property: string; rows: PaymentRow[] }[] = [];
  const groupIdx = new Map<string, number>();
  for (const c of visible) {
    const key = c.property ?? "—";
    let i = groupIdx.get(key);
    if (i === undefined) {
      i = groups.length;
      groupIdx.set(key, i);
      groups.push({ property: key, rows: [] });
    }
    groups[i].rows.push(c);
  }
  const showGroupHeaders = groups.length > 1;

  const renderRow = (c: PaymentRow) => {
    const open = isOpenRow(c);
    const checked = selected.has(c.id);
    const remaining = remainingOf(c);
    const partial = c.paidCents > 0 && remaining > 0;
    // Unit first — easiest to scan; name/email underneath.
    const namePrimary = c.unit ?? c.residentName ?? "—";
    const nameSub = [c.unit ? c.residentName : null, c.residentEmail]
      .filter(Boolean)
      .join(" · ");
    return (
      <Fragment key={c.id}>
        <tr className={checked ? "bg-pine/5" : "hover:bg-sand/30"}>
          <td className="px-5 py-3">
            {open ? (
              <input
                type="checkbox"
                aria-label={`Select ${namePrimary}`}
                checked={checked}
                onChange={() => toggle(c.id)}
                className="h-4 w-4 rounded border-clay-deep accent-pine"
              />
            ) : null}
          </td>
          <td className="px-5 py-3">
            <div className="font-medium text-ink">{namePrimary}</div>
            {nameSub && <div className="text-xs text-ink-faint">{nameSub}</div>}
          </td>
          <td className="px-5 py-3 text-ink-soft">{c.property ?? "—"}</td>
          <td className="px-5 py-3 text-ink-soft">{c.description ?? "Rent"}</td>
          <td className="px-5 py-3 text-ink-soft">{c.period ?? "—"}</td>
          <td className="px-5 py-3 text-ink-soft">{formatDate(c.dueDate)}</td>
          <td className="px-5 py-3 font-medium text-ink">
            {formatCents(c.amountCents)}
            {partial && (
              <div className="text-xs font-normal text-terracotta-dark">
                {formatCents(c.paidCents)} paid · {formatCents(remaining)} due
              </div>
            )}
          </td>
          <td className="px-5 py-3">
            {remaining === 0 ? (
              <StatusPill value="paid" />
            ) : partial ? (
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold">
                Partial
              </span>
            ) : (
              <StatusPill value={c.status} />
            )}
          </td>
          <td className="px-5 py-3 text-right">
            {open ? (
              <button
                type="button"
                onClick={() => setExpandedId((prev) => (prev === c.id ? null : c.id))}
                className="whitespace-nowrap text-xs font-medium text-pine hover:underline"
              >
                {expandedId === c.id ? "Close" : "Record…"}
              </button>
            ) : remaining === 0 && c.status !== "void" ? (
              <div className="flex justify-end">
                <PaymentReceipt chargeId={c.id} note={c.paidRef} compact />
              </div>
            ) : null}
          </td>
        </tr>
        {expandedId === c.id && (
          <tr className="bg-sand/30">
            <td colSpan={9} className="px-5 py-3">
              <RecordPaymentForm charge={c} remaining={remaining} />
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  return (
    <div>
      {(periods.length > 0 || propertyNames.length > 1) && (
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          {periods.length > 0 && (
            <label className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                Month
              </span>
              <select
                value={activePeriod}
                onChange={(e) => {
                  setSelected(new Set());
                  setActivePeriod(e.target.value);
                }}
                className={inputSm}
              >
                {periods.map((p) => (
                  <option key={p} value={p}>
                    {periodLabel(p)}
                  </option>
                ))}
                <option value="all">All months</option>
              </select>
            </label>
          )}

          {propertyNames.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                Community
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelected(new Set());
                  setActiveProps(new Set());
                }}
                aria-pressed={activeProps.size === 0}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                  activeProps.size === 0
                    ? "border-pine bg-pine text-cream"
                    : "border-clay-deep bg-white/70 text-ink-soft hover:bg-sand"
                }`}
              >
                All
              </button>
              {propertyNames.map((name) => {
                const on = activeProps.has(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleProp(name)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                      on
                        ? "border-pine bg-pine text-cream"
                        : "border-clay-deep bg-white/70 text-ink-soft hover:bg-sand"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-clay bg-cream">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="w-10 px-5 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all unpaid"
                    checked={allChecked}
                    onChange={toggleAll}
                    disabled={openRows.length === 0}
                    className="h-4 w-4 rounded border-clay-deep accent-pine"
                  />
                </th>
                <th className="px-5 py-3 font-medium">Unit</th>
                <th className="px-5 py-3 font-medium">Community</th>
                <th className="px-5 py-3 font-medium">Charge</th>
                <th className="px-5 py-3 font-medium">Period</th>
                <th className="px-5 py-3 font-medium">Due</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-clay">
              {groups.map((g) => {
                const groupDue = g.rows.reduce((s, r) => s + remainingOf(r), 0);
                const groupPaid = g.rows.filter((r) => remainingOf(r) === 0).length;
                return (
                  <Fragment key={`grp-${g.property}`}>
                    {showGroupHeaders && (
                      <tr className="border-t-2 border-clay bg-sand/70">
                        <td colSpan={9} className="px-5 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-display text-sm font-semibold text-ink">
                              {g.property}
                            </span>
                            <span className="text-xs text-ink-faint">
                              {groupPaid}/{g.rows.length} paid
                              {groupDue > 0 ? ` · ${formatCents(groupDue)} due` : ""}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {g.rows.map(renderRow)}
                  </Fragment>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-6 text-center text-sm text-ink-faint">
                    No charges for{" "}
                    {activePeriod === "all" ? "the selected community" : periodLabel(activePeriod)}
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCount > 0 && (
        <form action={action} className="sticky bottom-4 z-30 mt-4">
          {selectedRows.map((c) => (
            <input key={c.id} type="hidden" name="charge_ids" value={c.id} />
          ))}
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-pine/30 bg-cream px-5 py-3 shadow-xl">
            <div className="text-sm">
              <span className="font-semibold text-ink">
                {selectedCount} selected
              </span>
              <span className="text-ink-faint"> · {formatCents(selectedCents)}</span>
              {state.error && (
                <div className="text-xs text-terracotta-dark">{state.error}</div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select name="method" defaultValue="Check" className={inputSm}>
                <option value="Check">Check</option>
                <option value="Money order">Money order</option>
                <option value="Cash">Cash</option>
                <option value="Other">Other</option>
              </select>
              <input
                name="reference"
                placeholder="Check / MO #"
                className={`${inputSm} w-32`}
              />
              <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                <input type="checkbox" name="email_receipt" value="on" defaultChecked className="h-4 w-4 rounded border-clay-deep accent-pine" />
                Email receipt
              </label>
              <Button type="submit" variant="primary" size="md" disabled={pending}>
                {pending ? "Recording…" : "Mark paid in full"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

/** Inline recorder for a single charge — supports short/partial and overpayment. */
function RecordPaymentForm({
  charge,
  remaining,
}: {
  charge: PaymentRow;
  remaining: number;
}) {
  const [state, action, pending] = useActionState(recordManualPayment, initial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="charge_id" value={charge.id} />
      <label className="space-y-1">
        <span className="block text-xs font-medium text-ink-soft">Amount</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
            $
          </span>
          <input
            type="number"
            name="amount_dollars"
            min={0}
            step="0.01"
            defaultValue={(remaining / 100).toFixed(2)}
            className={`${inputSm} w-28 pl-6`}
          />
        </div>
      </label>
      <label className="space-y-1">
        <span className="block text-xs font-medium text-ink-soft">Method</span>
        <select name="method" defaultValue="Check" className={inputSm}>
          <option value="Check">Check</option>
          <option value="Money order">Money order</option>
          <option value="Cash">Cash</option>
          <option value="Other">Other</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="block text-xs font-medium text-ink-soft">Check / MO #</span>
        <input name="reference" placeholder="Optional" className={`${inputSm} w-36`} />
      </label>
      <label className="flex items-center gap-1.5 pb-2 text-xs text-ink-soft">
        <input type="checkbox" name="email_receipt" value="on" defaultChecked className="h-4 w-4 rounded border-clay-deep accent-pine" />
        Email receipt
      </label>
      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Recording…" : "Record payment"}
      </Button>
      {state.error && (
        <span className="text-xs text-terracotta-dark">{state.error}</span>
      )}
      {state.ok && state.notice && (
        <span className="text-xs font-medium text-pine">{state.notice}</span>
      )}
    </form>
  );
}
