"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { joinWaitlist, type GrowthState } from "@/app/(public)/availability/actions";
import { getFunnelSessionId } from "@/components/funnel-ping";

const initial: GrowthState = { ok: false };
const field =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function WaitlistForm({ properties }: { properties: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(joinWaitlist, initial);
  const [fsid, setFsid] = useState("");

  useEffect(() => {
    setFsid(getFunnelSessionId());
  }, []);

  if (state.ok) {
    return (
      <Card className="p-6 text-center sm:p-8">
        <div className="text-3xl">✅</div>
        <h3 className="mt-2 font-display text-xl font-semibold text-ink">You&apos;re on the list</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          We&apos;ll reach out the moment a home that fits opens up — the waitlist always hears
          first. Check your email for a confirmation.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-ink">Join the waitlist</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Our homes turn fast and rarely sit empty. Waitlist members hear first — before anything
        is posted publicly.
      </p>

      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="fsid" value={fsid} />
        {state.error && (
          <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-2.5 text-sm text-terracotta-dark">
            {state.error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Name</span>
            <input name="name" required className={field} autoComplete="name" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Email</span>
            <input name="email" type="email" required className={field} autoComplete="email" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Phone <span className="text-xs font-normal text-ink-faint">optional</span></span>
            <input name="phone" type="tel" className={field} autoComplete="tel" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Community</span>
            <select name="property_id" defaultValue="" className={field}>
              <option value="">Any community</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Size</span>
            <select name="bedrooms" defaultValue="any" className={field}>
              <option value="any">Any size</option>
              <option value="studio">Studio</option>
              <option value="1">1 bedroom</option>
              <option value="2">2 bedroom</option>
              <option value="3+">3+ bedroom</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Move in by <span className="text-xs font-normal text-ink-faint">optional</span></span>
            <input type="date" name="move_in_by" className={field} />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Anything else? <span className="text-xs font-normal text-ink-faint">optional</span></span>
          <input name="notes" placeholder="Budget, ground floor, parking…" className={field} />
        </label>

        <Button type="submit" size="lg" variant="primary" className="w-full" disabled={pending}>
          {pending ? "Joining…" : "Join the waitlist"}
        </Button>
      </form>
    </Card>
  );
}
