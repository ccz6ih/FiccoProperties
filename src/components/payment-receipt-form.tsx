"use client";

import { useActionState, useState } from "react";
import { savePaymentReceipt, type ReceiptState } from "@/app/(admin)/admin/payments-log/actions";
import { sendReceiptForCharge, type AdminPaymentsState } from "@/app/(admin)/admin/payments/actions";

const initial: ReceiptState = { ok: false };

export function PaymentReceipt({
  paymentId,
  chargeId,
  note,
  receiptUrl,
  compact,
}: {
  paymentId?: string;
  chargeId?: string;
  note: string | null;
  receiptUrl?: string | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(savePaymentReceipt, initial);
  const [mailState, mailAction, mailPending] = useActionState(
    sendReceiptForCharge,
    { ok: false } as AdminPaymentsState
  );

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {!compact && <span className="text-ink-soft">{note || "—"}</span>}
        {receiptUrl && (
          <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-pine hover:underline">
            View
          </a>
        )}
        {chargeId && (
          <form action={mailAction} className="inline print:hidden">
            <input type="hidden" name="charge_id" value={chargeId} />
            <button
              type="submit"
              disabled={mailPending}
              title="Email this receipt to everyone on the home"
              className="text-xs font-medium text-pine hover:underline disabled:opacity-50"
            >
              {mailPending ? "Sending…" : "Email receipt"}
            </button>
          </form>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-medium text-ink-faint hover:text-pine print:hidden"
        >
          {open ? "Close" : note || receiptUrl ? "Edit receipt" : "+ Receipt"}
        </button>
      </div>
      {mailState.ok && mailState.notice && (
        <div className="text-xs font-medium text-pine print:hidden">{mailState.notice}</div>
      )}
      {mailState.error && (
        <div className="text-xs text-terracotta-dark print:hidden">{mailState.error}</div>
      )}

      {open && (
        <form action={action} className="mt-1 space-y-2 rounded-lg border border-clay bg-sand/30 p-2 print:hidden">
          {paymentId && <input type="hidden" name="payment_id" value={paymentId} />}
          {chargeId && <input type="hidden" name="charge_id" value={chargeId} />}
          <input
            name="note"
            defaultValue={note ?? ""}
            placeholder="Money order / check #"
            className="w-full rounded-lg border border-clay-deep bg-white px-2 py-1.5 text-sm text-ink"
          />
          <input
            type="file"
            name="file"
            accept="application/pdf,image/*"
            className="text-xs text-ink-soft file:mr-2 file:rounded file:border file:border-clay-deep file:bg-sand file:px-2 file:py-1 file:text-xs file:text-ink-soft"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-pine px-3 py-1.5 text-xs font-medium text-cream hover:bg-pine-dark disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save receipt"}
            </button>
            {state.ok && state.notice && <span className="text-xs text-pine">{state.notice}</span>}
            {state.error && <span className="text-xs text-terracotta-dark">{state.error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
