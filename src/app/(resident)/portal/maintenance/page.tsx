import { Card } from "@/components/ui";
import { PageHeader, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { MaintenanceForm } from "@/components/maintenance-form";
import { formatDate, humanize } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function MaintenancePage() {
  const { user } = await requireProfile("/portal/maintenance");
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("maintenance_requests")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Maintenance"
        subtitle="Report an issue and follow it through to done."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <MaintenanceForm />

        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-ink">Your requests</h2>
          {requests && requests.length > 0 ? (
            <ul className="space-y-3">
              {requests.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-ink">{r.title}</div>
                      <div className="mt-0.5 text-xs text-ink-faint">
                        {humanize(r.category)} · {formatDate(r.created_at)}
                      </div>
                      {r.description && (
                        <p className="mt-2 text-sm text-ink-soft line-clamp-2">
                          {r.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusPill value={r.status} />
                      {r.priority !== "normal" && <StatusPill value={r.priority} />}
                    </div>
                  </div>
                </Card>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No requests yet"
              body="When you submit a maintenance request, it'll show up here so you can track its progress."
            />
          )}
        </div>
      </div>
    </div>
  );
}
