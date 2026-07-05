import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Container } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Owner report" };

type ReportChargeRow = {
  id: string;
  unit_id: string | null;
  amount_cents: number;
  due_date: string | null;
  status: string;
  description: string | null;
  resident_id: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

type OccRow = { unit_id: string; tenant_name: string | null };
type PaymentRow = {
  charge_id: string | null;
  amount_cents: number;
  created_at: string;
  status: string;
  provider_ref: string | null;
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

function daysBetween(fromIso: string, to: Date): number {
  const ms = to.getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

type LineStatus = "paid" | "partial" | "late" | "open";

export default async function OwnerReport({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { profile } = await requireProfile("/owner-report");
  if (!isStaff(profile)) redirect("/portal");

  const { period: periodParam } = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(periodParam ?? "") ? periodParam! : currentPeriod();

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const [{ data: charges }, { data: occRows }] = await Promise.all([
    db
      .from("charges")
      .select(
        "id, unit_id, amount_cents, due_date, status, description, resident_id, profiles:resident_id(full_name, email), units:unit_id(label, properties(name))"
      )
      .eq("period", period)
      .returns<ReportChargeRow[]>(),
    db.from("unit_occupancy").select("unit_id, tenant_name").returns<OccRow[]>(),
  ]);

  const occByUnit = new Map<string, string | null>();
  for (const o of occRows ?? []) occByUnit.set(o.unit_id, o.tenant_name);

  const all = (charges ?? []).filter((c) => c.status !== "void");
  const chargeIds = all.map((c) => c.id);

  // Actual money recorded per charge (supports partial payments), plus the
  // latest payment date + reference for the "paid" line.
  const paidByCharge = new Map<string, number>();
  const paidOn = new Map<string, string>();
  const paidRef = new Map<string, string>();
  if (chargeIds.length > 0) {
    const { data: payments } = await db
      .from("payments")
      .select("charge_id, amount_cents, created_at, status, provider_ref")
      .in("charge_id", chargeIds)
      .eq("status", "succeeded")
      .returns<PaymentRow[]>();
    for (const p of payments ?? []) {
      if (!p.charge_id) continue;
      paidByCharge.set(p.charge_id, (paidByCharge.get(p.charge_id) ?? 0) + p.amount_cents);
      const cur = paidOn.get(p.charge_id);
      if (!cur || p.created_at > cur) {
        paidOn.set(p.charge_id, p.created_at);
        if (p.provider_ref && p.provider_ref !== "offline") {
          paidRef.set(p.charge_id, p.provider_ref);
        }
      }
    }
  }

  type Line = {
    property: string;
    unit: string;
    tenant: string;
    item: string;
    amountCents: number;
    paidCents: number;
    status: LineStatus;
    paidDate: string | null;
    paidRef: string | null;
    daysLate: number;
  };

  const lines: Line[] = all.map((c) => {
    const paid = paidByCharge.get(c.id) ?? 0;
    const remaining = c.amount_cents - paid;
    const overdue = c.due_date != null && c.due_date < todayIso;
    const status: LineStatus =
      remaining <= 0 ? "paid" : paid > 0 ? "partial" : overdue ? "late" : "open";
    return {
      property: c.units?.properties?.name ?? "Unassigned",
      unit: c.units?.label ?? "—",
      tenant:
        c.profiles?.full_name ??
        (c.unit_id ? occByUnit.get(c.unit_id) ?? null : null) ??
        c.profiles?.email ??
        "—",
      item: c.description ?? "Rent",
      amountCents: c.amount_cents,
      paidCents: paid,
      status,
      paidDate: paid > 0 ? paidOn.get(c.id) ?? null : null,
      paidRef: paid > 0 ? paidRef.get(c.id) ?? null : null,
      daysLate: overdue && c.due_date ? daysBetween(c.due_date, today) : 0,
    };
  });

  lines.sort(
    (a, b) =>
      a.property.localeCompare(b.property) ||
      a.unit.localeCompare(b.unit, undefined, { numeric: true }) ||
      a.item.localeCompare(b.item)
  );

  const billedCents = lines.reduce((s, l) => s + l.amountCents, 0);
  const collectedCents = lines.reduce((s, l) => s + l.paidCents, 0);
  const outstandingCents = lines.reduce((s, l) => s + Math.max(0, l.amountCents - l.paidCents), 0);
  const lateCount = lines.filter((l) => l.status === "late").length;
  const paidUnits = lines.filter((l) => l.status === "paid").length;
  const pctCollected = billedCents > 0 ? Math.round((collectedCents / billedCents) * 100) : 0;

  // Per-property rollup.
  type Group = {
    property: string;
    lines: Line[];
    billed: number;
    collected: number;
    paidUnits: number;
    total: number;
    late: number;
  };
  const groupMap = new Map<string, Group>();
  for (const l of lines) {
    const g =
      groupMap.get(l.property) ??
      { property: l.property, lines: [], billed: 0, collected: 0, paidUnits: 0, total: 0, late: 0 };
    g.lines.push(l);
    g.billed += l.amountCents;
    g.collected += l.paidCents;
    g.total += 1;
    if (l.status === "paid") g.paidUnits += 1;
    if (l.status === "late") g.late += 1;
    groupMap.set(l.property, g);
  }
  const groups = [...groupMap.values()].sort((a, b) => a.property.localeCompare(b.property));

  const reportDate = today.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main
      className="min-h-dvh bg-cream py-10 print:bg-white print:py-0"
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
    >
      <Container className="max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
          <Link href="/admin/payments" className="text-sm font-medium text-pine hover:text-pine-dark">
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
              <div className="font-display text-2xl font-semibold text-pine">38th Ave Properties</div>
              <div className="text-sm text-ink-soft">W 38th Ave, Wheat Ridge, CO 80033</div>
            </div>
            <div className="text-right text-sm text-ink-soft">
              <div className="font-display text-lg font-semibold text-ink">Owner report</div>
              <div>{periodLabel(period)}</div>
              <div className="text-xs text-ink-faint">Prepared {reportDate}</div>
            </div>
          </div>

          {lines.length > 0 ? (
            <>
              {/* Collection overview: donut + headline figures */}
              <div className="mb-6 grid gap-6 rounded-2xl border border-clay bg-sand/30 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
                <div className="flex items-center justify-center gap-5">
                  <Donut pct={pctCollected} />
                  <div className="space-y-2">
                    <LegendDot color="#2f5d50" label="Collected" value={formatCents(collectedCents)} />
                    <LegendDot color="#d98b6a" label="Outstanding" value={formatCents(outstandingCents)} />
                    <LegendDot color="#c8b89c" label="Billed" value={formatCents(billedCents)} muted />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-clay bg-clay sm:grid-cols-4">
                  <Summary label="Units paid" value={`${paidUnits}/${lines.length}`} />
                  <Summary label="Collected" value={formatCents(collectedCents)} tone="pine" />
                  <Summary label="Outstanding" value={formatCents(outstandingCents)} tone="terracotta" />
                  <Summary label="Late" value={`${lateCount}`} />
                </div>
              </div>

              {/* Per-property paid vs unpaid */}
              <div className="mb-8">
                <h2 className="mb-3 font-display text-base font-semibold text-ink">
                  By community
                </h2>
                <div className="space-y-3">
                  {groups.map((g) => {
                    const pct = g.billed > 0 ? Math.round((g.collected / g.billed) * 100) : 0;
                    const out = g.billed - g.collected;
                    return (
                      <div
                        key={g.property}
                        className="break-inside-avoid rounded-xl border border-clay bg-white p-4"
                      >
                        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <div className="font-medium text-ink">{g.property}</div>
                          <div className="flex flex-wrap gap-x-4 text-xs">
                            <span className="text-ink-soft">
                              {g.paidUnits}/{g.total} paid
                            </span>
                            <span className="text-pine">{formatCents(g.collected)} in</span>
                            <span className={out > 0 ? "text-terracotta-dark" : "text-ink-faint"}>
                              {formatCents(out)} out
                            </span>
                            <span className="font-semibold text-ink">{pct}%</span>
                          </div>
                        </div>
                        <Bar pct={pct} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rent roll grouped by community */}
              {groups.map((g) => (
                <div key={g.property} className="mb-6">
                  <div className="mb-1 flex items-baseline justify-between border-b-2 border-clay pb-1 print:break-after-avoid">
                    <h3 className="font-display text-sm font-semibold text-ink">{g.property}</h3>
                    <span className="text-xs text-ink-faint">
                      {formatCents(g.collected)} of {formatCents(g.billed)} collected
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint">
                        <th className="py-1.5 pr-3 font-medium">Home</th>
                        <th className="py-1.5 pr-3 font-medium">Tenant</th>
                        <th className="py-1.5 pr-3 font-medium">Item</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Amount</th>
                        <th className="py-1.5 pr-3 font-medium">Status</th>
                        <th className="py-1.5 font-medium">Paid / late</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.lines.map((l, i) => (
                        <tr key={i} className="border-b border-clay/60 break-inside-avoid">
                          <td className="py-1.5 pr-3 font-medium text-ink">{l.unit}</td>
                          <td className="py-1.5 pr-3 text-ink-soft">{l.tenant}</td>
                          <td className="py-1.5 pr-3 text-ink-soft">{l.item}</td>
                          <td className="py-1.5 pr-3 text-right font-medium text-ink">
                            {formatCents(l.amountCents)}
                          </td>
                          <td className="py-1.5 pr-3">
                            <StatusTag status={l.status} />
                          </td>
                          <td className="py-1.5 text-ink-soft">
                            {l.status === "paid" ? (
                              <>
                                {formatDate(l.paidDate)}
                                {l.paidRef && <span className="text-ink-faint"> · {l.paidRef}</span>}
                              </>
                            ) : l.status === "partial" ? (
                              <span className="text-terracotta-dark">
                                {formatCents(l.paidCents)} paid ·{" "}
                                {formatCents(l.amountCents - l.paidCents)} due
                              </span>
                            ) : l.status === "late" ? (
                              `${l.daysLate} days late`
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold text-ink">
                        <td className="py-1.5 pr-3" colSpan={3}>
                          Subtotal — {g.property}
                        </td>
                        <td className="py-1.5 pr-3 text-right">{formatCents(g.billed)}</td>
                        <td className="py-1.5 pr-3 text-pine" colSpan={2}>
                          {formatCents(g.collected)} collected
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ))}

              {/* Grand total */}
              <div className="mt-6 break-inside-avoid rounded-xl border-2 border-pine/30 bg-pine-soft/40 px-5 py-4">
                <div className="grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-4">
                  <Total label="Total billed" value={formatCents(billedCents)} />
                  <Total label="Collected" value={formatCents(collectedCents)} tone="pine" />
                  <Total label="Outstanding" value={formatCents(outstandingCents)} tone="terracotta" />
                  <Total label="Collection rate" value={`${pctCollected}%`} />
                </div>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-ink-soft">
              No charges for {periodLabel(period)}. Generate this month&apos;s rent on the Payments
              page first.
            </p>
          )}

          <p className="mt-6 text-xs text-ink-faint">
            Rent charges and recorded payments for {periodLabel(period)}, as of {reportDate}.
            &ldquo;Late&rdquo; means a charge past its due date that is still unpaid;
            &ldquo;Partial&rdquo; means some has been paid.
          </p>
        </div>
      </Container>
    </main>
  );
}

function Donut({ pct, size = 132, stroke = 16 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, pct));
  const dash = (filled / 100) * c;
  const cx = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#ecd9cf" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="#2f5d50"
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: size * 0.26, fontWeight: 700 }}
        className="fill-ink"
      >
        {Math.round(filled)}%
      </text>
      <text
        x="50%"
        y="62%"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: size * 0.1 }}
        className="fill-ink-faint"
      >
        collected
      </text>
    </svg>
  );
}

function Bar({ pct }: { pct: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-terracotta/20">
      <div className="h-full rounded-full bg-pine" style={{ width: `${w}%` }} />
    </div>
  );
}

function LegendDot({
  color,
  label,
  value,
  muted,
}: {
  color: string;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className={muted ? "text-ink-faint" : "text-ink-soft"}>{label}</span>
      <span className="ml-auto font-medium text-ink">{value}</span>
    </div>
  );
}

function StatusTag({ status }: { status: LineStatus }) {
  if (status === "paid") return <span className="font-medium text-pine">Paid</span>;
  if (status === "partial")
    return <span className="font-semibold text-gold">Partial</span>;
  if (status === "late")
    return <span className="font-semibold text-terracotta-dark">Late</span>;
  return <span className="text-ink-soft">Open</span>;
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pine" | "terracotta";
}) {
  const color =
    tone === "pine" ? "text-pine" : tone === "terracotta" ? "text-terracotta-dark" : "text-ink";
  return (
    <div className="bg-white p-4 text-center">
      <div className="text-xs text-ink-faint">{label}</div>
      <div className={`mt-0.5 font-display text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Total({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pine" | "terracotta";
}) {
  const color =
    tone === "pine" ? "text-pine" : tone === "terracotta" ? "text-terracotta-dark" : "text-ink";
  return (
    <div>
      <div className="text-xs text-ink-faint">{label}</div>
      <div className={`font-display text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
