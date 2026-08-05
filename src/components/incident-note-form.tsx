"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  addIncidentNote,
  type IncidentAdminState,
} from "@/app/(admin)/admin/incidents/actions";

const initial: IncidentAdminState = { ok: false };

export function IncidentNoteForm({ incidentId }: { incidentId: string }) {
  const [state, action, pending] = useActionState(addIncidentNote, initial);

  return (
    <form action={action} className="mt-4 space-y-2" key={state.ok ? "reset" : "form"}>
      <input type="hidden" name="incident_id" value={incidentId} />
      <textarea
        name="body"
        rows={2}
        placeholder="Add a note (who you spoke with, what you did)…"
        className="w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Adding…" : "Add note"}
        </Button>
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>
    </form>
  );
}
