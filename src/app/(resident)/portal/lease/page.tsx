import { Card, Badge } from "@/components/ui";
import { PageHeader, EmptyState, StatusPill } from "@/components/dashboard-ui";
import { LeaseSignForm } from "@/components/lease-sign-form";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const LEASE_BUCKET = "lease-docs";

type SharedDoc = { id: string; label: string | null; url: string; created: string; category: string };

const DOC_CATEGORY_LABEL: Record<string, string> = {
  lease: "Lease",
  esa: "ESA letter",
  insurance: "Insurance",
  notice: "Notice",
  other: "Document",
};

/** Documents staff have shared to this resident (private bucket, signed URLs). */
async function getSharedLeaseDocs(residentId: string): Promise<SharedDoc[]> {
  const admin = createAdminClient() as unknown as SupabaseClient;
  const { data: rows } = await admin
    .from("lease_documents")
    .select("id, label, path, created_at, category")
    .eq("resident_id", residentId)
    .eq("shared_with_resident", true)
    .order("created_at", { ascending: false })
    .returns<{ id: string; label: string | null; path: string; created_at: string; category: string | null }[]>();

  const signed = await Promise.all(
    (rows ?? []).map((d) =>
      admin.storage.from(LEASE_BUCKET).createSignedUrl(d.path, 3600)
    )
  );
  return (rows ?? []).map((d, i) => ({
    id: d.id,
    label: d.label,
    url: signed[i]?.data?.signedUrl ?? "",
    created: d.created_at,
    category: d.category ?? "lease",
  }));
}

function LeaseDocsCard({ docs }: { docs: SharedDoc[] }) {
  if (docs.length === 0) return null;
  return (
    <Card className="mt-6 overflow-hidden">
      <div className="border-b border-clay bg-sand/50 px-6 py-4">
        <div className="font-display text-lg font-semibold text-ink">Your documents</div>
        <div className="text-sm text-ink-soft">Copies of documents on file for your home.</div>
      </div>
      <ul className="divide-y divide-clay">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 px-6 py-4">
            <a
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-2 text-sm font-medium text-pine hover:underline"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 2h8l4 4v16H6z" strokeLinejoin="round" />
                <path d="M14 2v4h4" strokeLinejoin="round" />
              </svg>
              <span className="truncate">{d.label || DOC_CATEGORY_LABEL[d.category] || "Document"}</span>
              <span className="shrink-0 rounded-full bg-clay/60 px-2 py-0.5 text-[11px] text-ink-soft">
                {DOC_CATEGORY_LABEL[d.category] ?? d.category}
              </span>
            </a>
            <span className="shrink-0 text-xs text-ink-faint">{formatDate(d.created)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

type LeaseRow = {
  id: string;
  rent_cents: number;
  deposit_cents: number;
  start_date: string;
  end_date: string | null;
  status: string;
  terms: string | null;
  signature_name: string | null;
  signed_at: string | null;
  document_url: string | null;
  units: {
    label: string;
    properties: {
      name: string | null;
      address_line1: string | null;
      city: string | null;
      state: string | null;
    } | null;
  } | null;
};

export default async function LeasePage() {
  const { user } = await requireProfile("/portal/lease");
  const supabase = await createClient();

  const { data: leases } = await supabase
    .from("leases")
    .select(
      "id, rent_cents, deposit_cents, start_date, end_date, status, terms, signature_name, signed_at, document_url, units(label, properties(name, address_line1, city, state))"
    )
    .eq("resident_id", user.id)
    .order("start_date", { ascending: false })
    .returns<LeaseRow[]>();

  const sharedDocs = await getSharedLeaseDocs(user.id);

  // Prioritise a lease awaiting signature, then the active one, then most recent.
  const pending = leases?.find((l) => l.status === "pending_signature");
  const lease = pending ?? leases?.find((l) => l.status === "active") ?? leases?.[0];

  if (!lease) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Lease" subtitle="Your current agreement and terms." />
        {sharedDocs.length > 0 ? (
          <LeaseDocsCard docs={sharedDocs} />
        ) : (
          <EmptyState
            title="No lease on file yet"
            body="Once your application is approved and your lease is prepared, it will appear here for review and e-signature."
          />
        )}
      </div>
    );
  }

  if (lease.status === "pending_signature") {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Sign your lease"
          subtitle={`${lease.units?.properties?.name ?? ""} · ${lease.units?.label ?? ""}`}
        />
        <Card className="mb-6 overflow-hidden">
          <dl className="grid grid-cols-2 gap-px bg-clay">
            <Detail label="Monthly rent" value={formatCents(lease.rent_cents)} />
            <Detail label="Deposit" value={formatCents(lease.deposit_cents)} />
            <Detail label="Start date" value={formatDate(lease.start_date)} />
            <Detail
              label="End date"
              value={lease.end_date ? formatDate(lease.end_date) : "—"}
            />
          </dl>
        </Card>
        <LeaseSignForm leaseId={lease.id} terms={lease.terms} />
        <LeaseDocsCard docs={sharedDocs} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Lease" subtitle="Your current agreement and terms." />

      {lease.status === "active" && lease.signed_at && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-pine/30 bg-pine-soft px-4 py-3 text-sm text-pine-dark">
          <span className="flex items-center gap-2">
            <span aria-hidden>✓</span>
            Signed on {formatDate(lease.signed_at)}
            {lease.signature_name ? ` by ${lease.signature_name}` : ""}.
          </span>
          <a
            href={`/lease-print?id=${lease.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-pine hover:underline"
          >
            Print / Save as PDF →
          </a>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-clay bg-sand/50 px-6 py-4">
          <div>
            <div className="font-display text-lg font-semibold text-ink">
              {lease.units?.properties?.name} · {lease.units?.label}
            </div>
            <div className="text-sm text-ink-soft">
              {lease.units?.properties?.address_line1}, {lease.units?.properties?.city}{" "}
              {lease.units?.properties?.state}
            </div>
          </div>
          <StatusPill value={lease.status} />
        </div>
        <dl className="grid grid-cols-2 gap-px bg-clay">
          <Detail label="Monthly rent" value={formatCents(lease.rent_cents)} />
          <Detail label="Deposit" value={formatCents(lease.deposit_cents)} />
          <Detail label="Start date" value={formatDate(lease.start_date)} />
          <Detail label="End date" value={formatDate(lease.end_date)} />
          <Detail
            label="Signed"
            value={lease.signed_at ? formatDate(lease.signed_at) : "Not yet signed"}
          />
          <Detail
            label="Document"
            value={
              lease.document_url ? (
                <a className="text-pine underline" href={lease.document_url}>
                  View PDF
                </a>
              ) : (
                "—"
              )
            }
          />
        </dl>
        {lease.terms?.trim() && (
          <div className="border-t border-clay px-6 py-5">
            <h2 className="mb-2 text-xs uppercase tracking-wide text-ink-faint">
              Lease terms
            </h2>
            <div className="max-h-80 overflow-y-auto rounded-xl border border-clay bg-cream px-4 py-3 text-sm leading-relaxed text-ink-soft whitespace-pre-wrap">
              {lease.terms}
            </div>
          </div>
        )}
      </Card>

      <LeaseDocsCard docs={sharedDocs} />

      {(lease.status === "ended" || lease.status === "terminated") && (
        <div className="mt-4">
          <Badge tone="neutral">This lease is closed.</Badge>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-cream px-6 py-4">
      <dt className="text-xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}
