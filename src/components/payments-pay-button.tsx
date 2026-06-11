"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  payCharge,
  type PaymentsState,
} from "@/app/(resident)/portal/payments/actions";

const initial: PaymentsState = { ok: false };

export function PaymentsPayButton({
  chargeId,
  methods,
  amountLabel,
}: {
  chargeId: string;
  methods: { id: string; label: string }[];
  amountLabel: string;
}) {
  const [state, action, pending] = useActionState(payCharge, initial);
  const hasMethods = methods.length > 0;

  return (
    <form action={action} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="charge_id" value={chargeId} />
      <div className="flex items-center gap-2">
        {hasMethods && (
          <select
            name="method_id"
            defaultValue={methods[0].id}
            className="rounded-lg border border-clay-deep bg-white px-2.5 py-1.5 text-xs font-medium text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30"
          >
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        )}
        <Button type="submit" variant="primary" disabled={pending || !hasMethods}>
          {pending ? "Paying…" : `Pay ${amountLabel}`}
        </Button>
      </div>
      {!hasMethods && (
        <span className="text-xs text-ink-faint">Add a bank account to pay.</span>
      )}
      {state.error && (
        <span className="text-xs text-terracotta-dark">{state.error}</span>
      )}
    </form>
  );
}
