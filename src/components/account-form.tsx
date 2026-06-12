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
  emergencyName,
  emergencyPhone,
  insuranceProvider,
  insurancePolicyNumber,
  insuranceExpiresOn,
  hasInsuranceDoc,
}: {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  insuranceExpiresOn: string | null;
  hasInsuranceDoc: boolean;
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

        <div className="space-y-5 border-t border-clay pt-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Emergency contact</h2>
            <p className="text-sm text-ink-soft">
              Who we should reach if we can&apos;t get hold of you.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Name</span>
              <input
                name="emergency_contact_name"
                defaultValue={emergencyName ?? ""}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Phone</span>
              <input
                name="emergency_contact_phone"
                defaultValue={emergencyPhone ?? ""}
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <div className="space-y-5 border-t border-clay pt-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Renters insurance</h2>
            <p className="text-sm text-ink-soft">
              Your lease requires active renters insurance — please keep this current.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Provider</span>
              <input
                name="insurance_provider"
                defaultValue={insuranceProvider ?? ""}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Policy number</span>
              <input
                name="insurance_policy_number"
                defaultValue={insurancePolicyNumber ?? ""}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Expiry date</span>
              <input
                type="date"
                name="insurance_expires_on"
                defaultValue={insuranceExpiresOn ?? ""}
                className={inputClass}
              />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">
              Proof of insurance
              {hasInsuranceDoc && (
                <span className="ml-2 font-normal text-pine-dark">Proof on file ✓</span>
              )}
            </span>
            <input
              type="file"
              name="insurance_doc"
              accept="image/*,application/pdf"
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-sand file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-clay"
            />
            <span className="block text-xs text-ink-faint">
              Upload your declarations page or policy (image or PDF). Our team can view this to confirm coverage.
            </span>
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
