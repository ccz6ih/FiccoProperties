import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { PageHeader, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { MakereadyStartForm } from "@/components/makeready-start-form";
import { UnitPhotosManager } from "@/components/unit-photos-manager";
import { UnitLogForm } from "@/components/unit-log-form";
import {
  UnitEditForm,
  type OccupancyValues,
  type ResidentOption,
} from "@/components/unit-edit-form";
import { LeaseDocuments, type LeaseDoc } from "@/components/lease-documents";
import { UnitCostForm } from "@/components/unit-cost-form";
import { UnitCostEdit } from "@/components/unit-cost-edit";
import { deleteLogEntry, deleteUnitCost } from "@/app/(admin)/admin/units/actions";

const LEASE_BUCKET = "lease-docs";
import { formatCents, formatDate, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONDITION_BUCKET, listingPublicUrl } from "@/lib/unit-photos";
import type { SupabaseClient } from "@supabase/supabase-js";

type UnitRow = {
  id: string;
  label: string;
  status: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  rent_cents: number | null;
  notes: string | null;
  properties: { name: string | null; slug: string } | null;
};

type RequestRow = {
  id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
};

type TurnRow = {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  makeready_templates: { name: string | null } | null;
};

type TemplateRow = { id: string; name: string };

type PhotoRow = {
  id: string;
  kind: string;
  path: string;
  caption: string | null;
};

type LogRow = {
  id: string;
  kind: string;
  body: string;
  performed_on: string | null;
  cost_cents: number | null;
  created_at: string;
  author: { full_name: string | null } | null;
};

type CostRow = {
  id: string;
  vendor: string | null;
  trade: string | null;
  description: string | null;
  amount_cents: number;
  hours: number | string | null;
  rate_cents: number | null;
  incurred_on: string;
  doc_path: string | null;
};

type PettyForUnitRow = {
  id: string;
  store: string | null;
  category: string | null;
  description: string | null;
  amount_cents: number;
  occurred_on: string;
};

export default async function UnitDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // make-ready tables aren't in the generated types yet (added in 0004).
  const db = supabase as unknown as SupabaseClient;

  const { data: unit } = await supabase
    .from("units")
    .select("id, label, status, bedrooms, bathrooms, sqft, rent_cents, notes, properties(name, slug)")
    .eq("id", id)
    .maybeSingle()
    .returns<UnitRow>();

  if (!unit) notFound();

  const [{ data: occ }, { data: residents }] = await Promise.all([
    supabase
      .from("unit_occupancy")
      .select(
        "occupant_profile_id, tenant_name, tenant_email, tenant_phone, rent_cents, lease_start_date, lease_signed_date, lease_end_date, move_in_date, notes"
      )
      .eq("unit_id", id)
      .maybeSingle<OccupancyValues>(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name")
      .returns<ResidentOption[]>(),
  ]);

  // Lease documents (private bucket) — sign each for viewing.
  const { data: leaseDocRows } = await db
    .from("lease_documents")
    .select("id, label, path, created_at")
    .eq("unit_id", id)
    .order("created_at", { ascending: false })
    .returns<{ id: string; label: string | null; path: string; created_at: string }[]>();
  const leaseAdmin = createAdminClient();
  const leaseSigned = await Promise.all(
    (leaseDocRows ?? []).map((d) =>
      leaseAdmin.storage.from(LEASE_BUCKET).createSignedUrl(d.path, 3600)
    )
  );
  const leaseDocs: LeaseDoc[] = (leaseDocRows ?? []).map((d, i) => ({
    id: d.id,
    label: d.label,
    url: leaseSigned[i]?.data?.signedUrl ?? "",
    created: d.created_at,
  }));

  // Unit costs (contractor bills) + petty-cash expenses tagged to this unit.
  const [{ data: costRows }, { data: pettyRows }] = await Promise.all([
    db
      .from("unit_costs")
      .select("id, vendor, trade, description, amount_cents, hours, rate_cents, incurred_on, doc_path")
      .eq("unit_id", id)
      .order("incurred_on", { ascending: false })
      .returns<CostRow[]>(),
    db
      .from("petty_cash_entries")
      .select("id, store, category, description, amount_cents, occurred_on")
      .eq("unit_id", id)
      .eq("kind", "expense")
      .returns<PettyForUnitRow[]>(),
  ]);
  const costs = costRows ?? [];
  const pettyForUnit = pettyRows ?? [];
  const costById = new Map(costs.map((c) => [c.id, c]));

  // Open tasks tagged to this unit.
  const { data: unitTaskRows } = await db
    .from("tasks")
    .select("id, title, status, priority, category, due_date, assignee:assignee_id(full_name)")
    .eq("unit_id", id)
    .neq("status", "done")
    .neq("status", "cancelled")
    .order("due_date", { ascending: true, nullsFirst: false })
    .returns<
      {
        id: string;
        title: string;
        status: string;
        priority: string;
        category: string;
        due_date: string | null;
        assignee: { full_name: string | null } | null;
      }[]
    >();
  const unitTasks = unitTaskRows ?? [];
  const todayIso2 = new Date().toISOString().slice(0, 10);

  const costSigned = await Promise.all(
    costs.filter((c) => c.doc_path).map((c) =>
      leaseAdmin.storage.from("unit-cost-docs").createSignedUrl(c.doc_path!, 3600)
    )
  );
  const costDocUrl = new Map<string, string>();
  costs.filter((c) => c.doc_path).forEach((c, i) => {
    const url = costSigned[i]?.data?.signedUrl;
    if (url) costDocUrl.set(c.id, url);
  });

  const costTotal = costs.reduce((s, c) => s + c.amount_cents, 0);
  const pettyTotal = pettyForUnit.reduce((s, p) => s + p.amount_cents, 0);
  const grandTotal = costTotal + pettyTotal;
  const totalHours = costs.reduce((s, c) => s + (c.hours ? Number(c.hours) : 0), 0);

  const byTrade = new Map<string, number>();
  for (const c of costs) {
    const k = c.trade ?? "other";
    byTrade.set(k, (byTrade.get(k) ?? 0) + c.amount_cents);
  }
  for (const p of pettyForUnit) {
    const k = p.category ?? "supplies";
    byTrade.set(k, (byTrade.get(k) ?? 0) + p.amount_cents);
  }
  const tradeRows = [...byTrade.entries()].sort((a, b) => b[1] - a[1]);

  const costLines = [
    ...costs.map((c) => ({
      type: "bill" as const,
      id: c.id,
      date: c.incurred_on,
      title: c.vendor ?? (c.trade ? c.trade : "Contractor cost"),
      sub: [c.trade, c.description, c.hours ? `${Number(c.hours)} hrs` : null]
        .filter(Boolean)
        .join(" · "),
      amount: c.amount_cents,
    })),
    ...pettyForUnit.map((p) => ({
      type: "petty" as const,
      id: p.id,
      date: p.occurred_on,
      title: p.store ?? "Petty cash",
      sub: [p.category, p.description].filter(Boolean).join(" · "),
      amount: p.amount_cents,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const [{ data: requests }, { data: turns }, { data: templates }] = await Promise.all([
    supabase
      .from("maintenance_requests")
      .select("id, title, category, status, priority, created_at")
      .eq("unit_id", id)
      .order("created_at", { ascending: false })
      .returns<RequestRow[]>(),
    db
      .from("makeready_turns")
      .select("id, status, created_at, completed_at, makeready_templates(name)")
      .eq("unit_id", id)
      .order("created_at", { ascending: false })
      .returns<TurnRow[]>(),
    db
      .from("makeready_templates")
      .select("id, name")
      .order("name", { ascending: true })
      .returns<TemplateRow[]>(),
  ]);

  const requestList = requests ?? [];
  const turnList = turns ?? [];
  const templateList = templates ?? [];
  const activeTurn = turnList.find((t) => t.status !== "complete");

  const { data: logEntries } = await db
    .from("unit_log_entries")
    .select("id, kind, body, performed_on, cost_cents, created_at, author:author_id(full_name)")
    .eq("unit_id", id)
    .order("created_at", { ascending: false })
    .returns<LogRow[]>();
  const logList = logEntries ?? [];

  // Unit photos — staff client reads rows; URLs are resolved server-side
  // (public URL for listing, signed URL for the private condition bucket).
  const { data: photos } = await supabase
    .from("unit_photos")
    .select("id, kind, path, caption")
    .eq("unit_id", id)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<PhotoRow[]>();

  const photoList = photos ?? [];
  const admin = createAdminClient();

  const listingPhotos = photoList
    .filter((p) => p.kind === "listing")
    .map((p) => ({ id: p.id, url: listingPublicUrl(p.path), caption: p.caption }));

  // Move-in (incl. legacy "condition") and move-out are private — sign their URLs.
  const privateRows = photoList.filter((p) => p.kind !== "listing");
  const signed = await Promise.all(
    privateRows.map((p) =>
      admin.storage.from(CONDITION_BUCKET).createSignedUrl(p.path, 3600)
    )
  );
  const signedByIndex = privateRows.map((p, i) => ({
    id: p.id,
    kind: p.kind,
    url: signed[i]?.data?.signedUrl ?? "",
    caption: p.caption,
  }));
  const moveInPhotos = signedByIndex.filter((p) => p.kind === "move_in" || p.kind === "condition");
  const moveOutPhotos = signedByIndex.filter((p) => p.kind === "move_out");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`${unit.properties?.name ?? "Unit"} · ${unit.label}`}
        subtitle={[
          unit.bedrooms != null ? `${unit.bedrooms} bd` : null,
          unit.bathrooms != null ? `${unit.bathrooms} ba` : null,
          unit.rent_cents != null ? `${formatCents(unit.rent_cents)}/mo` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={<StatusPill value={unit.status} />}
      />

      <div className="space-y-6">
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              Tenant &amp; lease
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Who lives here and their lease details. Click Edit to add or change a
              phone, email, dates, or rent.
            </p>
          </div>

          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label="Tenant" value={occ?.tenant_name} />
            <Field
              label="Account"
              value={occ?.occupant_profile_id ? "Linked ✓" : "Records only"}
            />
            <Field label="Email" value={occ?.tenant_email} />
            <Field label="Phone" value={occ?.tenant_phone} />
            <Field
              label="Rent"
              value={occ?.rent_cents != null ? formatCents(occ.rent_cents) : null}
            />
            <Field label="Move-in" value={formatDate(occ?.move_in_date) || null} />
            <Field label="Lease start" value={formatDate(occ?.lease_start_date) || null} />
            <Field label="Lease end" value={formatDate(occ?.lease_end_date) || null} />
          </dl>

          <UnitEditForm
            unit={{
              id: unit.id,
              label: unit.label,
              status: unit.status,
              bedrooms: unit.bedrooms,
              bathrooms: unit.bathrooms,
              sqft: unit.sqft,
              rent_cents: unit.rent_cents,
              notes: unit.notes,
            }}
            occupancy={occ ?? null}
            residents={residents ?? []}
            propertySlug={unit.properties?.slug ?? ""}
          />

          <LeaseDocuments unitId={unit.id} docs={leaseDocs} />
        </Card>

        <div>
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">Photos</h2>
          <UnitPhotosManager
            unitId={unit.id}
            listing={listingPhotos}
            moveIn={moveInPhotos}
            moveOut={moveOutPhotos}
          />
        </div>

        <Card className="space-y-5 p-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              Notes &amp; service log
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              A running history for this unit — tenant notes and maintenance you&apos;ve
              performed. Visible to staff only.
            </p>
          </div>

          <UnitLogForm unitId={unit.id} />

          {logList.length > 0 ? (
            <ul className="space-y-3 border-t border-clay pt-4">
              {logList.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      e.kind === "maintenance" ? "bg-terracotta" : "bg-pine"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          e.kind === "maintenance"
                            ? "bg-terracotta-soft text-terracotta-dark"
                            : "bg-sand text-ink-soft"
                        }`}
                      >
                        {e.kind === "maintenance" ? "Maintenance" : "Note"}
                      </span>
                      <span>
                        {formatDate(e.performed_on ?? e.created_at)}
                      </span>
                      {e.author?.full_name && <span>· {e.author.full_name}</span>}
                      {e.cost_cents != null && (
                        <span>· {formatCents(e.cost_cents)}</span>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{e.body}</p>
                  </div>
                  <form action={deleteLogEntry}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="unit_id" value={unit.id} />
                    <button
                      type="submit"
                      className="text-xs text-ink-faint hover:text-terracotta-dark"
                      title="Delete entry"
                    >
                      ✕
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-t border-clay pt-4 text-sm text-ink-faint">
              No entries yet. Add the first note or maintenance record above.
            </p>
          )}
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Make-ready</h2>
          {activeTurn ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-clay bg-white/70 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-ink">
                  {activeTurn.makeready_templates?.name ?? "Make-ready"} in progress
                </div>
                <div className="text-xs text-ink-faint">
                  Started {formatDate(activeTurn.created_at)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill value={activeTurn.status} />
                <Link
                  href={`/admin/turns/${activeTurn.id}`}
                  className="text-sm font-medium text-pine hover:text-pine-dark"
                >
                  Open →
                </Link>
              </div>
            </div>
          ) : (
            <MakereadyStartForm unitId={unit.id} templates={templateList} />
          )}
        </Card>

        <Card className="space-y-5 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">
                Make-ready &amp; repair costs
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                Contractor bills plus petty cash tagged to this unit.{" "}
                <Link href={`/unit-cost-report?unit=${unit.id}`} className="font-medium text-pine hover:underline">
                  Print report →
                </Link>
              </p>
            </div>
            <div className="text-right">
              <div className="font-display text-3xl font-semibold text-ink">
                {formatCents(grandTotal)}
              </div>
              <div className="text-xs text-ink-faint">
                {formatCents(costTotal)} bills · {formatCents(pettyTotal)} petty cash
                {totalHours > 0 ? ` · ${totalHours} hrs` : ""}
              </div>
            </div>
          </div>

          {tradeRows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tradeRows.map(([t, c]) => (
                <span key={t} className="rounded-full bg-sand px-3 py-1 text-xs capitalize text-ink-soft">
                  {t} <span className="font-semibold text-ink">{formatCents(c)}</span>
                </span>
              ))}
            </div>
          )}

          {costLines.length > 0 ? (
            <ul className="divide-y divide-clay">
              {costLines.map((l) => (
                <li key={`${l.type}-${l.id}`} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">
                      {l.title}
                      {l.type === "petty" && (
                        <span className="ml-2 rounded-full bg-pine/10 px-2 py-0.5 text-[10px] font-medium text-pine">
                          Petty cash
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-faint">
                      {[formatDate(l.date), l.sub].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium text-ink">{formatCents(l.amount)}</span>
                    {l.type === "bill" && costDocUrl.has(l.id) && (
                      <a
                        href={costDocUrl.get(l.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-pine hover:underline"
                      >
                        Invoice
                      </a>
                    )}
                    {l.type === "bill" ? (
                      <>
                        {costById.has(l.id) && (
                          <UnitCostEdit
                            entry={{
                              id: l.id,
                              unitId: unit.id,
                              vendor: costById.get(l.id)!.vendor,
                              trade: costById.get(l.id)!.trade,
                              description: costById.get(l.id)!.description,
                              incurred_on: costById.get(l.id)!.incurred_on,
                              amountDollars: (costById.get(l.id)!.amount_cents / 100).toString(),
                              hoursValue:
                                costById.get(l.id)!.hours != null
                                  ? String(Number(costById.get(l.id)!.hours))
                                  : "",
                              rateDollars:
                                costById.get(l.id)!.rate_cents != null
                                  ? (costById.get(l.id)!.rate_cents! / 100).toString()
                                  : "",
                            }}
                          />
                        )}
                        <form action={deleteUnitCost}>
                          <input type="hidden" name="id" value={l.id} />
                          <input type="hidden" name="unit_id" value={unit.id} />
                          <button
                            type="submit"
                            className="text-xs text-ink-faint hover:text-terracotta-dark"
                            title="Delete cost"
                          >
                            ✕
                          </button>
                        </form>
                      </>
                    ) : (
                      <Link href="/admin/petty-cash" className="text-xs text-ink-faint hover:text-pine" title="Petty cash">
                        ↗
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-faint">No costs recorded for this unit yet.</p>
          )}

          <UnitCostForm unitId={unit.id} />
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">Open tasks</h2>
            <Link href="/admin/tasks" className="text-sm font-medium text-pine hover:text-pine-dark">
              All tasks
            </Link>
          </div>
          {unitTasks.length > 0 ? (
            <ul className="divide-y divide-clay">
              {unitTasks.map((t) => {
                const overdue = t.due_date != null && t.due_date < todayIso2;
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink">{t.title}</div>
                      <div className="text-xs text-ink-faint">
                        {[humanize(t.category), t.assignee?.full_name, t.status === "in_progress" ? "in progress" : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    {t.due_date && (
                      <span className={`shrink-0 text-xs ${overdue ? "font-medium text-terracotta-dark" : "text-ink-faint"}`}>
                        {formatDate(t.due_date)}
                        {overdue ? " · overdue" : ""}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-faint">
              No open tasks for this unit.{" "}
              <Link href="/admin/tasks" className="font-medium text-pine hover:underline">
                Add one →
              </Link>
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">
            Maintenance history
          </h2>
          {requestList.length > 0 ? (
            <ul className="divide-y divide-clay">
              {requestList.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/maintenance/${r.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-sand/30"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">{r.title}</div>
                      <div className="text-xs text-ink-faint">
                        {humanize(r.category)} · {formatDate(r.created_at)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {r.priority !== "normal" && <StatusPill value={r.priority} />}
                      <StatusPill value={r.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-faint">No maintenance requests for this unit.</p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">Turn history</h2>
          {turnList.length > 0 ? (
            <ul className="divide-y divide-clay">
              {turnList.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/turns/${t.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-sand/30"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">
                        {t.makeready_templates?.name ?? "Make-ready"}
                      </div>
                      <div className="text-xs text-ink-faint">
                        {t.completed_at
                          ? `Completed ${formatDate(t.completed_at)}`
                          : `Started ${formatDate(t.created_at)}`}
                      </div>
                    </div>
                    <StatusPill value={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-faint">No make-ready turns yet.</p>
          )}
        </Card>
      </div>

      {requestList.length === 0 && turnList.length === 0 && !activeTurn && (
        <div className="mt-6">
          <EmptyState
            title="Nothing recorded yet"
            body="Maintenance requests and make-ready turns for this unit will appear here."
          />
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 border-b border-clay/50 py-1.5 sm:border-0 sm:py-0">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-right font-medium text-ink">{value || "—"}</dd>
    </div>
  );
}
