"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  savePropertyWelcome,
  type WelcomeState,
} from "@/app/(admin)/admin/properties/actions";

const initial: WelcomeState = { ok: false };

const inputClass =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

/**
 * What a new resident reads about this community on their welcome page.
 *
 * The suggestions below are the questions that actually get asked in the first
 * week. They're prompts, not defaults — nothing is pre-filled, because a wrong
 * answer about who pays the gas is worse than no answer.
 */
export function PropertyWelcomeForm({
  propertyId,
  note,
  facts,
}: {
  propertyId: string;
  note: string | null;
  facts: { label: string; value: string }[];
}) {
  const [state, action, pending] = useActionState(savePropertyWelcome, initial);
  const asLines = facts.map((f) => `${f.label}: ${f.value}`).join("\n");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="property_id" value={propertyId} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">
          A short welcome to the community
        </span>
        <span className="mb-1.5 block text-xs text-ink-faint">
          A paragraph in your own words — what the place is like, who owns it, what you want
          them to know on day one.
        </span>
        <textarea
          name="welcome_note"
          rows={4}
          defaultValue={note ?? ""}
          placeholder="Eighteen town homes just off 38th Avenue, owned and run by our family since…"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">
          Good-to-know facts — one per line, as{" "}
          <code className="rounded bg-sand px-1 text-[12px]">Label: what it is</code>
        </span>
        <span className="mb-1.5 block text-xs text-ink-faint">
          Worth covering: Laundry · Utilities (who pays what) · Heat · Mail · Snow &amp;
          lawn · Storage · Pets · Smoking · Quiet hours. Rent, parking, trash, maintenance
          and how to reach the office are already shown automatically.
        </span>
        <textarea
          name="welcome_facts"
          rows={7}
          defaultValue={asLines}
          placeholder={"Laundry: hookups in the basement, washer and dryer are yours to bring\nUtilities: you set up Xcel for gas and electric; we cover water and trash\nMail: boxes are on the wall by the office"}
          className={`${inputClass} font-mono text-[13px]`}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save what new residents see"}
        </Button>
        {state.ok && state.notice && <span className="text-sm text-pine">{state.notice}</span>}
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>
    </form>
  );
}
