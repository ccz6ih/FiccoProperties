import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { InspectionScheduleForm, type UnitOpt } from "@/components/inspection-forms";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  kind: string;
  scheduled_for: string;
  time_window: string | null;
  status: string;
  completed_at: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

const KIND_LABEL: Record<string, string> = {
  annual: "Annual",
  seasonal: "Seasonal",
  move_in: "Move-in",
  move_out: "Move-out",
  follow_up: "Follow-up",
  complaint: "Follow-up",
};

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Scheduled — notice not sent", cls: "bg-gold/20 text-ink" },
  notice_sent: { label: "Notice sent ✓", cls: "bg-pine/15 text-pine" },
  completed: { label: "Completed", cls: "bg-sand text-ink-soft" },
  canceled: { label: "Canceled", cls: "bg-sand text-ink-faint" },
};

export default async function AdminInspections() {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: inspections }, { data: units }] = await Promise.all([
    db
      .from("inspections")
      .select("id, kind, scheduled_for, time_window, status, completed_at, units:unit_id(label, properties(name))")
      .order("scheduled_for", { ascending: true })
      .returns<Row[]>(),
    db
      .from("units")
      .select("id, label, properties(name)")
      .returns<{ id: string; label: string; properties: { name: string | null } | null }[]>(),
  ]);

  const unitOpts: UnitOpt[] = (units ?? []).map((u) => ({
    id: u.id,
    label: u.label,
    property: u.properties?.name ?? "—",
  }));

  const all = inspections ?? [];
  const upcoming = all.filter((i) => ["scheduled", "notice_sent"].includes(i.status));
  const past = all
    .filter((i) => ["completed", "canceled"].includes(i.status))
    .sort((a, b) => b.scheduled_for.localeCompare(a.scheduled_for))
    .slice(0, 25);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Inspections"
        subtitle="Scheduled walk-throughs with entry notices, findings, and a permanent record per unit."
      />

      <Card className="mb-8 p-6">
        <h2 className="mb-1 font-display text-lg font-semibold text-ink">Schedule an inspection</h2>
        <p className="mb-4 text-xs text-ink-faint">
          Pick the unit and day — then open it to email the resident their entry notice.
        </p>
        <InspectionScheduleForm units={unitOpts} />
      </Card>

      <h2 className="mb-3 font-display text-lg font-semibold text-ink">
        Upcoming{upcoming.length > 0 ? ` (${upcoming.length})` : ""}
      </h2>
      {upcoming.length > 0 ? (
        <Card className="mb-8 overflow-hidden">
          <ul className="divide-y divide-clay">
            {upcoming.map((i) => {
              const chip = STATUS_CHIP[i.status] ?? STATUS_CHIP.scheduled;
              const home = i.units
                ? `${i.units.properties?.name ?? "—"} · ${i.units.label}`
                : "—";
              return (
                <li key={i.id}>
                  <Link
                    href={`/admin/inspections/${i.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-sand/30"
                  >
                    <div>
                      <div className="text-sm font-medium text-ink">{home}</div>
                      <div className="text-xs text-ink-faint">
                        {KIND_LABEL[i.kind] ?? i.kind} · {formatDate(i.scheduled_for)}
                        {i.time_window ? ` · ${i.time_window}` : ""}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${chip.cls}`}>
                      {chip.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <div className="mb-8">
          <EmptyState
            title="Nothing scheduled"
            body="Schedule a walk-through above — annual inspections catch small problems before they're expensive ones."
          />
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">Recent history</h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-clay">
              {past.map((i) => {
                const home = i.units
                  ? `${i.units.properties?.name ?? "—"} · ${i.units.label}`
                  : "—";
                return (
                  <li key={i.id}>
                    <Link
                      href={`/admin/inspections/${i.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-sand/30"
                    >
                      <div>
                        <div className="text-sm text-ink">{home}</div>
                        <div className="text-xs text-ink-faint">
                          {KIND_LABEL[i.kind] ?? i.kind} · {formatDate(i.scheduled_for)}
                        </div>
                      </div>
                      <span className="text-xs text-ink-faint">
                        {i.status === "canceled" ? "Canceled" : `Completed ${formatDate(i.completed_at ?? i.scheduled_for)}`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
