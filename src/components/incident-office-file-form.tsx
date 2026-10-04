"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import {
  fileOfficeIncident,
  type OfficeIncidentState,
} from "@/app/(admin)/admin/incidents/actions";

const initial: OfficeIncidentState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export type IncidentUnit = { id: string; label: string };

/**
 * File an incident from the office — what a neighbour said, what staff saw, a
 * police visit. Residents could already file one; the office couldn't, so
 * anything learned second-hand ended up as a note on somebody else's report.
 */
export function IncidentOfficeFileForm({
  units,
  defaultUnit,
}: {
  units: IncidentUnit[];
  defaultUnit?: string;
}) {
  const [state, action, pending] = useActionState(fileOfficeIncident, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="primary" size="md" onClick={() => setOpen(true)}>
        + Record an incident
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-2xl border border-clay bg-white p-5" key={state.ok ? "saved" : "editing"}>
      <div>
        <div className="font-display text-lg font-semibold text-ink">Record an incident</div>
        <p className="mt-0.5 text-xs text-ink-faint">
          For something the office learned rather than a resident filing it themselves. It&apos;s
          filed under your name and says so on the record.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Home</span>
          <select name="unit_id" defaultValue={defaultUnit ?? ""} className={field}>
            <option value="">Not about one home</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Who told you
          </span>
          <input name="told_by" placeholder="e.g. two residents of Unit 27 and Unit 4" className={field} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Date</span>
          <input type="date" name="occurred_on" required max={new Date().toISOString().slice(0, 10)} className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Time</span>
          <input name="occurred_time" placeholder="around 10:15 am" className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Where</span>
          <input name="location" placeholder="Front walk, parking lot…" className={field} />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Who was involved
        </span>
        <input name="involved" placeholder="Names and units, as best you know them" className={field} />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          What was reported
        </span>
        <textarea
          name="narrative"
          rows={5}
          required
          className={field}
          placeholder="Write what you were told, as close to their words as you can, and say who said what. Stick to what was described rather than a conclusion about it."
        />
        <span className="block text-[11px] text-ink-faint">
          This is the part that carries weight later. Dates, words used, who saw it.
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Anyone hurt
          </span>
          <select name="anyone_hurt" defaultValue="no" className={field}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Police</span>
          <select name="police_called" defaultValue="unknown" className={field}>
            <option value="no">Not called</option>
            <option value="unknown">Don&apos;t know</option>
            <option value="yes">Called</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Happened before
          </span>
          <select name="happened_before" defaultValue="no" className={field}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Police reference
          </span>
          <input name="police_ref" placeholder="Case number, if there is one" className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            When before
          </span>
          <input name="before_when" placeholder="e.g. Jul 29, 2026 — IR-00002" className={field} />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Anything else
        </span>
        <input name="additional" placeholder="Optional" className={field} />
      </label>

      {state.error && <p className="text-sm text-terracotta-dark">{state.error}</p>}
      {state.ok && state.notice && <p className="text-sm font-medium text-pine">{state.notice}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Filing…" : "File it"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-faint hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
