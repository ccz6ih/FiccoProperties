import Link from "next/link";
import { Card } from "@/components/ui";
import { PageHeader, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { Avatar } from "@/components/avatar";
import { MaintenanceQuickAdd, type MaintUnitOpt } from "@/components/maintenance-quick-add";
import { formatDate, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type MaintenanceRow = Tables<"maintenance_requests"> & {
  units: { label: string; properties: { name: string | null } | null } | null;
  assignee: { full_name: string | null; avatar_url: string | null } | null;
};

const COLUMNS: { key: string; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "on_hold", label: "On hold" },
  { key: "completed", label: "Completed" },
];

// Colorado warranty-of-habitability response windows (C.R.S. 38-12-503):
// life/safety conditions → 24h to respond; other habitability issues → 96h.
const HABITABILITY_CATEGORIES = new Set(["plumbing", "hvac", "heating", "electrical", "pest"]);

function habitabilityClock(
  r: { category: string; priority: string; status: string; created_at: string },
  nowMs: number
): { label: string; cls: string } | null {
  if (!["open", "in_progress"].includes(r.status)) return null;
  const emergency = r.priority === "emergency";
  const habitability = HABITABILITY_CATEGORIES.has(r.category);
  if (!emergency && !habitability) return null;

  const windowHours = emergency ? 24 : 96;
  const elapsed = (nowMs - new Date(r.created_at).getTime()) / 3_600_000;
  const left = windowHours - elapsed;

  if (left <= 0) {
    return {
      label: `⏰ Habitability window passed (${windowHours}h) — respond now`,
      cls: "bg-terracotta text-cream",
    };
  }
  if (left <= windowHours / 3) {
    return {
      label: `⏳ Habitability: ${Math.ceil(left)}h left of ${windowHours}h`,
      cls: "bg-gold/30 text-ink",
    };
  }
  return {
    label: `Habitability: respond within ${windowHours}h (${Math.ceil(left)}h left)`,
    cls: "bg-pine/10 text-pine",
  };
}

export default async function AdminMaintenance() {
  const supabase = await createClient();
  const [{ data: requests }, { data: units }] = await Promise.all([
    supabase
      .from("maintenance_requests")
      .select(
        "*, units(label, properties(name)), assignee:profiles!maintenance_requests_assigned_to_fkey(full_name, avatar_url)"
      )
      .order("created_at", { ascending: false })
      .returns<MaintenanceRow[]>(),
    supabase
      .from("units")
      .select("id, label, properties(name)")
      .returns<{ id: string; label: string; properties: { name: string | null } | null }[]>(),
  ]);

  const all = requests ?? [];
  const nowMs = new Date().getTime();
  const unitOpts: MaintUnitOpt[] = (units ?? []).map((u) => ({
    id: u.id,
    label: u.label,
    property: u.properties?.name ?? "—",
  }));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Maintenance board"
        subtitle="Every request across the portfolio."
        action={<MaintenanceQuickAdd units={unitOpts} />}
      />

      {all.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = all.filter((r) => r.status === col.key);
            return (
              <div key={col.key} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-ink">{col.label}</span>
                  <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-ink-soft">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {items.map((r) => (
                    <Link key={r.id} href={`/admin/maintenance/${r.id}`} className="block">
                      <Card className="space-y-2 p-4 transition-colors hover:border-clay-deep hover:bg-sand/30">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-ink">{r.title}</span>
                          {r.priority !== "normal" && <StatusPill value={r.priority} />}
                        </div>
                        {(() => {
                          const clock = habitabilityClock(r, nowMs);
                          return clock ? (
                            <div className={`rounded-lg px-2 py-1 text-[11px] font-medium leading-tight ${clock.cls}`}>
                              {clock.label}
                            </div>
                          ) : null;
                        })()}
                        <div className="text-xs text-ink-faint">
                          {r.units?.properties?.name ?? "Unassigned"}
                          {r.units?.label ? ` · ${r.units.label}` : ""}
                        </div>
                        <div className="flex items-center justify-between text-xs text-ink-faint">
                          <span>{humanize(r.category)}</span>
                          <span>{formatDate(r.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 border-t border-clay pt-2 text-xs">
                          {r.assignee ? (
                            <>
                              <Avatar
                                size="sm"
                                name={r.assignee.full_name}
                                url={r.assignee.avatar_url}
                              />
                              <span className="text-ink-soft">
                                {r.assignee.full_name ?? "Assigned"}
                              </span>
                            </>
                          ) : (
                            <span className="text-ink-faint">Unassigned</span>
                          )}
                        </div>
                      </Card>
                    </Link>
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-clay-deep py-8 text-center text-xs text-ink-faint">
                      Nothing here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No maintenance requests"
          body="Resident-submitted requests will populate this board automatically."
        />
      )}
    </div>
  );
}
