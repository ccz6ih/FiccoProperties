"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { TermUnit } from "@/components/termination-notice-form";
import { createLeaseViolationForUnit } from "@/app/(admin)/admin/delinquency/actions";

const input =
  "w-full rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

const EXAMPLES = [
  "Unauthorized lock change — reinstall the Landlord's original deadbolt (a new key is not accepted).",
  "Unauthorized pet on the premises (Lease §11). Remove the animal from the property.",
  "Items stored on the front rocks/grass (Community Rules #1, #6). Move them to the back patio.",
  "Trash/furniture left by the dumpster (Community Rules #5). Remove it.",
];

export function LeaseViolationForm({
  units,
  defaultUnit,
}: {
  units: TermUnit[];
  defaultUnit?: string;
}) {
  const [unitId, setUnitId] = useState(defaultUnit ?? units[0]?.id ?? "");
  const [reason, setReason] = useState("");

  return (
    <form action={createLeaseViolationForUnit} className="space-y-5">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink">Unit / tenant</span>
        <select name="unit_id" value={unitId} onChange={(e) => setUnitId(e.target.value)} className={input} required>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.property} · {u.label} — {u.tenant}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink">
          Violation &amp; required correction
        </span>
        <textarea
          name="reason"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={input}
          placeholder="Describe the violation, cite the lease section or community rule, and state exactly what they must do to fix it."
          required
        />
      </label>

      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setReason(ex)}
            className="rounded-full border border-clay-deep px-2.5 py-1 text-xs text-ink-soft hover:bg-sand"
          >
            {ex.split(" — ")[0]}
          </button>
        ))}
      </div>

      <label className="block max-w-[200px] space-y-1.5">
        <span className="text-sm font-medium text-ink">Days to correct</span>
        <input name="cure_days" type="number" min={1} max={60} defaultValue={10} className={input} />
      </label>

      <Button type="submit" variant="primary">Create notice</Button>
    </form>
  );
}
