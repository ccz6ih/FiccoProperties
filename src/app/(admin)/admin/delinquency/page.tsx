import Link from "next/link";
import { Card } from "@/components/ui";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard-ui";
import { LateFeeForm } from "@/components/late-fee-form";
import {
  createDemandForUnit,
  createDemandsForAllOverdue,
  createNoFaultNotice,
} from "@/app/(admin)/admin/delinquency/actions";
import { lateFeeCapCents } from "@/lib/late-fee";
import { formatCents, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type DChargeRow = {
  id: string;
  amount_cents: number;
  due_date: string | null;
  status: string;
  resident_id: string | null;
  lease_id: string | null;
  unit_id: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
  units: {
    label: string;
    properties: { name: string | null } | null;
    unit_occupancy: { tenant_name: string | null; tenant_email: string | null }[] | null;
  } | null;
};

type Delinquent = {
  key: string;
  unitId: string | null;
  residentId: string | null;
  leaseId: string | null;
  name: string;
  email: string | null;
  unit: string;
  property: string;
  overdueCents: number;
  count: number;
  oldestDue: string;
};

function daysBetween(fromIso: string, to: Date): number {
  const ms = to.getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default async function AdminDelinquency() {
  const supabase = await createClient();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const { data: charges } = await supabase
    .from("charges")
    .select(
      "id, amount_cents, due_date, status, resident_id, lease_id, unit_id, profiles:resident_id(full_name, email), units:unit_id(label, properties(name), unit_occupancy(tenant_name, tenant_email))"
    )
    .in("status", ["open", "past_due"])
    .returns<DChargeRow[]>();

  // Served Demands for Compliance (JDF 99A) — the basis for a no-fault eviction
  // on repeated-late-payment grounds. Group by unit to spot repeat offenders.
  const { data: servedDemands } = await supabase
    .from("notices")
    .select("unit_id, served_at, units:unit_id(label, properties(name), unit_occupancy(tenant_name))")
    .eq("type", "pay_or_quit")
    .not("served_at", "is", null)
    .not("unit_id", "is", null)
    .returns<
      {
        unit_id: string | null;
        served_at: string | null;
        units: {
          label: string | null;
          properties: { name: string | null } | null;
          unit_occupancy: { tenant_name: string | null }[] | null;
        } | null;
      }[]
    >();

  type Repeat = { unitId: string; name: string; unit: string; property: string; count: number; last: string };
  const repeatMap = new Map<string, Repeat>();
  for (const d of servedDemands ?? []) {
    if (!d.unit_id) continue;
    const cur = repeatMap.get(d.unit_id);
    const last = d.served_at ?? "";
    if (cur) {
      cur.count += 1;
      if (last > cur.last) cur.last = last;
    } else {
      repeatMap.set(d.unit_id, {
        unitId: d.unit_id,
        name: d.units?.unit_occupancy?.[0]?.tenant_name ?? d.units?.label ?? "—",
        unit: d.units?.label ?? "—",
        property: d.units?.properties?.name ?? "—",
        count: 1,
        last,
      });
    }
  }
  // "More than two" late payments (C.R.S. § 38-12-1303(3)(f)) → 3+ served demands.
  const repeatOffenders = [...repeatMap.values()]
    .filter((r) => r.count >= 2)
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));

  // Overdue = an open charge whose due date has passed.
  const overdue = (charges ?? []).filter(
    (c) => c.due_date != null && c.due_date < todayIso
  );

  const byUnit = new Map<string, Delinquent>();
  for (const c of overdue) {
    const key = c.unit_id ?? c.resident_id ?? c.id;
    const occ = c.units?.unit_occupancy?.[0] ?? null;
    const cur = byUnit.get(key);
    if (cur) {
      cur.overdueCents += c.amount_cents;
      cur.count += 1;
      if (c.due_date! < cur.oldestDue) cur.oldestDue = c.due_date!;
    } else {
      byUnit.set(key, {
        key,
        unitId: c.unit_id,
        residentId: c.resident_id,
        leaseId: c.lease_id,
        name: c.profiles?.full_name ?? occ?.tenant_name ?? "—",
        email: c.profiles?.email ?? occ?.tenant_email ?? null,
        unit: c.units?.label ?? "—",
        property: c.units?.properties?.name ?? "—",
        overdueCents: c.amount_cents,
        count: 1,
        oldestDue: c.due_date!,
      });
    }
  }

  const rows = [...byUnit.values()].sort(
    (a, b) => new Date(a.oldestDue).getTime() - new Date(b.oldestDue).getTime()
  );

  const totalOverdue = rows.reduce((s, r) => s + r.overdueCents, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Delinquency"
        subtitle="Who's behind on rent, how far, and what's owed."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {rows.length > 0 && (
              <form action={createDemandsForAllOverdue}>
                <button
                  type="submit"
                  className="rounded-lg bg-terracotta px-3 py-2 text-sm font-medium text-cream hover:bg-terracotta-dark"
                >
                  Create demands for all overdue
                </button>
              </form>
            )}
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
        <StatCard label="Total overdue" value={formatCents(totalOverdue)} tone="terracotta" />
        <StatCard label="Delinquent tenants" value={rows.length} tone="terracotta" />
        <StatCard
          label="Overdue charges"
          value={overdue.length}
          tone="gold"
          hint="Past their due date"
        />
      </div>

      {rows.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Tenant</th>
                  <th className="px-5 py-3 font-medium">Home</th>
                  <th className="px-5 py-3 font-medium">Overdue</th>
                  <th className="px-5 py-3 font-medium">Oldest due</th>
                  <th className="px-5 py-3 font-medium">Days late</th>
                  <th className="px-5 py-3 font-medium">Late fee</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {rows.map((r) => {
                  const suggested = Math.round(r.overdueCents * 0.05);
                  const cap = lateFeeCapCents(r.overdueCents);
                  const daysLate = daysBetween(r.oldestDue, today);
                  const href = r.residentId
                    ? `/admin/residents/${r.residentId}`
                    : r.unitId
                      ? `/admin/units/${r.unitId}`
                      : null;
                  return (
                    <tr key={r.key} className="align-top hover:bg-sand/30">
                      <td className="px-5 py-3">
                        {href ? (
                          <Link href={href} className="font-medium text-pine hover:text-pine-dark">
                            {r.name}
                          </Link>
                        ) : (
                          <span className="font-medium text-ink">{r.name}</span>
                        )}
                        <div className="text-xs text-ink-faint">{r.email}</div>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        {r.property} · {r.unit}
                      </td>
                      <td className="px-5 py-3 font-semibold text-terracotta-dark">
                        {formatCents(r.overdueCents)}
                        <span className="ml-1 text-xs font-normal text-ink-faint">
                          ({r.count})
                        </span>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{formatDate(r.oldestDue)}</td>
                      <td className="px-5 py-3">
                        <span
                          className={
                            daysLate >= 10
                              ? "font-semibold text-terracotta-dark"
                              : "text-ink-soft"
                          }
                        >
                          {daysLate} days
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <LateFeeForm
                          residentId={r.residentId}
                          leaseId={r.leaseId}
                          unitId={r.unitId}
                          overdueCents={r.overdueCents}
                          suggestedCents={suggested}
                          capCents={cap}
                        />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {r.unitId && (
                            <form action={createDemandForUnit}>
                              <input type="hidden" name="unit_id" value={r.unitId} />
                              <button
                                type="submit"
                                className="whitespace-nowrap text-xs font-medium text-terracotta-dark hover:underline"
                              >
                                Create demand →
                              </button>
                            </form>
                          )}
                          <Link
                            href="/admin/payments"
                            className="whitespace-nowrap text-xs font-medium text-pine hover:text-pine-dark"
                          >
                            Record payment →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No one's behind on rent"
          body="Tenants with a past-due charge show up here, sorted by how late they are."
        />
      )}

      {repeatOffenders.length > 0 && (
        <Card className="mt-8 overflow-hidden">
          <div className="border-b border-clay bg-sand/50 px-5 py-3">
            <h2 className="font-display text-base font-semibold text-ink">
              Repeat late payers
            </h2>
            <p className="text-xs text-ink-faint">
              Units by number of <span className="font-medium">served</span> Demands for
              Compliance. A no-fault eviction for repeated late payment (C.R.S. §
              38-12-1303(3)(f)) generally needs more than two late payments, each 10+ days
              late with a served demand.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">Tenant</th>
                  <th className="px-5 py-2.5 font-medium">Home</th>
                  <th className="px-5 py-2.5 font-medium">Served demands</th>
                  <th className="px-5 py-2.5 font-medium">Latest</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {repeatOffenders.map((r) => {
                  const qualifies = r.count >= 3;
                  return (
                    <tr key={r.unitId} className="hover:bg-sand/30">
                      <td className="px-5 py-3 font-medium text-ink">{r.name}</td>
                      <td className="px-5 py-3 text-ink-soft">
                        {r.property} · {r.unit}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            qualifies
                              ? "bg-terracotta/15 text-terracotta-dark"
                              : "bg-gold/15 text-gold"
                          }`}
                        >
                          {r.count} {qualifies ? "· may qualify" : "· watch"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        {r.last ? formatDate(r.last) : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <form action={createNoFaultNotice}>
                          <input type="hidden" name="unit_id" value={r.unitId} />
                          <button
                            type="submit"
                            className="whitespace-nowrap text-xs font-medium text-terracotta-dark hover:underline"
                          >
                            Prepare no-fault notice →
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="mt-6 text-xs text-ink-faint">
        Colorado: a late fee can&apos;t exceed the greater of $50 or 5% of overdue
        rent, and only after a 7-day grace period. A no-fault eviction is a 90-day
        termination and has strict eligibility (1+ year tenancy, each late payment
        10+ days late with a served demand, plus exemptions). Verify current law and
        consult your attorney — this is a workflow aid, not legal advice.
      </p>
    </div>
  );
}
