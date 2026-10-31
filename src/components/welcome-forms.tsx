"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import {
  setPaymentPreference,
  confirmMoveIn,
  type WelcomeState,
} from "@/app/(resident)/portal/welcome/actions";
import { RENT_DROPBOX } from "@/lib/rent-dropbox";

const initial: WelcomeState = { ok: false };

// Online card / bank payment isn't live yet — it's being set up. Offering it
// here would have residents choose a way to pay that doesn't exist, so it's
// named as coming rather than listed as an option. The database still accepts
// 'online', so this is the only place to change when it opens.
const OPTIONS = [
  {
    v: "money_order",
    l: "Money order",
    d: `Made payable to ${RENT_DROPBOX.payee}. Most of our residents pay this way.`,
    icon: "✉️",
  },
  {
    v: "check",
    l: "Personal check",
    d: `Made payable to ${RENT_DROPBOX.payee}.`,
    icon: "🖊️",
  },
];

/**
 * How they intend to pay. Laid out as pickable cards rather than a dropdown —
 * the payee name matters more than the choice does, and it has to be readable
 * without being hunted for.
 */
export function PaymentPreferenceForm({ chosen }: { chosen: string | null }) {
  const [state, action, pending] = useActionState(setPaymentPreference, initial);
  const [picked, setPicked] = useState(chosen ?? "");

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-2.5">
        {OPTIONS.map((o) => {
          const on = picked === o.v;
          return (
            <label
              key={o.v}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                on
                  ? "border-pine bg-pine/5 ring-1 ring-pine"
                  : "border-clay-deep bg-white hover:border-pine/50"
              }`}
            >
              <input
                type="radio"
                name="payment_preference"
                value={o.v}
                checked={on}
                onChange={() => setPicked(o.v)}
                className="mt-1 h-4 w-4 shrink-0 border-clay-deep accent-pine"
              />
              <span className="min-w-0">
                <span className="block text-base font-semibold text-ink">
                  <span aria-hidden className="mr-1.5">
                    {o.icon}
                  </span>
                  {o.l}
                </span>
                <span className="mt-0.5 block text-sm text-ink-soft">{o.d}</span>
              </span>
            </label>
          );
        })}
      </div>

      <p className="text-sm text-ink-faint">
        💳 Paying online by card or bank is coming soon — we&apos;re setting it up now and
        we&apos;ll email you the moment it&apos;s ready.
      </p>

      {picked !== "" && (
        <div className="rounded-xl border border-clay bg-sand/50 p-4">
          <div className="text-[11px] uppercase tracking-wide text-ink-faint">
            Where it goes
          </div>
          <div className="mt-0.5 text-base font-semibold text-ink">{RENT_DROPBOX.full}</div>
          <div className="mt-1 text-sm text-ink-soft">
            Payable to <strong className="text-ink">{RENT_DROPBOX.payee}</strong>. Please write
            your unit number on it.
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending || !picked}>
          {pending ? "Saving…" : chosen ? "Update my choice" : "That's how I'll pay"}
        </Button>
        {state.ok && state.notice && <span className="text-sm text-pine">{state.notice}</span>}
        {state.error && (
          <span className="text-sm text-terracotta-dark">{state.error}</span>
        )}
      </div>
    </form>
  );
}

/**
 * The move-in day. Pre-filled from the application where we have one, but it's
 * theirs to confirm — the lease start follows from whatever they put here.
 */
export function MoveInDateForm({
  current,
  suggested,
}: {
  current: string | null;
  suggested: string | null;
}) {
  const [state, action, pending] = useActionState(confirmMoveIn, initial);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">
          The day you plan to move in
        </span>
        <input
          type="date"
          name="move_in_date"
          required
          min={today}
          defaultValue={current ?? suggested ?? ""}
          className="w-full max-w-xs rounded-lg border border-clay-deep bg-white px-3 py-2.5 text-base text-ink"
        />
      </label>

      {!current && suggested && (
        <p className="text-sm text-ink-soft">
          Your application said {suggested}. Change it if that&apos;s moved — we&apos;d rather
          know now than on the day.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : current ? "Change my move-in day" : "Confirm my move-in day"}
        </Button>
        {state.ok && state.notice && <span className="text-sm text-pine">{state.notice}</span>}
        {state.error && (
          <span className="text-sm text-terracotta-dark">{state.error}</span>
        )}
      </div>
    </form>
  );
}
