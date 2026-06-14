"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { editPettyEntry, type CashState } from "@/app/(admin)/admin/petty-cash/actions";

const initial: CashState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";
const lbl = "block text-xs font-medium text-ink-faint";
const CATEGORIES = ["supplies", "materials", "tools", "fuel", "cleaning", "extra", "other"];

export type PettyEntry = {
  id: string;
  kind: string;
  occurred_on: string;
  store: string | null;
  description: string | null;
  category: string | null;
  amountDollars: string;
  receiptTotalDollars: string;
};

export function PettyEntryEdit({ entry }: { entry: PettyEntry }) {
  const [state, action, pending] = useActionState(editPettyEntry, initial);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isTopup = entry.kind === "topup";
  const router = useRouter();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="text-xs font-medium text-pine hover:underline"
    >
      Edit
    </button>
  );

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="my-8 w-full max-w-md rounded-2xl bg-cream p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">
            {isTopup ? "Edit cash received" : "Edit expense"}
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-sand"
          >
            ✕
          </button>
        </div>

        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={entry.id} />
          <input type="hidden" name="kind" value={entry.kind} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}>
              {isTopup ? "Date received" : "Date"}
              <input type="date" name="occurred_on" defaultValue={entry.occurred_on} className={field} />
            </label>
            <label className={lbl}>
              {isTopup ? "Amount ($)" : "From petty cash ($)"}
              <input
                inputMode="decimal"
                name="amount"
                required
                defaultValue={entry.amountDollars}
                className={field}
              />
            </label>
          </div>

          {isTopup ? (
            <label className={lbl}>
              Received from
              <input name="store" defaultValue={entry.store ?? ""} className={field} />
            </label>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={lbl}>
                  Store / vendor
                  <input name="store" defaultValue={entry.store ?? ""} className={field} />
                </label>
                <label className={lbl}>
                  Receipt total ($)
                  <input
                    inputMode="decimal"
                    name="receipt_total"
                    defaultValue={entry.receiptTotalDollars}
                    className={field}
                  />
                </label>
              </div>
              <label className={lbl}>
                Category
                <select name="category" defaultValue={entry.category ?? "supplies"} className={field}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="capitalize">{c}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className={lbl}>
            {isTopup ? "Note" : "What was it for?"}
            <input name="description" defaultValue={entry.description ?? ""} className={field} />
          </label>

          {state.error && <p className="text-xs text-terracotta-dark">{state.error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {trigger}
      {open && mounted && createPortal(dialog, document.body)}
    </>
  );
}
