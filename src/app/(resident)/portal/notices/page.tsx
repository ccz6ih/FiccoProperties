import { Card } from "@/components/ui";
import { PageHeader, EmptyState, StatusPill } from "@/components/dashboard-ui";
import { NOTICE_LABELS, type NoticeType } from "@/lib/notice-template";
import { formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type NoticeRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  status: string;
  served_at: string | null;
  created_at: string;
};

function typeLabel(type: string): string {
  return NOTICE_LABELS[type as NoticeType] ?? type;
}

export default async function PortalNotices() {
  const { user } = await requireProfile("/portal/notices");
  const supabase = await createClient();

  // RLS returns only this resident's non-draft notices.
  const { data: notices } = await supabase
    .from("notices")
    .select("id, type, title, body, status, served_at, created_at")
    .eq("resident_id", user.id)
    .order("created_at", { ascending: false })
    .returns<NoticeRow[]>();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notices"
        subtitle="Official notices and postings from the management office."
      />

      {notices && notices.length > 0 ? (
        <div className="space-y-4">
          {notices.map((n) => (
            <Card key={n.id} className="space-y-3 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <h2 className="font-display text-lg font-semibold text-ink">
                    {n.title}
                  </h2>
                  <div className="text-xs text-ink-faint">
                    {typeLabel(n.type)} ·{" "}
                    {formatDate(n.served_at ?? n.created_at)}
                  </div>
                </div>
                <StatusPill value={n.status} />
              </div>
              <div className="whitespace-pre-wrap border-t border-clay pt-3 text-sm leading-relaxed text-ink-soft">
                {n.body}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No notices"
          body="When the office posts a notice for your home, it will appear here."
        />
      )}
    </div>
  );
}
