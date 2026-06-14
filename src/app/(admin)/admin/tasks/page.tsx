import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import {
  TaskQuickAdd,
  type StaffOpt,
  type UnitOpt,
  type PropOpt,
} from "@/components/task-quick-add";
import { setTaskStatus, deleteTask } from "./actions";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type TaskRow = {
  id: string;
  title: string;
  details: string | null;
  category: string;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_id: string | null;
  assignee: { full_name: string | null } | null;
  property: { name: string | null; slug: string } | null;
  unit: { id: string; label: string; properties: { name: string | null } | null } | null;
};

const CATEGORY_CHIP: Record<string, string> = {
  emergency: "bg-terracotta text-cream",
  repair: "bg-clay text-ink-soft",
  cleaning: "bg-pine/15 text-pine",
  trash: "bg-sand text-ink-soft",
  fence: "bg-gold/20 text-ink",
  landscaping: "bg-pine/15 text-pine",
  inspection: "bg-clay text-ink-soft",
  admin: "bg-sand text-ink-soft",
  extra: "bg-gold/20 text-ink",
  other: "bg-sand text-ink-soft",
};

const COLUMNS: { key: string; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

export default async function AdminTasks({
  searchParams,
}: {
  searchParams: Promise<{ who?: string }>;
}) {
  const { who } = await searchParams;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: tasks }, { data: staff }, { data: properties }, { data: units }] =
    await Promise.all([
      db
        .from("tasks")
        .select(
          "id, title, details, category, status, priority, due_date, assignee_id, assignee:assignee_id(full_name), property:property_id(name, slug), unit:unit_id(id, label, properties(name))"
        )
        .neq("status", "cancelled")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .returns<TaskRow[]>(),
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("role", ["owner", "admin"])
        .order("full_name")
        .returns<{ id: string; full_name: string | null; role: string }[]>(),
      supabase.from("properties").select("id, name").order("name").returns<PropOpt[]>(),
      supabase
        .from("units")
        .select("id, label, properties(name)")
        .returns<{ id: string; label: string; properties: { name: string | null } | null }[]>(),
    ]);

  const staffOpts: StaffOpt[] = (staff ?? []).map((s) => ({
    id: s.id,
    name: s.full_name ?? "Staff",
  }));
  const propOpts: PropOpt[] = properties ?? [];
  const unitOpts: UnitOpt[] = (units ?? []).map((u) => ({
    id: u.id,
    label: u.label,
    property: u.properties?.name ?? "—",
  }));

  // Filter by assignee.
  const all = tasks ?? [];
  const filtered = who
    ? all.filter((t) =>
        who === "unassigned" ? !t.assignee_id : t.assignee_id === who
      )
    : all;

  const openCount = filtered.filter((t) => t.status !== "done").length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Tasks"
        subtitle="Everything to do across the communities — assign it, link a unit, track it."
        action={<TaskQuickAdd staff={staffOpts} properties={propOpts} units={unitOpts} />}
      />

      {/* Assignee filter */}
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Filter active={!who} href="/admin/tasks" label={`Everyone (${all.filter((t) => t.status !== "done").length})`} />
        {staffOpts.map((s) => (
          <Filter
            key={s.id}
            active={who === s.id}
            href={`/admin/tasks?who=${s.id}`}
            label={s.name}
          />
        ))}
        <Filter active={who === "unassigned"} href="/admin/tasks?who=unassigned" label="Unassigned" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No tasks here"
          body="Add a task with the button above — fences, trash, cleaning, emergencies, anything."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = filtered.filter((t) => t.status === col.key);
            return (
              <div key={col.key} className="rounded-2xl border border-clay bg-sand/30 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-ink">{col.label}</h2>
                  <span className="text-xs text-ink-faint">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map((t) => (
                    <TaskCard key={t.id} t={t} />
                  ))}
                  {items.length === 0 && (
                    <p className="px-1 py-4 text-center text-xs text-ink-faint">
                      Nothing here.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openCount > 0 && (
        <p className="mt-6 text-xs text-ink-faint">
          {openCount} open task{openCount === 1 ? "" : "s"}
          {who ? " for this person" : ""}.
        </p>
      )}
    </div>
  );
}

function Filter({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 font-medium ${
        active ? "bg-pine text-cream" : "text-ink-soft hover:bg-sand"
      }`}
    >
      {label}
    </Link>
  );
}

function TaskCard({ t }: { t: TaskRow }) {
  const overdue = t.status !== "done" && t.due_date != null && t.due_date < todayIso();
  const home = t.unit
    ? `${t.unit.properties?.name ?? ""} · ${t.unit.label}`
    : t.property?.name ?? null;

  return (
    <div className="rounded-xl border border-clay bg-cream p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                CATEGORY_CHIP[t.category] ?? CATEGORY_CHIP.other
              }`}
            >
              {t.category}
            </span>
            {(t.priority === "high" || t.priority === "urgent") && (
              <span className="rounded-full bg-terracotta-soft px-2 py-0.5 text-[10px] font-medium capitalize text-terracotta-dark">
                {t.priority}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm font-medium text-ink">{t.title}</p>
        </div>
        <form action={deleteTask}>
          <input type="hidden" name="id" value={t.id} />
          <button
            type="submit"
            className="text-xs text-ink-faint hover:text-terracotta-dark"
            title="Delete task"
          >
            ✕
          </button>
        </form>
      </div>

      {t.details && <p className="mt-1 text-xs text-ink-soft">{t.details}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
        {t.assignee?.full_name && <span>👤 {t.assignee.full_name}</span>}
        {home && (
          <span>
            📍{" "}
            {t.unit ? (
              <Link href={`/admin/units/${t.unit.id}`} className="text-pine hover:underline">
                {home}
              </Link>
            ) : t.property?.slug ? (
              <Link href={`/admin/properties/${t.property.slug}`} className="text-pine hover:underline">
                {home}
              </Link>
            ) : (
              home
            )}
          </span>
        )}
        {t.due_date && (
          <span className={overdue ? "font-medium text-terracotta-dark" : ""}>
            🗓 {formatDate(t.due_date)}
            {overdue ? " (overdue)" : ""}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {t.status === "todo" && (
          <StatusButton id={t.id} status="in_progress" label="Start" primary />
        )}
        {t.status === "in_progress" && (
          <StatusButton id={t.id} status="todo" label="↩ To do" />
        )}
        {t.status !== "done" ? (
          <StatusButton id={t.id} status="done" label="✓ Done" primary={t.status === "in_progress"} />
        ) : (
          <StatusButton id={t.id} status="todo" label="Reopen" />
        )}
      </div>
    </div>
  );
}

function StatusButton({
  id,
  status,
  label,
  primary = false,
}: {
  id: string;
  status: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={setTaskStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
          primary
            ? "bg-pine text-cream hover:bg-pine-dark"
            : "border border-clay-deep text-ink-soft hover:bg-sand"
        }`}
      >
        {label}
      </button>
    </form>
  );
}
