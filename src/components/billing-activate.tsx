"use client";

import { useState, useTransition } from "react";
import { Card, Button } from "@/components/ui";
import {
  activateImportedBilling,
  type ActivateResult,
} from "@/app/(admin)/admin/tenants/actions";

export function BillingActivate({ needsBilling }: { needsBilling: number }) {
  const [result, setResult] = useState<ActivateResult | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setResult(null);
    start(async () => setResult(await activateImportedBilling()));
  }

  return (
    <Card className="space-y-3 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">
            Activate billing
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            Turn imported tenancies into active leases so they appear on Payments,
            Delinquency, and the owner report. Creates a portal account per tenant
            (quietly) — tenancies without an email are skipped.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          disabled={pending || needsBilling === 0}
          onClick={run}
        >
          {pending
            ? "Activating…"
            : needsBilling > 0
              ? `Activate ${needsBilling} for billing`
              : "All set up"}
        </Button>
      </div>

      {result && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            result.ok
              ? "border-pine/30 bg-pine/5 text-ink"
              : "border-terracotta/40 bg-terracotta-soft/40 text-terracotta-dark"
          }`}
        >
          {result.ok ? (
            <>
              <span className="font-semibold text-pine">
                Activated {result.activated} lease{result.activated === 1 ? "" : "s"}.
              </span>{" "}
              {result.alreadyActive > 0 && `${result.alreadyActive} already active. `}
              {result.skippedNoEmail > 0 &&
                `${result.skippedNoEmail} skipped (no email). `}
              Next: open Payments and “Generate this month’s rent.”
            </>
          ) : (
            result.error ?? "Activation failed."
          )}
        </div>
      )}
    </Card>
  );
}
