import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { PrintButton } from "@/components/print-button";
import {
  InspectionNoticeButton,
  InspectionItemForm,
  InspectionCloseForm,
} from "@/components/inspection-forms";
import { escalateInspectionItem, deleteInspectionItem } from "../actions";
import { formatDate } from "@/lib/format";
import { CONDITION_BUCKET } from "@/lib/unit-photos";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Inspection = {
  id: string;
  unit_id: string;
  kind: string;
  scheduled_for: string;
  time_window: string | null;
  status: string;
  notice_sent_at: string | null;
  completed_at: string | null;
  summary: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

type Item = {
  id: string;
  area: string;
  condition: string;
  note: string | null;
  photo_path: string | null;
  task_id: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  annual: "Annual inspection",
  seasonal: "Seasonal check",
  move_in: "Move-in inspection",
  move_out: "Move-out inspection",
  follow_up: "Follow-up visit",
  complaint: "Follow-up visit",
};

const CONDITION_CHIP: Record<string, string> = {
  good: "bg-pine/15 text-pine",
  fair: "bg-gold/20 text-ink",
  needs_attention: "bg-terracotta-soft text-terracotta-dark",
  urgent: "bg-terracotta text-cream",
};

export default async function InspectionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: insp } = await db
    .from("inspections")
    .select(
      "id, unit_id, kind, scheduled_for, time_window, status, notice_sent_at, completed_at, summary, units:unit_id(label, properties(name))"
    )
    .eq("id", id)
    .maybeSingle<Inspection>();
  if (!insp) notFound();

  const [{ data: items }, { data: occ }] = await Promise.all([
    db
      .from("inspection_items")
      .select("id, area, condition, note, photo_path, task_id, created_at")
      .eq("inspection_id", id)
      .order("created_at", { ascending: true })
      .returns<Item[]>(),
    db
      .from("unit_occupancy")
      .select("tenant_name")
      .eq("unit_id", insp.unit_id)
      .maybeSingle<{ tenant_name: string | null }>(),
  ]);

  const admin = createAdminClient();
  const photoUrl = new Map<string, string>();
  for (const it of items ?? []) {
    if (!it.photo_path) continue;
    const { data: signed } = await admin.storage
      .from(CONDITION_BUCKET)
      .createSignedUrl(it.photo_path, 3600);
    if (signed?.signedUrl) photoUrl.set(it.id, signed.signedUrl);
  }

  const home = insp.units
    ? `${insp.units.properties?.name ?? "—"} · ${insp.units.label}`
    : "—";
  const open = ["scheduled", "notice_sent"].includes(insp.status);
  const findings = items ?? [];
  const flagged = findings.filter((f) => ["needs_attention", "urgent"].includes(f.condition));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="print:hidden">
        <PageHeader
          title={`${KIND_LABEL[insp.kind] ?? "Inspection"} — ${home}`}
          subtitle={`${formatDate(insp.scheduled_for)}${insp.time_window ? ` · ${insp.time_window}` : ""}${occ?.tenant_name ? ` · ${occ.tenant_name}` : ""}`}
          action={
            <div className="flex items-center gap-3">
              <Link href="/admin/inspections" className="text-sm font-medium text-pine hover:text-pine-dark">
                ← All inspections
              </Link>
              <PrintButton label="Print report" />
            </div>
          }
        />

        {open && (
          <Card className="mb-6 space-y-4 p-6">
            {insp.notice_sent_at ? (
              <p className="text-sm text-pine">
                ✓ Entry notice emailed {formatDate(insp.notice_sent_at)} — you&apos;re covered to enter as scheduled.
              </p>
            ) : (
              <>
                <p className="text-sm text-ink-soft">
                  Send the resident their written entry notice before the visit:
                </p>
                <InspectionNoticeButton inspectionId={insp.id} />
              </>
            )}
          </Card>
        )}
      </div>

      {/* Print letterhead */}
      <div className="mb-4 hidden print:block">
        <div className="font-display text-xl font-semibold text-ink">
          38th Ave Properties — Inspection report
        </div>
        <div className="text-sm text-ink-soft">
          {home} · {KIND_LABEL[insp.kind] ?? "Inspection"} · {formatDate(insp.scheduled_for)}
          {occ?.tenant_name ? ` · Tenant: ${occ.tenant_name}` : ""}
        </div>
      </div>

      {/* Findings */}
      <Card className="mb-6 p-6 print:border-0 print:shadow-none">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h2 className="font-display text-lg font-semibold text-ink">
            Findings {findings.length > 0 ? `(${findings.length})` : ""}
          </h2>
          {flagged.length > 0 && (
            <span className="text-xs text-terracotta-dark">
              {flagged.length} need{flagged.length === 1 ? "s" : ""} follow-up
            </span>
          )}
        </div>

        {findings.length > 0 ? (
          <ul className="space-y-4">
            {findings.map((f) => (
              <li key={f.id} className="flex gap-4 border-b border-clay/60 pb-4 break-inside-avoid">
                {photoUrl.has(f.id) && (
                  <a href={photoUrl.get(f.id)} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl.get(f.id)}
                      alt={f.area}
                      className="h-20 w-24 rounded-lg border border-clay object-cover"
                    />
                  </a>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{f.area}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${CONDITION_CHIP[f.condition] ?? CONDITION_CHIP.good}`}>
                      {f.condition.replace("_", " ")}
                    </span>
                    {f.task_id && (
                      <span className="rounded-full bg-pine/10 px-2 py-0.5 text-[11px] font-medium text-pine">
                        → Task created
                      </span>
                    )}
                  </div>
                  {f.note && <p className="mt-1 text-sm text-ink-soft">{f.note}</p>}
                  <div className="mt-1.5 flex gap-3 print:hidden">
                    {!f.task_id && ["needs_attention", "urgent"].includes(f.condition) && (
                      <form action={escalateInspectionItem}>
                        <input type="hidden" name="item_id" value={f.id} />
                        <button type="submit" className="text-xs font-medium text-pine hover:underline">
                          Create task →
                        </button>
                      </form>
                    )}
                    <form action={deleteInspectionItem}>
                      <input type="hidden" name="item_id" value={f.id} />
                      <button type="submit" className="text-xs text-ink-faint hover:text-terracotta-dark">
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-faint">
            No findings recorded yet{open ? " — add them as you walk through" : ""}.
          </p>
        )}

        {open && (
          <div className="mt-5 border-t border-clay pt-4 print:hidden">
            <InspectionItemForm inspectionId={insp.id} />
          </div>
        )}

        {insp.summary && (
          <div className="mt-5 border-t border-clay pt-4">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">Summary</div>
            <p className="mt-1 text-sm text-ink">{insp.summary}</p>
          </div>
        )}
      </Card>

      {open && (
        <Card className="p-6 print:hidden">
          <InspectionCloseForm inspectionId={insp.id} />
        </Card>
      )}

      {insp.status === "completed" && (
        <p className="text-sm text-pine print:hidden">
          ✓ Completed {formatDate(insp.completed_at ?? insp.scheduled_for)} — on file for this unit.
        </p>
      )}
    </div>
  );
}
