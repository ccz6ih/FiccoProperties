"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { formatCents } from "@/lib/format";
import { recordMoveOut } from "@/app/(admin)/admin/move-out/actions";

const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-base text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

function SubmitButton({ tenantName }: { tenantName: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-pine px-4 py-2.5 text-sm font-semibold text-cream hover:bg-pine-dark disabled:opacity-60"
    >
      {pending ? "Recording…" : `Move ${tenantName} out`}
    </button>
  );
}

/**
 * Ending a tenancy is the one move-out step that changes what everyone else
 * sees, so it asks for the date plainly and says out loud what will happen
 * before it happens.
 */
export function MoveOutForm({
  unitId,
  tenantName,
  moveInDate,
  rentCents,
}: {
  unitId: string;
  tenantName: string;
  moveInDate: string | null;
  rentCents: number | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [moveOut, setMoveOut] = useState(today);
  const firstName = tenantName.trim().split(/\s+/)[0] || "them";

  return (
    <form action={recordMoveOut} className="space-y-4">
      <input type="hidden" name="unit_id" value={unitId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Move-out date
          </span>
          <input
            type="date"
            name="move_out_date"
            required
            value={moveOut}
            min={moveInDate ?? undefined}
            onChange={(e) => setMoveOut(e.target.value)}
            className={field}
          />
          <span className="block text-[11px] text-ink-faint">
            The day they were out — keys back, home empty.
          </span>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Why they left (optional)
          </span>
          <input
            name="move_out_reason"
            placeholder="Bought a house, moved for work…"
            className={field}
          />
          <span className="block text-[11px] text-ink-faint">
            Worth knowing when you look back at the home&apos;s history.
          </span>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Forwarding address (optional)
        </span>
        <input
          name="forwarding_address"
          placeholder="Where the deposit check goes"
          className={field}
        />
        <span className="block text-[11px] text-ink-faint">
          Colorado gives you 30 days to return the deposit — you can add this later.
        </span>
      </label>

      <label className="flex items-start gap-2.5 rounded-xl border border-clay bg-sand/40 px-3.5 py-3">
        <input
          type="checkbox"
          name="void_future_charges"
          defaultChecked
          className="mt-0.5 h-4 w-4 rounded border-clay-deep accent-pine"
        />
        <span className="text-sm text-ink-soft">
          <strong className="text-ink">Void rent charged after that date.</strong> Rent for months
          starting after they left comes off the books. Anything still owed for their time here
          stays — moving out doesn&apos;t erase a balance.
        </span>
      </label>

      <div className="rounded-xl border border-clay bg-cream/60 px-3.5 py-3 text-sm text-ink-soft">
        <div className="mb-1 font-medium text-ink">What this does</div>
        <ul className="space-y-0.5 text-[13px]">
          <li>· Takes {firstName} off the rent board and out of next month&apos;s billing</li>
          <li>· Files the tenancy in this home&apos;s history — dates, rent, deposit, all of it</li>
          <li>· Ends the lease and sets the home to make-ready</li>
          <li>· Stops rent reminders, notices, and the owner report from counting them</li>
          {rentCents ? (
            <li>· The home shows vacant at {formatCents(rentCents)}/mo until someone new is set up</li>
          ) : null}
        </ul>
      </div>

      <SubmitButton tenantName={firstName} />
    </form>
  );
}
