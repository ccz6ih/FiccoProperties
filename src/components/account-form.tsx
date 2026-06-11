"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { updateAccount, type AccountState } from "@/app/account/actions";

const initial: AccountState = { ok: false };

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function AccountForm({
  fullName,
  phone,
  email,
  avatarUrl,
}: {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
}) {
  const [state, action, pending] = useActionState(updateAccount, initial);

  return (
    <Card className="p-6 sm:p-8">
      <form action={action} className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar name={fullName} url={avatarUrl} size="xl" />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Profile photo</span>
            <input
              type="file"
              name="avatar"
              accept="image/*"
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-sand file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-clay"
            />
            <span className="block text-xs text-ink-faint">
              Shown in messages and maintenance so the team knows who&apos;s who.
            </span>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Full name</span>
          <input name="full_name" defaultValue={fullName ?? ""} className={inputClass} />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Phone</span>
            <input name="phone" defaultValue={phone ?? ""} className={inputClass} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Email</span>
            <input value={email ?? ""} disabled className={`${inputClass} opacity-60`} />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {state.ok && <span className="text-sm font-medium text-pine-dark">Saved ✓</span>}
          {state.error && (
            <span className="text-sm font-medium text-terracotta-dark">{state.error}</span>
          )}
        </div>
      </form>
    </Card>
  );
}
