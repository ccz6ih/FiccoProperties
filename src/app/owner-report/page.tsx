import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Owner report" };

type ReportChargeRow = {
  id: string;
  amount_cents: number;
  due_date: string | null;
  status: string;
  description: string | null;
  resident_id: string;
  lease_id: string;
  profiles: { full_name: string | null; email: string | null } | null;
  leases: {
    units: { label: string; properties: { name: string | null } | null } | null;
  } | null;
};

type PaymentRow = { charge_id: string; created_at: string; status: string };

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-06" -> "June 2026". */
function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function daysBetween(fromIso: string, to: Date): number {
  const ms = to.getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default async function OwnerReport({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { profile } = await requireProfile("/owner-report");
  if (!isStaff(profile)) redirect("/portal");

  const { period: periodParam } = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(periodParam ?? "")
    ? periodParam!
    : currentPeriod();

  const supabase = await createClient();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const { data: charges } = await supabase
    .from("charges")
    .select(
      "id, amount_cents, due_date, status, description, resident_id, lease_id, profiles:resident_id(full_name, email), leases(units(label, properties(name)))"
    )
    .eq("period", period)
    .returns<ReportChargeRow[]>();

  const all = (charges ?? []).filter((c) => c.status !== "void");
  const chargeIds = all.map((c) => c.id);

  // Latest succeeded payment per charge = the "paid on" date.
  const paidOn = new Map<string, string>();
  if (chargeIds.length > 0) {
    const { data: payments } = await supabase
      .from("payments")
      .select("charge_id, created_at, status")
      .in("charge_id", chargeIds)
      .eq("status", "succeeded")
      .returns<PaymentRow[]>();
    for (const p of payments ?? []) {
      const cur = paidOn.get(p.charge_id);
      if (!cur || p.created_at > cur) paidOn.set(p.charge_id, p.created_at);
    }
  }

  type Line = {
    property: string;
    unit: string;
    tenant: string;
    item: string;
    amountCents: number;
    status: "paid" | "late" | "open";
    paidDate: string | null;
    daysLate: number;
  };

  const lines: Line[] = all.map((c) => {
    const isPaid = c.status === "paid";
    const isLate =
      !isPaid && c.due_date != null && c.due_date < todayIso;
    return {
      property: c.leases?.units?.properties?.name ?? "—",
      unit: c.leases?.units?.label ?? "—",
      tenant: c.profiles?.full_name ?? c.profiles?.email ?? "—",
      item: c.description ?? "Rent",
      amountCents: c.amount_cents,
      status: isPaid ? "paid" : isLate ? "late" : "open",
      paidDate: isPaid ? paidOn.get(c.id) ?? null : null,
      daysLate: isLate && c.due_date ? daysBetween(c.due_date, today) : 0,
    };
  });

  lines.sort(
    (a, b) =>
      a.property.localeCompare(b.property) ||
      a.unit.localeCompare(b.unit, undefined, { numeric: true }) ||
      a.item.localeCompare(b.item)
  );

  const billedCents = lines.reduce((s, l) => s + l.amountCents, 0);
  const collectedCents = lines
    .filter((l) => l.status === "paid")
    .reduce((s, l) => s + l.amountCents, 0);
  const outstandingCents = billedCents - collectedCents;
  const lateCount = lines.filter((l) => l.status === "late").length;

  const reportDate = today.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-dvh bg-cream py-10 print:bg-white print:py-0">
      <Container className="max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
          <Link
            href="/admin/payments"
            className="text-sm font-medium text-pine hover:text-pine-dark"
          >
            ← Back to payments
          </Link>
          <div className="flex items-center gap-3">
            <form method="get" className="flex items-center gap-2">
              <label htmlFor="period" className="text-sm text-ink-soft">
                Month
              </label>
              <input
                id="period"
                type="month"
                name="period"
                defaultValue={period}
                className="rounded-lg border border-clay-deep bg-white px-3 py-1.5 text-sm text-ink"
              />
              <button
                type="submit"
                className="rounded-lg border border-clay-deep px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-sand"
              >
                View
              </button>
            </form>
            <PrintButton label="Print / Save as PDF" />
          </div>
        </div>

        <div className="rounded-2xl border border-clay bg-white p-8 print:rounded-none print:border-0 print:p-0">
          {/* Letterhead */}
          <div className="mb-6 flex items-start justify-between border-b border-clay pb-5">
            <div>
              <div className="font-display text-2xl font-semibold text-pine">
                38th Ave Properties
              </div>
              <div className="text-sm text-ink-soft">
                W 38th Ave, Wheat Ridge, CO 80033
              </div>
            </div>
            <div className="text-right text-sm text-ink-soft">
              <div className="font-display text-lg font-semibold text-ink">
                Owner report
              </div>
              <div>{periodLabel(period)}</div>
              <div className="text-xs text-ink-faint">Prepared {reportDate}</div>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-clay bg-clay sm:grid-cols-4">
            <Summary label="Billed" value={formatCents(billedCents)} />
            <Summary label="Collected" value={formatCents(collectedCents)} />
            <Summary label="Outstanding" value={formatCents(outstandingCents)} />
            <Summary label="Late" value={`${lateCount}`} />
          </div>

          {/* Rent roll */}
          {lines.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="py-2 pr-3 font-medium">Home</th>
                  <th className="py-2 pr-3 font-medium">Tenant</th>
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Paid / late</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b border-clay/60">
                    <td className="py-2 pr-3 text-ink">
                      <span className="font-medium">{l.unit}</span>
                      <span className="text-ink-faint"> · {l.property}</span>
                    </td>
                    <td className="py-2 pr-3 text-ink-soft">{l.tenant}</td>
                    <td className="py-2 pr-3 text-ink-soft">{l.item}</td>
                    <td className="py-2 pr-3 text-right font-medium text-ink">
                      {formatCents(l.amountCents)}
                    </td>
                    <td className="py-2 pr-3">
                      {l.status === "paid" ? (
                        <span className="font-medium text-pine">Paid</span>
                      ) : l.status === "late" ? (
                        <span className="font-semibold text-terracotta-dark">
                          Late
                        </span>
                      ) : (
                        <span className="text-ink-soft">Open</span>
                      )}
                    </td>
                    <td className="py-2 text-ink-soft">
                      {l.status === "paid"
                        ? formatDate(l.paidDate)
                        : l.status === "late"
                          ? `${l.daysLate} days late`
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-clay font-semibold text-ink">
                  <td className="py-2 pr-3" colSpan={3}>
                    Total billed
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {formatCents(billedCents)}
                  </td>
                  <td className="py-2" colSpan={2} />
                </tr>
                <tr className="text-ink-soft">
                  <td className="py-1 pr-3" colSpan={3}>
                    Collected
                  </td>
                  <td className="py-1 pr-3 text-right text-pine">
                    {formatCents(collectedCents)}
                  </td>
                  <td className="py-1" colSpan={2} />
                </tr>
                <tr className="text-ink-soft">
                  <td className="py-1 pr-3" colSpan={3}>
                    Outstanding
                  </td>
                  <td className="py-1 pr-3 text-right text-terracotta-dark">
                    {formatCents(outstandingCents)}
                  </td>
                  <td className="py-1" colSpan={2} />
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="py-8 text-center text-sm text-ink-soft">
              No charges for {periodLabel(period)}. Generate this month&apos;s rent
              on the Payments page first.
            </p>
          )}

          <p className="mt-6 text-xs text-ink-faint">
            Rent charges and recorded payments for {periodLabel(period)}, as of{" "}
            {reportDate}. &ldquo;Late&rdquo; means a charge past its due date that
            is still unpaid.
          </p>
        </div>
      </Container>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4 text-center">
      <div className="text-xs text-ink-faint">{label}</div>
      <div className="mt-0.5 font-display text-xl font-semibold text-ink">
        {value}
      </div>
    </div>
  );
}
