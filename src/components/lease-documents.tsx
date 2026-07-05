"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/format";
import {
  uploadLeaseDocument,
  deleteLeaseDocument,
  setLeaseDocumentShared,
  type DocState,
} from "@/app/(admin)/admin/units/actions";

const initial: DocState = { ok: false };

export type LeaseDoc = {
  id: string;
  label: string | null;
  url: string;
  created: string;
  shared: boolean;
  residentLinked: boolean;
};

export function LeaseDocuments({
  unitId,
  docs,
}: {
  unitId: string;
  docs: LeaseDoc[];
}) {
  const [state, action, pending] = useActionState(uploadLeaseDocument, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="border-t border-clay pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Lease documents
      </h3>

      {docs.length > 0 ? (
        <ul className="mt-3 divide-y divide-clay">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 text-sm font-medium text-pine hover:underline"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 2h8l4 4v16H6z" strokeLinejoin="round" />
                  <path d="M14 2v4h4" strokeLinejoin="round" />
                </svg>
                <span className="truncate">{d.label || "Signed lease"}</span>
                <span className="shrink-0 text-xs font-normal text-ink-faint">
                  · {formatDate(d.created)}
                </span>
              </a>
              <div className="flex shrink-0 items-center gap-2">
                {d.shared ? (
                  <span className="rounded-full bg-pine/10 px-2 py-0.5 text-[11px] font-medium text-pine">
                    In portal
                  </span>
                ) : (
                  <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] text-ink-faint">
                    Private
                  </span>
                )}
                {d.residentLinked ? (
                  <form action={setLeaseDocumentShared}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="unit_id" value={unitId} />
                    <input type="hidden" name="share" value={d.shared ? "0" : "1"} />
                    <button
                      type="submit"
                      className="text-[11px] font-medium text-pine hover:underline"
                      title={d.shared ? "Hide from resident portal" : "Show in resident portal"}
                    >
                      {d.shared ? "Unshare" : "Share"}
                    </button>
                  </form>
                ) : (
                  <span
                    className="text-[11px] text-ink-faint"
                    title="Link a portal resident to this unit to share"
                  >
                    No resident
                  </span>
                )}
                <form action={deleteLeaseDocument}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="unit_id" value={unitId} />
                  <button
                    type="submit"
                    className="text-xs text-ink-faint hover:text-terracotta-dark"
                    title="Delete document"
                  >
                    ✕
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-faint">No lease on file yet.</p>
      )}

      <form ref={formRef} action={action} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="unit_id" value={unitId} />
        <input
          type="text"
          name="label"
          placeholder="Label (e.g. 2024 renewal)"
          className="min-w-0 flex-1 rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink"
        />
        <input
          type="file"
          name="file"
          accept="application/pdf,image/*"
          required
          className="text-xs text-ink-soft file:mr-2 file:rounded-lg file:border file:border-clay-deep file:bg-sand file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink-soft"
        />
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input
            type="checkbox"
            name="share"
            className="h-3.5 w-3.5 rounded border-clay-deep accent-pine"
          />
          Show in resident portal
        </label>
        <Button type="submit" variant="outline" size="md" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </form>
      {state.error && (
        <p className="mt-1 text-xs text-terracotta-dark">{state.error}</p>
      )}
      <p className="mt-1 text-[11px] text-ink-faint">
        PDF or photo, up to 8&nbsp;MB. Private by default — use{" "}
        <span className="font-medium">Share</span> to let the unit&apos;s portal
        resident view their copy.
      </p>
    </div>
  );
}
