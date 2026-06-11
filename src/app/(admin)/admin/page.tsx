import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui";
import { PageHeader, StatCard, StatusPill } from "@/components/dashboard-ui";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type RecentApp = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  created_at: string;
  properties: { name: string | null } | null;
};

export default async function AdminOverview() {
  const supabase = await createClient();

  const [
    { count: unitCount },
    { data: units },
    { count: newApps },
    { data: recentApps },
    { data: openMaint },
    { data: properties },
  ] = await Promise.all([
    supabase.from("units").select("*", { count: "exact", head: true }),
    supabase.from("units").select("status"),
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("applications")
      .select("id, first_name, last_name, status, created_at, properties(name)")
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<RecentApp[]>(),
    supabase
      .from("maintenance_requests")
      .select("id, title, status, priority, created_at")
      .not("status", "in", "(completed,cancelled)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("properties").select("id, name, slug"),
  ]);

  const occupied = units?.filter((u) => u.status === "occupied").length ?? 0;
  const total = unitCount ?? 0;
  const occupancy = total ? Math.round((occupied / total) * 100) : 0;
  const openMaintCount = openMaint?.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Overview"
        subtitle="The whole portfolio at a glance."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total homes" value={total} hint={`${properties?.length ?? 0} communities`} />
        <StatCard label="Occupancy" value={`${occupancy}%`} tone="terracotta" hint={`${occupied} occupied`} />
        <StatCard label="New applications" value={newApps ?? 0} tone="gold" hint="Awaiting review" />
        <StatCard label="Open maintenance" value={openMaintCount} tone="terracotta" hint="Active requests" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <Eyebrow>Latest applications</Eyebrow>
            <Link href="/admin/applications" className="text-sm font-medium text-pine hover:text-pine-dark">
              Review queue
            </Link>
          </div>
          {recentApps && recentApps.length > 0 ? (
            <ul className="divide-y divide-clay">
              {recentApps.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {a.first_name} {a.last_name}
                    </div>
                    <div className="text-xs text-ink-faint">
                      {a.properties?.name ?? "—"} · {formatDate(a.created_at)}
                    </div>
                  </div>
                  <StatusPill value={a.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-ink-soft">No applications yet.</p>
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <Eyebrow>Open maintenance</Eyebrow>
            <Link href="/admin/maintenance" className="text-sm font-medium text-pine hover:text-pine-dark">
              View board
            </Link>
          </div>
          {openMaint && openMaint.length > 0 ? (
            <ul className="divide-y divide-clay">
              {openMaint.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-ink">{m.title}</div>
                    <div className="text-xs text-ink-faint">{formatDate(m.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {m.priority !== "normal" && <StatusPill value={m.priority} />}
                    <StatusPill value={m.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-ink-soft">Nothing open — nice.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
