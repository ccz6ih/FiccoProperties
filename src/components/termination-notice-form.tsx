"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { createTerminationNotice } from "@/app/(admin)/admin/delinquency/actions";

export type TermUnit = {
  id: string;
  label: string;
  property: string;
  tenant: string;
  /** Whole months in the home. Omitted where tenure doesn't bear on the notice
   *  (the violation form reuses this shape). */
  monthsResident?: number | null;
};

const input =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

type Ground = "substantial" | "repeat" | "nonrenewal";
const DAYS: Record<Ground, number> = { substantial: 3, repeat: 10, nonrenewal: 21 };

function isoDaysOut(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function TerminationNoticeForm({
  units,
  defaultUnit,
}: {
  units: TermUnit[];
  defaultUnit?: string;
}) {
  const [unitId, setUnitId] = useState(defaultUnit ?? units[0]?.id ?? "");
  const [ground, setGround] = useState<Ground>("repeat");
  const [moveOut, setMoveOut] = useState(isoDaysOut(DAYS.repeat));
  const [touchedDate, setTouchedDate] = useState(false);

  // C.R.S. 38-12-1302 (HB24-1098): past 12 months in the home, a tenancy can't
  // be ended without cause outside the narrow exemptions — so say so here,
  // against this tenant, rather than in small print at the foot of the page.
  const chosen = units.find((u) => u.id === unitId) ?? null;
  const months = chosen?.monthsResident ?? null;
  const longTenured = months != null && months >= 12;

  const grounds = useMemo(
    () =>
      [
        { key: "substantial" as Ground, label: "Substantial violation (criminal) — 3-day", note: "Willful endangerment, violent/drug felony, or public-nuisance crime. Not curable." },
        { key: "repeat" as Ground, label: "Repeat lease violation — 10-day", note: "Same violation recurred after a prior served demand." },
        { key: "nonrenewal" as Ground, label: "Non-renewal", note: "Only for exempt cases or a tenant under 12 months. Otherwise use the 90-day no-fault." },
      ],
    []
  );

  function onGround(next: Ground) {
    setGround(next);
    if (!touchedDate) setMoveOut(isoDaysOut(DAYS[next]));
  }

  return (
    <form action={createTerminationNotice} className="space-y-5">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink">Unit / tenant</span>
        <select name="unit_id" value={unitId} onChange={(e) => setUnitId(e.target.value)} className={input} required>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.property} · {u.label} — {u.tenant}
              {u.monthsResident != null ? ` (${u.monthsResident} mo)` : ""}
            </option>
          ))}
        </select>
        <span className="block text-xs text-ink-faint">
          {months == null
            ? "No move-in date on file for this home — check the lease before relying on a notice period."
            : `Resident ${months} month${months === 1 ? "" : "s"}.`}
        </span>
      </label>

      {ground === "nonrenewal" && longTenured && (
        <div className="rounded-xl border-2 border-terracotta/40 bg-terracotta/5 px-4 py-3">
          <div className="text-sm font-semibold text-terracotta-dark">
            ⚠ This tenant has been here {months} months — a no-cause non-renewal likely isn&apos;t
            available
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Under C.R.S. § 38-12-1302 you can only end a tenancy without cause once someone has
            lived there 12 months if the home is a short-term rental, employer-provided housing, or
            a single-family/duplex/triplex where you live on site. None of the 38th Ave communities
            fit that. Use the 90-day no-fault notice instead, or a violation ground above — and
            check with your attorney before serving this.
          </p>
        </div>
      )}

      <fieldset className="space-y-2">
        <span className="text-sm font-medium text-ink">Ground</span>
        {grounds.map((g) => (
          <label
            key={g.key}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${
              ground === g.key ? "border-pine bg-pine-soft/40" : "border-clay-deep hover:bg-sand"
            }`}
          >
            <input
              type="radio"
              name="ground"
              value={g.key}
              checked={ground === g.key}
              onChange={() => onGround(g.key)}
              className="mt-0.5 h-4 w-4 accent-pine"
            />
            <span>
              <span className="block text-sm font-medium text-ink">{g.label}</span>
              <span className="block text-xs text-ink-faint">{g.note}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {ground !== "nonrenewal" && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">
            {ground === "substantial" ? "What happened (describe the violation)" : "Which lease term / rule + what happened"}
          </span>
          <textarea name="reason" rows={3} className={input} placeholder="Be specific — dates, conduct, which lease term or rule." />
        </label>
      )}

      {ground === "repeat" && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Prior demand served on (optional)</span>
          <input type="date" name="prior_demand_date" className={input} />
          <span className="text-xs text-ink-faint">Leave blank to auto-fill from the most recent served lease-violation notice.</span>
        </label>
      )}

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink">Move-out date</span>
        <input
          type="date"
          name="move_out_date"
          value={moveOut}
          onChange={(e) => {
            setMoveOut(e.target.value);
            setTouchedDate(true);
          }}
          className={input}
        />
        <span className="text-xs text-ink-faint">
          {ground === "substantial"
            ? "At least 3 days after service."
            : ground === "repeat"
              ? "At least 10 days after service."
              : "Non-renewal notice: 91 days (1yr+ lease) · 28 days (6–12 mo) · 21 days (month-to-month) · 3 days (weekly). Set the correct date."}
        </span>
      </label>

      <Button type="submit" variant="primary">Create notice</Button>
    </form>
  );
}
