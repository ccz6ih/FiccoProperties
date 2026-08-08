import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { formatCents } from "@/lib/format";
import { requireProfile, isStaff } from "@/lib/auth";
import {
  buildYearFinancials,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
} from "@/lib/financials";

export const metadata: Metadata = { title: "Tax report" };

export default async function TaxReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { profile } = await requireProfile("/tax-report");
  if (!isStaff(profile)) redirect("/portal");

  const { year: yearParam } = await searchParams;
  const thisYear = new Date().getFullYear();
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : thisYear;

  const fin = await buildYearFinancials(year);
  const realProps = fin.properties.filter((p) => p.propertyId != null);
  const unassigned = fin.properties.find((p) => p.propertyId == null);

  const reportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <main className="min-h-dvh bg-cream py-10 print:bg-white print:py-0">
      <Container className="max-w-3xl">
        <div className="mb-5 flex items-center justify-between print:hidden">
          <Link href="/admin/financials" className="text-sm font-medium text-pine hover:text-pine-dark">
            ← Back to financials
          </Link>
          <PrintButton />
        </div>

        <div className="rounded-2xl border border-clay bg-white p-8 print:rounded-none print:border-0 print:p-0">
          {/* Letterhead */}
          <div className="mb-6 flex items-start justify-between border-b-2 border-ink pb-5">
            <div>
              <div className="font-display text-2xl font-semibold text-pine">38th Ave Properties</div>
              <div className="text-sm text-ink-soft">W 38th Ave, Wheat Ridge, CO 80033</div>
            </div>
            <div className="text-right text-sm text-ink-soft">
              <div className="font-display text-lg font-semibold text-ink">Rental income &amp; expenses</div>
              <div>Tax year {year} · prepared {reportDate}</div>
            </div>
          </div>

          <p className="mb-6 text-sm leading-relaxed text-ink-soft">
            Cash-basis summary per property, organized to match IRS Schedule&nbsp;E (Form&nbsp;1040)
            line items. Depreciation and any costs kept outside the portal are not included — your tax
            preparer will add those.
          </p>

          {/* One block per property */}
          {realProps.map((p, idx) => {
            const cats = CATEGORY_ORDER.filter((c) => (p.byCategory[c] ?? 0) > 0);
            const net = p.incomeCents - p.expenseCents;
            return (
              <section
                key={p.propertyId}
                className={`mb-8 break-inside-avoid ${idx > 0 ? "print:break-before-page" : ""}`}
              >
                <h2 className="mb-1 font-display text-xl font-semibold text-ink">{p.name}</h2>
                <div className="mb-3 text-xs text-ink-faint">Wheat Ridge, CO · residential rental</div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b-2 border-ink">
                      <td className="py-2 font-semibold text-ink">Rents received (line 3)</td>
                      <td className="py-2 text-right font-semibold text-pine">{formatCents(p.incomeCents)}</td>
                    </tr>
                    {cats.map((c) => (
                      <tr key={c} className="border-b border-clay">
                        <td className="py-1.5 pl-4 text-ink-soft">{CATEGORY_LABEL[c]}</td>
                        <td className="py-1.5 text-right text-ink">{formatCents(p.byCategory[c] ?? 0)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-ink">
                      <td className="py-2 font-semibold text-ink">Total expenses (line 20)</td>
                      <td className="py-2 text-right font-semibold text-terracotta-dark">
                        {formatCents(p.expenseCents)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 font-semibold text-ink">
                        Income less expenses (line 21, before depreciation)
                      </td>
                      <td className={`py-2 text-right font-semibold ${net >= 0 ? "text-ink" : "text-terracotta-dark"}`}>
                        {formatCents(net)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>
            );
          })}

          {unassigned && (unassigned.incomeCents > 0 || unassigned.expenseCents > 0) && (
            <section className="mb-8 break-inside-avoid">
              <h2 className="mb-2 font-display text-lg font-semibold text-ink">
                Not assigned to a property
              </h2>
              <p className="mb-2 text-xs text-ink-faint">
                Entries recorded without a community — assign them in the portal so they land on the
                right property next time.
              </p>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-clay">
                    <td className="py-1.5 text-ink-soft">Income</td>
                    <td className="py-1.5 text-right">{formatCents(unassigned.incomeCents)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-ink-soft">Expenses</td>
                    <td className="py-1.5 text-right">{formatCents(unassigned.expenseCents)}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}

          {/* Portfolio total */}
          <section className="break-inside-avoid rounded-xl border-2 border-ink px-5 py-4 print:rounded-none">
            <h2 className="mb-2 font-display text-lg font-semibold text-ink">
              All properties combined — {year}
            </h2>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1 text-ink-soft">Total rents received</td>
                  <td className="py-1 text-right font-semibold text-pine">{formatCents(fin.totalIncomeCents)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-ink-soft">Total expenses</td>
                  <td className="py-1 text-right font-semibold text-terracotta-dark">
                    {formatCents(fin.totalExpenseCents)}
                  </td>
                </tr>
                <tr className="border-t-2 border-ink">
                  <td className="py-2 font-semibold text-ink">Net (before depreciation)</td>
                  <td className="py-2 text-right font-display text-lg font-bold text-ink">
                    {formatCents(fin.totalIncomeCents - fin.totalExpenseCents)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <p className="mt-6 text-xs text-ink-faint">
            Prepared from portal records (rent payments, contractor bills, petty cash, and property
            expenses) on a cash basis. Not tax advice — review with your tax professional.
          </p>
        </div>
      </Container>
    </main>
  );
}
