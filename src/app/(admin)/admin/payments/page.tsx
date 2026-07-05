import Link from "next/link";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard-ui";
import { PaymentsGenerateForm } from "@/components/payments-generate-form";
import { PaymentsTable, type PaymentRow } from "@/components/payments-table";
import { formatCents } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type ChargeRow = {
  id: string;
  unit_id: string | null;
  amount_cents: number;
  description: string | null;
  due_date: string | null;
  status: string;
  period: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
  units: {
    label: string;
    properties: { name: string | null } | null;
  } | null;
};

type OccRow = { unit_id: string; tenant_name: string | null; tenant_email: string | null };
type PaySumRow = { charge_id: string | null; amount_cents: number };
type PropertyRow = { id: string; name: string | null };

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AdminPayments() {
  const supabase = await createClient();
  // New tables aren't in the generated types yet; read via a loose handle.
  const db = supabase as unknown as SupabaseClient;

  const [{ data: charges }, { data: propertyList }, { data: occRows }] =
    await Promise.all([
      db
        .from("charges")
        .select(
          "id, unit_id, amount_cents, description, due_date, status, period, profiles:resident_id(full_name, email), units:unit_id(label, properties(name))"
        )
        .order("due_date", { ascending: false })
        .returns<ChargeRow[]>(),
      db
        .from("properties")
        .select("id, name")
        .order("name", { ascending: true })
        .returns<PropertyRow[]>(),
      db
        .from("unit_occupancy")
        .select("unit_id, tenant_name, tenant_email")
        .returns<OccRow[]>(),
    ]);

  const properties = (propertyList ?? [])
    .filter((p): p is { id: string; name: string } => !!p.name)
    .map((p) => ({ id: p.id, name: p.name }));

  // Occupancy name/email keyed by unit (the nested embed can come back empty).
  const occByUnit = new Map<string, OccRow>();
  for (const o of occRows ?? []) occByUnit.set(o.unit_id, o);

  const all = (charges ?? []).filter((c) => c.status !== "void");

  // How much has actually been paid against each charge (supports partials).
  const chargeIds = all.map((c) => c.id);
  const paidByCharge = new Map<string, number>();
  if (chargeIds.length > 0) {
    const { data: paySums } = await db
      .from("payments")
      .select("charge_id, amount_cents")
      .in("charge_id", chargeIds)
      .eq("status", "succeeded")
      .returns<PaySumRow[]>();
    for (const p of paySums ?? []) {
      if (!p.charge_id) continue;
      paidByCharge.set(p.charge_id, (paidByCharge.get(p.charge_id) ?? 0) + p.amount_cents);
    }
  }
  const paidFor = (c: ChargeRow) => paidByCharge.get(c.id) ?? 0;
  const remainingFor = (c: ChargeRow) => Math.max(0, c.amount_cents - paidFor(c));

  // Collected = actual cash in. Outstanding = what's still owed (partials count).
  const collectedCents = all.reduce((s, c) => s + paidFor(c), 0);
  const outstandingCents = all.reduce((s, c) => s + remainingFor(c), 0);
  const unpaidCount = all.filter((c) => remainingFor(c) > 0).length;

  // Collection by community (all charges). Decomposes the headline numbers and
  // fills out as more months are billed.
  type Bucket = {
    property: string;
    billedCents: number;
    collectedCents: number;
    paidCount: number;
    count: number;
  };
  const buckets = new Map<string, Bucket>();
  for (const c of all) {
    const name = c.units?.properties?.name ?? "Unassigned";
    const b =
      buckets.get(name) ??
      { property: name, billedCents: 0, collectedCents: 0, paidCount: 0, count: 0 };
    b.billedCents += c.amount_cents;
    b.collectedCents += paidFor(c);
    b.count += 1;
    if (remainingFor(c) === 0) b.paidCount += 1;
    buckets.set(name, b);
  }
  const breakdown = [...buckets.values()].sort((a, b) =>
    a.property.localeCompare(b.property)
  );

  const rows: PaymentRow[] = all.map((c) => {
    const occ = c.unit_id ? occByUnit.get(c.unit_id) ?? null : null;
    return {
      id: c.id,
      residentName: c.profiles?.full_name ?? occ?.tenant_name ?? null,
      residentEmail: c.profiles?.email ?? occ?.tenant_email ?? null,
      unit: c.units?.label ?? null,
      property: c.units?.properties?.name ?? null,
      paidCents: paidFor(c),
      description: c.description,
      period: c.period,
      dueDate: c.due_date,
      amountCents: c.amount_cents,
      status: c.status,
    };
  });

  // Group by community, then unit number, then newest period — easy to scan.
  rows.sort(
    (a, b) =>
      (a.property ?? "").localeCompare(b.property ?? "") ||
      (a.unit ?? "").localeCompare(b.unit ?? "", undefined, { numeric: true }) ||
      (b.period ?? "").localeCompare(a.period ?? "")
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Payments"
        subtitle="Generate rent charges, track who's paid, and record offline payments."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/rents"
              className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
            >
              Set rents →
            </Link>
            <Link
              href="/admin/rent-board"
              className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
            >
              Rent board →
            </Link>
            <Link
              href="/admin/payments-log"
              className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
            >
              Payments log →
            </Link>
            <Link
              href="/owner-report"
              className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
            >
              Owner report →
            </Link>
          </div>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Outstanding"
          value={formatCents(outstandingCents)}
          tone="terracotta"
          hint={`${unpaidCount} unpaid charge${unpaidCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Collected"
          value={formatCents(collectedCents)}
          tone="pine"
          hint="Across all paid charges"
        />
        <StatCard
          label="Total charges"
          value={all.length}
          tone="gold"
          hint="All time"
        />
      </div>

      {breakdown.length > 0 && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-clay bg-cream">
          <div className="border-b border-clay bg-sand/50 px-5 py-3">
            <h2 className="font-display text-base font-semibold text-ink">
              Collection by community
            </h2>
            <p className="text-xs text-ink-faint">
              Across all recorded charges — grows as you bill each month.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">Community</th>
                  <th className="px-5 py-2.5 font-medium">Paid</th>
                  <th className="px-5 py-2.5 text-right font-medium">Billed</th>
                  <th className="px-5 py-2.5 text-right font-medium">Collected</th>
                  <th className="px-5 py-2.5 text-right font-medium">Outstanding</th>
                  <th className="px-5 py-2.5 font-medium">Collection rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {breakdown.map((b) => {
                  const outCents = b.billedCents - b.collectedCents;
                  const pct =
                    b.billedCents > 0
                      ? Math.round((b.collectedCents / b.billedCents) * 100)
                      : 0;
                  return (
                    <tr key={b.property} className="hover:bg-sand/30">
                      <td className="px-5 py-3 font-medium text-ink">{b.property}</td>
                      <td className="px-5 py-3 text-ink-soft">
                        {b.paidCount}/{b.count}
                      </td>
                      <td className="px-5 py-3 text-right text-ink-soft">
                        {formatCents(b.billedCents)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-pine">
                        {formatCents(b.collectedCents)}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-medium ${
                          outCents > 0 ? "text-terracotta-dark" : "text-ink-faint"
                        }`}
                      >
                        {formatCents(outCents)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-clay">
                            <div
                              className={`h-full rounded-full ${
                                pct >= 100 ? "bg-pine" : pct >= 60 ? "bg-gold" : "bg-terracotta"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-ink-soft">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-clay bg-sand/30 font-semibold text-ink">
                  <td className="px-5 py-2.5">All communities</td>
                  <td className="px-5 py-2.5 text-ink-soft">
                    {all.filter((c) => remainingFor(c) === 0).length}/{all.length}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {formatCents(collectedCents + outstandingCents)}
                  </td>
                  <td className="px-5 py-2.5 text-right text-pine">
                    {formatCents(collectedCents)}
                  </td>
                  <td className="px-5 py-2.5 text-right text-terracotta-dark">
                    {formatCents(outstandingCents)}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-ink-faint">
                    {collectedCents + outstandingCents > 0
                      ? Math.round(
                          (collectedCents / (collectedCents + outstandingCents)) * 100
                        )
                      : 0}
                    % overall
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="mb-8">
        <PaymentsGenerateForm defaultPeriod={currentPeriod()} properties={properties} />
      </div>

      {all.length > 0 ? (
        <PaymentsTable charges={rows} />
      ) : (
        <EmptyState
          title="No charges yet"
          body="Generate this month's rent above to bill every active lease at once."
        />
      )}
    </div>
  );
}
