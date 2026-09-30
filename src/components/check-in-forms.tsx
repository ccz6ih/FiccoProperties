"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import {
  discloseAssistance,
  saveForwarding,
  type CheckInState,
} from "@/app/(resident)/portal/check-in/actions";

const initial: CheckInState = { ok: false };
type Action = (state: CheckInState, form: FormData) => Promise<CheckInState>;

const inputClass =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

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

/**
 * The file input plus its submit button, owning the "how many did you pick"
 * count. Kept as its own component so a successful upload can remount it —
 * which clears the chosen files and the count together, with no effect
 * reaching in to reset state after the fact.
 */
function PhotoPicker({ pending }: { pending: boolean }) {
  const [picked, setPicked] = useState(0);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* `multiple` lets them pick a whole room at once. No `capture` — on a
          phone that forces the camera and allows only one shot at a time,
          which is what made documenting a home so tedious. */}
      <input
        type="file"
        name="file"
        accept="image/*"
        multiple
        required
        onChange={(e) => setPicked(e.currentTarget.files?.length ?? 0)}
        className="text-xs text-ink-soft file:mr-2 file:rounded-lg file:border file:border-clay-deep file:bg-sand file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink-soft"
      />
      <Button type="submit" variant="outline" size="md" disabled={pending}>
        {pending
          ? `Uploading${picked > 1 ? ` ${picked} photos` : ""}…`
          : picked > 1
            ? `Add ${picked} photos`
            : "Add photos"}
      </Button>
    </div>
  );
}

export function PhotoUploader({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="space-y-3">
      <input
        type="text"
        name="caption"
        placeholder="Caption for this batch (e.g. living room, kitchen)"
        className={inputClass}
        key={state.ok ? `caption-${state.notice}` : "caption"}
      />
      <PhotoPicker key={state.ok ? `picker-${state.notice}` : "picker"} pending={pending} />
      <div className="flex flex-wrap items-center gap-3">
        {state.ok && state.notice && <span className="text-sm text-pine">{state.notice}</span>}
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>
      <p className="text-xs text-ink-faint">
        Pick as many as you like in one go — on a phone, choose from your library to select several,
        or use the camera button to take a new one. Large batches take a moment.
      </p>
    </form>
  );
}

export function ForwardingForm({
  forwarding,
  moveOut,
}: {
  forwarding: string | null;
  moveOut: string | null;
}) {
  const [state, action, pending] = useActionState(saveForwarding, initial);
  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink">Planned move-out date</span>
        <input type="date" name="move_out_date" defaultValue={moveOut ?? ""} className={inputClass} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink">Forwarding address</span>
        <textarea
          name="forwarding_address"
          rows={3}
          defaultValue={forwarding ?? ""}
          placeholder="Where should we mail your deposit refund?"
          className={inputClass}
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.ok && state.notice && <span className="text-sm text-pine">{state.notice}</span>}
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>
    </form>
  );
}
