import { Card } from "@/components/ui";
import { PageHeader, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { MaintenanceForm } from "@/components/maintenance-form";
import { MaintenanceCommentForm } from "@/components/maintenance-comment-form";
import { MaintenanceTimeline } from "@/components/maintenance-timeline";
import { Avatar } from "@/components/avatar";
import { addResidentComment } from "@/app/(resident)/portal/maintenance/actions";
import { formatDate, humanize } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONDITION_BUCKET } from "@/lib/unit-photos";
import type { SupabaseClient } from "@supabase/supabase-js";

type CommentRow = {
  id: string;
  request_id: string;
  body: string;
  created_at: string;
  profiles: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
};

export default async function MaintenancePage() {
  const { user } = await requireProfile("/portal/maintenance");
  const supabase = await createClient();
  // maintenance_comments isn't in the generated types yet (added in 0004).
  const db = supabase as unknown as SupabaseClient;

  // Loose handle — scheduled_for/scheduled_window/vendor_id are newer columns.
  const { data: requests } = await db
    .from("maintenance_requests")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        title: string;
        description: string | null;
        category: string;
        priority: string;
        status: string;
        created_at: string;
        completed_at: string | null;
        assigned_to: string | null;
        vendor_id: string | null;
        scheduled_for: string | null;
        scheduled_window: string | null;
      }[]
    >();

  const list = requests ?? [];

  // Non-internal comments on the resident's own requests (RLS filters the rest).
  const { data: comments } =
    list.length > 0
      ? await db
          .from("maintenance_comments")
          .select("id, request_id, body, created_at, profiles(full_name, email, avatar_url)")
          .in(
            "request_id",
            list.map((r) => r.id)
          )
          .eq("internal", false)
          .order("created_at", { ascending: true })
          .returns<CommentRow[]>()
      : { data: [] as CommentRow[] };

  const commentsByRequest = new Map<string, CommentRow[]>();
  for (const c of comments ?? []) {
    const arr = commentsByRequest.get(c.request_id) ?? [];
    arr.push(c);
    commentsByRequest.set(c.request_id, arr);
  }

  // Photos (RLS scopes to their own requests); signed URLs from the private bucket.
  const photosByRequest = new Map<string, string[]>();
  if (list.length > 0) {
    const { data: photoRows } = await db
      .from("maintenance_photos")
      .select("request_id, path")
      .in("request_id", list.map((r) => r.id))
      .returns<{ request_id: string; path: string }[]>();
    const admin = createAdminClient();
    for (const p of photoRows ?? []) {
      const { data: signed } = await admin.storage
        .from(CONDITION_BUCKET)
        .createSignedUrl(p.path, 3600);
      if (signed?.signedUrl) {
        const arr = photosByRequest.get(p.request_id) ?? [];
        arr.push(signed.signedUrl);
        photosByRequest.set(p.request_id, arr);
      }
    }
  }

  const isOpen = (status: string) => status !== "completed" && status !== "cancelled";

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
          {list.length > 0 ? (
            <ul className="space-y-3">
              {list.map((r) => {
                const thread = commentsByRequest.get(r.id) ?? [];
                return (
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

                    <div className="mt-4">
                      <MaintenanceTimeline
                        createdAt={r.created_at}
                        assigned={!!r.assigned_to || !!r.vendor_id}
                        scheduledFor={r.scheduled_for ?? null}
                        scheduledWindow={r.scheduled_window ?? null}
                        status={r.status}
                        completedAt={r.completed_at ?? null}
                      />
                    </div>

                    {(photosByRequest.get(r.id) ?? []).length > 0 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto">
                        {(photosByRequest.get(r.id) ?? []).map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="Request photo" className="h-16 w-20 rounded-lg border border-clay object-cover" />
                          </a>
                        ))}
                      </div>
                    )}

                    {(thread.length > 0 || isOpen(r.status)) && (
                      <div className="mt-4 space-y-3 border-t border-clay pt-4">
                        {thread.length > 0 && (
                          <ul className="space-y-2">
                            {thread.map((c) => (
                              <li
                                key={c.id}
                                className="rounded-xl border border-clay bg-white/70 px-3 py-2"
                              >
                                <div className="mb-0.5 flex items-center justify-between gap-2 text-xs text-ink-faint">
                                  <span className="flex items-center gap-2 font-medium text-ink-soft">
                                    <Avatar
                                      size="sm"
                                      name={c.profiles?.full_name ?? c.profiles?.email}
                                      url={c.profiles?.avatar_url}
                                    />
                                    {c.profiles?.full_name ?? c.profiles?.email ?? "38th Ave team"}
                                  </span>
                                  <span>{formatDate(c.created_at)}</span>
                                </div>
                                <p className="whitespace-pre-line text-sm text-ink-soft">
                                  {c.body}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                        {isOpen(r.status) && (
                          <MaintenanceCommentForm
                            requestId={r.id}
                            action={addResidentComment}
                          />
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
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
