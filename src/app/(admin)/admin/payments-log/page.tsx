import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, StatCard, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { PrintButton } from "@/components/print-button";
import { PaymentReceipt } from "@/components/payment-receipt-form";
import { formatCents, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type PaymentLogRow = {
  id: string;
  amount_cents: number;
  status: string;
  created_at: string;
  provider_ref: string | null;
  receipt_note: string | null;
  receipt_path: string | null;
  profiles: { full_name: string | null } | null;
  charges: {
    description: string | null;
    period: string | null;
    units: {
      label: string;
      properties: { name: string | null } | null;
      unit_occupancy: { tenant_name: string | null }[] | null;
    } | null;
  } | null;
};

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function PaymentsLog({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(periodParam ?? "") ? periodParam! : currentPeriod();
  const [y, m] = period.split("-").map(Number);
  const from = `${period}-01`;
  const toExclusive = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: payments } = await db
    .from("payments")
    .select(
      "id, amount_cents, status, created_at, provider_ref, receipt_note, receipt_path, profiles:resident_id(full_name), charges:charge_id(description, period, units:unit_id(label, properties(name), unit_occupancy(tenant_name)))"
    )
    .gte("created_at", from)
    .lt("created_at", toExclusive)
    .order("created_at", { ascending: false })
    .returns<PaymentLogRow[]>();

  const all = payments ?? [];

  // Signed URLs for any attached receipt images (private bucket).
  const receiptUrls = new Map<string, string>();
  const withReceipt = all.filter((p) => p.receipt_path);
  if (withReceipt.length > 0) {
    const admin = createAdminClient();
    const signed = await Promise.all(
      withReceipt.map((p) => admin.storage.from("payment-receipts").createSignedUrl(p.receipt_path!, 3600))
    );
    withReceipt.forEach((p, i) => {
      const url = signed[i]?.data?.signedUrl;
      if (url) receiptUrls.set(p.id, url);
    });
  }
  const succeeded = all.filter((p) => p.status === "succeeded");
  const totalCents = succeeded.reduce((s, p) => s + p.amount_cents, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Payments received"
        subtitle="Every recorded payment — method, reference, and amount."
        action={
          <div className="flex items-center gap-3 print:hidden">
            <form method="get">
              <input
                type="month"
                name="period"
                defaultValue={period}
                className="rounded-lg border border-clay-deep bg-white px-3 py-1.5 text-sm text-ink"
              />
            </form>
            <PrintButton label="Print" />
          </div>
        }
      />

      <div className="mb-4 hidden print:block">
        <div className="font-display text-xl font-semibold text-ink">
          38th Ave Properties — Payments received · {periodLabel(period)}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 print:hidden">
        <StatCard label={`Received in ${periodLabel(period)}`} value={formatCents(totalCents)} tone="pine" />
        <StatCard label="Payments" value={succeeded.length} hint="Recorded this month" />
      </div>

      {all.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Tenant</th>
                  <th className="px-4 py-3 font-medium">Home</th>
                  <th className="px-4 py-3 font-medium">For</th>
                  <th className="px-4 py-3 font-medium">Method / #</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {all.map((p) => {
                  const unit = p.charges?.units;
                  const home = unit
                    ? `${unit.properties?.name ?? ""} · ${unit.label}`
                    : "—";
                  const name =
                    p.profiles?.full_name ??
                    unit?.unit_occupancy?.[0]?.tenant_name ??
                    "—";
                  const refNote =
                    p.receipt_note ??
                    (p.provider_ref && p.provider_ref !== "offline" ? p.provider_ref : null);
                  return (
                    <tr key={p.id} className="align-top hover:bg-sand/30">
                      <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                        {formatDate(p.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">{name}</td>
                      <td className="px-4 py-3 text-ink-soft">{home}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {p.charges?.description ?? "Rent"}
                        {p.charges?.period ? ` · ${p.charges.period}` : ""}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        <PaymentReceipt
                          paymentId={p.id}
                          note={refNote}
                          receiptUrl={receiptUrls.get(p.id) ?? null}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-ink">
                        {formatCents(p.amount_cents)}
                        {p.status !== "succeeded" && (
                          <span className="ml-2">
                            <StatusPill value={p.status} />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-clay font-semibold text-ink">
                  <td className="px-4 py-3" colSpan={5}>
                    Total received
                  </td>
                  <td className="px-4 py-3 text-right">{formatCents(totalCents)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title={`No payments recorded in ${periodLabel(period)}`}
          body="Recorded payments will appear here as you mark rent paid."
        />
      )}
    </div>
  );
}
