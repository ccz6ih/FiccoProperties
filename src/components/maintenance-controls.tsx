"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  setMaintenanceStatus,
  setMaintenancePriority,
  setMaintenanceAssignee,
} from "@/app/(admin)/admin/maintenance/actions";

const STATUS_OPTIONS = ["open", "in_progress", "on_hold", "completed", "cancelled"];
const PRIORITY_OPTIONS = ["low", "normal", "high", "emergency"];

const selectClass =
  "w-full rounded-lg border border-clay-deep bg-white px-2.5 py-1.5 text-sm font-medium text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

function label(value: string) {
  const s = value.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * These dropdowns save the moment you pick — there's no Save button. Without a
 * cue that's unnerving, so say so, and show "Saving…" while it's in flight.
 */
function SaveHint({ savedLabel = "Saves as soon as you pick" }: { savedLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <span
      className={`mt-1 block text-[11px] ${pending ? "font-medium text-pine" : "text-ink-faint"}`}
    >
      {pending ? "Saving…" : savedLabel}
    </span>
  );
}

export function MaintenanceStatusControl({ id, status }: { id: string; status: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={setMaintenanceStatus}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className={selectClass}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {label(o)}
          </option>
        ))}
      </select>
      <SaveHint
        savedLabel={
          status === "completed"
            ? "✓ Completed — saved"
            : "Saves as soon as you pick"
        }
      />
    </form>
  );
}

export function MaintenancePriorityControl({ id, priority }: { id: string; priority: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={setMaintenancePriority}>
      <input type="hidden" name="id" value={id} />
      <select
        name="priority"
        defaultValue={priority}
        onChange={() => formRef.current?.requestSubmit()}
        className={selectClass}
      >
        {PRIORITY_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {label(o)}
          </option>
        ))}
      </select>
      <SaveHint />
    </form>
  );
}

export function MaintenanceAssigneeControl({
  id,
  assignedTo,
  staff,
}: {
  id: string;
  assignedTo: string | null;
  staff: { id: string; full_name: string | null; email: string | null }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={setMaintenanceAssignee}>
      <input type="hidden" name="id" value={id} />
      <select
        name="assigned_to"
        defaultValue={assignedTo ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className={selectClass}
      >
        <option value="">Unassigned</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.full_name ?? s.email ?? "Staff member"}
          </option>
        ))}
      </select>
      <SaveHint />
    </form>
  );
}
