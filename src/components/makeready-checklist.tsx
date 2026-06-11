"use client";

import { Button } from "@/components/ui";
import { toggleTask, completeTurn } from "@/app/(admin)/admin/turns/actions";

export type ChecklistTask = {
  id: string;
  label: string;
  done: boolean;
};

export function MakereadyChecklist({
  turnId,
  tasks,
  isComplete,
}: {
  turnId: string;
  tasks: ChecklistTask[];
  isComplete: boolean;
}) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const allDone = total > 0 && done === total;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-ink">Progress</span>
          <span className="text-ink-soft">
            {done}/{total} done
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-sand">
          <div
            className="h-full rounded-full bg-pine transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id}>
            <form action={toggleTask}>
              <input type="hidden" name="task_id" value={t.id} />
              <input type="hidden" name="turn_id" value={turnId} />
              <input type="hidden" name="done" value={t.done ? "false" : "true"} />
              <button
                type="submit"
                disabled={isComplete}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                  t.done
                    ? "border-pine/30 bg-pine-soft/60"
                    : "border-clay-deep bg-white/70 hover:bg-sand/40"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                    t.done
                      ? "border-pine bg-pine text-cream"
                      : "border-clay-deep bg-white"
                  }`}
                  aria-hidden
                >
                  {t.done && (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span
                  className={`text-sm ${
                    t.done ? "text-ink-soft line-through" : "font-medium text-ink"
                  }`}
                >
                  {t.label}
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>

      {!isComplete && (
        <form action={completeTurn}>
          <input type="hidden" name="turn_id" value={turnId} />
          <Button type="submit" variant="primary" disabled={!allDone}>
            {allDone ? "Mark turn complete" : `Finish all tasks to complete (${done}/${total})`}
          </Button>
        </form>
      )}
    </div>
  );
}
