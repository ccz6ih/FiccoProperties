"use client";

import { Button } from "@/components/ui";
import { startTurn } from "@/app/(admin)/admin/turns/actions";

const selectClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function MakereadyStartForm({
  unitId,
  templates,
}: {
  unitId: string;
  templates: { id: string; name: string }[];
}) {
  return (
    <form action={startTurn} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="unit_id" value={unitId} />
      <label className="flex-1 space-y-1.5">
        <span className="text-sm font-medium text-ink">Checklist template</span>
        <select name="template_id" className={selectClass} defaultValue={templates[0]?.id ?? ""}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="primary" disabled={templates.length === 0}>
        Start make-ready
      </Button>
    </form>
  );
}
