"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Card } from "@/components/ui";
import {
  generateMonthlyCharges,
  type AdminPaymentsState,
} from "@/app/(admin)/admin/payments/actions";

const initial: AdminPaymentsState = { ok: false };

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function PaymentsGenerateForm({ defaultPeriod }: { defaultPeriod: string }) {
  const [state, action, pending] = useActionState(generateMonthlyCharges, initial);

  return (
    <Card className="p-6">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">
        Generate this month&apos;s rent
      </h2>
      <p className="mb-4 text-sm text-ink-soft">
        Creates one open charge per occupied unit for the chosen month. Safe to
        re-run — units already billed for that month are skipped. Units without a
        rent are skipped —{" "}
        <Link href="/admin/rents" className="font-medium text-pine hover:text-pine-dark">
          set rents first
        </Link>
        .
      </p>
      <form action={action} className="space-y-4">
        {state.error && (
          <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-2.5 text-sm text-terracotta-dark">
            {state.error}
          </div>
        )}
        {state.ok && state.notice && (
          <div className="rounded-xl border border-pine/30 bg-pine-soft px-4 py-2.5 text-sm text-pine-dark">
            {state.notice}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Billing month</span>
            <input
              type="month"
              name="period"
              defaultValue={defaultPeriod}
              className={inputClass}
            />
          </label>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Generating…" : "Generate charges"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
