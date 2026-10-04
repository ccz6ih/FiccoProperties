import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { RecurringForm } from "@/components/recurring-form";
import { toggleRecurring, deleteRecurring, raiseNow } from "@/app/(admin)/admin/recurring/actions";
import { nextDueDate, type RecurringRow } from "@/lib/recurring-work";
import { formatDate, humanize } from "@/lib/format";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Recurring work" };
export const dynamic = "force-dynamic";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** "Apr & Oct" / "Every month" / "Quarterly" — the shape at a glance. */
function monthsLabel(months: number[] | null): string {
  const m = (months ?? []).slice().sort((a, b) => a - b);
  if (m.length === 0) return "No months set";
  if (m.length === 12) return "Every month";
  if (m.length === 4 && m.join() === "1,4,7,10") return "Quarterly";
  return m.map((n) => MONTH_NAMES[n - 1]).join(" · ");
}

type Row = RecurringRow & {
  units: { label: string; properties: { name: string | null } | null } | null;
  properties: { name: string | null } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

export default async function RecurringWork() {
  const { profile } = await requireProfile("/admin/recurring");
  if (!isStaff(profile)) redirect("/portal");

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: rows, error }, { data: places }, { data: unitRows }, { data: staff }] =
    await Promise.all([
      db
        .from("recurring_work")
        .select(
          "id, title, details, kind, category, priority, property_id, unit_id, assignee_id, months, day_of_month, lead_days, active, last_raised_on, created_by, units:unit_id(label, properties(name)), properties:property_id(name), profiles:assignee_id(full_name, email)"
        )
        .order("active", { ascending: false })
        .returns<Row[]>(),
      db.from("properties").select("id, name").order("name").returns<{ id: string; name: string }[]>(),
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

  const today = new Date();
  const list = rows ?? [];

  const units = (unitRows ?? [])
    .map((u) => ({
      id: u.id,
      label: `${u.properties?.name ? `${u.properties.name} · ` : ""}${u.label}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const people = (staff ?? []).map((s) => ({ id: s.id, name: s.full_name ?? s.email ?? "Staff" }));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Recurring work"
        subtitle="The seasonal jobs — raised as real tasks before they're due, so they don't live in your head."
        action={
          <form action={raiseNow}>
            <button
              type="submit"
              className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
            >
              Raise anything due now
            </button>
          </form>
        }
      />

      {error ? (
        <Card className="p-6 text-sm text-terracotta-dark">
          The recurring_work table isn&apos;t there yet — run migration 0058 and reload.
        </Card>
      ) : (
        <>
          <div className="mb-5">
            <RecurringForm places={places ?? []} units={units} people={people} />
          </div>

          {list.length > 0 ? (
            <Card className="overflow-hidden p-0">
              <ul className="divide-y divide-clay">
                {list.map((r) => {
                  const where =
                    r.units?.label
                      ? `${r.units.properties?.name ? `${r.units.properties.name} · ` : ""}${r.units.label}`
                      : r.properties?.name ?? "No place set";
                  const due = nextDueDate(r, today);
                  return (
                    <li key={r.id} className={`px-4 py-3 ${r.active ? "" : "bg-sand/40"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-ink">{r.title}</span>
                            <span className="rounded-full bg-clay-deep/25 px-2 py-0.5 text-[11px] text-ink-soft">
                              {humanize(r.category)}
                            </span>
                            {!r.active && (
                              <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] text-ink-faint">
                                Paused
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-ink-faint">
                            {where} · {monthsLabel(r.months)} on day {r.day_of_month} ·{" "}
                            {r.lead_days === 0 ? "raised on the day" : `raised ${r.lead_days} days early`}
                            {r.profiles ? ` · ${r.profiles.full_name ?? r.profiles.email}` : ""}
                          </div>
                          {r.details && (
                            <div className="mt-0.5 text-xs text-ink-faint">{r.details}</div>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-xs font-medium text-ink-soft">
                            {r.active && due ? `Next ${formatDate(due)}` : "—"}
                          </div>
                          <div className="mt-0.5 text-[11px] text-ink-faint">
                            {r.last_raised_on ? `Last raised ${formatDate(r.last_raised_on)}` : "Never raised"}
                          </div>
                          <div className="mt-1.5 flex items-center justify-end gap-3 text-xs">
                            <form action={toggleRecurring}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="active" value={String(r.active)} />
                              <button className="font-medium text-pine hover:underline">
                                {r.active ? "Pause" : "Resume"}
                              </button>
                            </form>
                            <form action={deleteRecurring}>
                              <input type="hidden" name="id" value={r.id} />
                              <button className="text-ink-faint hover:text-terracotta-dark">
                                Delete
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : (
            <EmptyState
              title="Nothing scheduled yet"
              body="Add the jobs that come round every year — gutters, furnace filters, sprinkler blow-out — and they'll appear as tasks before they're due."
            />
          )}

          <p className="mt-4 text-xs text-ink-faint">
            Each one is raised as a real task on the{" "}
            <Link href="/admin/work" className="font-medium text-pine hover:underline">
              work list
            </Link>{" "}
            when its lead time comes round — checked every morning. Pausing keeps the schedule;
            deleting throws it away.
          </p>
        </>
      )}
    </div>
  );
}
