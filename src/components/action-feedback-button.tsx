"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui";
import type { EmailActionState } from "@/lib/action-state";

const initial: EmailActionState = { ok: false };

/**
 * Submit button for an email-sending server action that shows clear feedback:
 * "Sending…" while pending and a green "✓ Sent to …" once done.
 */
export function ActionFeedbackButton({
  action,
  hidden,
  label,
  successLabel = "Sent",
  sendingLabel = "Sending…",
  variant = "outline",
  compact = false,
}: {
  action: (prev: EmailActionState, form: FormData) => Promise<EmailActionState>;
  hidden?: ReactNode;
  label: string;
  successLabel?: string;
  sendingLabel?: string;
  variant?: "primary" | "outline";
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  if (state.ok) {
    const text = `✓ ${successLabel}${state.sentTo ? ` to ${state.sentTo}` : ""}`;
    return compact ? (
      <span className="text-xs font-medium text-pine">{text}</span>
    ) : (
      <div className="rounded-xl border border-pine/40 bg-pine/10 px-4 py-2.5 text-center text-sm font-medium text-pine">
        {text}
      </div>
    );
  }

  if (compact) {
    return (
      <form action={formAction}>
        {hidden}
        <button
          type="submit"
          disabled={pending}
          className="text-xs font-medium text-pine hover:underline disabled:opacity-60"
        >
          {pending ? sendingLabel : label}
        </button>
        {state.error && <span className="ml-2 text-xs text-terracotta-dark">{state.error}</span>}
      </form>
    );
  }

  return (
    <form action={formAction}>
      {hidden}
      <Button type="submit" variant={variant} disabled={pending} className="w-full">
        {pending ? sendingLabel : label}
      </Button>
      {state.error && <p className="mt-1 text-xs text-terracotta-dark">{state.error}</p>}
    </form>
  );
}
