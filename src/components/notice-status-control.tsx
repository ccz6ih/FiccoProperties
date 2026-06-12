"use client";

import { useRef } from "react";
import { setNoticeStatus } from "@/app/(admin)/admin/notices/actions";

const OPTIONS = ["draft", "served", "cured", "expired", "withdrawn"];

export function NoticeStatusControl({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={setNoticeStatus}>
      <input type="hidden" name="id" value={id} />
      <select
        key={status}
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
