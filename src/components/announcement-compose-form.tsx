"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  createAnnouncement,
  type AnnouncementState,
} from "@/app/(admin)/admin/announcements/actions";

const initial: AnnouncementState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

export type PropertyOpt = { id: string; name: string };

export function AnnouncementComposeForm({ properties }: { properties: PropertyOpt[] }) {
  const [state, action, pending] = useActionState(createAnnouncement, initial);

  return (
    <form action={action} className="space-y-4" key={state.ok ? "posted" : "form"}>
      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Title</span>
        <input
          name="title"
          required
          placeholder="e.g. Water shut-off Tuesday 9 am – noon"
          className={field}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Announcement
        </span>
        <textarea
          name="body"
          rows={4}
          required
          placeholder={"What's happening, when, and what residents should do.\n\nBlank line = new paragraph."}
          className={field}
        />
      </label>

      <div>
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-faint">
          Which communities? (none checked = all)
        </span>
        <div className="flex flex-wrap gap-3">
          {properties.map((p) => (
            <label key={p.id} className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                name="property_ids"
                value={p.id}
                className="h-4 w-4 rounded border-clay-deep accent-pine"
              />
              {p.name}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Take it down after (optional)
          </span>
          <input type="date" name="expires_on" className={field} />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-ink">
          <input
            type="checkbox"
            name="email_residents"
            defaultChecked
            className="h-4 w-4 rounded border-clay-deep accent-pine"
          />
          Also email everyone it applies to
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Posting…" : "Post announcement"}
        </Button>
        {state.ok && state.notice && (
          <span className="text-sm font-medium text-pine">{state.notice}</span>
        )}
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>
    </form>
  );
}
