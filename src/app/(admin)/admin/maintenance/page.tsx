import Link from "next/link";
import { Card } from "@/components/ui";
import { PageHeader, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { formatDate, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type MaintenanceRow = Tables<"maintenance_requests"> & {
  units: { label: string; properties: { name: string | null } | null } | null;
};

const COLUMNS: { key: string; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "on_hold", label: "On hold" },
  { key: "completed", label: "Completed" },
];

export default async function AdminMaintenance() {
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("maintenance_requests")
    .select("*, units(label, properties(name))")
    .order("created_at", { ascending: false })
    .returns<MaintenanceRow[]>();

  const all = requests ?? [];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Maintenance board" subtitle="Every request across the portfolio." />

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
                        <div className="text-xs text-ink-faint">
                          {r.units?.properties?.name ?? "Unassigned"}
                          {r.units?.label ? ` · ${r.units.label}` : ""}
                        </div>
                        <div className="flex items-center justify-between text-xs text-ink-faint">
                          <span>{humanize(r.category)}</span>
                          <span>{formatDate(r.created_at)}</span>
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
