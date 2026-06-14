"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { editUnitCost, type CostState } from "@/app/(admin)/admin/units/actions";

const initial: CostState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";
const lbl = "block text-xs font-medium text-ink-faint";
const TRADES = [
  "carpet", "cleaning", "plumbing", "electrical", "drywall", "paint",
  "flooring", "appliance", "landscaping", "labor", "supplies", "other",
];

export type CostEntry = {
  id: string;
  unitId: string;
  vendor: string | null;
  trade: string | null;
  description: string | null;
  incurred_on: string;
  amountDollars: string;
  hoursValue: string;
  rateDollars: string;
};

export function UnitCostEdit({ entry }: { entry: CostEntry }) {
  const [state, action, pending] = useActionState(editUnitCost, initial);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hours, setHours] = useState(entry.hoursValue);
  const [rate, setRate] = useState(entry.rateDollars);
  const [amount, setAmount] = useState(entry.amountDollars);
  const router = useRouter();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  useEffect(() => {
    if (state.ok) { setOpen(false); router.refresh(); }
  }, [state, router]);

  const computed = Number(hours) > 0 && Number(rate) > 0
    ? (Number(hours) * Number(rate)).toFixed(2)
    : null;

  const trigger = (
    <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-pine hover:underline">
      Edit
    </button>
  );

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4" onClick={() => setOpen(false)}>
      <div className="my-8 w-full max-w-md rounded-2xl bg-cream p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">Edit cost</h3>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-sand">✕</button>
        </div>
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={entry.id} />
          <input type="hidden" name="unit_id" value={entry.unitId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}>
              Vendor / contractor
              <input name="vendor" defaultValue={entry.vendor ?? ""} className={field} />
            </label>
            <label className={lbl}>
              Trade
              <select name="trade" defaultValue={entry.trade ?? "cleaning"} className={field}>
                {TRADES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={lbl}>
              Hours
              <input inputMode="decimal" name="hours" value={hours} onChange={(e) => setHours(e.target.value)} className={field} />
            </label>
            <label className={lbl}>
              Rate ($/hr)
              <input inputMode="decimal" name="rate" value={rate} onChange={(e) => setRate(e.target.value)} className={field} />
            </label>
            <label className={lbl}>
              Amount ($)
              <input inputMode="decimal" name="amount" required value={amount || (computed ?? "")} onChange={(e) => setAmount(e.target.value)} className={field} />
            </label>
          </div>
          <label className={lbl}>
            Date
            <input type="date" name="incurred_on" defaultValue={entry.incurred_on} className={field} />
          </label>
          <label className={lbl}>
            What was done?
            <input name="description" defaultValue={entry.description ?? ""} className={field} />
          </label>
          {state.error && <p className="text-xs text-terracotta-dark">{state.error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-ink-soft hover:text-ink">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {trigger}
      {open && mounted && createPortal(dialog, document.body)}
    </>
  );
}
