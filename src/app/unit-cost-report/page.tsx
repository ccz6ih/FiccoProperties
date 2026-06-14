import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Container } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Unit cost report" };

const isImage = (p: string) => /\.(jpe?g|png|webp|heic|heif)$/i.test(p);

type UnitRow = { id: string; label: string; properties: { name: string | null } | null };
type CostRow = {
  id: string; vendor: string | null; trade: string | null; description: string | null;
  amount_cents: number; hours: number | string | null; rate_cents: number | null;
  incurred_on: string; doc_path: string | null;
};
type PettyRow = {
  id: string; store: string | null; category: string | null; description: string | null;
  amount_cents: number; occurred_on: string;
};

export default async function UnitCostReport({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { profile } = await requireProfile("/unit-cost-report");
  if (!isStaff(profile)) redirect("/portal");

  const { unit: unitId } = await searchParams;
  if (!unitId) notFound();

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: unit } = await supabase
    .from("units")
    .select("id, label, properties(name)")
    .eq("id", unitId)
    .maybeSingle<UnitRow>();
  if (!unit) notFound();

  const [{ data: costRows }, { data: pettyRows }] = await Promise.all([
    db.from("unit_costs")
      .select("id, vendor, trade, description, amount_cents, hours, rate_cents, incurred_on, doc_path")
      .eq("unit_id", unitId).order("incurred_on", { ascending: true }).returns<CostRow[]>(),
    db.from("petty_cash_entries")
      .select("id, store, category, description, amount_cents, occurred_on")
      .eq("unit_id", unitId).eq("kind", "expense").order("occurred_on", { ascending: true }).returns<PettyRow[]>(),
  ]);
  const costs = costRows ?? [];
  const petty = pettyRows ?? [];

  const costTotal = costs.reduce((s, c) => s + c.amount_cents, 0);
  const pettyTotal = petty.reduce((s, p) => s + p.amount_cents, 0);
  const grand = costTotal + pettyTotal;
  const totalHours = costs.reduce((s, c) => s + (c.hours ? Number(c.hours) : 0), 0);

  const byTrade = new Map<string, number>();
  for (const c of costs) byTrade.set(c.trade ?? "other", (byTrade.get(c.trade ?? "other") ?? 0) + c.amount_cents);
  for (const p of petty) byTrade.set(p.category ?? "supplies", (byTrade.get(p.category ?? "supplies") ?? 0) + p.amount_cents);
  const tradeRows = [...byTrade.entries()].sort((a, b) => b[1] - a[1]);

  const lines = [
    ...costs.map((c) => ({
      date: c.incurred_on, kind: "Bill", who: c.vendor ?? c.trade ?? "Contractor",
      detail: [c.trade, c.description, c.hours ? `${Number(c.hours)} hrs${c.rate_cents ? ` @ ${formatCents(c.rate_cents)}/hr` : ""}` : null].filter(Boolean).join(" · "),
      amount: c.amount_cents,
    })),
    ...petty.map((p) => ({
      date: p.occurred_on, kind: "Petty cash", who: p.store ?? "Petty cash",
      detail: [p.category, p.description].filter(Boolean).join(" · "), amount: p.amount_cents,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Sign invoice docs.
  const admin = createAdminClient();
  const withDocs = costs.filter((c) => c.doc_path);
  const signed = await Promise.all(
    withDocs.map((c) => admin.storage.from("unit-cost-docs").createSignedUrl(c.doc_path!, 3600))
  );
  const docs = withDocs.map((c, i) => ({
    label: `${formatDate(c.incurred_on)} · ${c.vendor ?? c.trade ?? "Cost"} · ${formatCents(c.amount_cents)}`,
    url: signed[i]?.data?.signedUrl ?? "",
    image: isImage(c.doc_path!),
  })).filter((d) => d.url);

  const home = `${unit.properties?.name ?? ""} · ${unit.label}`;

  return (
    <main className="min-h-dvh bg-cream py-10 print:bg-white print:py-0">
      <Container className="max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
          <Link href={`/admin/units/${unitId}`} className="text-sm font-medium text-pine hover:text-pine-dark">
            ← Back to unit
          </Link>
          <PrintButton label="Print / Save as PDF" />
        </div>

        <div className="rounded-2xl border border-clay bg-white p-8 print:rounded-none print:border-0 print:p-0">
          <div className="mb-6 flex items-start justify-between border-b border-clay pb-5">
            <div>
              <div className="font-display text-2xl font-semibold text-pine">38th Ave Properties</div>
              <div className="text-sm text-ink-soft">Unit cost report · {home}</div>
            </div>
            <div className="text-right text-sm text-ink-soft">
              <div className="font-display text-lg font-semibold text-ink">{formatCents(grand)}</div>
              <div className="text-xs text-ink-faint">{lines.length} items{totalHours > 0 ? ` · ${totalHours} hrs` : ""}</div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-clay bg-clay">
            <Summary label="Total" value={formatCents(grand)} />
            <Summary label="Contractor bills" value={formatCents(costTotal)} />
            <Summary label="Petty cash" value={formatCents(pettyTotal)} />
          </div>

          {tradeRows.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {tradeRows.map(([t, c]) => (
                <span key={t} className="rounded-full bg-sand px-3 py-1 text-xs capitalize text-ink-soft">
                  {t} <span className="font-semibold text-ink">{formatCents(c)}</span>
                </span>
              ))}
            </div>
          )}

          {lines.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b border-clay/60 align-top">
                    <td className="py-2 pr-3 text-ink-soft">{formatDate(l.date)}</td>
                    <td className="py-2 pr-3 text-ink">
                      {l.who}
                      {l.detail && <div className="text-xs text-ink-faint">{l.detail}</div>}
                    </td>
                    <td className="py-2 pr-3 text-ink-soft">{l.kind}</td>
                    <td className="py-2 text-right font-medium text-ink">{formatCents(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-clay font-semibold text-ink">
                  <td className="py-2 pr-3" colSpan={3}>Total</td>
                  <td className="py-2 text-right">{formatCents(grand)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="py-8 text-center text-sm text-ink-soft">No costs recorded for this unit.</p>
          )}

          {docs.length > 0 && (
            <div className="mt-8 border-t border-clay pt-6">
              <h2 className="mb-4 font-display text-lg font-semibold text-ink">Invoices &amp; receipts</h2>
              <div className="space-y-6">
                {docs.map((d, i) => (
                  <div key={i} className="break-inside-avoid">
                    <div className="mb-2 text-sm font-medium text-ink">{d.label}</div>
                    {d.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.url} alt="Invoice" className="max-h-80 rounded-lg border border-clay" />
                    ) : (
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-clay bg-sand/40 px-3 py-2 text-xs font-medium text-pine print:hidden">
                        Invoice PDF →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-6 text-xs text-ink-faint">
            Costs to date for {home}. Includes contractor bills and petty-cash expenses tagged to this unit.
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
      <div className="mt-0.5 font-display text-xl font-semibold text-ink">{value}</div>
    </div>
  );
}
