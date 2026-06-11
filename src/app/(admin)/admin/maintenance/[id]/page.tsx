import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { PageHeader, StatusPill, EmptyState } from "@/components/dashboard-ui";
import {
  MaintenanceStatusControl,
  MaintenancePriorityControl,
  MaintenanceAssigneeControl,
} from "@/components/maintenance-controls";
import { MaintenanceCommentForm } from "@/components/maintenance-comment-form";
import { Avatar } from "@/components/avatar";
import { addMaintenanceComment } from "@/app/(admin)/admin/maintenance/actions";
import { formatDate, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type RequestRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  units: { label: string; properties: { name: string | null } | null } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

type CommentRow = {
  id: string;
  body: string;
  internal: boolean;
  created_at: string;
  profiles: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
};

type StaffRow = { id: string; full_name: string | null; email: string | null };

export default async function MaintenanceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // maintenance_comments isn't in the generated types yet (added in 0004).
  const db = supabase as unknown as SupabaseClient;

  const { data: request } = await supabase
    .from("maintenance_requests")
    .select(
      "id, title, description, category, priority, status, assigned_to, created_at, units(label, properties(name)), profiles!maintenance_requests_created_by_fkey(full_name, email)"
    )
    .eq("id", id)
    .maybeSingle()
    .returns<RequestRow>();

  if (!request) notFound();

  const { data: comments } = await db
    .from("maintenance_comments")
    .select("id, body, internal, created_at, profiles(full_name, email, avatar_url)")
    .eq("request_id", id)
    .order("created_at", { ascending: true })
    .returns<CommentRow[]>();

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("role", ["owner", "admin"])
    .order("full_name", { ascending: true })
    .returns<StaffRow[]>();

  const thread = comments ?? [];
  const staffList = staff ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={request.title}
        subtitle={`${request.units?.properties?.name ?? "Unassigned"}${
          request.units?.label ? ` · ${request.units.label}` : ""
        }`}
        action={
          <Link
            href="/admin/maintenance"
            className="text-sm font-medium text-pine hover:text-pine-dark"
          >
            ← Back to board
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
              <span>{humanize(request.category)}</span>
              <span>·</span>
              <span>Reported {formatDate(request.created_at)}</span>
              {request.profiles && (
                <>
                  <span>·</span>
                  <span>by {request.profiles.full_name ?? request.profiles.email}</span>
                </>
              )}
            </div>
            {request.description ? (
              <p className="whitespace-pre-line text-sm text-ink-soft">
                {request.description}
              </p>
            ) : (
              <p className="text-sm text-ink-faint">No additional details provided.</p>
            )}
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Activity</h2>
            {thread.length > 0 ? (
              <ul className="space-y-3">
                {thread.map((c) => (
                  <li
                    key={c.id}
                    className={`rounded-xl border px-4 py-3 ${
                      c.internal
                        ? "border-[#e6d9b0] bg-[#f6edd6]/50"
                        : "border-clay bg-white/70"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-medium text-ink">
                        <Avatar
                          size="sm"
                          name={c.profiles?.full_name ?? c.profiles?.email}
                          url={c.profiles?.avatar_url}
                        />
                        {c.profiles?.full_name ?? c.profiles?.email ?? "Unknown"}
                      </span>
                      <div className="flex items-center gap-2">
                        {c.internal && <StatusPill value="internal" />}
                        <span className="text-xs text-ink-faint">
                          {formatDate(c.created_at)}
                        </span>
                      </div>
                    </div>
                    <p className="whitespace-pre-line text-sm text-ink-soft">{c.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-faint">No comments yet.</p>
            )}
            <MaintenanceCommentForm
              requestId={request.id}
              action={addMaintenanceComment}
              allowInternal
            />
          </Card>
        </div>

        <Card className="h-fit space-y-5 p-6">
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              Status
            </span>
            <MaintenanceStatusControl id={request.id} status={request.status} />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              Priority
            </span>
            <MaintenancePriorityControl id={request.id} priority={request.priority} />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              Assigned to
            </span>
            <MaintenanceAssigneeControl
              id={request.id}
              assignedTo={request.assigned_to}
              staff={staffList}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
