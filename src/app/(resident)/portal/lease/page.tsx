import { Card, Badge } from "@/components/ui";
import { PageHeader, EmptyState, StatusPill } from "@/components/dashboard-ui";
import { LeaseSignForm } from "@/components/lease-sign-form";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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

  // Prioritise a lease awaiting signature, then the active one, then most recent.
  const pending = leases?.find((l) => l.status === "pending_signature");
  const lease = pending ?? leases?.find((l) => l.status === "active") ?? leases?.[0];

  if (!lease) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Lease" subtitle="Your current agreement and terms." />
        <EmptyState
          title="No lease on file yet"
          body="Once your application is approved and your lease is prepared, it will appear here for review and e-signature."
        />
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
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Lease" subtitle="Your current agreement and terms." />

      {lease.status === "active" && lease.signed_at && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-pine/30 bg-pine-soft px-4 py-3 text-sm text-pine-dark">
          <span aria-hidden>✓</span>
          Signed on {formatDate(lease.signed_at)}
          {lease.signature_name ? ` by ${lease.signature_name}` : ""}.
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
