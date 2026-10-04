/**
 * One list over maintenance requests AND tasks.
 *
 * They stay two tables on purpose: a maintenance request is readable by the
 * resident whose home it's on, a task is staff-only, and a task can hang off a
 * whole property ("back fence") where a request can't. Merging them would mean
 * either exposing internal work to tenants or rewriting that boundary — so the
 * join happens here, in the reading, where it's safe.
 *
 * What the two share is what you actually search by: what, where, who, when.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchesTerms, splitTerms } from "@/lib/search-match";

export type WorkSource = "maintenance" | "task";

export type WorkItem = {
  id: string;
  source: WorkSource;
  title: string;
  details: string | null;
  category: string;
  priority: string;
  /** Raw status from its own table. */
  status: string;
  /** Normalised so both tables sort and filter together. */
  state: "open" | "in_progress" | "done" | "cancelled";
  propertyName: string | null;
  unitLabel: string | null;
  unitId: string | null;
  assigneeName: string | null;
  assigneeId: string | null;
  createdAt: string;
  /** Task due date, or a maintenance visit that's been scheduled. */
  dueDate: string | null;
  completedAt: string | null;
  href: string;
};

type MaintRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  scheduled_for: string | null;
  unit_id: string | null;
  assigned_to: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

type TaskRow = {
  id: string;
  title: string;
  details: string | null;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  due_date: string | null;
  unit_id: string | null;
  assignee_id: string | null;
  unit: { label: string; properties: { name: string | null } | null } | null;
  property: { name: string | null } | null;
};

const maintState = (s: string): WorkItem["state"] =>
  s === "completed" ? "done" : s === "cancelled" ? "cancelled" : s === "in_progress" ? "in_progress" : "open";
const taskState = (s: string): WorkItem["state"] =>
  s === "done" ? "done" : s === "cancelled" ? "cancelled" : s === "in_progress" ? "in_progress" : "open";

/** Everything, both tables, in one shape. Filtering happens on the result. */
export async function getWorkItems(db: SupabaseClient): Promise<WorkItem[]> {
  const [{ data: maint }, { data: tasks }, { data: staff }] = await Promise.all([
    db
      .from("maintenance_requests")
      .select(
        "id, title, description, category, priority, status, created_at, completed_at, scheduled_for, unit_id, assigned_to, units:unit_id(label, properties(name))"
      )
      .order("created_at", { ascending: false })
      .returns<MaintRow[]>(),
    db
      .from("tasks")
      .select(
        "id, title, details, category, priority, status, created_at, completed_at, due_date, unit_id, assignee_id, unit:unit_id(label, properties(name)), property:property_id(name)"
      )
      .order("created_at", { ascending: false })
      .returns<TaskRow[]>(),
    db
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["owner", "admin"])
      .returns<{ id: string; full_name: string | null; email: string | null }[]>(),
  ]);

  const nameById = new Map(
    (staff ?? []).map((s) => [s.id, s.full_name ?? s.email ?? "Staff"] as const)
  );

  const fromMaint: WorkItem[] = (maint ?? []).map((m) => ({
    id: m.id,
    source: "maintenance",
    title: m.title,
    details: m.description,
    category: m.category,
    priority: m.priority,
    status: m.status,
    state: maintState(m.status),
    propertyName: m.units?.properties?.name ?? null,
    unitLabel: m.units?.label ?? null,
    unitId: m.unit_id,
    assigneeName: m.assigned_to ? nameById.get(m.assigned_to) ?? null : null,
    assigneeId: m.assigned_to,
    createdAt: m.created_at,
    dueDate: m.scheduled_for ?? null,
    completedAt: m.completed_at,
    href: `/admin/maintenance/${m.id}`,
  }));

  const fromTasks: WorkItem[] = (tasks ?? []).map((t) => ({
    id: t.id,
    source: "task",
    title: t.title,
    details: t.details,
    category: t.category,
    priority: t.priority,
    status: t.status,
    state: taskState(t.status),
    // A task can be attached to a whole property rather than one home.
    propertyName: t.unit?.properties?.name ?? t.property?.name ?? null,
    unitLabel: t.unit?.label ?? null,
    unitId: t.unit_id,
    assigneeName: t.assignee_id ? nameById.get(t.assignee_id) ?? null : null,
    assigneeId: t.assignee_id,
    createdAt: t.created_at,
    dueDate: t.due_date,
    completedAt: t.completed_at,
    href: "/admin/tasks",
  }));

  return [...fromMaint, ...fromTasks];
}

export type WorkFilters = {
  q?: string;
  place?: string;
  unit?: string;
  who?: string;
  source?: string;
  state?: string;
  from?: string;
  to?: string;
};

/**
 * Apply the filters. Open work sorts by what's most overdue; finished work by
 * what finished most recently — the two questions you actually ask of a list
 * this size ("what's waiting on me" and "what did we do on this home").
 */
export function filterWork(items: WorkItem[], f: WorkFilters): WorkItem[] {
  const terms = splitTerms(f.q ?? "");
  const todayIso = new Date().toISOString().slice(0, 10);

  const out = items.filter((w) => {
    if (f.source && f.source !== "all" && w.source !== f.source) return false;
    if (f.place && f.place !== "all" && w.propertyName !== f.place) return false;
    if (f.unit && f.unit !== "all" && w.unitId !== f.unit) return false;
    if (f.who && f.who !== "all") {
      if (f.who === "none" ? !!w.assigneeId : w.assigneeId !== f.who) return false;
    }

    const state = f.state ?? "live";
    if (state === "live" && (w.state === "done" || w.state === "cancelled")) return false;
    if (state === "done" && w.state !== "done") return false;
    if (state === "overdue") {
      if (w.state === "done" || w.state === "cancelled") return false;
      if (!w.dueDate || w.dueDate >= todayIso) return false;
    }

    // Date window reads against whichever date defines the item.
    const when = (w.completedAt ?? w.dueDate ?? w.createdAt).slice(0, 10);
    if (f.from && when < f.from) return false;
    if (f.to && when > f.to) return false;

    if (terms.length > 0) {
      const hay = [w.title, w.details, w.propertyName, w.unitLabel, w.assigneeName, w.category]
        .filter(Boolean)
        .join(" ");
      if (!matchesTerms(hay, terms)) return false;
    }
    return true;
  });

  const done = (w: WorkItem) => w.state === "done" || w.state === "cancelled";
  return out.sort((a, b) => {
    if (done(a) !== done(b)) return done(a) ? 1 : -1;
    if (done(a)) {
      return (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt);
    }
    // Live work: anything with a date first, oldest date first, then newest raised.
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
