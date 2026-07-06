"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import {
  discloseAssistance,
  uploadMoveInPhoto,
  type CheckInState,
} from "@/app/(resident)/portal/check-in/actions";

const initial: CheckInState = { ok: false };

const PROGRAMS = [
  { v: "ssi", l: "Supplemental Security Income (SSI)" },
  { v: "ssdi", l: "Social Security Disability Insurance (SSDI)" },
  { v: "colorado_works", l: "Cash Assistance (Colorado Works)" },
];

export function AssistanceDisclosureForm({ selected }: { selected: string[] }) {
  const [state, action, pending] = useActionState(discloseAssistance, initial);
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-ink-soft">
        Do you currently receive any of these? This is <strong>voluntary</strong>. If you do and you
        tell us, you may have a right to free mediation before any eviction — so it helps to let us
        know now.
      </p>
      <div className="space-y-2">
        {PROGRAMS.map((p) => (
          <label key={p.v} className="flex items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              name="assistance_programs"
              value={p.v}
              defaultChecked={selected.includes(p.v)}
              className="h-4 w-4 rounded border-clay-deep accent-pine"
            />
            {p.l}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save disclosure"}
        </Button>
        {state.ok && state.notice && <span className="text-sm text-pine">{state.notice}</span>}
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>
    </form>
  );
}

export function MoveInPhotoUploader() {
  const [state, action, pending] = useActionState(uploadMoveInPhoto, initial);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input
        type="text"
        name="caption"
        placeholder="Caption (e.g. living room wall, kitchen floor)"
        className="w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink"
      />
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          accept="image/*"
          capture="environment"
          required
          className="text-xs text-ink-soft file:mr-2 file:rounded-lg file:border file:border-clay-deep file:bg-sand file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink-soft"
        />
        <Button type="submit" variant="outline" size="md" disabled={pending}>
          {pending ? "Uploading…" : "Add photo"}
        </Button>
        {state.ok && state.notice && <span className="text-sm text-pine">{state.notice}</span>}
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>
    </form>
  );
}
