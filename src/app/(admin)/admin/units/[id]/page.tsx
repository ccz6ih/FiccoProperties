import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { PageHeader, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { MakereadyStartForm } from "@/components/makeready-start-form";
import { formatCents, formatDate, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type UnitRow = {
  id: string;
  label: string;
  status: string;
  bedrooms: number | null;
  bathrooms: number | null;
  rent_cents: number | null;
  properties: { name: string | null } | null;
};

type RequestRow = {
  id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
};

type TurnRow = {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  makeready_templates: { name: string | null } | null;
};

type TemplateRow = { id: string; name: string };

export default async function UnitDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // make-ready tables aren't in the generated types yet (added in 0004).
  const db = supabase as unknown as SupabaseClient;

  const { data: unit } = await supabase
    .from("units")
    .select("id, label, status, bedrooms, bathrooms, rent_cents, properties(name)")
    .eq("id", id)
    .maybeSingle()
    .returns<UnitRow>();

  if (!unit) notFound();

  const [{ data: requests }, { data: turns }, { data: templates }] = await Promise.all([
    supabase
      .from("maintenance_requests")
      .select("id, title, category, status, priority, created_at")
      .eq("unit_id", id)
      .order("created_at", { ascending: false })
      .returns<RequestRow[]>(),
    db
      .from("makeready_turns")
      .select("id, status, created_at, completed_at, makeready_templates(name)")
      .eq("unit_id", id)
      .order("created_at", { ascending: false })
      .returns<TurnRow[]>(),
    db
      .from("makeready_templates")
      .select("id, name")
      .order("name", { ascending: true })
      .returns<TemplateRow[]>(),
  ]);

  const requestList = requests ?? [];
  const turnList = turns ?? [];
  const templateList = templates ?? [];
  const activeTurn = turnList.find((t) => t.status !== "complete");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`${unit.properties?.name ?? "Unit"} · ${unit.label}`}
        subtitle={[
          unit.bedrooms != null ? `${unit.bedrooms} bd` : null,
          unit.bathrooms != null ? `${unit.bathrooms} ba` : null,
          unit.rent_cents != null ? `${formatCents(unit.rent_cents)}/mo` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={<StatusPill value={unit.status} />}
      />

      <div className="space-y-6">
        <Card className="space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Make-ready</h2>
          {activeTurn ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-clay bg-white/70 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-ink">
                  {activeTurn.makeready_templates?.name ?? "Make-ready"} in progress
                </div>
                <div className="text-xs text-ink-faint">
                  Started {formatDate(activeTurn.created_at)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill value={activeTurn.status} />
                <Link
                  href={`/admin/turns/${activeTurn.id}`}
                  className="text-sm font-medium text-pine hover:text-pine-dark"
                >
                  Open →
                </Link>
              </div>
            </div>
          ) : (
            <MakereadyStartForm unitId={unit.id} templates={templateList} />
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">
            Maintenance history
          </h2>
          {requestList.length > 0 ? (
            <ul className="divide-y divide-clay">
              {requestList.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/maintenance/${r.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-sand/30"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">{r.title}</div>
                      <div className="text-xs text-ink-faint">
                        {humanize(r.category)} · {formatDate(r.created_at)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {r.priority !== "normal" && <StatusPill value={r.priority} />}
                      <StatusPill value={r.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-faint">No maintenance requests for this unit.</p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">Turn history</h2>
          {turnList.length > 0 ? (
            <ul className="divide-y divide-clay">
              {turnList.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/turns/${t.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-sand/30"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">
                        {t.makeready_templates?.name ?? "Make-ready"}
                      </div>
                      <div className="text-xs text-ink-faint">
                        {t.completed_at
                          ? `Completed ${formatDate(t.completed_at)}`
                          : `Started ${formatDate(t.created_at)}`}
                      </div>
                    </div>
                    <StatusPill value={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-faint">No make-ready turns yet.</p>
          )}
        </Card>
      </div>

      {requestList.length === 0 && turnList.length === 0 && !activeTurn && (
        <div className="mt-6">
          <EmptyState
            title="Nothing recorded yet"
            body="Maintenance requests and make-ready turns for this unit will appear here."
          />
        </div>
      )}
    </div>
  );
}
