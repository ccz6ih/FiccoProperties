"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { startTurn } from "@/app/(admin)/admin/turns/actions";

export type TurnUnitOpt = {
  id: string;
  label: string;
  property: string;
  waiting: boolean;
};
export type TurnTemplateOpt = { id: string; name: string; items: number };

const field =
  "w-full rounded-xl border border-clay-deep bg-white px-3.5 py-2.5 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

function StartButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-pine px-4 py-2.5 text-sm font-semibold text-cream hover:bg-pine-dark disabled:opacity-60"
    >
      {pending ? "Starting…" : "Start make-ready"}
    </button>
  );
}

/**
 * Starting a turn used to live only on a unit's own page, so the board itself
 * was read-only and there was no obvious way in. This is that way in — with the
 * homes already sitting empty offered first, since those are the ones that need
 * a turn.
 */
export function TurnStartPanel({
  units,
  templates,
}: {
  units: TurnUnitOpt[];
  templates: TurnTemplateOpt[];
}) {
  const waiting = units.filter((u) => u.waiting);
  const [unitId, setUnitId] = useState(waiting[0]?.id ?? "");
  const [open, setOpen] = useState(waiting.length > 0);

  if (templates.length === 0) {
    return (
      <div className="mb-6 rounded-2xl border border-clay bg-white px-5 py-4 text-sm text-ink-soft">
        No checklist templates yet — add one before starting a turn.
      </div>
    );
  }

  const rest = units.filter((u) => !u.waiting);

  return (
    <div className="mb-6 rounded-2xl border border-clay bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold text-ink">Start a turn</div>
          <p className="mt-0.5 text-sm text-ink-soft">
            {waiting.length > 0
              ? `${waiting.length} home${waiting.length === 1 ? "" : "s"} sitting empty without a turn started.`
              : "Pick a home and a checklist to begin tracking its turnover."}
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl bg-pine px-4 py-2.5 text-sm font-semibold text-cream hover:bg-pine-dark"
          >
            + New turn
          </button>
        )}
      </div>

      {open && (
        <form action={startTurn} className="mt-4 grid gap-3 sm:grid-cols-[2fr_2fr_auto] sm:items-end">
          <label className="space-y-1.5">
            <span className="block text-xs font-medium uppercase tracking-wide text-ink-faint">
              Home
            </span>
            <select
              name="unit_id"
              required
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className={field}
            >
              <option value="" disabled>
                Choose a home…
              </option>
              {waiting.length > 0 && (
                <optgroup label="Empty — needs a turn">
                  {waiting.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.property} · {u.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {rest.length > 0 && (
                <optgroup label="Every other home">
                  {rest.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.property} · {u.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-medium uppercase tracking-wide text-ink-faint">
              Checklist
            </span>
            <select name="template_id" defaultValue={templates[0]?.id} className={field}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.items} steps
                </option>
              ))}
            </select>
          </label>

          <StartButton />
        </form>
      )}
    </div>
  );
}
