"use client";

import { useRef } from "react";
import { setApplicationStatus } from "@/app/(admin)/admin/applications/actions";

const OPTIONS = ["new", "reviewing", "approved", "denied", "withdrawn"];

export function ApplicationStatusControl({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={setApplicationStatus}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-clay-deep bg-white px-2.5 py-1.5 text-xs font-medium text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30"
      >
        {OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o.charAt(0).toUpperCase() + o.slice(1)}
          </option>
        ))}
      </select>
    </form>
  );
}
