"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { updateMoveOutRecord } from "@/app/(admin)/admin/move-out/actions";

const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-base text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export type MoveOutCheck = { name: string; label: string; hint: string };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-pine px-4 py-2.5 text-sm font-semibold text-cream hover:bg-pine-dark disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save the walk-through"}
    </button>
  );
}

/**
 * Finish a move-out after the fact — the address that arrived a week later, the
 * walk-through nobody filled in at the time. Collapsed by default so a home
 * whose paperwork is already done doesn't shout for attention.
 */
export function MoveOutRecordForm({
  unitId,
  tenantName,
  checks,
  done,
  forwardingAddress,
}: {
  unitId: string;
  tenantName: string;
  checks: MoveOutCheck[];
  /** Which boxes were ticked last time, by label. */
  done: Record<string, boolean>;
  forwardingAddress: string | null;
}) {
  const [open, setOpen] = useState(false);
  const recorded = Object.keys(done).length > 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-clay-deep bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-sand"
      >
        {recorded ? "Edit the walk-through" : "Run the move-out checklist"}
      </button>
    );
  }

  return (
    <form action={updateMoveOutRecord} className="mt-3 space-y-4">
      <input type="hidden" name="unit_id" value={unitId} />

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Forwarding address
        </span>
        <textarea
          name="forwarding_address"
          rows={2}
          defaultValue={forwardingAddress ?? ""}
          placeholder="5090 Ellis St, Golden, CO 80403"
          className={field}
        />
        <span className="block text-[11px] text-ink-faint">
          Where the deposit check goes — this is what the disposition statement prints.
        </span>
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Date they gave notice
        </span>
        <input type="date" name="notice_given_on" className={field} />
      </label>

      <fieldset className="space-y-2 rounded-xl border border-clay bg-sand/30 p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
          Move-out walk-through — {tenantName}
        </legend>
        {checks.map((c) => (
          <label key={c.name} className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name={c.name}
              defaultChecked={done[c.label] ?? true}
              className="mt-0.5 h-4 w-4 rounded border-clay-deep accent-pine"
            />
            <span className="text-sm text-ink-soft">
              <strong className="text-ink">{c.label}</strong>
              <span className="block text-[11px] text-ink-faint">{c.hint}</span>
            </span>
          </label>
        ))}
        <label className="block space-y-1 pt-1">
          <span className="text-[11px] text-ink-faint">
            Anything to note — damage, what&apos;s left behind, meter readings
          </span>
          <input name="walkthrough_note" placeholder="Optional" className={field} />
        </label>
      </fieldset>

      <label className="flex items-start gap-2.5 rounded-xl border border-clay bg-cream/60 px-3.5 py-3">
        <input
          type="checkbox"
          name="notify_owners"
          defaultChecked
          className="mt-0.5 h-4 w-4 rounded border-clay-deep accent-pine"
        />
        <span className="text-sm text-ink-soft">
          <strong className="text-ink">Email Lou, Tony and Chris.</strong> Sends them the
          checklist, the forwarding address and the 30-day deposit deadline.
        </span>
      </label>

      <div className="flex items-center gap-3">
        <SaveButton />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-ink-faint hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
