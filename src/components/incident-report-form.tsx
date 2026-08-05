"use client";

import { useActionState, useState } from "react";
import { Button, Card } from "@/components/ui";
import {
  submitIncidentReport,
  type IncidentState,
} from "@/app/(resident)/portal/incident/actions";

const initial: IncidentState = { ok: false };

const field =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export type IncidentDefaults = {
  name: string;
  phone: string;
  email: string;
  home: string;
};

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-clay pt-6">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pine text-xs text-cream">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Radio({ name, value, label }: { name: string; value: string; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input type="radio" name={name} value={value} className="h-4 w-4 accent-pine" />
      {label}
    </label>
  );
}

export function IncidentReportForm({ defaults }: { defaults: IncidentDefaults }) {
  const [state, action, pending] = useActionState(submitIncidentReport, initial);
  const [hurt, setHurt] = useState(false);
  const [police, setPolice] = useState(false);
  const [before, setBefore] = useState(false);

  if (state.ok) {
    return (
      <Card className="space-y-3 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-pine-soft text-pine-dark">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="font-display text-xl font-semibold text-ink">Report submitted</h3>
        <p className="mx-auto max-w-md text-sm text-ink-soft">
          Thank you — your report is on file and our team has been notified. We&apos;ve emailed you a
          copy for your records. If anything changes, you can file another report anytime.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      {/* Safety notice */}
      <div className="mb-6 rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-3 text-sm text-terracotta-dark">
        <strong>If you are in danger right now, call 911 first.</strong> Fill this out afterward.
        Write only what you saw and heard yourself. If you don&apos;t know an answer, write
        &ldquo;don&apos;t know&rdquo; — that&apos;s fine.
      </div>

      <form action={action} className="space-y-6">
        {state.error && (
          <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-3 text-sm text-terracotta-dark">
            {state.error}
          </div>
        )}

        {/* 1 · Who is filling this out */}
        <Section n={1} title="Who is filling this out">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Your name</span>
              <input name="reporter_name" defaultValue={defaults.name} className={field} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Home</span>
              <input value={defaults.home} readOnly className={`${field} bg-sand/50 text-ink-soft`} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Phone</span>
              <input name="reporter_phone" defaultValue={defaults.phone} className={field} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Email</span>
              <input name="reporter_email" defaultValue={defaults.email} readOnly className={`${field} bg-sand/50 text-ink-soft`} />
            </label>
          </div>
        </Section>

        {/* 2 · When and where */}
        <Section n={2} title="When and where it happened">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Date it happened</span>
              <input type="date" name="occurred_on" className={field} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Time (about)</span>
              <input name="occurred_time" placeholder="e.g. 9:30 pm" className={field} />
            </label>
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-medium text-ink">Where exactly</span>
              <input name="location" placeholder="Unit, parking lot, sidewalk…" className={field} />
            </label>
          </div>
        </Section>

        {/* 3 · Who was involved */}
        <Section n={3} title="Who was involved">
          <label className="block space-y-1.5">
            <span className="text-sm text-ink-soft">
              Names of everyone involved. If you don&apos;t know a name, describe the person. Include
              anyone who was just watching.
            </span>
            <textarea name="involved" rows={2} className={field} />
          </label>
        </Section>

        {/* 4 · What happened */}
        <Section n={4} title="What happened">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">
              Describe it in your own words <span className="text-terracotta-dark">*</span>
            </span>
            <span className="block text-xs text-ink-faint">
              Start at the beginning and go in order. Write what was said and done, as close to
              word-for-word as you can remember.
            </span>
            <textarea name="narrative" rows={7} required className={field} />
          </label>
        </Section>

        {/* 5 · Quick questions */}
        <Section n={5} title="A few quick questions">
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Was anyone hurt?</p>
              <div className="flex flex-wrap items-center gap-5" onChange={(e) => setHurt((e.target as HTMLInputElement).value === "yes")}>
                <Radio name="anyone_hurt" value="no" label="No" />
                <Radio name="anyone_hurt" value="yes" label="Yes" />
              </div>
              {hurt && (
                <input name="hurt_details" placeholder="Who and how?" className={`${field} mt-3`} />
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-ink">Did anyone call the police?</p>
              <div className="flex flex-wrap items-center gap-5" onChange={(e) => setPolice((e.target as HTMLInputElement).value === "yes")}>
                <Radio name="police_called" value="no" label="No" />
                <Radio name="police_called" value="unknown" label="Don't know" />
                <Radio name="police_called" value="yes" label="Yes" />
              </div>
              {police && (
                <input name="police_ref" placeholder="Case or report number (if you have it)" className={`${field} mt-3`} />
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-ink">
                Do you have photos, video, texts, or voicemails about this?
              </p>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="has_evidence" className="h-4 w-4 rounded border-clay-deep accent-pine" />
                Yes — I can share copies with the property manager
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-ink">
                Has something like this happened before with the same people?
              </p>
              <div className="flex flex-wrap items-center gap-5" onChange={(e) => setBefore((e.target as HTMLInputElement).value === "yes")}>
                <Radio name="happened_before" value="no" label="No" />
                <Radio name="happened_before" value="yes" label="Yes" />
              </div>
              {before && (
                <input name="before_when" placeholder="About when?" className={`${field} mt-3`} />
              )}
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Anything else we should know?</span>
              <textarea name="additional" rows={2} className={field} />
            </label>
          </div>
        </Section>

        {/* 6 · Photos */}
        <Section n={6} title="Add photos (optional)">
          <label className="block space-y-1.5">
            <span className="text-sm text-ink-soft">
              Attach photos of any damage, injuries, or the scene. You can add several.
            </span>
            <input
              type="file"
              name="photos"
              accept="image/*,application/pdf"
              multiple
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-pine file:px-4 file:py-2 file:text-sm file:font-medium file:text-cream hover:file:bg-pine-dark"
            />
          </label>
        </Section>

        {/* Attest */}
        <Section n={7} title="Confirm and submit">
          <label className="flex items-start gap-2.5 rounded-xl border border-clay bg-sand/40 px-4 py-3 text-sm text-ink-soft">
            <input type="checkbox" required className="mt-0.5 h-4 w-4 rounded border-clay-deep accent-pine" />
            <span>
              Everything I wrote above is true and correct as far as I know. I understand this report
              may be kept on file and may be used if this matter goes to court.
            </span>
          </label>
          <Button type="submit" size="lg" variant="primary" className="mt-4 w-full" disabled={pending}>
            {pending ? "Submitting…" : "Submit incident report"}
          </Button>
          <p className="mt-3 text-center text-xs text-ink-faint">
            This form does not replace calling the police. In an emergency, always call 911 first.
          </p>
        </Section>
      </form>
    </Card>
  );
}
