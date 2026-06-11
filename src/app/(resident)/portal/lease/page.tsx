import { Card, Badge } from "@/components/ui";
import { PageHeader, EmptyState, StatusPill } from "@/components/dashboard-ui";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type LeaseRow = Tables<"leases"> & {
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
    .select("*, units(label, properties(name, address_line1, city, state))")
    .eq("resident_id", user.id)
    .order("start_date", { ascending: false })
    .returns<LeaseRow[]>();

  const lease = leases?.find((l) => l.status === "active") ?? leases?.[0];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Lease" subtitle="Your current agreement and terms." />

      {lease ? (
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
        </Card>
      ) : (
        <EmptyState
          title="No lease on file yet"
          body="Once your application is approved and your lease is prepared, it will appear here for review and e-signature."
          action={<Badge tone="terracotta">Coming soon: e-sign</Badge>}
        />
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
