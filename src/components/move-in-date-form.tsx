"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  recordMoveInByPhone,
  type MoveInDateState,
} from "@/app/(admin)/admin/units/actions";

const initial: MoveInDateState = { ok: false };

/**
 * Taking a move-in date over the phone.
 *
 * The portal asks them, but plenty ring instead — and a date typed straight
 * into the tenancy does nothing on its own. This does the same work their own
 * confirmation does: prorates the first month, raises the charge, and offers
 * to tell them what to bring.
 */
export function MoveInDateForm({
  unitId,
  current,
  hasEmail,
}: {
  unitId: string;
  current: string | null;
  hasEmail: boolean;
}) {
  const [state, action, pending] = useActionState(recordMoveInByPhone, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="unit_id" value={unitId} />
      <div className="flex flex-wrap items-end gap-3">
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-soft">
            {current ? "Change their move-in day" : "They told you they're moving in"}
          </span>
          <input
            type="date"
            name="move_in_date"
            required
            defaultValue={current ?? ""}
            className="rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink"
          />
        </label>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : current ? "Update it" : "Record it"}
        </Button>
      </div>

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          name="tell_them"
          defaultChecked={hasEmail}
          disabled={!hasEmail}
          className="mt-0.5 h-4 w-4 rounded border-clay-deep accent-pine"
        />
        <span className="text-sm text-ink">
          Email them what to bring
          <span className="block text-xs text-ink-faint">
            {hasEmail
              ? "The prorated first month and the deposit, with who to make it payable to."
              : "No email on file for them."}
          </span>
        </span>
      </label>

      {state.ok && state.notice && <p className="text-sm text-pine">{state.notice}</p>}
      {state.error && <p className="text-sm text-terracotta-dark">{state.error}</p>}

      <p className="text-[11px] text-ink-faint">
        Changing the date re-works the first month&apos;s rent and replaces the charge —
        unless something has already been paid against it, in which case it&apos;s left
        alone for you to sort out.
      </p>
    </form>
  );
}
