"use client";

import { useActionState } from "react";
import { inviteTenant, type InviteState } from "@/app/(admin)/admin/properties/actions";

const initial: InviteState = { ok: false };

export function InviteTenantButton({ unitId }: { unitId: string }) {
  const [state, action, pending] = useActionState(inviteTenant, initial);

  if (state.ok) {
    return (
      <span className="mt-1 block text-[11px] font-medium text-pine-dark">
        {state.notice ?? "Invited ✓"}
      </span>
    );
  }

  return (
    <form action={action} className="mt-1">
      <input type="hidden" name="unit_id" value={unitId} />
      <button
        type="submit"
        disabled={pending}
        className="text-[11px] font-medium text-pine hover:underline disabled:opacity-60"
      >
        {pending ? "Inviting…" : "Invite to portal →"}
      </button>
      {state.error && (
        <span className="mt-0.5 block text-[11px] text-terracotta-dark">{state.error}</span>
      )}
    </form>
  );
}
