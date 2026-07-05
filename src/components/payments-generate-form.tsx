"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Card } from "@/components/ui";
import {
  generateMonthlyCharges,
  type AdminPaymentsState,
} from "@/app/(admin)/admin/payments/actions";

const initial: AdminPaymentsState = { ok: false };

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function PaymentsGenerateForm({
  defaultPeriod,
  properties,
}: {
  defaultPeriod: string;
  properties: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(generateMonthlyCharges, initial);
  // All properties selected by default; uncheck to bill just some (e.g. townhomes).
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(properties.map((p) => p.id))
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = selected.size === properties.length;
  const noneSelected = selected.size === 0;

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

        {[...selected].map((id) => (
          <input key={id} type="hidden" name="property_ids" value={id} />
        ))}

        {properties.length > 1 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Communities to bill</span>
              <button
                type="button"
                onClick={() =>
                  setSelected(allSelected ? new Set() : new Set(properties.map((p) => p.id)))
                }
                className="text-xs font-medium text-pine hover:text-pine-dark"
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {properties.map((p) => {
                const on = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      on
                        ? "border-pine bg-pine text-cream"
                        : "border-clay-deep bg-white/70 text-ink-soft hover:bg-sand"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
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
          <Button type="submit" variant="primary" disabled={pending || noneSelected}>
            {pending
              ? "Generating…"
              : allSelected
                ? "Generate charges"
                : `Generate for ${selected.size} ${selected.size === 1 ? "community" : "communities"}`}
          </Button>
        </div>
        {noneSelected && (
          <p className="text-xs text-terracotta-dark">Pick at least one community to bill.</p>
        )}
      </form>
    </Card>
  );
}
