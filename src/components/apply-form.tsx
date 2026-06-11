"use client";

import { useState } from "react";
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

  // Track the required consents so we can disable submit until they're all met.
  const [petsAck, setPetsAck] = useState(false);
  const [authScreening, setAuthScreening] = useState(false);
  const [authLandlord, setAuthLandlord] = useState(false);
  const [signature, setSignature] = useState("");

  const consentsMet =
    petsAck && authScreening && authLandlord && signature.trim().length > 0;

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
      <form action={action} className="space-y-8">
        {state.error && (
          <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-3 text-sm text-terracotta-dark">
            {state.error}
          </div>
        )}

        {/* Pet policy notice */}
        <div className="space-y-3 rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-4">
          <h3 className="text-sm font-semibold text-terracotta-dark">Pet policy</h3>
          <p className="text-sm text-terracotta-dark">
            None of the Ficco Properties communities allow pets. We&apos;re a
            pet-free environment for all of our residents.
          </p>
          <p className="text-xs text-terracotta-dark/90">
            Assistance animals that are not pets may be requested as a reasonable
            accommodation.
          </p>
          <label className="flex items-start gap-2.5 pt-1 text-sm text-terracotta-dark">
            <input
              type="checkbox"
              name="pets_ack"
              checked={petsAck}
              onChange={(e) => setPetsAck(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-clay-deep text-pine focus:ring-pine/30"
            />
            <span>
              I understand that pets are not permitted at any Ficco community.
              {state.fieldErrors?.pets_ack && (
                <span className="ml-2 text-xs font-medium">
                  {state.fieldErrors.pets_ack}
                </span>
              )}
            </span>
          </label>
        </div>

        {/* Applicant */}
        <Section title="About you">
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

          <Field label="Date of birth" error={state.fieldErrors?.date_of_birth}>
            <input name="date_of_birth" type="date" className={inputClass} autoComplete="bday" />
          </Field>

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
        </Section>

        {/* Current residence */}
        <Section title="Where you live now">
          <Field label="Current address" error={state.fieldErrors?.current_address}>
            <input
              name="current_address"
              className={inputClass}
              autoComplete="street-address"
              placeholder="Street, city, state, ZIP"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="How long at this address?"
              error={state.fieldErrors?.current_residency_length}
            >
              <input
                name="current_residency_length"
                className={inputClass}
                placeholder="e.g. 2 years"
              />
            </Field>
            <Field label="Reason for moving" optional>
              <input name="reason_for_moving" className={inputClass} />
            </Field>
          </div>
        </Section>

        {/* Employment */}
        <Section title="Employment">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Employer name" optional>
              <input name="employer_name" className={inputClass} autoComplete="organization" />
            </Field>
            <Field label="Employer phone" optional>
              <input name="employer_phone" type="tel" className={inputClass} />
            </Field>
          </div>
        </Section>

        {/* Current landlord */}
        <Section title="Current landlord">
          <Field label="Landlord name" error={state.fieldErrors?.landlord_name}>
            <input name="landlord_name" className={inputClass} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Landlord phone" error={state.fieldErrors?.landlord_phone}>
              <input name="landlord_phone" type="tel" className={inputClass} />
            </Field>
            <Field label="Landlord email" optional>
              <input name="landlord_email" type="email" className={inputClass} />
            </Field>
          </div>
        </Section>

        {/* ID photo */}
        <Section title="Photo ID (optional)">
          <Field label="Upload a photo of your ID" optional>
            <input
              name="id_photo"
              type="file"
              accept="image/*"
              className="block w-full text-sm text-ink-soft file:mr-4 file:rounded-full file:border-0 file:bg-sand file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-clay"
            />
          </Field>
          <p className="text-xs text-ink-faint">
            Stored securely — only Ficco staff can view it. You can also bring
            your ID when you tour.
          </p>
        </Section>

        {/* Anything else */}
        <Field label="Anything we should know?" optional>
          <textarea
            name="message"
            rows={4}
            className={inputClass}
            placeholder="Parking needs, timing, questions…"
          />
        </Field>

        {/* Authorization / consent */}
        <Section title="Background check & authorizations">
          <div className="space-y-3 rounded-xl border border-clay bg-sand/40 px-4 py-4 text-sm text-ink-soft">
            <p>
              As part of our review, applicants complete a credit and background
              screening through TransUnion SmartMove. After we receive your
              application we&apos;ll email you a secure link to start it. The
              screening fee is approximately <strong>$40</strong> and is paid by
              you directly to TransUnion SmartMove — Ficco never sees your Social
              Security number or payment details.
            </p>
            <p>
              By signing below you authorize Ficco Properties to obtain a
              consumer, credit, and background report about you, and to contact
              your current and previous landlords and your employer to verify the
              information in this application. This authorization is provided in
              accordance with the Fair Credit Reporting Act (FCRA).
            </p>
          </div>

          <Field label="Type your full name to sign" error={state.fieldErrors?.signature_name}>
            <input
              name="signature_name"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className={inputClass}
              autoComplete="name"
              placeholder="Full legal name"
            />
          </Field>

          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              name="authorize_screening"
              checked={authScreening}
              onChange={(e) => setAuthScreening(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-clay-deep text-pine focus:ring-pine/30"
            />
            <span>
              I authorize Ficco Properties to request a credit and background
              screening (~$40, paid by me to TransUnion SmartMove).
              {state.fieldErrors?.authorize_screening && (
                <span className="ml-2 text-xs font-medium text-terracotta-dark">
                  {state.fieldErrors.authorize_screening}
                </span>
              )}
            </span>
          </label>

          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              name="authorize_landlord_contact"
              checked={authLandlord}
              onChange={(e) => setAuthLandlord(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-clay-deep text-pine focus:ring-pine/30"
            />
            <span>
              I authorize Ficco Properties to contact my current and previous
              landlords and my employer.
              {state.fieldErrors?.authorize_landlord_contact && (
                <span className="ml-2 text-xs font-medium text-terracotta-dark">
                  {state.fieldErrors.authorize_landlord_contact}
                </span>
              )}
            </span>
          </label>
        </Section>

        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs text-ink-faint">
            By applying you agree to be contacted about availability.
          </p>
          <Button
            type="submit"
            size="lg"
            variant="accent"
            disabled={pending || !consentsMet}
          >
            {pending ? "Submitting…" : "Submit application"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-5">
      <legend className="font-display text-lg font-semibold text-ink">
        {title}
      </legend>
      {children}
    </fieldset>
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
