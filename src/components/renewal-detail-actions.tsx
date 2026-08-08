"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  emailRenewalOffer,
  markRenewalServed,
  applyRenewalNow,
  withdrawRenewalOffer,
  type RenewalState,
} from "@/app/(admin)/admin/renewals/actions";

const initial: RenewalState = { ok: false };
const inputSm =
  "rounded-lg border border-clay-deep bg-white px-2 py-1.5 text-sm text-ink";

export function RenewalEmailButton({ offerId }: { offerId: string }) {
  const [state, action, pending] = useActionState(emailRenewalOffer, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={offerId} />
      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Sending…" : "Email offer to tenant"}
      </Button>
      {state.ok && state.notice && <span className="text-xs font-medium text-pine">{state.notice}</span>}
      {state.error && <span className="text-xs text-terracotta-dark">{state.error}</span>}
    </form>
  );
}

export function RenewalServeForm({ offerId }: { offerId: string }) {
  const [state, action, pending] = useActionState(markRenewalServed, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={offerId} />
      <label className="space-y-1">
        <span className="block text-xs font-medium text-ink-soft">Served on</span>
        <input type="date" name="served_on" className={inputSm} required />
      </label>
      <label className="space-y-1">
        <span className="block text-xs font-medium text-ink-soft">How</span>
        <select name="method" defaultValue="posted" className={inputSm}>
          <option value="posted">Posted on door</option>
          <option value="personal">Hand delivered</option>
          <option value="mailed">Mailed</option>
          <option value="email">Email only</option>
        </select>
      </label>
      <Button type="submit" variant="outline" size="md" disabled={pending}>
        {pending ? "Saving…" : "Record service"}
      </Button>
      {state.ok && state.notice && <span className="pb-2 text-xs font-medium text-pine">{state.notice}</span>}
      {state.error && <span className="pb-2 text-xs text-terracotta-dark">{state.error}</span>}
    </form>
  );
}

export function RenewalApplyButton({ offerId }: { offerId: string }) {
  const [state, action, pending] = useActionState(applyRenewalNow, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={offerId} />
      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Applying…" : "Apply new terms now"}
      </Button>
      {state.ok && state.notice && <span className="text-xs font-medium text-pine">{state.notice}</span>}
      {state.error && <span className="text-xs text-terracotta-dark">{state.error}</span>}
    </form>
  );
}

export function RenewalWithdrawButton({ offerId }: { offerId: string }) {
  return (
    <form action={withdrawRenewalOffer}>
      <input type="hidden" name="id" value={offerId} />
      <button
        type="submit"
        className="text-xs font-medium text-ink-faint hover:text-terracotta-dark"
      >
        Withdraw this offer
      </button>
    </form>
  );
}
