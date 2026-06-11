"use client";

import { useRef } from "react";
import { Button } from "@/components/ui";
import { addMaintenanceComment } from "@/app/(admin)/admin/maintenance/actions";

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

/**
 * Comment composer. `allowInternal` shows the staff-only toggle; residents only
 * ever post visible (non-internal) replies, so the form omits it for them.
 */
export function MaintenanceCommentForm({
  requestId,
  action,
  allowInternal = false,
}: {
  requestId: string;
  action: (form: FormData) => void;
  allowInternal?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(form) => {
        action(form);
        formRef.current?.reset();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="request_id" value={requestId} />
      <textarea
        name="body"
        rows={3}
        required
        className={inputClass}
        placeholder="Add a note…"
      />
      <div className="flex items-center justify-between gap-3">
        {allowInternal ? (
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              name="internal"
              className="h-4 w-4 rounded border-clay-deep text-pine focus:ring-pine/30"
            />
            Internal note (staff only)
          </label>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary">
          Post
        </Button>
      </div>
    </form>
  );
}
