"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { logWorkForUnit, type LogWorkState } from "@/app/(admin)/admin/units/log-work-actions";

const initial: LogWorkState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

const MAINT_CATEGORIES = [
  "general", "plumbing", "electrical", "hvac", "appliance", "structural", "pest", "other",
];
const TASK_CATEGORIES = [
  "repair", "cleaning", "trash", "fence", "landscaping", "inspection", "admin", "extra", "other",
];

/**
 * Log work from the home itself, picking which kind it is.
 *
 * Both boards could already create things with no prompt about which was
 * right, which is how the same faucet ended up a maintenance request AND a
 * task. The choice is the first thing asked here, in the terms that actually
 * differ: whether the resident sees it.
 */
export function LogWorkForm({ unitId }: { unitId: string }) {
  const [state, action, pending] = useActionState(logWorkForUnit, initial);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"maintenance" | "task">("maintenance");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-clay-deep bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-sand"
      >
        + Log work for this home
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-3" key={state.ok ? "done" : "editing"}>
      <input type="hidden" name="unit_id" value={unitId} />
      <input type="hidden" name="kind" value={kind} />

      <div className="grid gap-2 sm:grid-cols-2">
        {([
          {
            key: "maintenance" as const,
            label: "Resident repair",
            hint: "Shows in their portal — they can follow it and add photos.",
          },
          {
            key: "task" as const,
            label: "Office task",
            hint: "Internal only. The resident never sees it.",
          },
        ]).map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setKind(o.key)}
            className={`rounded-xl border p-3 text-left ${
              kind === o.key
                ? "border-pine bg-pine/5 ring-1 ring-pine/30"
                : "border-clay-deep bg-white hover:bg-sand"
            }`}
          >
            <div className="text-sm font-semibold text-ink">{o.label}</div>
            <div className="mt-0.5 text-[11px] text-ink-faint">{o.hint}</div>
          </button>
        ))}
      </div>

      <input name="title" required placeholder="What needs doing?" className={field} />
      <input name="details" placeholder="Any detail (optional)" className={field} />

      <div className="flex flex-wrap gap-2">
        <label className="space-y-1">
          <span className="block text-xs text-ink-soft">Category</span>
          <select name="category" className={field} defaultValue={kind === "task" ? "repair" : "general"}>
            {(kind === "task" ? TASK_CATEGORIES : MAINT_CATEGORIES).map((c) => (
              <option key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-ink-soft">Priority</span>
          <select name="priority" className={field} defaultValue="normal">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value={kind === "task" ? "urgent" : "emergency"}>
              {kind === "task" ? "Urgent" : "Emergency"}
            </option>
          </select>
        </label>
        {kind === "task" && (
          <label className="space-y-1">
            <span className="block text-xs text-ink-soft">Due</span>
            <input type="date" name="due_date" className={field} />
          </label>
        )}
      </div>

      {/* The duplicate check asks once; this is how you say it's a real second job. */}
      {state.error?.includes("sounds similar") && (
        <label className="flex items-start gap-2.5 rounded-xl border border-gold/40 bg-gold/5 px-3 py-2.5">
          <input type="checkbox" name="ignore_duplicate" className="mt-0.5 h-4 w-4 rounded border-clay-deep accent-pine" />
          <span className="text-sm text-ink-soft">
            <strong className="text-ink">Log it anyway</strong> — this is a different job.
          </span>
        </label>
      )}

      {state.error && <p className="text-sm text-terracotta-dark">{state.error}</p>}
      {state.ok && state.notice && <p className="text-sm font-medium text-pine">{state.notice}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Logging…" : kind === "maintenance" ? "Log repair" : "Log task"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-faint hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
