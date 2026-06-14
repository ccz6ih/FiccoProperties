"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { addUnitCost, type CostState } from "@/app/(admin)/admin/units/actions";

const initial: CostState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";
const lbl = "block text-xs font-medium text-ink-faint";

const TRADES = [
  "carpet", "cleaning", "plumbing", "electrical", "drywall", "paint",
  "flooring", "appliance", "landscaping", "labor", "supplies", "other",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function UnitCostForm({ unitId }: { unitId: string }) {
  const [state, action, pending] = useActionState(addUnitCost, initial);
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // hours × rate auto-fills the amount (you can still override it).
  const computed = Number(hours) > 0 && Number(rate) > 0
    ? (Number(hours) * Number(rate)).toFixed(2)
    : null;
  const amountValue = amount || (computed ?? "");

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
      setHours(""); setRate(""); setAmount("");
      router.refresh();
    }
  }, [state, router]);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="md" onClick={() => setOpen(true)}>
        + Add a bill / cost
      </Button>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-3 rounded-xl border border-clay bg-white/70 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lbl}>
          Vendor / contractor
          <input name="vendor" placeholder="ABC Carpet Cleaning" className={field} />
        </label>
        <label className={lbl}>
          Trade / category
          <select name="trade" defaultValue="cleaning" className={field}>
            {TRADES.map((t) => (
              <option key={t} value={t} className="capitalize">{t}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={lbl}>
          Hours (optional)
          <input inputMode="decimal" name="hours" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="3" className={field} />
        </label>
        <label className={lbl}>
          Rate ($/hr, optional)
          <input inputMode="decimal" name="rate" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="25" className={field} />
        </label>
        <label className={lbl}>
          Amount ($)
          <input
            inputMode="decimal"
            name="amount"
            required
            value={amountValue}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="250"
            className={field}
          />
        </label>
      </div>
      {computed && !amount && (
        <p className="text-[11px] text-ink-faint">
          {hours} hrs × ${rate}/hr = <span className="font-medium text-ink">${computed}</span> (edit Amount to override)
        </p>
      )}
      <label className={lbl}>
        Date
        <input type="date" name="incurred_on" defaultValue={today()} className={field} />
      </label>

      <input type="hidden" name="unit_id" value={unitId} />
      <label className={lbl}>
        What was done?
        <input name="description" placeholder="Cleaned & stretched carpet in both bedrooms" className={field} />
      </label>

      <label className={lbl}>
        Invoice / receipt (optional)
        <input
          type="file"
          name="file"
          accept="application/pdf,image/*"
          className="mt-1 block text-xs text-ink-soft file:mr-2 file:rounded-lg file:border file:border-clay-deep file:bg-sand file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink-soft"
        />
      </label>

      {state.error && <p className="text-xs text-terracotta-dark">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Saving…" : "Save cost"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-ink-soft hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}
