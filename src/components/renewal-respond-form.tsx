"use client";

import { useActionState, useState } from "react";
import { Button, Card } from "@/components/ui";
import { formatCents } from "@/lib/format";
import {
  respondToRenewal,
  type RespondState,
} from "@/app/(resident)/portal/renewal/actions";

const initial: RespondState = { ok: false };
const field =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export type PortalOffer = {
  id: string;
  newRentCents: number;
  currentRentCents: number;
  termMonths: number;
  effectiveDate: string; // human formatted
  endDate: string | null; // human formatted
};

function termLabel(months: number): string {
  if (months === 0) return "Month-to-month";
  if (months === 12) return "12 months (1 year)";
  return `${months} months`;
}

export function RenewalRespondForm({ offer, defaultName }: { offer: PortalOffer; defaultName: string }) {
  const [state, action, pending] = useActionState(respondToRenewal, initial);
  const [mode, setMode] = useState<"none" | "accept" | "decline">("none");

  if (state.ok) {
    return (
      <Card className="space-y-3 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-pine-soft text-pine-dark">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="font-display text-xl font-semibold text-ink">Response recorded</h3>
        <p className="mx-auto max-w-md text-sm text-ink-soft">
          Thank you — we&apos;ve let the management team know, and you&apos;ll get a confirmation email
          for your records.
        </p>
      </Card>
    );
  }

  const delta = offer.newRentCents - offer.currentRentCents;

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-5 rounded-xl border border-pine/30 bg-pine/5 px-5 py-4 text-center">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">New monthly rent</div>
        <div className="font-display text-3xl font-semibold text-pine">{formatCents(offer.newRentCents)}</div>
        {delta !== 0 ? (
          <div className="mt-0.5 text-xs text-ink-soft">
            Currently {formatCents(offer.currentRentCents)} · a change of {formatCents(Math.abs(delta))}/month
          </div>
        ) : (
          <div className="mt-0.5 text-xs font-medium text-pine">No change from your current rent</div>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-clay bg-sand/40 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-ink-faint">Term</div>
          <div className="text-sm font-medium text-ink">{termLabel(offer.termMonths)}</div>
        </div>
        <div className="rounded-xl border border-clay bg-sand/40 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-ink-faint">Starts</div>
          <div className="text-sm font-medium text-ink">
            {offer.effectiveDate}
            {offer.endDate ? ` → ${offer.endDate}` : ""}
          </div>
        </div>
      </div>

      {mode === "none" && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" size="lg" variant="primary" className="flex-1" onClick={() => setMode("accept")}>
            Accept & sign →
          </Button>
          <Button type="button" size="lg" variant="outline" className="flex-1" onClick={() => setMode("decline")}>
            I don&apos;t plan to renew
          </Button>
        </div>
      )}

      {mode === "accept" && (
        <form action={action} className="space-y-4 border-t border-clay pt-5">
          <input type="hidden" name="offer_id" value={offer.id} />
          <input type="hidden" name="mode" value="accept" />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">
              Type your full name to sign <span className="text-terracotta-dark">*</span>
            </span>
            <input name="signed_name" defaultValue={defaultName} required className={field} />
          </label>
          <label className="flex items-start gap-2.5 rounded-xl border border-clay bg-sand/40 px-4 py-3 text-sm text-ink-soft">
            <input type="checkbox" name="agree" value="on" required className="mt-0.5 h-4 w-4 rounded border-clay-deep accent-pine" />
            <span>
              I agree to renew my tenancy on the terms above — {formatCents(offer.newRentCents)}/month,{" "}
              {termLabel(offer.termMonths).toLowerCase()}, starting {offer.effectiveDate}. I understand this
              typed signature has the same effect as a handwritten one.
            </span>
          </label>
          {state.error && <p className="text-sm text-terracotta-dark">{state.error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" size="lg" variant="primary" disabled={pending}>
              {pending ? "Signing…" : "Sign & accept renewal"}
            </Button>
            <button type="button" onClick={() => setMode("none")} className="text-sm text-ink-soft hover:text-ink">
              Back
            </button>
          </div>
        </form>
      )}

      {mode === "decline" && (
        <form action={action} className="space-y-4 border-t border-clay pt-5">
          <input type="hidden" name="offer_id" value={offer.id} />
          <input type="hidden" name="mode" value="decline" />
          <p className="text-sm text-ink-soft">
            We&apos;re sorry to see you go! If something about the offer isn&apos;t working, reply to our
            email or call (720) 527-2596 first — we&apos;re happy to talk.
          </p>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Anything you&apos;d like us to know? (optional)</span>
            <textarea name="reason" rows={2} className={field} placeholder="Moving for work, buying a home…" />
          </label>
          {state.error && <p className="text-sm text-terracotta-dark">{state.error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" size="lg" variant="outline" disabled={pending}>
              {pending ? "Sending…" : "Confirm — I won't renew"}
            </Button>
            <button type="button" onClick={() => setMode("none")} className="text-sm text-ink-soft hover:text-ink">
              Back
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
