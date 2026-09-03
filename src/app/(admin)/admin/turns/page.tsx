import Link from "next/link";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { TurnStartPanel, type TurnUnitOpt } from "@/components/turn-start-panel";
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
type UnitRow = {
  id: string;
  label: string;
  status: string;
  properties: { name: string | null } | null;
};
type TemplateRow = { id: string; name: string; makeready_template_items: { id: string }[] };
type OccIdRow = { unit_id: string; tenant_name: string | null };

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
  const [{ data: turns }, { data: units }, { data: templates }, { data: occ }] = await Promise.all([
    db
      .from("makeready_turns")
      .select(
        "id, status, created_at, completed_at, units(label, properties(name)), makeready_templates(name), makeready_tasks(done)"
      )
      .order("created_at", { ascending: false })
      .returns<TurnRow[]>(),
    db
      .from("units")
      .select("id, label, status, properties(name)")
      .order("label", { ascending: true })
      .returns<UnitRow[]>(),
    db
      .from("makeready_templates")
      .select("id, name, makeready_template_items(id)")
      .order("name", { ascending: true })
      .returns<TemplateRow[]>(),
    // Occupancy fetched separately — nested embeds come back empty here.
    db.from("unit_occupancy").select("unit_id, tenant_name").returns<OccIdRow[]>(),
  ]);

  const all = turns ?? [];

  // A home "needs a turn" when nobody lives there and no turn is already running.
  const livedIn = new Set(
    (occ ?? []).filter((o) => o.tenant_name).map((o) => o.unit_id)
  );
  const unitsWithOpenTurn = new Set<string>();
  for (const t of all) {
    if (t.status !== "complete" && t.units) {
      unitsWithOpenTurn.add(`${t.units.properties?.name}·${t.units.label}`);
    }
  }

  const unitOpts: TurnUnitOpt[] = (units ?? []).map((u) => {
    const key = `${u.properties?.name}·${u.label}`;
    return {
      id: u.id,
      label: u.label,
      property: u.properties?.name ?? "Unassigned",
      waiting:
        !livedIn.has(u.id) &&
        !unitsWithOpenTurn.has(key) &&
        (u.status === "make_ready" || u.status === "available"),
    };
  });
  const templateOpts = (templates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    items: t.makeready_template_items?.length ?? 0,
  }));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Make-ready board"
        subtitle="Track unit turnovers from vacant to ready-to-lease."
      />

      <TurnStartPanel units={unitOpts} templates={templateOpts} />

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
          body="Pick a home above and start one — the checklist steps come with it."
        />
      )}
    </div>
  );
}
