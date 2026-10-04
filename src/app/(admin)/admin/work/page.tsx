import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { WorkFilters, type FilterOption } from "@/components/work-filters";
import { getWorkItems, filterWork, type WorkItem } from "@/lib/work-items";
import { formatDate, humanize } from "@/lib/format";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "All work" };
export const dynamic = "force-dynamic";

/** A list this long is only useful if a row says where and when at a glance. */
function WorkRow({ w, todayIso }: { w: WorkItem; todayIso: string }) {
  const overdue = !!w.dueDate && w.dueDate < todayIso && w.state !== "done" && w.state !== "cancelled";
  const where = [w.propertyName, w.unitLabel].filter(Boolean).join(" · ");

  return (
    <li className="border-b border-clay last:border-0">
      <Link href={w.href} className="block px-4 py-3 hover:bg-sand/40">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  w.source === "maintenance"
                    ? "bg-pine/10 text-pine"
                    : "bg-clay-deep/25 text-ink-soft"
                }`}
              >
                {w.source === "maintenance" ? "Maintenance" : "Task"}
              </span>
              <span className="text-[11px] text-ink-faint">{humanize(w.category)}</span>
              {(w.priority === "emergency" || w.priority === "urgent" || w.priority === "high") && (
                <StatusPill value={w.priority} />
              )}
            </div>
            <div className="mt-1 font-medium text-ink">{w.title}</div>
            {w.details && (
              <div className="mt-0.5 line-clamp-1 text-sm text-ink-faint">{w.details}</div>
            )}
          </div>

          <div className="shrink-0 text-right text-xs">
            <div className="font-medium text-ink-soft">{where || "No home"}</div>
            <div className="mt-0.5 text-ink-faint">{w.assigneeName ?? "Unassigned"}</div>
            <div className={`mt-0.5 ${overdue ? "font-semibold text-terracotta-dark" : "text-ink-faint"}`}>
              {w.completedAt
                ? `Done ${formatDate(w.completedAt)}`
                : w.dueDate
                  ? `${w.source === "maintenance" ? "Visit" : "Due"} ${formatDate(w.dueDate)}${overdue ? " — overdue" : ""}`
                  : `Raised ${formatDate(w.createdAt)}`}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

export default async function AllWork({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { profile } = await requireProfile("/admin/work");
  if (!isStaff(profile)) redirect("/portal");

  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [items, { data: unitRows }, { data: staffRows }] = await Promise.all([
    getWorkItems(db),
    db
      .from("units")
      .select("id, label, properties(name)")
      .returns<{ id: string; label: string; properties: { name: string | null } | null }[]>(),
    db
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["owner", "admin"])
      .order("full_name")
      .returns<{ id: string; full_name: string | null; email: string | null }[]>(),
  ]);

  const todayIso = new Date().toISOString().slice(0, 10);

  // Counts are of everything EXCEPT the state filter, so the tabs keep telling
  // you how much is open while you're looking at what's done.
  const base = { ...sp, state: "all" };
  const scoped = filterWork(items, base);
  const counts = {
    all: scoped.length,
    live: scoped.filter((w) => w.state !== "done" && w.state !== "cancelled").length,
    overdue: scoped.filter(
      (w) => w.state !== "done" && w.state !== "cancelled" && !!w.dueDate && w.dueDate < todayIso
    ).length,
    done: scoped.filter((w) => w.state === "done").length,
  };

  const results = filterWork(items, sp);

  // Only offer homes that actually carry work — 150 units in a dropdown is
  // worse than none.
  const unitsWithWork = new Set(items.map((w) => w.unitId).filter(Boolean) as string[]);
  const places: FilterOption[] = [
    ...new Set(items.map((w) => w.propertyName).filter(Boolean) as string[]),
  ]
    .sort()
    .map((p) => ({ value: p, label: p }));
  const units: FilterOption[] = (unitRows ?? [])
    .filter((u) => unitsWithWork.has(u.id))
    .map((u) => ({
      value: u.id,
      label: `${u.properties?.name ? `${u.properties.name} · ` : ""}${u.label}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const people: FilterOption[] = (staffRows ?? []).map((s) => ({
    value: s.id,
    label: s.full_name ?? s.email ?? "Staff",
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="All work"
        subtitle="Maintenance and tasks in one list — filter by home, community, person or date."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/maintenance"
              className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
            >
              Maintenance board
            </Link>
            <Link
              href="/admin/tasks"
              className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
            >
              Task board
            </Link>
          </div>
        }
      />

      <WorkFilters places={places} units={units} people={people} counts={counts} />

      {results.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <ul>
            {results.slice(0, 300).map((w) => (
              <WorkRow key={`${w.source}-${w.id}`} w={w} todayIso={todayIso} />
            ))}
          </ul>
          {results.length > 300 && (
            <div className="border-t border-clay px-4 py-3 text-center text-xs text-ink-faint">
              Showing the first 300 of {results.length} — narrow it with a filter above.
            </div>
          )}
        </Card>
      ) : (
        <EmptyState
          title="Nothing matches"
          body="Try a different community, person or date range — or clear the filters."
        />
      )}
    </div>
  );
}
