"use client";

import { useActionState } from "react";
import { inviteTenant, type InviteState } from "@/app/(admin)/admin/properties/actions";

const initial: InviteState = { ok: false };

/**
 * Roster control for a tenant who has a record but no linked account. If an
 * email is on file, offers a one-click invite; if not, lets staff type one in
 * and invite in the same step (the email is saved to the tenancy too).
 */
export function TenantAccountControl({
  unitId,
  email,
}: {
  unitId: string;
  email: string | null;
}) {
  const [state, action, pending] = useActionState(inviteTenant, initial);

  if (state.ok) {
    return (
      <span className="mt-1 block text-[11px] font-medium text-pine-dark">
        {state.notice ?? "Invited ✓"}
      </span>
    );
  }

  return (
    <form action={action} className="mt-1 space-y-1">
      <input type="hidden" name="unit_id" value={unitId} />
      {!email && (
        <input
          type="email"
          name="email"
          required
          placeholder="tenant@email.com"
          className="block w-full max-w-[13rem] rounded border border-clay-deep bg-white px-2 py-1 text-[11px] text-ink"
        />
      )}
      <button
        type="submit"
        disabled={pending}
        className="text-[11px] font-medium text-pine hover:underline disabled:opacity-60"
      >
        {pending ? "Inviting…" : email ? "Invite to portal →" : "Add email & invite →"}
      </button>
      {state.error && (
        <span className="block text-[11px] text-terracotta-dark">{state.error}</span>
      )}
    </form>
  );
}
