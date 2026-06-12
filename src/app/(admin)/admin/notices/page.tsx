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
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

function typeLabel(type: string): string {
  return NOTICE_LABELS[type as NoticeType] ?? type;
}

export default async function AdminNotices() {
  const supabase = await createClient();
  const { data: notices } = await supabase
    .from("notices")
    .select(
      "id, type, title, status, served_at, created_at, profiles:resident_id(full_name, email)"
    )
    .order("created_at", { ascending: false })
    .returns<NoticeRow[]>();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Notices"
        subtitle="Draft, print, and serve resident notices and postings."
        action={
          <ButtonLink href="/admin/notices/new" variant="primary">
            New notice
          </ButtonLink>
        }
      />

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
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {notices.map((n) => (
                  <tr key={n.id} className="hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/notices/${n.id}`}
                        className="font-medium text-ink hover:text-pine"
                      >
                        {n.profiles?.full_name ?? "—"}
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
                    </td>
                    <td className="px-5 py-3 text-ink-soft">
                      {formatDate(n.created_at)}
                    </td>
                  </tr>
                ))}
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
