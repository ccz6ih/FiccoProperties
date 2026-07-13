import Link from "next/link";
import { Card, ButtonLink } from "@/components/ui";
import { PageHeader, EmptyState, StatusPill } from "@/components/dashboard-ui";
import { NOTICE_LABELS, type NoticeType } from "@/lib/notice-template";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type NoticeRow = {
  id: string;
  type: string;
  title: string;
  status: string;
  served_at: string | null;
  served_email: string | null;
  cure_by: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
  units: {
    label: string | null;
    unit_occupancy: { tenant_name: string | null }[] | null;
  } | null;
};

function typeLabel(type: string): string {
  return NOTICE_LABELS[type as NoticeType] ?? type;
}

/** Whole days from today (start of day) to an ISO date; negative = past. */
function daysUntil(iso: string, todayIso: string): number {
  const ms = new Date(iso).getTime() - new Date(todayIso).getTime();
  return Math.round(ms / 86_400_000);
}

export default async function AdminNotices({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  const createdCount = created ? Number(created) : null;

  const supabase = await createClient();
  const { data: notices } = await supabase
    .from("notices")
    .select(
      "id, type, title, status, served_at, served_email, cure_by, created_at, profiles:resident_id(full_name, email), units:unit_id(label, unit_occupancy(tenant_name))"
    )
    .order("created_at", { ascending: false })
    .returns<NoticeRow[]>();

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Notices"
        subtitle="Draft, print, and serve resident notices and postings."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/notices/violation"
              className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
            >
              Lease violation →
            </Link>
            <Link
              href="/admin/notices/terminate"
              className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
            >
              Terminate tenancy →
            </Link>
            <ButtonLink href="/admin/notices/new" variant="primary">
              New notice
            </ButtonLink>
          </div>
        }
      />

      {createdCount != null && (
        <div className="mb-6 rounded-xl border border-pine/30 bg-pine-soft px-4 py-3 text-sm text-pine-dark">
          {createdCount > 0
            ? `Created ${createdCount} demand${createdCount === 1 ? "" : "s"}. Review each one below, then print and mark it served.`
            : "No new demands to create — every overdue unit already has an open demand."}
        </div>
      )}

      {notices && notices.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Resident</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Served</th>
                  <th className="px-5 py-3 font-medium">Cure by</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {notices.map((n) => {
                  const name =
                    n.profiles?.full_name ??
                    n.units?.unit_occupancy?.[0]?.tenant_name ??
                    n.units?.label ??
                    "—";
                  // Countdown only matters for a served pay-or-quit with a cure date.
                  const showCure =
                    n.type === "pay_or_quit" &&
                    n.status === "served" &&
                    !!n.cure_by;
                  const daysLeft = showCure ? daysUntil(n.cure_by!, todayIso) : null;
                  return (
                    <tr key={n.id} className="hover:bg-sand/30">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/notices/${n.id}`}
                          className="font-medium text-ink hover:text-pine"
                        >
                          {name}
                        </Link>
                        <div className="text-xs text-ink-faint">
                          {n.profiles?.email ?? ""}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{typeLabel(n.type)}</td>
                      <td className="px-5 py-3">
                        <StatusPill value={n.status} />
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        {n.served_at ? formatDate(n.served_at) : "—"}
                        {n.served_at && (
                          <div className="text-xs">
                            {n.served_email ? (
                              <span className="text-pine" title={`Emailed to ${n.served_email}`}>
                                ✓ emailed
                              </span>
                            ) : (
                              <span className="text-ink-faint">no email</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {showCure ? (
                          daysLeft! > 0 ? (
                            <span className="text-ink-soft">
                              {formatDate(n.cure_by!)}
                              <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold">
                                {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                              </span>
                            </span>
                          ) : (
                            <span className="text-ink-soft">
                              {formatDate(n.cure_by!)}
                              <span className="ml-2 rounded-full bg-terracotta/15 px-2 py-0.5 text-xs font-semibold text-terracotta-dark">
                                Cure ended — ready to file
                              </span>
                            </span>
                          )
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        {formatDate(n.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No notices yet"
          body="Draft a late-rent reminder, lease-violation notice, or other posting to print and serve."
          action={
            <ButtonLink href="/admin/notices/new" variant="primary">
              New notice
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}
