import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Container } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { PettyCashCsv, type CsvRow } from "@/components/petty-cash-csv";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Petty cash report" };

const RECEIPT_BUCKET = "receipts";

type EntryRow = {
  id: string;
  staff_id: string;
  kind: string;
  occurred_on: string;
  created_at: string | null;
  store: string | null;
  description: string | null;
  category: string | null;
  receipt_total_cents: number | null;
  amount_cents: number;
  receipt_path: string | null;
  receipt_paths: string[] | null;
  staff: { full_name: string | null } | null;
  unit: { label: string; properties: { name: string | null } | null } | null;
  property: { name: string | null } | null;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const isImage = (p: string) => /\.(jpe?g|png|webp|heic|heif)$/i.test(p);

export default async function PettyCashReport({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    staff?: string;
    place?: string;
    sort?: string;
  }>;
}) {
  const { profile } = await requireProfile("/petty-cash-report");
  if (!isStaff(profile)) redirect("/portal");

  const sp = await searchParams;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const from = re.test(sp.from ?? "") ? sp.from! : iso(startOfMonth);
  const to = re.test(sp.to ?? "") ? sp.to! : iso(now);
  const staffId = sp.staff || null;
  const placeName = sp.place || null;
  const sortMode = sp.sort === "person" || sp.sort === "place" ? sp.sort : "date";

  // Preset ranges.
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const presets = [
    { label: "Today", from: iso(now), to: iso(now) },
    { label: "This week", from: iso(weekStart), to: iso(now) },
    { label: "This month", from: iso(startOfMonth), to: iso(now) },
    { label: "Last month", from: iso(lastMonthStart), to: iso(lastMonthEnd) },
  ];

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: staff }, { data: properties }, entriesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["owner", "admin"])
      .order("full_name")
      .returns<{ id: string; full_name: string | null }[]>(),
    supabase.from("properties").select("name").order("name").returns<{ name: string }[]>(),
    (async () => {
      let q = db
        .from("petty_cash_entries")
        .select(
          "id, staff_id, kind, occurred_on, created_at, store, description, category, receipt_total_cents, amount_cents, receipt_path, receipt_paths, staff:staff_id(full_name), unit:unit_id(label, properties(name)), property:property_id(name)"
        )
        .gte("occurred_on", from)
        .lte("occurred_on", to)
        .order("occurred_on", { ascending: true })
        .order("created_at", { ascending: true });
      if (staffId) q = q.eq("staff_id", staffId);
      return q.returns<EntryRow[]>();
    })(),
  ]);

  const placeOf = (e: EntryRow) =>
    e.unit?.properties?.name ?? e.property?.name ?? "Unassigned";

  const allEntries = entriesRes.data ?? [];
  const filtered = placeName
    ? allEntries.filter((e) => placeOf(e) === placeName)
    : allEntries;
  const entries = [...filtered].sort((a, b) => {
    if (sortMode === "person") {
      const an = a.staff?.full_name ?? "";
      const bn = b.staff?.full_name ?? "";
      if (an !== bn) return an.localeCompare(bn);
    } else if (sortMode === "place") {
      const ap = placeOf(a);
      const bp = placeOf(b);
      if (ap !== bp) return ap.localeCompare(bp);
    }
    // Same-day entries need a tiebreak, or the order drifts between the screen,
    // the print-out, and the CSV — which is what makes a re-export look wrong.
    if (a.occurred_on !== b.occurred_on) return a.occurred_on.localeCompare(b.occurred_on);
    return (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id);
  });

  const receivedCents = entries.filter((e) => e.kind === "topup").reduce((s, e) => s + e.amount_cents, 0);
  const spentCents = entries.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amount_cents, 0);

  // What was already in the tin when this window opened. Without it a range
  // that starts after the last top-up reads as a pure loss — the money Lou
  // handed over on the 2nd simply vanishes from a report starting the 3rd.
  // Same envelope/place filters, so the balance matches what's listed.
  const openingCents = await (async () => {
    let q = db
      .from("petty_cash_entries")
      .select("kind, amount_cents, unit:unit_id(properties(name)), property:property_id(name)")
      .lt("occurred_on", from);
    if (staffId) q = q.eq("staff_id", staffId);
    const { data } = await q.returns<
      {
        kind: string;
        amount_cents: number;
        unit: { properties: { name: string | null } | null } | null;
        property: { name: string | null } | null;
      }[]
    >();
    return (data ?? [])
      .filter((e) =>
        placeName
          ? (e.unit?.properties?.name ?? e.property?.name ?? "Unassigned") === placeName
          : true
      )
      .reduce((sum, e) => sum + (e.kind === "topup" ? e.amount_cents : -e.amount_cents), 0);
  })();
  const closingCents = openingCents + receivedCents - spentCents;

  // Sign every receipt page.
  const admin = createAdminClient();
  const flat = entries.flatMap((e) => {
    const paths = e.receipt_paths ?? (e.receipt_path ? [e.receipt_path] : []);
    return paths.map((p) => ({ id: e.id, p }));
  });
  const signed = await Promise.all(
    flat.map((f) => admin.storage.from(RECEIPT_BUCKET).createSignedUrl(f.p, 3600))
  );
  const receiptsByEntry = new Map<string, { url: string; image: boolean }[]>();
  flat.forEach((f, i) => {
    const url = signed[i]?.data?.signedUrl;
    if (!url) return;
    const arr = receiptsByEntry.get(f.id) ?? [];
    arr.push({ url, image: isImage(f.p) });
    receiptsByEntry.set(f.id, arr);
  });

  const where = (e: EntryRow) =>
    e.unit ? `${e.unit.properties?.name ?? ""} · ${e.unit.label}` : e.property?.name ?? "—";

  const staffName = staffId
    ? staff?.find((s) => s.id === staffId)?.full_name ?? "Staff"
    : "All envelopes";

  const csvRows: CsvRow[] = entries.map((e) => ({
    date: e.occurred_on,
    envelope: e.staff?.full_name ?? "—",
    type: e.kind === "topup" ? "Cash received" : "Expense",
    store: e.store ?? "",
    details: e.description ?? "",
    category: e.category ?? "",
    where: e.kind === "topup" ? "" : where(e),
    receiptTotal: e.receipt_total_cents != null ? (e.receipt_total_cents / 100).toFixed(2) : "",
    amount: ((e.kind === "topup" ? 1 : -1) * e.amount_cents / 100).toFixed(2),
  }));

  const current = {
    from,
    to,
    staff: staffId ?? "",
    place: placeName ?? "",
    sort: sortMode,
  };
  const hrefWith = (over: Partial<typeof current>) => {
    const merged = { ...current, ...over };
    const q = Object.entries(merged)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return `/petty-cash-report?${q}`;
  };
  const communities = (properties ?? []).map((p) => p.name);

  return (
    <main className="min-h-dvh bg-cream py-10 print:bg-white print:py-0">
      <Container className="max-w-4xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/admin/petty-cash" className="text-sm font-medium text-pine hover:text-pine-dark">
            ← Back to petty cash
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <PettyCashCsv rows={csvRows} filename={`petty-cash-${from}-to-${to}.csv`} />
            <PrintButton label="Print / Save as PDF" />
          </div>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => {
              const active = p.from === from && p.to === to;
              return (
                <Link
                  key={p.label}
                  href={hrefWith({ from: p.from, to: p.to })}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    active ? "bg-pine text-cream" : "text-ink-soft hover:bg-sand"
                  }`}
                >
                  {p.label}
                </Link>
              );
            })}
          </div>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="sort" value={sortMode} />
            <label className="text-xs text-ink-soft">
              From
              <input type="date" name="from" defaultValue={from} className="block rounded-lg border border-clay-deep bg-white px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-ink-soft">
              To
              <input type="date" name="to" defaultValue={to} className="block rounded-lg border border-clay-deep bg-white px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-ink-soft">
              Envelope
              <select name="staff" defaultValue={staffId ?? ""} className="block rounded-lg border border-clay-deep bg-white px-2 py-1.5 text-sm">
                <option value="">All</option>
                {(staff ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name ?? "Staff"}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-soft">
              Community
              <select name="place" defaultValue={placeName ?? ""} className="block rounded-lg border border-clay-deep bg-white px-2 py-1.5 text-sm">
                <option value="">All places</option>
                {communities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="Unassigned">Unassigned</option>
              </select>
            </label>
            <button type="submit" className="rounded-lg border border-clay-deep px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-sand">
              Apply
            </button>
          </form>
        </div>

        {/* Sort */}
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm print:hidden">
          <span className="text-xs uppercase tracking-wide text-ink-faint">Sort by</span>
          <Link href={hrefWith({ sort: "date" })} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${sortMode === "date" ? "bg-pine text-cream" : "text-ink-soft hover:bg-sand"}`}>Date</Link>
          <Link href={hrefWith({ sort: "person" })} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${sortMode === "person" ? "bg-pine text-cream" : "text-ink-soft hover:bg-sand"}`}>Person</Link>
          <Link href={hrefWith({ sort: "place" })} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${sortMode === "place" ? "bg-pine text-cream" : "text-ink-soft hover:bg-sand"}`}>Place</Link>
        </div>

        <div className="rounded-2xl border border-clay bg-white p-8 print:rounded-none print:border-0 print:p-0">
          {/* Letterhead */}
          <div className="mb-7 flex items-start justify-between border-b-2 border-clay-deep pb-5">
            <div>
              <div className="font-display text-3xl font-semibold text-pine">38th Ave Properties</div>
              <div className="mt-0.5 text-base text-ink-soft">
                Petty cash report · {staffName}
                {placeName ? ` · ${placeName}` : ""}
              </div>
            </div>
            <div className="text-right text-ink-soft">
              <div className="text-lg font-semibold text-ink">
                {formatDate(from)} – {formatDate(to)}
              </div>
              <div className="text-sm text-ink-faint">{entries.length} entries</div>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-clay bg-clay sm:grid-cols-4">
            <Summary label={`In hand ${formatDate(from)}`} value={formatCents(openingCents)} />
            <Summary label="Cash received" value={formatCents(receivedCents)} />
            <Summary label="Spent" value={formatCents(spentCents)} />
            <Summary
              label={closingCents < 0 ? "Owed back to envelope" : "In hand at the end"}
              value={formatCents(Math.abs(closingCents))}
              tone={closingCents < 0 ? "debt" : "normal"}
            />
          </div>

          <div className="mb-7 -mt-4 text-center text-sm text-ink-soft print:mb-5">
            {formatCents(openingCents)} in hand on {formatDate(from)} + {formatCents(receivedCents)}{" "}
            received − {formatCents(spentCents)} spent ={" "}
            <strong className="text-ink-soft">{formatCents(closingCents)}</strong>
            {closingCents < 0
              ? " — the envelope is out of pocket by this much and is owed it back."
              : " left in the envelope."}
          </div>

          {/* Log */}
          {entries.length > 0 ? (
            <table className="w-full text-base">
              <thead>
                <tr className="border-b-2 border-clay-deep text-left text-xs uppercase tracking-wider text-ink-soft">
                  <th className="py-2.5 pr-3 font-semibold">Date</th>
                  <th className="py-2.5 pr-3 font-semibold">Envelope</th>
                  <th className="py-2.5 pr-3 font-semibold">Details</th>
                  <th className="py-2.5 pr-3 font-semibold">Where</th>
                  <th className="py-2.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const topup = e.kind === "topup";
                  return (
                    <tr key={e.id} className="border-b border-clay align-top">
                      <td className="whitespace-nowrap py-3 pr-3 text-ink-soft">{formatDate(e.occurred_on)}</td>
                      <td className="py-3 pr-3 text-ink-soft">{e.staff?.full_name ?? "—"}</td>
                      <td className="py-3 pr-3 font-medium text-ink">
                        {topup ? `Cash received${e.store ? ` from ${e.store}` : ""}` : e.store ?? e.description ?? "Expense"}
                        <div className="mt-0.5 text-sm font-normal text-ink-faint">
                          {[topup ? null : e.category, topup ? e.description : e.description,
                            e.receipt_total_cents != null && e.receipt_total_cents !== e.amount_cents
                              ? `receipt ${formatCents(e.receipt_total_cents)}` : null]
                            .filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-ink-soft">{topup ? "—" : where(e)}</td>
                      <td className={`whitespace-nowrap py-3 text-right text-lg font-semibold tabular-nums ${topup ? "text-pine" : "text-ink"}`}>
                        {topup ? "+" : "−"}{formatCents(e.amount_cents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* The page ends on the number, so a printed copy doesn't need
                  the reader to scroll back up to the tiles. */}
              <tfoot>
                <tr className="border-t-2 border-clay-deep">
                  <td colSpan={4} className="py-3 pr-3 text-right font-semibold text-ink">
                    Received this period
                  </td>
                  <td className="whitespace-nowrap py-3 text-right text-lg font-semibold tabular-nums text-pine">
                    +{formatCents(receivedCents)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="py-1 pr-3 text-right font-semibold text-ink">
                    Spent this period
                  </td>
                  <td className="whitespace-nowrap py-1 text-right text-lg font-semibold tabular-nums text-ink">
                    −{formatCents(spentCents)}
                  </td>
                </tr>
                <tr className="border-t border-clay">
                  <td colSpan={4} className="py-3 pr-3 text-right font-display text-lg font-semibold text-ink">
                    {closingCents < 0 ? "Owed back to envelope" : "Left in the envelope"}
                  </td>
                  <td
                    className={`whitespace-nowrap py-3 text-right font-display text-2xl font-semibold tabular-nums ${
                      closingCents < 0 ? "text-terracotta-dark" : "text-ink"
                    }`}
                  >
                    {formatCents(Math.abs(closingCents))}
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="py-8 text-center text-base text-ink-soft">No entries in this period.</p>
          )}

          {/* Receipt images */}
          {receiptsByEntry.size > 0 && (
            <div className="mt-8 border-t border-clay pt-6">
              <h2 className="mb-4 font-display text-xl font-semibold text-ink">Receipts</h2>
              <div className="space-y-6">
                {entries
                  .filter((e) => receiptsByEntry.has(e.id))
                  .map((e) => (
                    <div key={e.id} className="break-inside-avoid">
                      <div className="mb-2 text-base font-medium text-ink">
                        {formatDate(e.occurred_on)} · {e.store ?? "Expense"} ·{" "}
                        {formatCents(e.amount_cents)}
                        <span className="text-ink-faint"> — {e.staff?.full_name ?? ""}</span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {receiptsByEntry.get(e.id)!.map((r, i) =>
                          r.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={r.url}
                              alt={`Receipt page ${i + 1}`}
                              className="max-h-80 rounded-lg border border-clay"
                            />
                          ) : (
                            <a
                              key={i}
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-clay bg-sand/40 px-3 py-2 text-xs font-medium text-pine print:hidden"
                            >
                              Receipt PDF (page {i + 1}) →
                            </a>
                          )
                        )}
                      </div>
                    </div>
                  ))}
              </div>
              <p className="mt-4 text-xs text-ink-faint print:hidden">
                PDF receipts open in a new tab — print those separately if you need them in the packet.
              </p>
            </div>
          )}

          <p className="mt-6 text-xs text-ink-faint">
            Petty cash {staffName.toLowerCase()} · {formatDate(from)}–{formatDate(to)}. Amounts reflect the
            business portion drawn from the envelope.
          </p>
        </div>
      </Container>
    </main>
  );
}

function Summary({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "debt";
}) {
  return (
    <div className="bg-white px-4 py-5 text-center">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</div>
      <div
        className={`mt-1 font-display text-2xl font-semibold tabular-nums ${
          tone === "debt" ? "text-terracotta-dark" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
