"use client";

import { useActionState } from "react";
import { setUnitRent, type SetRentState } from "@/app/(admin)/admin/rents/actions";

const initial: SetRentState = { ok: false };

export function RentRowForm({
  unitId,
  rentDollars,
}: {
  unitId: string;
  rentDollars: number | "";
}) {
  const [state, action, pending] = useActionState(setUnitRent, initial);

  return (
    <form action={action} className="flex items-center justify-end gap-2">
      <input type="hidden" name="unit_id" value={unitId} />
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
          $
        </span>
        <input
          type="number"
          name="rent_dollars"
          min={0}
          step={1}
          defaultValue={rentDollars}
          placeholder="0"
          className="w-28 rounded-lg border border-clay-deep bg-white/80 py-1.5 pl-6 pr-2 text-right text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-pine px-3 py-1.5 text-xs font-medium text-cream hover:bg-pine-dark disabled:opacity-50"
      >
        {pending ? "…" : "Save"}
      </button>
      {state.ok && <span className="text-xs text-pine">✓</span>}
      {state.error && <span className="text-xs text-terracotta-dark">{state.error}</span>}
    </form>
  );
}
