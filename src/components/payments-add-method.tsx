"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Card } from "@/components/ui";
import {
  addPaymentMethod,
  type PaymentsState,
} from "@/app/(resident)/portal/payments/actions";

const initial: PaymentsState = { ok: false };

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function PaymentsAddMethod() {
  const [state, action, pending] = useActionState(addPaymentMethod, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <Card className="p-6">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">
        Add bank account
      </h2>
      <p className="mb-4 text-sm text-ink-soft">
        ACH is the fastest, no-fee way to pay rent. (Demo — no real bank details
        are stored.)
      </p>
      <form ref={formRef} action={action} className="space-y-4">
        {state.error && (
          <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-2.5 text-sm text-terracotta-dark">
            {state.error}
          </div>
        )}
        {state.ok && state.notice && (
          <div className="rounded-xl border border-pine/30 bg-pine-soft px-4 py-2.5 text-sm text-pine-dark">
            {state.notice}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Account type</span>
            <select name="kind" className={inputClass} defaultValue="ach">
              <option value="ach">Bank account (ACH)</option>
              <option value="card">Debit / credit card</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Last 4 digits</span>
            <input
              name="last4"
              inputMode="numeric"
              maxLength={4}
              className={inputClass}
              placeholder="1234"
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">
            Nickname <span className="text-ink-faint">(optional)</span>
          </span>
          <input name="nickname" className={inputClass} placeholder="Main checking" />
        </label>

        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Adding…" : "Add account"}
        </Button>
      </form>
    </Card>
  );
}
