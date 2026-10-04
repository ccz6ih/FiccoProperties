/**
 * Raising the seasonal jobs — gutters, furnace filters, sprinkler blow-out.
 *
 * Each schedule names the months it runs in rather than a frequency, because
 * "April and October" is a real answer and no enum of monthly/quarterly/annual
 * can give it. A job is raised `lead_days` before its date so there's time to
 * actually do it, and `last_raised_on` means a cron that runs every morning
 * still only ever raises each occurrence once.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RecurringRow = {
  id: string;
  title: string;
  details: string | null;
  kind: "task" | "maintenance";
  category: string;
  priority: string;
  property_id: string | null;
  unit_id: string | null;
  assignee_id: string | null;
  months: number[] | null;
  day_of_month: number;
  lead_days: number;
  active: boolean;
  last_raised_on: string | null;
  created_by: string | null;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The next date this schedule is due on or after `from`. Returns null when it
 * names no months.
 */
export function nextDueDate(row: RecurringRow, from: Date): string | null {
  const months = (row.months ?? []).filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (months.length === 0) return null;

  // Look across this year and next so December → January rolls over.
  for (let yearOffset = 0; yearOffset <= 1; yearOffset++) {
    const year = from.getFullYear() + yearOffset;
    for (const m of months) {
      const due = new Date(Date.UTC(year, m - 1, row.day_of_month));
      if (iso(due) >= iso(from)) return iso(due);
    }
  }
  return null;
}

/** True when the lead window has opened and this occurrence isn't raised yet. */
export function isDueToRaise(row: RecurringRow, today: Date): { due: boolean; dueDate: string | null } {
  if (!row.active) return { due: false, dueDate: null };
  const dueDate = nextDueDate(row, today);
  if (!dueDate) return { due: false, dueDate: null };

  const raiseFrom = new Date(`${dueDate}T00:00:00Z`);
  raiseFrom.setUTCDate(raiseFrom.getUTCDate() - row.lead_days);

  if (iso(today) < iso(raiseFrom)) return { due: false, dueDate };
  // Already raised for this occurrence.
  if (row.last_raised_on && row.last_raised_on >= iso(raiseFrom)) return { due: false, dueDate };
  return { due: true, dueDate };
}

/**
 * Raise everything whose lead window has opened. Returns what it created, so
 * the cron can report and the digest can mention it.
 */
export async function raiseDueRecurringWork(
  db: SupabaseClient,
  today = new Date()
): Promise<{ title: string; dueDate: string; kind: string }[]> {
  const { data: rows } = await db
    .from("recurring_work")
    .select(
      "id, title, details, kind, category, priority, property_id, unit_id, assignee_id, months, day_of_month, lead_days, active, last_raised_on, created_by"
    )
    .eq("active", true)
    .returns<RecurringRow[]>();

  const raised: { title: string; dueDate: string; kind: string }[] = [];

  for (const row of rows ?? []) {
    const { due, dueDate } = isDueToRaise(row, today);
    if (!due || !dueDate) continue;

    if (row.kind === "maintenance" && row.unit_id) {
      const { error } = await db.from("maintenance_requests").insert({
        unit_id: row.unit_id,
        created_by: row.created_by ?? row.assignee_id,
        title: row.title,
        description: row.details,
        category: row.category,
        priority: row.priority === "urgent" ? "emergency" : row.priority,
        status: "open",
      });
      if (error) continue;
    } else {
      const { error } = await db.from("tasks").insert({
        title: row.title,
        details: row.details,
        category: row.category,
        priority: row.priority === "emergency" ? "urgent" : row.priority,
        property_id: row.property_id,
        unit_id: row.unit_id,
        assignee_id: row.assignee_id,
        due_date: dueDate,
        created_by: row.created_by ?? row.assignee_id,
        recurring_id: row.id,
      });
      if (error) continue;
    }

    await db
      .from("recurring_work")
      .update({ last_raised_on: iso(today) })
      .eq("id", row.id);

    raised.push({ title: row.title, dueDate, kind: row.kind });
  }

  return raised;
}
