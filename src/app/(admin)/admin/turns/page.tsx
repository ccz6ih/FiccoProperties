import Link from "next/link";
import { Card } from "@/components/ui";
import { PageHeader, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type TurnRow = {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
  makeready_templates: { name: string | null } | null;
  makeready_tasks: { done: boolean }[];
};

const COLUMNS: { key: string; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" },
  { key: "complete", label: "Complete" },
];

export default async function AdminTurns() {
  const supabase = await createClient();
  // make-ready tables aren't in the generated types yet (added in 0004).
  const db = supabase as unknown as SupabaseClient;
  const { data: turns } = await db
    .from("makeready_turns")
    .select(
      "id, status, created_at, completed_at, units(label, properties(name)), makeready_templates(name), makeready_tasks(done)"
    )
    .order("created_at", { ascending: false })
    .returns<TurnRow[]>();

  const all = turns ?? [];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Make-ready board"
        subtitle="Track unit turnovers from vacant to ready-to-lease."
      />

      {all.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = all.filter((t) => t.status === col.key);
            return (
              <div key={col.key} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-ink">{col.label}</span>
                  <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-ink-soft">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {items.map((t) => {
                    const total = t.makeready_tasks.length;
                    const done = t.makeready_tasks.filter((x) => x.done).length;
                    return (
                      <Link key={t.id} href={`/admin/turns/${t.id}`} className="block">
                        <Card className="space-y-2 p-4 transition-colors hover:border-clay-deep hover:bg-sand/30">
                          <div className="text-sm font-medium text-ink">
                            {t.units?.properties?.name ?? "Unassigned"}
                            {t.units?.label ? ` · ${t.units.label}` : ""}
                          </div>
                          <div className="text-xs text-ink-faint">
                            {t.makeready_templates?.name ?? "Make-ready"}
                          </div>
                          <div className="flex items-center justify-between text-xs text-ink-faint">
                            <span>
                              {done}/{total} done
                            </span>
                            <span>{formatDate(t.created_at)}</span>
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
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
          title="No make-ready turns"
          body="Start a turn from a vacant unit's page to begin tracking its turnover."
        />
      )}
    </div>
  );
}
