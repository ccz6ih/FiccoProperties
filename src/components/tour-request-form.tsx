"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/ui";
import {
  submitTourRequest,
  type TourState,
} from "@/app/(public)/properties/[slug]/tour-actions";

const initial: TourState = { ok: false };

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function TourRequestForm({
  propertyId,
  propertyName,
}: {
  propertyId: string;
  propertyName: string;
}) {
  const [state, action, pending] = useActionState(submitTourRequest, initial);

  if (state.ok) {
    return (
      <Card className="space-y-3 p-6 text-center sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-pine-soft text-pine-dark">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="font-display text-xl font-semibold text-ink">
          Request received
        </h3>
        <p className="mx-auto max-w-sm text-sm text-ink-soft">
          Thanks — we&apos;ll reach out to schedule your tour.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <form action={action} className="space-y-5">
        <div className="space-y-1">
          <h3 className="font-display text-xl font-semibold text-ink">
            Request a tour
          </h3>
          <p className="text-sm text-ink-soft">
            Come see {propertyName} in person — tell us when works and we&apos;ll
            be in touch.
          </p>
        </div>

        {state.error && (
          <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-3 text-sm text-terracotta-dark">
            {state.error}
          </div>
        )}

        <input type="hidden" name="property_id" value={propertyId} />
        <input type="hidden" name="property_name" value={propertyName} />

        <Field label="Name" error={state.fieldErrors?.name}>
          <input name="name" className={inputClass} autoComplete="name" />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" error={state.fieldErrors?.email}>
            <input name="email" type="email" className={inputClass} autoComplete="email" />
          </Field>
          <Field label="Phone" optional>
            <input name="phone" type="tel" className={inputClass} autoComplete="tel" />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Preferred date" optional>
            <input name="preferred_date" type="date" className={inputClass} />
          </Field>
          <Field label="Preferred time" optional>
            <select name="preferred_time" defaultValue="" className={inputClass}>
              <option value="">No preference</option>
              <option value="Morning">Morning</option>
              <option value="Afternoon">Afternoon</option>
              <option value="Evening">Evening</option>
              <option value="Flexible">Flexible</option>
            </select>
          </Field>
        </div>

        <Field label="Anything we should know?" optional>
          <textarea
            name="message"
            rows={3}
            className={inputClass}
            placeholder="Questions, timing, who's joining you…"
          />
        </Field>

        <Button type="submit" variant="accent" className="w-full" disabled={pending}>
          {pending ? "Sending…" : "Request a tour"}
        </Button>
      </form>
    </Card>
  );
}

function Field({
  label,
  error,
  optional,
  children,
}: {
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-2 text-sm font-medium text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-ink-faint">optional</span>}
        {error && <span className="text-xs font-normal text-terracotta-dark">{error}</span>}
      </span>
      {children}
    </label>
  );
}
