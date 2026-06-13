"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { formatCents } from "@/lib/format";
import {
  addExpense,
  addTopup,
  type CashState,
} from "@/app/(admin)/admin/petty-cash/actions";

const initial: CashState = { ok: false };
const field =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";
const lbl = "block text-xs font-medium text-ink-faint";

const CATEGORIES = ["supplies", "materials", "tools", "fuel", "cleaning", "extra", "other"];

export type StaffOpt = { id: string; name: string };
export type UnitOpt = { id: string; label: string; property: string };
export type PropOpt = { id: string; name: string };

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PettyCashForms({
  staff,
  properties,
  units,
  defaultStaffId,
}: {
  staff: StaffOpt[];
  properties: PropOpt[];
  units: UnitOpt[];
  defaultStaffId: string;
}) {
  const [tab, setTab] = useState<"expense" | "topup">("expense");

  return (
    <div className="rounded-2xl border border-clay bg-cream p-5 shadow-sm">
      <div className="mb-4 flex gap-2">
        <Tab active={tab === "expense"} onClick={() => setTab("expense")} label="Log expense" />
        <Tab active={tab === "topup"} onClick={() => setTab("topup")} label="+ Add cash received" />
      </div>
      {tab === "expense" ? (
        <ExpenseForm
          staff={staff}
          properties={properties}
          units={units}
          defaultStaffId={defaultStaffId}
        />
      ) : (
        <TopupForm staff={staff} defaultStaffId={defaultStaffId} />
      )}
    </div>
  );
}

function Tab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
        active ? "bg-pine text-cream" : "text-ink-soft hover:bg-sand"
      }`}
    >
      {label}
    </button>
  );
}

function ExpenseForm({
  staff,
  properties,
  units,
  defaultStaffId,
}: {
  staff: StaffOpt[];
  properties: PropOpt[];
  units: UnitOpt[];
  defaultStaffId: string;
}) {
  const [state, action, pending] = useActionState(addExpense, initial);
  const [total, setTotal] = useState("");
  const [amount, setAmount] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setTotal("");
      setAmount("");
    }
  }, [state]);

  const t = parseFloat(total);
  const a = parseFloat(amount);
  const personal =
    Number.isFinite(t) && Number.isFinite(a) && t > a ? Math.round((t - a) * 100) : null;

  const byProperty = new Map<string, UnitOpt[]>();
  for (const u of units) {
    const arr = byProperty.get(u.property) ?? [];
    arr.push(u);
    byProperty.set(u.property, arr);
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lbl}>
          Envelope
          <select name="staff_id" defaultValue={defaultStaffId} className={field}>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className={lbl}>
          Date
          <input type="date" name="occurred_on" defaultValue={today()} className={field} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lbl}>
          Store / vendor
          <input name="store" placeholder="Home Depot…" className={field} />
        </label>
        <label className={lbl}>
          Category
          <select name="category" defaultValue="supplies" className={field}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lbl}>
          Receipt total ($)
          <input
            inputMode="decimal"
            name="receipt_total"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="47.83"
            className={field}
          />
        </label>
        <label className={lbl}>
          From petty cash ($) — business portion
          <input
            inputMode="decimal"
            name="amount"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="22.10"
            className={field}
          />
        </label>
      </div>

      {personal != null && (
        <p className="rounded-lg bg-sand/60 px-3 py-2 text-xs text-ink-soft">
          {formatCents(personal)} of this receipt is personal (not from the envelope).
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lbl}>
          Community (optional)
          <select name="property_id" defaultValue="" className={field}>
            <option value="">—</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className={lbl}>
          Unit (optional)
          <select name="unit_id" defaultValue="" className={field}>
            <option value="">—</option>
            {[...byProperty.entries()].map(([prop, list]) => (
              <optgroup key={prop} label={prop}>
                {list.map((u) => (
                  <option key={u.id} value={u.id}>{prop} · {u.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <label className={lbl}>
        What was it for?
        <input name="description" placeholder="Fence brackets, trash bags…" className={field} />
      </label>

      <label className={lbl}>
        Receipt photo / PDF (optional)
        <input
          type="file"
          name="file"
          accept="application/pdf,image/*"
          className="mt-1 block text-xs text-ink-soft file:mr-2 file:rounded-lg file:border file:border-clay-deep file:bg-sand file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink-soft"
        />
      </label>

      {state.error && <p className="text-xs text-terracotta-dark">{state.error}</p>}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Log expense"}
      </Button>
    </form>
  );
}

function TopupForm({ staff, defaultStaffId }: { staff: StaffOpt[]; defaultStaffId: string }) {
  const [state, action, pending] = useActionState(addTopup, initial);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <p className="text-xs text-ink-soft">
        Record cash you received for the envelope (e.g. what Lou hands you). This
        raises the envelope&apos;s balance.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={lbl}>
          Envelope
          <select name="staff_id" defaultValue={defaultStaffId} className={field}>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className={lbl}>
          Date received
          <input type="date" name="occurred_on" defaultValue={today()} className={field} />
        </label>
        <label className={lbl}>
          Amount ($)
          <input inputMode="decimal" name="amount" required placeholder="200" className={field} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lbl}>
          Received from
          <input name="received_from" defaultValue="Lou" className={field} />
        </label>
        <label className={lbl}>
          Note (optional)
          <input name="description" placeholder="Monthly refill" className={field} />
        </label>
      </div>
      {state.error && <p className="text-xs text-terracotta-dark">{state.error}</p>}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Add cash to envelope"}
      </Button>
    </form>
  );
}
