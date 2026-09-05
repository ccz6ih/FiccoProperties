"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { formatCents } from "@/lib/format";
import { voidRentCharge } from "@/app/(admin)/admin/delinquency/actions";

const REASONS = [
  "Moved out — not held to this month",
  "Billed by mistake",
  "Settled another way",
  "Waived by the office",
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-terracotta-dark px-2.5 py-1 text-xs font-semibold text-cream hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Removing…" : "Write it off"}
    </button>
  );
}

/**
 * Writing off rent is real money leaving the books, so this asks why before it
 * will do anything — the reason lands in the home's log. Tucked behind a small
 * link so it's never the easy accidental click.
 */
export function VoidRentForm({
  chargeIds,
  amountCents,
  tenantName,
}: {
  chargeIds: string[];
  amountCents: number;
  tenantName: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap text-xs font-medium text-ink-faint hover:text-terracotta-dark hover:underline"
      >
        Not owed?
      </button>
    );
  }

  return (
    <form action={voidRentCharge} className="space-y-1.5 text-left">
      {chargeIds.map((id) => (
        <input key={id} type="hidden" name="charge_id" value={id} />
      ))}
      <div className="text-xs text-ink-soft">
        Write off {formatCents(amountCents)} for {tenantName}?
      </div>
      <select
        name="reason"
        required
        defaultValue={REASONS[0]}
        className="w-full rounded-lg border border-clay-deep bg-white px-2 py-1 text-xs text-ink"
      >
        {REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <Submit />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-ink-faint hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
