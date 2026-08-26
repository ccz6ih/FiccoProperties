"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { formatDate } from "@/lib/format";
import {
  setMaintenanceVendor,
  emailWorkOrder,
  recordMaintenanceCost,
  scheduleMaintenanceVisit,
  type WorkOrderState,
} from "@/app/(admin)/admin/maintenance/actions";

const initial: WorkOrderState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

export type VendorOpt = {
  id: string;
  name: string;
  trade: string | null;
  coiExpired: boolean;
};

export function MaintenanceVendorPanel({
  requestId,
  vendorId,
  vendors,
  workOrderSentAt,
  scheduledFor,
  scheduledWindow,
}: {
  requestId: string;
  vendorId: string | null;
  vendors: VendorOpt[];
  workOrderSentAt: string | null;
  scheduledFor: string | null;
  scheduledWindow: string | null;
}) {
  const [woState, woAction, woPending] = useActionState(emailWorkOrder, initial);
  const [costState, costAction, costPending] = useActionState(recordMaintenanceCost, initial);
  const [schedState, schedAction, schedPending] = useActionState(scheduleMaintenanceVisit, initial);
  const [entry, setEntry] = useState("knock");
  const assigned = vendors.find((v) => v.id === vendorId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
          Schedule the visit (tenant sees this)
        </div>
        {scheduledFor && (
          <p className="mb-2 text-xs text-pine">
            ✓ Scheduled {formatDate(scheduledFor)}{scheduledWindow ? ` · ${scheduledWindow}` : ""}
          </p>
        )}
        <form action={schedAction} className="space-y-2">
          <input type="hidden" name="id" value={requestId} />
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="block text-xs text-ink-soft">Date</span>
              <input type="date" name="scheduled_for" defaultValue={scheduledFor ?? ""} className={field} />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-ink-soft">Window</span>
              <input name="scheduled_window" defaultValue={scheduledWindow ?? ""} placeholder="9 am – noon" className={`${field} w-28`} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="block text-xs text-ink-soft">Getting in (the tenant reads this)</span>
            <select
              name="entry_note"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              className={`${field} w-full`}
            >
              <option value="knock">Knock first — they don&apos;t need to be home</option>
              <option value="key">We&apos;ll use our key if they&apos;re out</option>
              <option value="present">Someone must be home</option>
              <option value="custom">Write my own…</option>
              <option value="none">Say nothing about entry</option>
            </select>
          </label>
          {entry === "custom" && (
            <input
              name="entry_custom"
              placeholder="e.g. We'll come to the back door — please keep the dog inside."
              className={`${field} w-full`}
            />
          )}
          <Button type="submit" variant="outline" size="md" disabled={schedPending}>
            {schedPending ? "Saving…" : scheduledFor ? "Update" : "Set ETA"}
          </Button>
        </form>
        {schedState.ok && schedState.notice && (
          <p className="mt-1.5 text-xs font-medium text-pine">{schedState.notice}</p>
        )}
        {schedState.error && <p className="mt-1.5 text-xs text-terracotta-dark">{schedState.error}</p>}
      </div>
      <div>
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">Vendor</div>
        <form action={setMaintenanceVendor}>
          <input type="hidden" name="id" value={requestId} />
          <select
            name="vendor_id"
            defaultValue={vendorId ?? ""}
            className={field}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          >
            <option value="">No vendor — in-house</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}{v.trade ? ` (${v.trade})` : ""}{v.coiExpired ? " ⚠ insurance expired" : ""}
              </option>
            ))}
          </select>
        </form>
        {assigned?.coiExpired && (
          <p className="mt-1.5 text-xs text-terracotta-dark">
            ⚠ {assigned.name}&apos;s insurance certificate has expired — get a current COI before work starts.
          </p>
        )}
      </div>

      {vendorId && (
        <div className="border-t border-clay pt-3">
          {workOrderSentAt ? (
            <p className="mb-2 text-xs text-pine">✓ Work order emailed {formatDate(workOrderSentAt)}</p>
          ) : null}
          <form action={woAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={requestId} />
            <Button type="submit" variant="outline" size="md" disabled={woPending}>
              {woPending ? "Sending…" : workOrderSentAt ? "Re-send work order" : "Email work order"}
            </Button>
          </form>
          {woState.ok && woState.notice && <p className="mt-1.5 text-xs font-medium text-pine">{woState.notice}</p>}
          {woState.error && <p className="mt-1.5 text-xs text-terracotta-dark">{woState.error}</p>}
        </div>
      )}

      <div className="border-t border-clay pt-3">
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
          Job done? Record the cost
        </div>
        <form action={costAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={requestId} />
          <label className="space-y-1">
            <span className="block text-xs text-ink-soft">Amount ($)</span>
            <input inputMode="decimal" name="amount" placeholder="0.00" className={`${field} w-24`} />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-ink-soft">Date</span>
            <input type="date" name="incurred_on" className={field} />
          </label>
          <Button type="submit" variant="primary" size="md" disabled={costPending}>
            {costPending ? "Saving…" : "Record"}
          </Button>
        </form>
        {costState.ok && costState.notice && <p className="mt-1.5 text-xs font-medium text-pine">{costState.notice}</p>}
        {costState.error && <p className="mt-1.5 text-xs text-terracotta-dark">{costState.error}</p>}
        <p className="mt-1.5 text-[11px] text-ink-faint">
          Lands in the unit&apos;s cost history and the yearly financials automatically.
        </p>
      </div>
    </div>
  );
}
