"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { signRepaymentPlan, type SignState } from "@/app/(resident)/portal/repayment/actions";

const initial: SignState = { ok: false };
const field =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function RepaymentSignForm({
  planId,
  defaultName,
  attestation,
}: {
  planId: string;
  defaultName: string;
  attestation: string;
}) {
  const [state, action, pending] = useActionState(signRepaymentPlan, initial);

  if (state.ok) {
    return (
      <div className="rounded-xl border border-pine/30 bg-pine-soft px-4 py-3 text-sm text-pine-dark">
        <strong>Signed ✓</strong> — thank you. Once the landlord countersigns, you&apos;ll receive
        the fully executed copy by email for your records.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {state.error && (
        <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-2.5 text-sm text-terracotta-dark">
          {state.error}
        </div>
      )}
      <input type="hidden" name="plan_id" value={planId} />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink">
          Type your full name to sign <span className="text-terracotta-dark">*</span>
        </span>
        <input name="signed_name" defaultValue={defaultName} required className={field} />
      </label>
      <label className="flex items-start gap-2.5 rounded-xl border border-clay bg-sand/40 px-4 py-3 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="attest"
          value="on"
          required
          className="mt-0.5 h-4 w-4 rounded border-clay-deep accent-pine"
        />
        <span>{attestation}</span>
      </label>
      <Button type="submit" size="lg" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Signing…" : "Sign the agreement"}
      </Button>
      <p className="text-center text-xs text-ink-faint">
        Your typed name, the date and time, and your device information are recorded with your
        signature (Colorado UETA).
      </p>
    </form>
  );
}
