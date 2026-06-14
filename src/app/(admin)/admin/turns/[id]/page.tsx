import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { MakereadyChecklist } from "@/components/makeready-checklist";
import { MakereadyTurnStatus } from "@/components/makeready-turn-status";
import { formatCents, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type TurnRow = {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  unit_id: string | null;
  units: { id: string; label: string; properties: { name: string | null } | null } | null;
  makeready_templates: { name: string | null } | null;
  started_by_profile: { full_name: string | null; email: string | null } | null;
};

type TaskRow = {
  id: string;
  label: string;
  done: boolean;
  sort: number;
};

export default async function TurnDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // make-ready tables aren't in the generated types yet (added in 0004).
  const db = supabase as unknown as SupabaseClient;

  const { data: turn } = await db
    .from("makeready_turns")
    .select(
      "id, status, created_at, completed_at, unit_id, units(id, label, properties(name)), makeready_templates(name), started_by_profile:profiles!makeready_turns_started_by_fkey(full_name, email)"
    )
    .eq("id", id)
    .maybeSingle()
    .returns<TurnRow>();

  if (!turn) notFound();

  const { data: tasks } = await db
    .from("makeready_tasks")
    .select("id, label, done, sort")
    .eq("turn_id", id)
    .order("sort", { ascending: true })
    .order("label", { ascending: true })
    .returns<TaskRow[]>();

  const taskList = tasks ?? [];
  const isComplete = turn.status === "complete";

  // Cost of THIS turn = unit costs + petty cash dated within the turn window.
  const winFrom = turn.created_at.slice(0, 10);
  const winTo = (turn.completed_at ?? new Date().toISOString()).slice(0, 10);
  let turnCostCents = 0;
  if (turn.unit_id) {
    const [{ data: tc }, { data: tp }] = await Promise.all([
      db
        .from("unit_costs")
        .select("amount_cents")
        .eq("unit_id", turn.unit_id)
        .gte("incurred_on", winFrom)
        .lte("incurred_on", winTo)
        .returns<{ amount_cents: number }[]>(),
      db
        .from("petty_cash_entries")
        .select("amount_cents")
        .eq("unit_id", turn.unit_id)
        .eq("kind", "expense")
        .gte("occurred_on", winFrom)
        .lte("occurred_on", winTo)
        .returns<{ amount_cents: number }[]>(),
    ]);
    turnCostCents = [...(tc ?? []), ...(tp ?? [])].reduce((s, r) => s + r.amount_cents, 0);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`${turn.units?.properties?.name ?? "Unassigned"}${
          turn.units?.label ? ` · ${turn.units.label}` : ""
        }`}
        subtitle={`${turn.makeready_templates?.name ?? "Make-ready"} · started ${formatDate(
          turn.created_at
        )}`}
        action={
          <Link
            href="/admin/turns"
            className="text-sm font-medium text-pine hover:text-pine-dark"
          >
            ← Back to board
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">Checklist</h2>
          <MakereadyChecklist turnId={turn.id} tasks={taskList} isComplete={isComplete} />
        </Card>

        <Card className="h-fit space-y-5 p-6">
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
              Status
            </span>
            <div className="flex items-center gap-2">
              <MakereadyTurnStatus turnId={turn.id} status={turn.status} />
            </div>
          </div>

          {turn.unit_id && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                Cost of this turn
              </span>
              <div className="font-display text-2xl font-semibold text-ink">
                {formatCents(turnCostCents)}
              </div>
              <div className="text-xs text-ink-faint">
                {formatDate(winFrom)} – {turn.completed_at ? formatDate(winTo) : "ongoing"}
              </div>
              <Link
                href={`/unit-cost-report?unit=${turn.unit_id}`}
                className="text-xs font-medium text-pine hover:underline"
              >
                Full cost report →
              </Link>
            </div>
          )}
          {turn.units && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                Unit
              </span>
              <Link
                href={`/admin/units/${turn.units.id}`}
                className="block text-sm font-medium text-pine hover:text-pine-dark"
              >
                {turn.units.properties?.name ?? "Unit"}
                {turn.units.label ? ` · ${turn.units.label}` : ""}
              </Link>
            </div>
          )}
          {turn.started_by_profile && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                Started by
              </span>
              <div className="text-sm text-ink-soft">
                {turn.started_by_profile.full_name ?? turn.started_by_profile.email}
              </div>
            </div>
          )}
          {turn.completed_at && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                Completed
              </span>
              <div className="text-sm text-ink-soft">{formatDate(turn.completed_at)}</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
