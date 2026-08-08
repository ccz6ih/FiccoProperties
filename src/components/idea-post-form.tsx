"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { postIdea, type IdeaState } from "@/app/(resident)/portal/ideas/actions";

const initial: IdeaState = { ok: false };
const field =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function IdeaPostForm() {
  const [state, action, pending] = useActionState(postIdea, initial);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border-2 border-dashed border-clay-deep bg-white/50 px-5 py-4 text-left text-sm text-ink-soft transition hover:border-pine/50 hover:bg-sand/50"
      >
        💡 <span className="font-medium text-ink">Got an idea for the community?</span> A bench, a
        light, a fix, an event — share it here…
      </button>
    );
  }

  return (
    <Card className="p-5">
      <form ref={formRef} action={action} className="space-y-3">
        {state.error && (
          <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-2.5 text-sm text-terracotta-dark">
            {state.error}
          </div>
        )}
        {state.ok && (
          <div className="rounded-xl border border-pine/30 bg-pine-soft px-4 py-2.5 text-sm text-pine-dark">
            Posted! Your neighbors can +1 it now — the owners see every idea.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            name="title"
            required
            maxLength={90}
            placeholder="Your idea in one line — e.g. A bench by the mailboxes"
            className={field}
            autoFocus
          />
          <select name="category" defaultValue="idea" className={field}>
            <option value="idea">💡 Idea</option>
            <option value="upgrade">✨ Upgrade</option>
            <option value="fix">🔧 Fix it</option>
            <option value="event">🎉 Event</option>
          </select>
        </div>
        <textarea
          name="body"
          rows={2}
          placeholder="A little more detail (optional) — why it'd be great, where it'd go…"
          className={field}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Posting…" : "Post idea"}
          </Button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-ink-soft hover:text-ink"
          >
            Close
          </button>
          <span className="ml-auto hidden text-xs text-ink-faint sm:block">
            Be kind — everyone here is a neighbor. 🏡
          </span>
        </div>
      </form>
    </Card>
  );
}
