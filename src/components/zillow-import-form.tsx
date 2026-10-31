"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  importZillowApplication,
  type ImportState,
} from "@/app/(admin)/admin/applications/import/actions";

const initial: ImportState = { ok: false };

const input =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";
const label = "mb-1 block text-sm font-medium text-ink";
const hint = "mt-1 block text-xs text-ink-faint";

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-clay pt-5 first:border-0 first:pt-0">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      {blurb && <p className="mt-0.5 mb-3 text-sm text-ink-soft">{blurb}</p>}
      <div className={blurb ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

export function ZillowImportForm({
  homes,
}: {
  homes: { id: string; label: string; property: string; rentCents: number | null }[];
}) {
  const [state, action, pending] = useActionState(importZillowApplication, initial);

  if (state.ok && state.unitId) {
    return (
      <div className="rounded-2xl border border-pine/30 bg-pine/5 p-6">
        <h2 className="font-display text-xl font-semibold text-ink">Done ✓</h2>
        <p className="mt-1 text-base text-ink-soft">{state.notice}</p>
        <p className="mt-3 text-sm text-ink-soft">
          Their application, screening and portal account are on file, and their welcome
          steps are open. Two buttons on the home finish it: <strong>Send the welcome &amp;
          onboarding invite</strong>, then <strong>Tell the owners it&apos;s rented</strong>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/admin/units/${state.unitId}`}
            className="rounded-full bg-pine px-5 py-2.5 text-sm font-medium text-cream hover:bg-pine-dark"
          >
            Open the home →
          </Link>
          <Link
            href="/admin/applications/import"
            className="rounded-full border border-clay-deep px-5 py-2.5 text-sm font-medium text-ink hover:bg-sand"
          >
            Import another
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <Section
        title="Which home?"
        blurb="Vacant homes first. Setting the rent here updates the home as well."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="sm:col-span-3">
            <span className={label}>Home</span>
            <select name="unit_id" required className={input} defaultValue="">
              <option value="" disabled>
                Choose a home…
              </option>
              {homes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.property} · {h.label}
                  {h.rentCents ? ` — $${(h.rentCents / 100).toLocaleString("en-US")}/mo` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={label}>Rent</span>
            <input name="rent" placeholder="1750" className={input} inputMode="decimal" />
            <span className={hint}>Blank keeps the home&apos;s current rent.</span>
          </label>
          <label>
            <span className={label}>Deposit</span>
            <input name="deposit" placeholder="1750" className={input} inputMode="decimal" />
          </label>
          <label>
            <span className={label}>Move-in they asked for</span>
            <input type="date" name="desired_move_in" className={input} />
            <span className={hint}>They confirm it themselves in the portal.</span>
          </label>
        </div>
      </Section>

      <Section title="Who's moving in" blurb="The person whose email the portal invite goes to.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={label}>First name</span>
            <input name="first_name" required className={input} />
          </label>
          <label>
            <span className={label}>Last name</span>
            <input name="last_name" required className={input} />
          </label>
          <label>
            <span className={label}>Email</span>
            <input type="email" name="email" required className={input} />
          </label>
          <label>
            <span className={label}>Phone</span>
            <input name="phone" className={input} />
          </label>
          <label>
            <span className={label}>Date of birth</span>
            <input type="date" name="date_of_birth" className={input} />
          </label>
          <label>
            <span className={label}>Monthly income</span>
            <input name="monthly_income" placeholder="3953.24" className={input} inputMode="decimal" />
          </label>
          <label>
            <span className={label}>Employer</span>
            <input name="employer_name" className={input} />
          </label>
          <label>
            <span className={label}>Employer phone</span>
            <input name="employer_phone" className={input} />
          </label>
        </div>
      </Section>

      <Section
        title="Second adult"
        blurb="Optional. Everyone 18 or over should be on the lease, even if only one of them gave contact details."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className={label}>First name</span>
            <input name="second_first_name" className={input} />
          </label>
          <label>
            <span className={label}>Last name</span>
            <input name="second_last_name" className={input} />
            <span className={hint}>Blank uses the same surname.</span>
          </label>
          <label>
            <span className={label}>Date of birth</span>
            <input type="date" name="second_date_of_birth" className={input} />
          </label>
        </div>
      </Section>

      <Section title="Where they live now" blurb="What the current landlord would be called about.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={label}>Current address</span>
            <input name="current_address" className={input} />
          </label>
          <label>
            <span className={label}>How long they&apos;ve been there</span>
            <input name="current_residency_length" placeholder="Since Nov 2025" className={input} />
          </label>
          <label>
            <span className={label}>Why they&apos;re moving</span>
            <input name="reason_for_moving" className={input} />
          </label>
          <label>
            <span className={label}>Current landlord</span>
            <input name="landlord_name" className={input} />
          </label>
          <label>
            <span className={label}>Landlord phone</span>
            <input name="landlord_phone" className={input} />
          </label>
        </div>
      </Section>

      <Section
        title="What the screening showed"
        blurb="Zillow has already run this. Record the outcome — not the report itself."
      >
        <div className="space-y-3">
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name="screening_clear"
              value="yes"
              defaultChecked
              className="mt-1 h-4 w-4 rounded border-clay-deep accent-pine"
            />
            <span className="text-sm text-ink">
              Clear — no criminal records and no evictions or housing-court records
              <span className="block text-xs text-ink-faint">
                Untick if anything came back. The application is then marked for review
                rather than approved.
              </span>
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className={label}>Credit score</span>
              <input name="credit_score" placeholder="646" className={input} />
            </label>
          </div>
          <label className="block">
            <span className={label}>Anything else worth having on file</span>
            <textarea
              name="screening_notes"
              rows={4}
              placeholder={
                "Income $3,953/mo, front desk agent since Mar 2024.\nPays $1,700 now, 100% on time.\nNo pets declared."
              }
              className={input}
            />
            <span className={hint}>
              Written into the file and summarised in the owners&apos; email. Keep it to what
              you&apos;d be comfortable showing — don&apos;t paste the credit report.
            </span>
          </label>
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3 border-t border-clay pt-5">
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? "Setting them up…" : "Import and set up the home"}
        </Button>
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>
      <p className="text-xs text-ink-faint">
        This creates their application marked approved and screened, makes their portal
        account, links them to the home and opens their welcome steps. It does not email
        them — you do that from the home when you&apos;re ready.
      </p>
    </form>
  );
}
