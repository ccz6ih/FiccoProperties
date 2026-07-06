"use client";

import { useActionState, useState } from "react";
import { Button, Card } from "@/components/ui";
import { signLease, type SignState } from "@/app/(resident)/portal/lease/actions";

const initial: SignState = { ok: false };

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

const ACKS = [
  "I have read and agree to the full lease terms above.",
  "Rent is due on the 1st of each month; a late fee may apply after the grace period.",
  "I will give proper written notice before moving out, as my lease requires.",
  "Only the people and pets listed on my lease may live in the home.",
];

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
  const [initials, setInitials] = useState<string[]>(() => ACKS.map(() => ""));

  const allInitialed = initials.every((i) => i.trim().length > 0);
  const canSign = name.trim().length > 0 && consent && allInitialed && !pending;

  function setInitial(i: number, v: string) {
    setInitials((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  }

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

          {/* Initial each acknowledgement */}
          <div className="space-y-2 rounded-xl border border-clay bg-sand/30 p-4">
            <div className="text-sm font-medium text-ink">Initial each item</div>
            {ACKS.map((ack, i) => (
              <div key={i} className="flex items-start gap-3">
                <input type="hidden" name="ack_label" value={ack} />
                <input
                  name="ack_initials"
                  value={initials[i]}
                  onChange={(e) => setInitial(i, e.target.value.toUpperCase().slice(0, 5))}
                  placeholder="INT"
                  aria-label={`Initials for: ${ack}`}
                  className="mt-0.5 w-16 shrink-0 rounded-lg border border-clay-deep bg-white px-2 py-1.5 text-center text-sm font-semibold uppercase text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30"
                />
                <span className="text-sm text-ink-soft">{ack}</span>
              </div>
            ))}
          </div>

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
