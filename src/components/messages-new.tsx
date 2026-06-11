"use client";

import { useActionState, useState } from "react";
import { Button, Card } from "@/components/ui";
import { startConversation, type StartState } from "@/app/(resident)/portal/messages/actions";

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

const initial: StartState = { ok: false };

/** Resident-facing "start a new conversation" composer (collapsible). */
export function MessagesNew() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(startConversation, initial);

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        New message
      </Button>
    );
  }

  return (
    <Card className="w-full p-5">
      <form action={action} className="space-y-4">
        {state.error && (
          <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-3 text-sm text-terracotta-dark">
            {state.error}
          </div>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Subject</span>
          <input
            name="subject"
            required
            className={inputClass}
            placeholder="e.g. Question about my lease"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Message</span>
          <textarea
            name="body"
            required
            rows={4}
            className={`${inputClass} resize-none`}
            placeholder="How can the office help?"
          />
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Sending…" : "Send message"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
