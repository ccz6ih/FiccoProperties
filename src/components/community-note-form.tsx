"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/ui";
import {
  sendCommunityNote,
  type CommunityNoteState,
} from "@/app/(admin)/admin/community-note/actions";

const initial: CommunityNoteState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function CommunityNoteForm({ recipientCount }: { recipientCount: number }) {
  const [state, action, pending] = useActionState(sendCommunityNote, initial);

  return (
    <Card className="p-6">
      <form action={action} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Subject line</span>
          <input
            name="subject"
            required
            placeholder="e.g. August around the neighborhood 🍁"
            className={field}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">
            Heading <span className="text-xs font-normal text-ink-faint">optional</span>
          </span>
          <input name="heading" placeholder="A note from the 38th Ave team" className={field} />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Your note</span>
          <textarea
            name="body"
            required
            rows={9}
            placeholder={
              "Write your note here. Leave a blank line between paragraphs.\n\nA few ideas: neighborhood happenings, a seasonal reminder (heat, snow, trash day), a resident spotlight, or just a warm hello."
            }
            className={field}
          />
          <span className="block text-[11px] text-ink-faint">
            Each resident is greeted by their first name automatically.
          </span>
        </label>

        {state.error && <p className="text-sm text-terracotta-dark">{state.error}</p>}
        {state.ok && state.notice && (
          <p className="rounded-lg border border-pine/30 bg-pine-soft px-3 py-2 text-sm text-pine-dark">
            {state.notice}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-clay pt-4">
          <Button type="submit" variant="outline" name="mode" value="test" disabled={pending}>
            {pending ? "Sending…" : "Send a test to me"}
          </Button>
          <Button
            type="submit"
            variant="primary"
            name="mode"
            value="all"
            disabled={pending || recipientCount === 0}
          >
            {pending ? "Sending…" : `Send to all residents (${recipientCount})`}
          </Button>
          <span className="text-xs text-ink-faint">
            Tip: send a test to yourself first, then send to everyone.
          </span>
        </div>
      </form>
    </Card>
  );
}
