"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  recordOfflinePayment,
  type AdminPaymentsState,
} from "@/app/(admin)/admin/payments/actions";

const initial: AdminPaymentsState = { ok: false };

export function PaymentsRecordButton({ chargeId }: { chargeId: string }) {
  const [state, action, pending] = useActionState(recordOfflinePayment, initial);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="charge_id" value={chargeId} />
      <Button type="submit" variant="outline" size="md" disabled={pending}>
        {pending ? "Recording…" : "Record payment"}
      </Button>
      {state.error && (
        <span className="text-xs text-terracotta-dark">{state.error}</span>
      )}
    </form>
  );
}
