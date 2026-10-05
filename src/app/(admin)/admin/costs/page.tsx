import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard-ui";
import { getUnitSpend } from "@/lib/unit-spend";
import { formatCents } from "@/lib/format";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cost per home" };
export const dynamic = "force-dynamic";

const RANGES: { key: string; label: string }[] = [
  { key: "ytd", label: "This year" },
  { key: "12m", label: "Last 12 months" },
  { key: "all", label: "All time" },
];

function rangeDates(key: string): { from: string | null; to: string | null } {
  const now = new Date();
  if (key === "ytd") return { from: `${now.getFullYear()}-01-01`, to: null };
  if (key === "12m") {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - 1);
    return { from: d.toISOString().slice(0, 10), to: null };
  }
  return { from: null, to: null };
}

export default async function CostPerHome({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; place?: string }>;
}) {
  const { profile } = await requireProfile("/admin/costs");
  if (!isStaff(profile)) redirect("/portal");

  const sp = await searchParams;
  const range = RANGES.some((r) => r.key === sp.range) ? sp.range! : "ytd";
  const { from, to } = rangeDates(range);

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const all = await getUnitSpend(db, { from, to });

  const places = [...new Set(all.map((r) => r.property))].sort();
  const rows = sp.place && sp.place !== "all" ? all.filter((r) => r.property === sp.place) : all;
  // Homes that cost nothing are the good news, but they're not the question.
  const spent = rows.filter((r) => r.totalCents > 0);

  const total = spent.reduce((s, r) => s + r.totalCents, 0);
  const billed = spent.reduce((s, r) => s + r.billedCents, 0);
  const petty = spent.reduce((s, r) => s + r.pettyCents, 0);
  const rangeLabel = RANGES.find((r) => r.key === range)!.label.toLowerCase();

  const href = (next: Record<string, string>) => {
    const p = new URLSearchParams({ range, ...(sp.place ? { place: sp.place } : {}), ...next });
    return `/admin/costs?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Cost per home"
        subtitle="What each home has swallowed — contractor bills plus the petty cash tagged to it."
      />

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={href({ range: r.key })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              range === r.key ? "bg-pine text-cream" : "text-ink-soft hover:bg-sand"
            }`}
          >
            {r.label}
          </Link>
        ))}
        <span className="mx-1 text-clay-deep">|</span>
        <Link
          href={href({ place: "all" })}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            !sp.place || sp.place === "all" ? "bg-pine text-cream" : "text-ink-soft hover:bg-sand"
          }`}
        >
          Everywhere
        </Link>
        {places.map((p) => (
          <Link
            key={p}
            href={href({ place: p })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              sp.place === p ? "bg-pine text-cream" : "text-ink-soft hover:bg-sand"
            }`}
          >
            {p}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={`Spent ${rangeLabel}`} value={formatCents(total)} tone="terracotta" />
        <StatCard label="Contractor bills" value={formatCents(billed)} />
        <StatCard label="Petty cash" value={formatCents(petty)} hint={`${spent.length} homes with spend`} />
      </div>

      {spent.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-clay-deep text-left text-[11px] uppercase tracking-wider text-ink-soft">
                  <th className="px-4 py-2.5 font-semibold">Home</th>
                  <th className="px-4 py-2.5 font-semibold">Resident</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Bills</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Petty cash</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-4 py-2.5 text-right font-semibold">vs rent</th>
                </tr>
              </thead>
              <tbody>
                {spent.map((r) => (
                  <tr key={r.unitId} className="border-b border-clay align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/units/${r.unitId}`}
                        className="font-medium text-pine hover:underline"
                      >
                        {r.home}
                      </Link>
                      <div className="text-[11px] text-ink-faint">
                        {r.entries} {r.entries === 1 ? "entry" : "entries"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{r.tenantName ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-soft">
                      {r.billedCents > 0 ? formatCents(r.billedCents) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-soft">
                      {r.pettyCents > 0 ? formatCents(r.pettyCents) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-base font-semibold tabular-nums text-ink">
                      {formatCents(r.totalCents)}
                    </td>
                    {/* Months of rent is the renewal question in one number. */}
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        (r.monthsOfRent ?? 0) >= 1
                          ? "font-semibold text-terracotta-dark"
                          : "text-ink-faint"
                      }`}
                    >
                      {r.monthsOfRent != null ? `${r.monthsOfRent.toFixed(1)} mo` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-clay-deep">
                  <td colSpan={4} className="px-4 py-3 text-right font-semibold text-ink">
                    Total {rangeLabel}
                  </td>
                  <td className="px-4 py-3 text-right font-display text-lg font-semibold tabular-nums text-ink">
                    {formatCents(total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="Nothing recorded yet"
          body="Costs appear here once a maintenance job records a cost, or a petty-cash entry is tagged to a home."
        />
      )}

      <p className="mt-4 text-xs text-ink-faint">
        <strong className="text-ink-soft">vs rent</strong> is what the spend comes to in months of
        that home&apos;s rent — anything at a month or more is flagged. Whole-property costs
        (insurance, taxes, the parking lot) aren&apos;t here; they live in{" "}
        <Link href="/admin/financials" className="font-medium text-pine hover:underline">
          Financials
        </Link>
        .
      </p>
    </div>
  );
}
