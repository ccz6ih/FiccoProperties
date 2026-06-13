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
import { deleteLogEntry } from "@/app/(admin)/admin/units/actions";

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
