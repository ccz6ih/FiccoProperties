"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { signRepaymentPlanAsLandlord } from "@/app/(admin)/admin/repayment-plans/actions";
import type { EmailActionState } from "@/lib/action-state";

const initial: EmailActionState = { ok: false };

export function LandlordSignForm({
  planId,
  defaultName,
}: {
  planId: string;
  defaultName: string;
}) {
  const [state, action, pending] = useActionState(signRepaymentPlanAsLandlord, initial);

  if (state.ok) {
    return <p className="text-sm font-medium text-pine">Countersigned ✓</p>;
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="plan_id" value={planId} />
      <input
        name="signed_name"
        defaultValue={defaultName}
        placeholder="Your name"
        required
        className="rounded-lg border border-clay-deep bg-white px-3 py-1.5 text-sm text-ink"
      />
      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Signing…" : "Countersign"}
      </Button>
      {state.error && <span className="text-xs text-terracotta-dark">{state.error}</span>}
    </form>
  );
}
