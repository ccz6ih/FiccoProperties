"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  emailIncidentForm,
  type IncidentAdminState,
} from "@/app/(admin)/admin/incidents/actions";

const initial: IncidentAdminState = { ok: false };
const field = "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

export type ResidentOpt = { id: string; name: string; home: string | null };

export function IncidentRequestForm({ residents }: { residents: ResidentOpt[] }) {
  const [state, action, pending] = useActionState(emailIncidentForm, initial);

  return (
    <form action={action} className="space-y-3" key={state.ok ? "sent" : "form"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Resident</span>
          <select name="resident_id" defaultValue="" required className={field}>
            <option value="" disabled>Choose a resident…</option>
            {residents.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}{r.home ? ` · ${r.home}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Note (optional)
          </span>
          <input
            name="note"
            placeholder="e.g. Please write up the parking-lot incident from last night."
            className={field}
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Sending…" : "Email the form"}
        </Button>
        {state.ok && state.sentTo && (
          <span className="text-sm font-medium text-pine">Sent to {state.sentTo} ✓</span>
        )}
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>
    </form>
  );
}
