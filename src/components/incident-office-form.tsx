"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  updateIncident,
  type IncidentAdminState,
} from "@/app/(admin)/admin/incidents/actions";

const initial: IncidentAdminState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

export type OfficeDefaults = {
  id: string;
  status: string;
  received_by: string;
  action_taken: string;
  follow_up: string;
  attorney_notified: string;
  admin_notes: string;
};

export function IncidentOfficeForm({ defaults }: { defaults: OfficeDefaults }) {
  const [state, action, pending] = useActionState(updateIncident, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={defaults.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Status</span>
          <select name="status" defaultValue={defaults.status} className={field}>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="action_taken">Action taken</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Received by</span>
          <input name="received_by" defaultValue={defaults.received_by} className={field} />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Action taken / notice served</span>
        <textarea name="action_taken" defaultValue={defaults.action_taken} rows={2} className={field} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Follow-up needed</span>
          <input name="follow_up" defaultValue={defaults.follow_up} className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Attorney notified</span>
          <input name="attorney_notified" defaultValue={defaults.attorney_notified} className={field} />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Internal notes</span>
        <textarea name="admin_notes" defaultValue={defaults.admin_notes} rows={3} className={field} />
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save office notes"}
        </Button>
        {state.ok && <span className="text-sm font-medium text-pine">Saved ✓</span>}
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>
    </form>
  );
}
