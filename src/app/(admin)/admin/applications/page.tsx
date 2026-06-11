import Link from "next/link";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { ApplicationStatusControl } from "@/components/application-status-control";
import { formatCents, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type ApplicationRow = Tables<"applications"> & {
  properties: { name: string | null } | null;
};

export default async function AdminApplications() {
  const supabase = await createClient();
  const { data: applications } = await supabase
    .from("applications")
    .select("*, properties(name)")
    .order("created_at", { ascending: false })
    .returns<ApplicationRow[]>();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Applications"
        subtitle="Review and move applicants through the pipeline."
      />

      {applications && applications.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Applicant</th>
                  <th className="px-5 py-3 font-medium">Community</th>
                  <th className="px-5 py-3 font-medium">Move-in</th>
                  <th className="px-5 py-3 font-medium">Income</th>
                  <th className="px-5 py-3 font-medium">Applied</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {applications.map((a) => (
                  <tr key={a.id} className="hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/applications/${a.id}`}
                        className="font-medium text-ink hover:text-pine"
                      >
                        {a.first_name} {a.last_name}
                      </Link>
                      <div className="text-xs text-ink-faint">{a.email}</div>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">
                      {a.properties?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{formatDate(a.desired_move_in)}</td>
                    <td className="px-5 py-3 text-ink-soft">
                      {a.monthly_income_cents ? `${formatCents(a.monthly_income_cents)}/mo` : "—"}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{formatDate(a.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <ApplicationStatusControl id={a.id} status={a.status} />
                        {a.status === "approved" && (
                          <Link
                            href={`/admin/leases/new?application=${a.id}`}
                            className="whitespace-nowrap text-xs font-medium text-pine hover:text-pine-dark"
                          >
                            Create lease →
                          </Link>
                        )}
                        {a.status === "denied" && !a.adverse_action_sent_at && (
                          <Link
                            href={`/admin/applications/${a.id}`}
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-terracotta-soft px-2.5 py-0.5 text-xs font-medium text-terracotta-dark"
                          >
                            ⚠ Notice due
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No applications yet"
          body="When prospects apply through the public site, they'll land here for review."
        />
      )}
    </div>
  );
}
