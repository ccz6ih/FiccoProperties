"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { addLogEntry, type LogState } from "@/app/(admin)/admin/units/actions";

const initial: LogState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

export function UnitLogForm({ unitId }: { unitId: string }) {
  const [state, action, pending] = useActionState(addLogEntry, initial);
  const [kind, setKind] = useState<"note" | "maintenance">("note");
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the form after a successful save.
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setKind("note");
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="unit_id" value={unitId} />

      <div className="flex gap-2">
        {(["note", "maintenance"] as const).map((k) => (
          <label
            key={k}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              kind === k ? "border-pine bg-pine/5 text-pine" : "border-clay text-ink-soft hover:bg-sand"
            }`}
          >
            <input
              type="radio"
              name="kind"
              value={k}
              checked={kind === k}
              onChange={() => setKind(k)}
              className="sr-only"
            />
            {k === "maintenance" ? "Maintenance performed" : "Note"}
          </label>
        ))}
      </div>

      <textarea
        name="body"
        rows={3}
        required
        placeholder={
          kind === "maintenance"
            ? "What was done, parts replaced, by whom…"
            : "Note about the tenant or unit…"
        }
        className={field}
      />

      {kind === "maintenance" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-ink-faint">
              Date performed
            </label>
            <input type="date" name="performed_on" className={field} />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-ink-faint">
              Cost ($, optional)
            </label>
            <input inputMode="decimal" name="cost" className={field} />
          </div>
        </div>
      )}

      {state.error && (
        <p className="text-xs text-terracotta-dark">{state.error}</p>
      )}

      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Saving…" : "Add to history"}
      </Button>
    </form>
  );
}
