"use client";

import { useRef } from "react";
import { setTurnStatus } from "@/app/(admin)/admin/turns/actions";

const OPTIONS = ["open", "in_progress", "blocked", "complete"];

function label(value: string) {
  const s = value.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function MakereadyTurnStatus({ turnId, status }: { turnId: string; status: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={setTurnStatus}>
      <input type="hidden" name="turn_id" value={turnId} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-clay-deep bg-white px-2.5 py-1.5 text-sm font-medium text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30"
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
