"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  recordMoveInMoney,
  type MoveInMoneyState,
} from "@/app/(admin)/admin/units/actions";

const initial: MoveInMoneyState = { ok: false };

const input =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

/**
 * Checking in what the new resident handed over.
 *
 * Rent and deposit get their own amount and their own reference because they
 * almost always arrive as two separate money orders — recording them as one
 * lump is how a deposit ends up indistinguishable from rent a year later when
 * someone asks for it back.
 */
export function MoveInMoneyForm({
  unitId,
  rentDueCents,
  depositDueCents,
  rentPaidCents,
  depositReceivedCents,
}: {
  unitId: string;
  rentDueCents: number;
  depositDueCents: number;
  rentPaidCents: number;
  depositReceivedCents: number;
}) {
  const [state, action, pending] = useActionState(recordMoveInMoney, initial);
  const today = new Date().toISOString().slice(0, 10);

  const rentLeft = Math.max(0, rentDueCents - rentPaidCents);
  const depositLeft = Math.max(0, depositDueCents - depositReceivedCents);
  const dollars = (c: number) => (c / 100).toFixed(2);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="unit_id" value={unitId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-clay bg-white p-3">
          <div className="text-xs font-semibold text-ink">First month&apos;s rent</div>
          <div className="mt-0.5 text-[11px] text-ink-faint">
            {rentPaidCents > 0
              ? `${dollars(rentPaidCents)} in · ${dollars(rentLeft)} still due`
              : `${dollars(rentDueCents)} due`}
          </div>
          <input
            name="rent_amount"
            inputMode="decimal"
            placeholder={rentLeft > 0 ? dollars(rentLeft) : "0.00"}
            className={`${input} mt-2`}
          />
          <input
            name="rent_reference"
            placeholder="Money order #"
            className={`${input} mt-2`}
          />
        </div>

        <div className="rounded-xl border border-clay bg-white p-3">
          <div className="text-xs font-semibold text-ink">Security deposit</div>
          <div className="mt-0.5 text-[11px] text-ink-faint">
            {depositReceivedCents > 0
              ? `${dollars(depositReceivedCents)} in · ${dollars(depositLeft)} still due`
              : `${dollars(depositDueCents)} due`}
          </div>
          <input
            name="deposit_amount"
            inputMode="decimal"
            placeholder={depositLeft > 0 ? dollars(depositLeft) : "0.00"}
            className={`${input} mt-2`}
          />
          <input
            name="deposit_reference"
            placeholder="Money order #"
            className={`${input} mt-2`}
          />
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-soft">Received on</span>
        <input
          type="date"
          name="received_on"
          required
          defaultValue={today}
          max={today}
          className={`${input} max-w-[200px]`}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Recording…" : "Record what they paid"}
        </Button>
        {state.ok && state.notice && <span className="text-sm text-pine">{state.notice}</span>}
        {state.error && <span className="text-sm text-terracotta-dark">{state.error}</span>}
      </div>

      <p className="text-[11px] text-ink-faint">
        Rent goes against their open charge and shows in the rent history. The deposit is
        held on the tenancy and stays off the rent board. Leave either blank if it
        hasn&apos;t come in yet.
      </p>
    </form>
  );
}
