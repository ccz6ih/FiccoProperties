import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, StatCard } from "@/components/dashboard-ui";
import { PropertyExpenseForm } from "@/components/property-expense-form";
import { deletePropertyExpense } from "./actions";
import { formatCents, formatDate } from "@/lib/format";
import {
  buildYearFinancials,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  type ScheduleECategory,
} from "@/lib/financials";
import { requireProfile, isStaff } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type ExpenseRow = {
  id: string;
  category: string;
  vendor: string | null;
  memo: string | null;
  amount_cents: number;
  incurred_on: string;
  properties: { name: string | null } | null;
};

export default async function AdminFinancials({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { profile } = await requireProfile("/admin/financials");
  if (!isStaff(profile)) redirect("/portal");

  const { year: yearParam } = await searchParams;
  const thisYear = new Date().getFullYear();
  const year =
    yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : thisYear;

  const fin = await buildYearFinancials(year);
  const net = fin.totalIncomeCents - fin.totalExpenseCents;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const [{ data: props }, { data: expenses }] = await Promise.all([
    db
      .from("properties")
      .select("id, name")
      .order("name")
      .returns<{ id: string; name: string | null }[]>(),
    db
      .from("property_expenses")
      .select("id, category, vendor, memo, amount_cents, incurred_on, properties:property_id(name)")
      .gte("incurred_on", `${year}-01-01`)
      .lt("incurred_on", `${year + 1}-01-01`)
      .order("incurred_on", { ascending: false })
      .returns<ExpenseRow[]>(),
  ]);

  const propertyOpts = (props ?? [])
    .filter((p): p is { id: string; name: string } => !!p.name)
    .map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Financials — ${year}`}
        subtitle="Income, expenses, and net by community — built from rent collected, contractor bills, petty cash, and property expenses."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/financials?year=${year - 1}`}
              className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
            >
              ← {year - 1}
            </Link>
            {year < thisYear && (
              <Link
                href={`/admin/financials?year=${year + 1}`}
                className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
              >
                {year + 1} →
              </Link>
            )}
            <Link
              href={`/tax-report?year=${year}`}
              className="rounded-lg bg-pine px-3 py-2 text-sm font-medium text-cream hover:bg-pine-dark"
            >
              Tax report (Schedule E) →
            </Link>
          </div>
        }
      />

      {/* Year totals */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Rent collected" value={formatCents(fin.totalIncomeCents)} tone="pine" hint={`All communities · ${year}`} />
        <StatCard label="Expenses" value={formatCents(fin.totalExpenseCents)} tone="terracotta" hint="Bills + petty cash + property costs" />
        <StatCard
          label="Net"
          value={formatCents(net)}
          tone={net >= 0 ? "gold" : "terracotta"}
          hint={net >= 0 ? "Before depreciation" : "Spending exceeded rent"}
        />
      </div>

      {/* Per-community sections */}
      <div className="space-y-6">
        {fin.properties.map((p) => {
          const pnet = p.incomeCents - p.expenseCents;
          const maxMonth = Math.max(1, ...p.incomeByMonth, ...p.expenseByMonth);
          const cats = CATEGORY_ORDER.filter((c) => (p.byCategory[c] ?? 0) > 0);
          return (
            <Card key={p.propertyId ?? "unassigned"} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clay bg-sand/50 px-6 py-4">
                <h2 className="font-display text-lg font-semibold text-ink">{p.name}</h2>
                <div className="flex gap-5 text-sm">
                  <span className="text-pine">In {formatCents(p.incomeCents)}</span>
                  <span className="text-terracotta-dark">Out {formatCents(p.expenseCents)}</span>
                  <span className={`font-semibold ${pnet >= 0 ? "text-ink" : "text-terracotta-dark"}`}>
                    Net {formatCents(pnet)}
                  </span>
                </div>
              </div>

              <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_1fr]">
                {/* Monthly bars */}
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
                    By month — collected vs spent
                  </div>
                  <div className="flex items-end gap-1.5">
                    {MONTHS.map((m, i) => (
                      <div key={m} className="flex flex-1 flex-col items-center gap-1">
                        <div className="flex h-24 w-full items-end justify-center gap-0.5">
                          <div
                            className="w-1/2 rounded-t bg-pine"
                            style={{ height: `${(p.incomeByMonth[i] / maxMonth) * 100}%` }}
                            title={`Collected ${formatCents(p.incomeByMonth[i])}`}
                          />
                          <div
                            className="w-1/2 rounded-t bg-terracotta"
                            style={{ height: `${(p.expenseByMonth[i] / maxMonth) * 100}%` }}
                            title={`Spent ${formatCents(p.expenseByMonth[i])}`}
                          />
                        </div>
                        <span className="text-[10px] text-ink-faint">{m}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Category breakdown */}
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
                    Expenses by category
                  </div>
                  {cats.length > 0 ? (
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-clay/60">
                        {cats.map((c) => (
                          <tr key={c}>
                            <td className="py-1.5 pr-3 text-ink-soft">
                              {CATEGORY_LABEL[c as ScheduleECategory].replace(/ \(line \d+\)/, "")}
                            </td>
                            <td className="py-1.5 text-right font-medium text-ink">
                              {formatCents(p.byCategory[c] ?? 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-ink-faint">No expenses recorded for {year}.</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Property expense entry + ledger */}
      <Card className="mt-8 p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Add a property expense</h2>
        <p className="mb-4 text-xs text-ink-faint">
          Whole-property costs — insurance, property taxes, utilities, mortgage interest. Unit repairs
          belong on the unit&apos;s page; small purchases in petty cash. Everything rolls up here.
        </p>
        <PropertyExpenseForm properties={propertyOpts} />

        {(expenses ?? []).length > 0 && (
          <div className="mt-6 overflow-x-auto border-t border-clay pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Community</th>
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 pr-3 font-medium">Vendor / memo</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {(expenses ?? []).map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 pr-3 text-ink-soft">{formatDate(e.incurred_on)}</td>
                    <td className="py-2 pr-3 text-ink-soft">{e.properties?.name ?? "—"}</td>
                    <td className="py-2 pr-3 text-ink-soft">
                      {(CATEGORY_LABEL[e.category as ScheduleECategory] ?? e.category).replace(/ \(line \d+\)/, "")}
                    </td>
                    <td className="py-2 pr-3 text-ink">
                      {[e.vendor, e.memo].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium text-ink">
                      {formatCents(e.amount_cents)}
                    </td>
                    <td className="py-2 text-right">
                      <form action={deletePropertyExpense}>
                        <input type="hidden" name="id" value={e.id} />
                        <button type="submit" className="text-xs text-ink-faint hover:text-terracotta-dark" title="Delete">
                          ✕
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-6 text-xs text-ink-faint">
        Net here is cash in minus cash out — your accountant will add depreciation and any costs kept
        outside the portal. Use the Tax report for a Schedule E-ready summary per property.
      </p>
    </div>
  );
}
