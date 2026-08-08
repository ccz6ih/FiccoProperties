"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/ui";
import { updateIdea, deleteIdea, type IdeaAdminState } from "@/app/(admin)/admin/ideas/actions";

const initial: IdeaAdminState = { ok: false };
const field = "rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

export type AdminIdea = {
  id: string;
  title: string;
  body: string | null;
  category: string;
  status: string;
  staff_reply: string | null;
  hidden: boolean;
  votes: number;
  author: string;
  createdAt: string;
};

export function IdeaAdminCard({ idea }: { idea: AdminIdea }) {
  const [state, action, pending] = useActionState(updateIdea, initial);

  return (
    <Card className={`p-5 ${idea.hidden ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-pine/10 px-2 py-0.5 text-sm font-bold text-pine">
              ▲ {idea.votes}
            </span>
            <h3 className="font-display text-base font-semibold text-ink">{idea.title}</h3>
            <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-medium capitalize text-ink-soft">
              {idea.category}
            </span>
            {idea.hidden && (
              <span className="rounded-full bg-terracotta-soft px-2 py-0.5 text-[11px] font-medium text-terracotta-dark">
                Hidden
              </span>
            )}
          </div>
          {idea.body && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{idea.body}</p>}
          <div className="mt-1 text-xs text-ink-faint">
            {idea.author} · {idea.createdAt}
          </div>
        </div>
        <form action={deleteIdea}>
          <input type="hidden" name="id" value={idea.id} />
          <button type="submit" className="text-xs text-ink-faint hover:text-terracotta-dark" title="Delete">
            ✕
          </button>
        </form>
      </div>

      <form action={action} className="mt-3 space-y-2 border-t border-clay pt-3">
        <input type="hidden" name="id" value={idea.id} />
        <div className="flex flex-wrap items-center gap-2">
          <select name="status" defaultValue={idea.status} className={field}>
            <option value="new">New</option>
            <option value="considering">Considering</option>
            <option value="planned">Planned</option>
            <option value="done">Done ✅</option>
            <option value="not_now">Not right now</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-ink-soft">
            <input type="checkbox" name="hidden" defaultChecked={idea.hidden} className="h-4 w-4 rounded border-clay-deep accent-pine" />
            Hide from board
          </label>
        </div>
        <textarea
          name="staff_reply"
          defaultValue={idea.staff_reply ?? ""}
          rows={2}
          placeholder="Reply from the owners (residents see this)…"
          className={`${field} w-full`}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" variant="outline" size="md" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {state.ok && <span className="text-sm font-medium text-pine">Saved ✓</span>}
          {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
        </div>
      </form>
    </Card>
  );
}
