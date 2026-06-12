"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { createNotice } from "@/app/(admin)/admin/notices/actions";
import {
  buildNotice,
  NOTICE_LABELS,
  type NoticeType,
} from "@/lib/notice-template";

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

const NOTICE_TYPES = Object.keys(NOTICE_LABELS) as NoticeType[];

export type ResidentOption = {
  id: string;
  full_name: string | null;
  email: string | null;
  home_label: string | null;
  full_address: string | null;
};

// Per-type which optional inputs to show.
const FIELDS: Record<
  NoticeType,
  {
    amount?: boolean;
    period?: boolean;
    dueDate?: boolean;
    cureBy?: boolean;
    reason?: boolean;
    entry?: boolean;
    custom?: boolean;
  }
> = {
  late_rent: { amount: true, period: true, dueDate: true },
  pay_or_quit: { amount: true, period: true, cureBy: true },
  lease_violation: { reason: true, cureBy: true },
  entry: { entry: true, reason: true },
  general: { custom: true },
};

/** Display string for today, matching the statement page format. */
function todayDisplay(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** ISO yyyy-mm-dd for a date N days from now. */
function isoDaysOut(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Render an ISO date as a friendly display string for the notice body. */
function displayDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function NoticeCreateForm({
  residents,
}: {
  residents: ResidentOption[];
}) {
  const [residentId, setResidentId] = useState("");
  const [type, setType] = useState<NoticeType>("late_rent");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [cureBy, setCureBy] = useState("");
  const [reason, setReason] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [entryTime, setEntryTime] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const fields = FIELDS[type];
  const resident = residents.find((r) => r.id === residentId);

  function onTypeChange(next: NoticeType) {
    setType(next);
    // Default cure_by ~10 days out for pay-or-quit.
    if (next === "pay_or_quit" && !cureBy) {
      setCureBy(isoDaysOut(10));
    }
  }

  function generate() {
    const built = buildNotice(type, {
      tenantName: resident?.full_name,
      homeLabel: resident?.home_label,
      fullAddress: resident?.full_address,
      amount: amount || null,
      period: period || null,
      dueDate: dueDate ? displayDate(dueDate) : null,
      cureBy: cureBy ? displayDate(cureBy) : null,
      reason: reason || null,
      entryDate: entryDate ? displayDate(entryDate) : null,
      entryTime: entryTime || null,
      customTitle: title || null,
      customBody: body || null,
      today: todayDisplay(),
    });
    setTitle(built.title);
    setBody(built.body);
  }

  return (
    <Card className="p-6">
      <form action={createNotice} className="space-y-4">
        <input type="hidden" name="cure_by" value={cureBy} />
        <input type="hidden" name="amount" value={amount} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Resident</span>
            <select
              name="resident_id"
              required
              value={residentId}
              onChange={(e) => setResidentId(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Choose a resident…
              </option>
              {residents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name ?? "Unnamed"}
                  {r.home_label ? ` — ${r.home_label}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Notice type</span>
            <select
              name="type"
              value={type}
              onChange={(e) => onTypeChange(e.target.value as NoticeType)}
              className={inputClass}
            >
              {NOTICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {NOTICE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {resident && !resident.home_label && (
          <p className="rounded-xl bg-sand/60 px-4 py-2.5 text-xs text-ink-soft">
            This resident has no current home on file — the notice will use
            placeholder address text and won&apos;t be linked to a unit.
          </p>
        )}

        {/* Conditional inputs by type */}
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.amount && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Amount (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
                placeholder="1450"
              />
            </label>
          )}
          {fields.period && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Period</span>
              <input
                type="text"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className={inputClass}
                placeholder="July 2026"
              />
            </label>
          )}
          {fields.dueDate && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </label>
          )}
          {fields.cureBy && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">
                Cure by{type === "pay_or_quit" ? " (10-day deadline)" : ""}
              </span>
              <input
                type="date"
                value={cureBy}
                onChange={(e) => setCureBy(e.target.value)}
                className={inputClass}
              />
            </label>
          )}
          {fields.entry && (
            <>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Entry date</span>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">
                  Entry time (optional)
                </span>
                <input
                  type="text"
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  className={inputClass}
                  placeholder="10:00 AM"
                />
              </label>
            </>
          )}
        </div>

        {fields.reason && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">
              {type === "entry" ? "Reason for entry" : "Violation description"}
            </span>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
              placeholder={
                type === "entry"
                  ? "Repairs, inspection, or to show the unit"
                  : "Describe the violation"
              }
            />
          </label>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={generate}
            className="whitespace-nowrap rounded-full border border-clay-deep px-4 py-1.5 text-xs font-medium text-pine hover:bg-sand"
          >
            Generate
          </button>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Title</span>
          <input
            type="text"
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Click Generate to prefill, then edit"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Body</span>
          <textarea
            name="body"
            required
            rows={16}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={inputClass}
            placeholder="Click Generate to prefill the notice wording from the fields above, then edit as needed."
          />
          <span className="block text-[11px] text-ink-faint">
            Not legal advice. For an eviction filing use Colorado JDF forms /
            your attorney.
          </span>
        </label>

        <Button type="submit" variant="primary">
          Save notice
        </Button>
      </form>
    </Card>
  );
}
