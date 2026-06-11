"use client";

import { useActionState, useState } from "react";
import { Button, Card } from "@/components/ui";
import { signLease, type SignState } from "@/app/(resident)/portal/lease/actions";

const initial: SignState = { ok: false };

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function LeaseSignForm({
  leaseId,
  terms,
}: {
  leaseId: string;
  terms: string | null;
}) {
  const [state, action, pending] = useActionState(signLease, initial);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);

  const canSign = name.trim().length > 0 && consent && !pending;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">
          Lease agreement
        </h2>
        <div className="max-h-96 overflow-y-auto rounded-xl border border-clay bg-cream px-4 py-3 text-sm leading-relaxed text-ink-soft whitespace-pre-wrap">
          {terms?.trim() || "No terms have been provided for this lease."}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 font-display text-lg font-semibold text-ink">
          Electronic signature
        </h2>
        <p className="mb-4 text-sm text-ink-soft">
          By signing, you agree to the terms above. Your name, the date, and your
          IP address are recorded as your electronic signature.
        </p>

        <form action={action} className="space-y-4">
          {state.error && (
            <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-2.5 text-sm text-terracotta-dark">
              {state.error}
            </div>
          )}

          <input type="hidden" name="lease_id" value={leaseId} />

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">
              Type your full legal name
            </span>
            <input
              name="signature_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Jane Q. Resident"
              autoComplete="name"
            />
          </label>

          <label className="flex items-start gap-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              name="consent"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-clay-deep text-pine focus:ring-pine/30"
            />
            <span>
              I agree this constitutes my electronic signature and is legally
              binding.
            </span>
          </label>

          <Button type="submit" variant="primary" disabled={!canSign}>
            {pending ? "Signing…" : "Sign lease"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
