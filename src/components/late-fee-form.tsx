"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { addLateFee, type LateFeeState } from "@/app/(admin)/admin/delinquency/actions";
import { formatCents } from "@/lib/format";

const initial: LateFeeState = { ok: false };

export function LateFeeForm({
  residentId,
  leaseId,
  overdueCents,
  suggestedCents,
  capCents,
}: {
  residentId: string;
  leaseId: string | null;
  overdueCents: number;
  suggestedCents: number;
  capCents: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addLateFee, initial);

  if (state.ok) {
    return <span className="text-xs font-medium text-pine-dark">Late fee added ✓</span>;
  }

  if (!leaseId) {
    return <span className="text-xs text-ink-faint">No lease on file</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap text-xs font-medium text-terracotta-dark hover:underline"
      >
        + Late fee
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="resident_id" value={residentId} />
      <input type="hidden" name="lease_id" value={leaseId} />
      <input type="hidden" name="overdue_cents" value={overdueCents} />
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-ink-faint">$</span>
        <input
          name="amount_dollars"
          type="number"
          min={0}
          step="0.01"
          defaultValue={(suggestedCents / 100).toFixed(2)}
          className="w-20 rounded-lg border border-clay-deep bg-white px-2 py-1 text-xs text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30"
        />
        <Button type="submit" variant="accent" disabled={pending} className="h-7 px-3 text-xs">
          {pending ? "…" : "Add"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-ink-faint hover:text-ink"
        >
          Cancel
        </button>
      </div>
      <span className="text-[11px] text-ink-faint">
        Suggested 5% = {formatCents(suggestedCents)} · CO max {formatCents(capCents)}
      </span>
      {state.error && (
        <span className="text-[11px] font-medium text-terracotta-dark">{state.error}</span>
      )}
    </form>
  );
}
