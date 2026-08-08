"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import {
  addPropertyExpense,
  type ExpenseState,
} from "@/app/(admin)/admin/financials/actions";

const initial: ExpenseState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

const CATEGORY_OPTIONS: [string, string][] = [
  ["insurance", "Insurance"],
  ["taxes", "Property taxes"],
  ["utilities", "Utilities"],
  ["mortgage_interest", "Mortgage interest"],
  ["cleaning_maintenance", "Cleaning & maintenance"],
  ["repairs", "Repairs"],
  ["supplies", "Supplies"],
  ["legal_professional", "Legal & professional"],
  ["management_fees", "Management fees"],
  ["advertising", "Advertising"],
  ["auto_travel", "Auto & travel"],
  ["other", "Other"],
];

export function PropertyExpenseForm({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(addPropertyExpense, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Community</span>
          <select name="property_id" defaultValue="" required className={field}>
            <option value="" disabled>Choose…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Category</span>
          <select name="category" defaultValue="insurance" className={field}>
            {CATEGORY_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Amount ($)</span>
          <input inputMode="decimal" name="amount" placeholder="0.00" required className={field} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Date</span>
          <input type="date" name="incurred_on" required className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Vendor (optional)</span>
          <input name="vendor" placeholder="e.g. State Farm" className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Receipt (optional)</span>
          <input
            type="file"
            name="file"
            accept="application/pdf,image/*"
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-pine file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-cream hover:file:bg-pine-dark"
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Memo (optional)</span>
        <input name="memo" placeholder="e.g. Annual policy renewal" className={field} />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Saving…" : "Add expense"}
        </Button>
        {state.ok && <span className="text-sm font-medium text-pine">Added ✓</span>}
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>
    </form>
  );
}
