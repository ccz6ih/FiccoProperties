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
  propertyId: string | null;
  unitId: string | null;
  amountDollars: string;
  receiptTotalDollars: string;
  /** How many receipt files are already attached. */
  receiptCount: number;
  /** The paper receipt was handed over rather than uploaded. */
  receiptOnPaper: boolean;
};

type PropOpt = { id: string; name: string };
type UnitOpt = { id: string; label: string; property: string };

export function PettyEntryEdit({
  entry,
  properties,
  units,
}: {
  entry: PettyEntry;
  properties: PropOpt[];
  units: UnitOpt[];
}) {
  const [state, action, pending] = useActionState(editPettyEntry, initial);
  const [open, setOpen] = useState(false);
  const isTopup = entry.kind === "topup";
  const router = useRouter();

  const unitsByProperty = new Map<string, UnitOpt[]>();
  for (const u of units) {
    const arr = unitsByProperty.get(u.property) ?? [];
    arr.push(u);
    unitsByProperty.set(u.property, arr);
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  // Refresh the list behind the dialog, but leave it open and say it saved.
  // Closing from inside an effect meant setting state after render, and for
  // adding receipts staying open is better anyway — you can see it took, and
  // add the next page without reopening.
  useEffect(() => {
    if (state.ok) router.refresh();
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
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={lbl}>
                  Community
                  <select name="property_id" defaultValue={entry.propertyId ?? ""} className={field}>
                    <option value="">—</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
                <label className={lbl}>
                  Unit
                  <select name="unit_id" defaultValue={entry.unitId ?? ""} className={field}>
                    <option value="">—</option>
                    {[...unitsByProperty.entries()].map(([prop, list]) => (
                      <optgroup key={prop} label={prop}>
                        {list.map((u) => (
                          <option key={u.id} value={u.id}>{prop} · {u.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}

          <label className={lbl}>
            {isTopup ? "Note" : "What was it for?"}
            <input name="description" defaultValue={entry.description ?? ""} className={field} />
          </label>

          {/* Receipts get added long after the purchase is keyed in, so the
              edit dialog has to accept them — it couldn't, which left every
              entry logged without one stuck that way. */}
          {!isTopup && (
            <>
              <label className={lbl}>
                {entry.receiptCount > 0 ? "Add more receipt pages" : "Add a receipt"}
                <input
                  type="file"
                  name="file"
                  accept="application/pdf,image/*"
                  multiple
                  className="mt-1 block text-xs text-ink-soft file:mr-2 file:rounded-lg file:border file:border-clay-deep file:bg-sand file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink-soft"
                />
                <span className="mt-1 block text-[11px] text-ink-faint">
                  {entry.receiptCount > 0
                    ? `${entry.receiptCount} already attached — anything you add here joins them.`
                    : "Photo or PDF. Nothing attached to this one yet."}
                </span>
              </label>

              <label className="flex items-start gap-2.5 rounded-xl border border-clay bg-sand/40 px-3 py-2.5">
                <input
                  type="checkbox"
                  name="receipt_on_paper"
                  defaultChecked={entry.receiptOnPaper}
                  className="mt-0.5 h-4 w-4 rounded border-clay-deep accent-pine"
                />
                <span className="text-xs text-ink-soft">
                  <strong className="text-ink">Paper receipt handed over</strong> — counts as
                  documented even with no photo here.
                </span>
              </label>
            </>
          )}

          {state.error && <p className="text-xs text-terracotta-dark">{state.error}</p>}
          {state.ok && (
            <p className="text-xs font-medium text-pine">Saved ✓</p>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-ink-soft hover:text-ink"
            >
              {state.ok ? "Done" : "Cancel"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {trigger}
      {/* The dialog only exists once someone has clicked Edit, which can only
          happen on the client — so no mounted flag is needed to keep document
          out of the server render. */}
      {open && typeof document !== "undefined" && createPortal(dialog, document.body)}
    </>
  );
}
