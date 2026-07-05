"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { StatusPill } from "@/components/dashboard-ui";
import { formatCents, formatDate } from "@/lib/format";
import {
  recordOfflinePayments,
  type AdminPaymentsState,
} from "@/app/(admin)/admin/payments/actions";

export type PaymentRow = {
  id: string;
  residentName: string | null;
  residentEmail: string | null;
  property: string | null;
  description: string | null;
  period: string | null;
  dueDate: string | null;
  amountCents: number;
  status: string;
};

const initial: AdminPaymentsState = { ok: false };

function isOpen(status: string) {
  return status === "open" || status === "past_due";
}

export function PaymentsTable({ charges }: { charges: PaymentRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState(recordOfflinePayments, initial);

  // Property filter (single or multi-select); empty set = show all.
  const propertyNames = [...new Set(charges.map((c) => c.property).filter(Boolean))] as string[];
  propertyNames.sort();
  const [activeProps, setActiveProps] = useState<Set<string>>(new Set());

  function toggleProp(name: string) {
    setSelected(new Set()); // clear row selection when the view changes
    setActiveProps((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const visible =
    activeProps.size === 0
      ? charges
      : charges.filter((c) => c.property && activeProps.has(c.property));

  const openRows = visible.filter((c) => isOpen(c.status));

  // Clear the selection once a batch is recorded (the paid rows fall away).
  useEffect(() => {
    if (state.ok) setSelected(new Set());
  }, [state]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === openRows.length && openRows.length > 0
        ? new Set()
        : new Set(openRows.map((c) => c.id))
    );
  }

  const selectedRows = openRows.filter((c) => selected.has(c.id));
  const selectedCount = selectedRows.length;
  const selectedCents = selectedRows.reduce((s, c) => s + c.amountCents, 0);
  const allChecked = openRows.length > 0 && selectedCount === openRows.length;

  return (
    <form action={action}>
      {selectedRows.map((c) => (
        <input key={c.id} type="hidden" name="charge_ids" value={c.id} />
      ))}

      {propertyNames.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
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
                <th className="px-5 py-3 font-medium">Resident</th>
                <th className="px-5 py-3 font-medium">Community</th>
                <th className="px-5 py-3 font-medium">Charge</th>
                <th className="px-5 py-3 font-medium">Period</th>
                <th className="px-5 py-3 font-medium">Due</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clay">
              {visible.map((c) => {
                const open = isOpen(c.status);
                const checked = selected.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={checked ? "bg-pine/5" : "hover:bg-sand/30"}
                  >
                    <td className="px-5 py-3">
                      {open ? (
                        <input
                          type="checkbox"
                          aria-label={`Mark ${c.residentName ?? "resident"} paid`}
                          checked={checked}
                          onChange={() => toggle(c.id)}
                          className="h-4 w-4 rounded border-clay-deep accent-pine"
                        />
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">
                        {c.residentName ?? "—"}
                      </div>
                      <div className="text-xs text-ink-faint">
                        {c.residentEmail ?? ""}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{c.property ?? "—"}</td>
                    <td className="px-5 py-3 text-ink-soft">
                      {c.description ?? "Rent"}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{c.period ?? "—"}</td>
                    <td className="px-5 py-3 text-ink-soft">
                      {formatDate(c.dueDate)}
                    </td>
                    <td className="px-5 py-3 font-medium text-ink">
                      {formatCents(c.amountCents)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill value={c.status} />
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-6 text-center text-sm text-ink-faint">
                    No charges for the selected community.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="sticky bottom-4 z-30 mt-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-pine/30 bg-cream px-5 py-3 shadow-xl">
            <div className="text-sm">
              <span className="font-semibold text-ink">
                {selectedCount} selected
              </span>
              <span className="text-ink-faint">
                {" "}
                · {formatCents(selectedCents)}
              </span>
              {state.error && (
                <div className="text-xs text-terracotta-dark">{state.error}</div>
              )}
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
