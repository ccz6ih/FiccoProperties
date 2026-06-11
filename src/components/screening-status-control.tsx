"use client";

import { useRef } from "react";
import { setScreeningStatus } from "@/app/(admin)/admin/applications/[id]/actions";

const OPTIONS = ["not_started", "invited", "in_progress", "passed", "failed", "waived"];

function label(value: string): string {
  const s = value.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ScreeningStatusControl({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={setScreeningStatus}>
      <input type="hidden" name="id" value={id} />
      <select
        name="screening_status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-clay-deep bg-white px-2.5 py-1.5 text-xs font-medium text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30"
      >
        {OPTIONS.map((o) => (
          <option key={o} value={o}>
            {label(o)}
          </option>
        ))}
      </select>
    </form>
  );
}
