"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/ui";
import { submitApplication, type ApplyState } from "@/app/(public)/apply/actions";

type PropertyOption = { id: string; slug: string; name: string };

const initial: ApplyState = { ok: false };

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function ApplyForm({
  properties,
  defaultPropertyId,
}: {
  properties: PropertyOption[];
  defaultPropertyId?: string;
}) {
  const [state, action, pending] = useActionState(submitApplication, initial);

  if (state.ok) {
    return (
      <Card className="space-y-4 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-pine-soft text-pine-dark">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-ink">Application received</h2>
        <p className="mx-auto max-w-md text-ink-soft">
          Thank you — our team will review your application and reach out by
          email within a few business days. Keep an eye on your inbox.
        </p>
        <a
          href="/"
          className="inline-block text-sm font-medium text-pine hover:text-pine-dark"
        >
          ← Back to home
        </a>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <form action={action} className="space-y-5">
        {state.error && (
          <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-3 text-sm text-terracotta-dark">
            {state.error}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" error={state.fieldErrors?.first_name}>
            <input name="first_name" className={inputClass} autoComplete="given-name" />
          </Field>
          <Field label="Last name" error={state.fieldErrors?.last_name}>
            <input name="last_name" className={inputClass} autoComplete="family-name" />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" error={state.fieldErrors?.email}>
            <input name="email" type="email" className={inputClass} autoComplete="email" />
          </Field>
          <Field label="Phone" optional>
            <input name="phone" type="tel" className={inputClass} autoComplete="tel" />
          </Field>
        </div>

        <Field label="Which community?" error={state.fieldErrors?.property_id}>
          <select
            name="property_id"
            defaultValue={defaultPropertyId ?? ""}
            className={inputClass}
          >
            <option value="" disabled>
              Select a community…
            </option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Desired move-in" optional>
            <input name="desired_move_in" type="date" className={inputClass} />
          </Field>
          <Field label="Household size" optional>
            <input name="household_size" type="number" min={1} className={inputClass} />
          </Field>
          <Field label="Monthly income ($)" optional>
            <input name="monthly_income" type="number" min={0} step={100} className={inputClass} />
          </Field>
        </div>

        <Field label="Anything we should know?" optional>
          <textarea
            name="message"
            rows={4}
            className={inputClass}
            placeholder="Pets, parking needs, timing, questions…"
          />
        </Field>

        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs text-ink-faint">
            By applying you agree to be contacted about availability.
          </p>
          <Button type="submit" size="lg" variant="accent" disabled={pending}>
            {pending ? "Submitting…" : "Submit application"}
          </Button>
        </div>
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
