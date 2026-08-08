"use client";

import { Fragment, useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { formatCents, formatDate } from "@/lib/format";
import {
  createRenewalOffer,
  type RenewalState,
} from "@/app/(admin)/admin/renewals/actions";

const initial: RenewalState = { ok: false };
const inputSm =
  "rounded-lg border border-clay-deep bg-white px-2 py-1.5 text-sm text-ink";

export type RenewalRow = {
  unitId: string;
  unit: string;
  property: string;
  tenant: string;
  rentCents: number;
  endDate: string | null;
  daysLeft: number | null; // null = month-to-month / no end date
  suggestedEffective: string;
  offer: {
    id: string;
    status: string;
    newRentCents: number;
    effectiveDate: string;
  } | null;
};

export type StaggerMonth = { label: string; count: number };

const OFFER_CHIP: Record<string, { label: string; cls: string }> = {
  draft: { label: "Offer drafted", cls: "bg-sand text-ink-soft" },
  sent: { label: "Offer sent", cls: "bg-gold/20 text-ink" },
  accepted: { label: "Accepted ✓", cls: "bg-pine/15 text-pine" },
  declined: { label: "Declined", cls: "bg-terracotta-soft text-terracotta-dark" },
  applied: { label: "Renewed ✓", cls: "bg-pine/15 text-pine" },
};

type Bucket = { key: string; title: string; accent: string; rows: RenewalRow[] };

function bucketize(rows: RenewalRow[]): Bucket[] {
  const b: Record<string, RenewalRow[]> = {
    expired: [], d30: [], d60: [], d90: [], later: [], mtm: [],
  };
  for (const r of rows) {
    if (r.daysLeft == null) b.mtm.push(r);
    else if (r.daysLeft < 0) b.expired.push(r);
    else if (r.daysLeft <= 30) b.d30.push(r);
    else if (r.daysLeft <= 60) b.d60.push(r);
    else if (r.daysLeft <= 90) b.d90.push(r);
    else b.later.push(r);
  }
  const order: [string, string, string][] = [
    ["expired", "Lease expired — now month-to-month", "text-terracotta-dark"],
    ["d30", "Ending in the next 30 days", "text-terracotta-dark"],
    ["d60", "Ending in 31–60 days", "text-gold"],
    ["d90", "Ending in 61–90 days", "text-pine"],
    ["later", "Ending later", "text-ink-soft"],
    ["mtm", "Month-to-month / no end date on file", "text-ink-soft"],
  ];
  return order
    .map(([key, title, accent]) => ({ key, title, accent, rows: b[key] }))
    .filter((x) => x.rows.length > 0);
}

export function RenewalBoard({
  rows,
  stagger,
}: {
  rows: RenewalRow[];
  stagger: StaggerMonth[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const needsAttention = rows.filter(
    (r) => (r.daysLeft != null && r.daysLeft <= 60) || r.daysLeft == null
  ).length;
  const awaiting = rows.filter((r) => r.offer?.status === "sent").length;
  const accepted = rows.filter((r) => r.offer?.status === "accepted").length;
  const maxStagger = Math.max(1, ...stagger.map((s) => s.count));

  return (
    <div>
      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Needs a decision"
          value={needsAttention}
          hint="Expiring ≤60 days or already month-to-month"
          tone="terracotta"
        />
        <SummaryCard label="Offers awaiting response" value={awaiting} hint="Sent, not yet answered" tone="gold" />
        <SummaryCard label="Accepted — will auto-apply" value={accepted} hint="Applied on their effective date" tone="pine" />
      </div>

      {/* Staggering strip */}
      {stagger.some((s) => s.count > 0) && (
        <div className="mb-6 rounded-2xl border border-clay bg-cream p-5">
          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">
            Lease endings by month — keep turns staggered
          </div>
          <div className="flex items-end gap-2">
            {stagger.map((s) => (
              <div key={s.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-semibold text-ink">{s.count > 0 ? s.count : ""}</span>
                <div
                  className={`w-full rounded-t ${s.count > 3 ? "bg-terracotta" : s.count > 0 ? "bg-pine" : "bg-clay"}`}
                  style={{ height: `${8 + (s.count / maxStagger) * 48}px` }}
                />
                <span className="text-[10px] text-ink-faint">{s.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">
            Red = more than 3 leases ending that month. Offer different terms (6 vs 12 months) to spread them out.
          </p>
        </div>
      )}

      {/* Buckets */}
      <div className="space-y-6">
        {bucketize(rows).map((b) => (
          <div key={b.key} className="overflow-hidden rounded-2xl border border-clay bg-cream">
            <div className="border-b border-clay bg-sand/50 px-5 py-3">
              <span className={`font-display text-base font-semibold ${b.accent}`}>{b.title}</span>
              <span className="ml-2 text-xs text-ink-faint">{b.rows.length} unit{b.rows.length === 1 ? "" : "s"}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-clay text-left text-xs uppercase tracking-wide text-ink-faint">
                    <th className="px-5 py-2.5 font-medium">Unit</th>
                    <th className="px-5 py-2.5 font-medium">Community</th>
                    <th className="px-5 py-2.5 text-right font-medium">Current rent</th>
                    <th className="px-5 py-2.5 font-medium">Lease ends</th>
                    <th className="px-5 py-2.5 font-medium">Renewal</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-clay">
                  {b.rows.map((r) => {
                    const chip = r.offer ? OFFER_CHIP[r.offer.status] : null;
                    return (
                      <Fragment key={r.unitId}>
                        <tr className="hover:bg-sand/30">
                          <td className="px-5 py-3">
                            <div className="font-medium text-ink">{r.unit}</div>
                            <div className="text-xs text-ink-faint">{r.tenant}</div>
                          </td>
                          <td className="px-5 py-3 text-ink-soft">{r.property}</td>
                          <td className="px-5 py-3 text-right font-medium text-ink">
                            {formatCents(r.rentCents)}
                          </td>
                          <td className="px-5 py-3 text-ink-soft">
                            {r.endDate ? (
                              <>
                                {formatDate(r.endDate)}
                                {r.daysLeft != null && (
                                  <div className={`text-xs ${r.daysLeft < 0 ? "text-terracotta-dark" : r.daysLeft <= 60 ? "text-gold" : "text-ink-faint"}`}>
                                    {r.daysLeft < 0
                                      ? `${-r.daysLeft} days ago`
                                      : `in ${r.daysLeft} days`}
                                  </div>
                                )}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {r.offer && chip ? (
                              <Link
                                href={`/admin/renewals/${r.offer.id}`}
                                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium hover:underline ${chip.cls}`}
                              >
                                {chip.label} · {formatCents(r.offer.newRentCents)}
                              </Link>
                            ) : (
                              <span className="text-xs text-ink-faint">No offer yet</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {(!r.offer || ["declined", "withdrawn", "applied"].includes(r.offer.status)) && (
                              <button
                                type="button"
                                onClick={() => setExpanded((p) => (p === r.unitId ? null : r.unitId))}
                                className="whitespace-nowrap text-xs font-medium text-pine hover:underline"
                              >
                                {expanded === r.unitId ? "Close" : "Offer renewal…"}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expanded === r.unitId && (
                          <tr className="bg-sand/30">
                            <td colSpan={6} className="px-5 py-4">
                              <OfferForm row={r} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      {rows.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-faint">No occupied units found.</p>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "pine" | "gold" | "terracotta";
}) {
  const color =
    tone === "pine" ? "text-pine" : tone === "gold" ? "text-gold" : "text-terracotta-dark";
  return (
    <div className="rounded-2xl border border-clay bg-cream p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={`mt-1 font-display text-3xl font-semibold ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-ink-faint">{hint}</div>
    </div>
  );
}

function OfferForm({ row }: { row: RenewalRow }) {
  const [state, action, pending] = useActionState(createRenewalOffer, initial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="unit_id" value={row.unitId} />
      <label className="space-y-1">
        <span className="block text-xs font-medium text-ink-soft">New rent ($/mo)</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink-faint">$</span>
          <input
            type="number"
            name="new_rent"
            min={0}
            step="1"
            defaultValue={row.rentCents > 0 ? Math.round(row.rentCents / 100) : undefined}
            className={`${inputSm} w-28 pl-6`}
            required
          />
        </div>
      </label>
      <label className="space-y-1">
        <span className="block text-xs font-medium text-ink-soft">Term</span>
        <select name="term_months" defaultValue="12" className={inputSm}>
          <option value="12">12 months</option>
          <option value="6">6 months</option>
          <option value="0">Month-to-month</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="block text-xs font-medium text-ink-soft">New terms start</span>
        <input type="date" name="effective_date" defaultValue={row.suggestedEffective} className={inputSm} required />
      </label>
      <label className="min-w-40 flex-1 space-y-1">
        <span className="block text-xs font-medium text-ink-soft">Note (optional)</span>
        <input name="note" placeholder="Anything to remember…" className={`${inputSm} w-full`} />
      </label>
      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Creating…" : "Create offer"}
      </Button>
      <div className="w-full text-[11px] leading-relaxed text-ink-faint">
        Colorado: rent increases need <strong>60 days&apos; written notice</strong> and are limited to{" "}
        <strong>one increase per 12 months</strong>. The suggested start date already allows 60 days from today.
        {state.error && <span className="ml-2 font-medium text-terracotta-dark">{state.error}</span>}
        {state.ok && state.notice && <span className="ml-2 font-medium text-pine">{state.notice}</span>}
      </div>
    </form>
  );
}
