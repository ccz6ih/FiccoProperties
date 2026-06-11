"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  saveScreening,
  type ScreeningState,
} from "@/app/(admin)/admin/applications/[id]/actions";

const OPTIONS: [string, string][] = [
  ["not_started", "Not started"],
  ["invited", "Invited"],
  ["in_progress", "In progress"],
  ["passed", "Passed"],
  ["failed", "Failed"],
  ["waived", "Waived"],
];

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

const initial: ScreeningState = { ok: false };

export function ScreeningRecordForm({
  id,
  status,
  reportUrl,
  notes,
}: {
  id: string;
  status: string;
  reportUrl: string | null;
  notes: string | null;
}) {
  const [state, action, pending] = useActionState(saveScreening, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Status
        </span>
        <select name="screening_status" defaultValue={status} className={inputClass}>
          {OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          SmartMove report link
        </span>
        <input
          name="screening_report_url"
          defaultValue={reportUrl ?? ""}
          className={inputClass}
          placeholder="https://www.mysmartmove.com/…"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Screening notes
        </span>
        <textarea
          name="screening_notes"
          defaultValue={notes ?? ""}
          rows={3}
          className={inputClass}
          placeholder="Decision, score range, anything to remember…"
        />
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save screening"}
        </Button>
        {state.ok && <span className="text-xs font-medium text-pine-dark">Saved.</span>}
        {state.error && (
          <span className="text-xs font-medium text-terracotta-dark">{state.error}</span>
        )}
      </div>
    </form>
  );
}
