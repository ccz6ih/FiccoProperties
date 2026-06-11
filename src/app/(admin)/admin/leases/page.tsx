import { Card } from "@/components/ui";
import { PageHeader, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { formatCents, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type LeaseRow = Tables<"leases"> & {
  units: { label: string; properties: { name: string | null } | null } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

export default async function AdminLeases() {
  const supabase = await createClient();
  const { data: leases } = await supabase
    .from("leases")
    .select("*, units(label, properties(name)), profiles(full_name, email)")
    .order("start_date", { ascending: false })
    .returns<LeaseRow[]>();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Leases" subtitle="Active and historical agreements." />

      {leases && leases.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Resident</th>
                  <th className="px-5 py-3 font-medium">Home</th>
                  <th className="px-5 py-3 font-medium">Rent</th>
                  <th className="px-5 py-3 font-medium">Term</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {leases.map((l) => (
                  <tr key={l.id} className="hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">{l.profiles?.full_name ?? "—"}</div>
                      <div className="text-xs text-ink-faint">{l.profiles?.email}</div>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">
                      {l.units?.properties?.name} · {l.units?.label}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{formatCents(l.rent_cents)}</td>
                    <td className="px-5 py-3 text-ink-soft">
                      {formatDate(l.start_date)} – {l.end_date ? formatDate(l.end_date) : "ongoing"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill value={l.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No leases yet"
          body="Approve an application and create a lease to get started. Lease creation and e-signature arrive in Phase 2."
        />
      )}
    </div>
  );
}
