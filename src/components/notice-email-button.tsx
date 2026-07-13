"use client";

import { useActionState } from "react";
import { emailNotice, type EmailNoticeState } from "@/app/(admin)/admin/notices/actions";

const initial: EmailNoticeState = { ok: false };

export function NoticeEmailButton({ id, email }: { id: string; email: string | null }) {
  const [state, action, pending] = useActionState(emailNotice, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending || !email}
        className="inline-flex h-10 items-center rounded-full bg-pine px-5 text-sm font-medium text-cream transition-colors hover:bg-pine-dark disabled:opacity-50"
      >
        {pending ? "Sending…" : "Email to tenant"}
      </button>
      {email ? (
        <span className="text-sm text-ink-soft">{email}</span>
      ) : (
        <span className="text-sm text-ink-faint">No email on file for this tenant.</span>
      )}
      {state.ok && state.notice && <span className="text-sm font-medium text-pine">✓ {state.notice}</span>}
      {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
    </form>
  );
}
