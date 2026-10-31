"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  recordNoticeToVacate,
  type NoticeState,
} from "@/app/(admin)/admin/units/actions";

const initial: NoticeState = { ok: false };

const input =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

/**
 * "They told me they're leaving." Recorded the day it's said, so the turn can
 * be planned and the listing can go up before the home is even empty.
 */
export function NoticeToVacateForm({
  unitId,
  givenOn,
  leavingOn,
  reason,
}: {
  unitId: string;
  givenOn: string | null;
  leavingOn: string | null;
  reason: string | null;
}) {
  const [state, action, pending] = useActionState(recordNoticeToVacate, initial);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="unit_id" value={unitId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-soft">
            They told us on
          </span>
          <input
            type="date"
            name="notice_given_on"
            required
            defaultValue={givenOn ?? today}
            className={input}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-soft">
            They&apos;ll be out by
          </span>
          <input
            type="date"
            name="notice_move_out_on"
            required
            defaultValue={leavingOn ?? ""}
            className={input}
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-soft">
          Why, in their words
        </span>
        <input
          name="notice_reason"
          defaultValue={reason ?? ""}
          placeholder="Bought a house"
          className={input}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : leavingOn ? "Update the notice" : "Record the notice"}
        </Button>
        {state.ok && state.notice && <span className="text-sm text-pine">{state.notice}</span>}
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>
    </form>
  );
}
