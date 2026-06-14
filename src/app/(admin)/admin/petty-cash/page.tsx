import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import {
  PettyCashForms,
  type StaffOpt,
  type UnitOpt,
  type PropOpt,
} from "@/components/petty-cash-forms";
import { deletePettyEntry } from "./actions";
import { PettyEntryEdit } from "@/components/petty-entry-edit";
import { formatCents, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const RECEIPT_BUCKET = "receipts";

type EntryRow = {
  id: string;
  staff_id: string;
  kind: string;
  occurred_on: string;
  store: string | null;
  description: string | null;
  category: string | null;
  receipt_total_cents: number | null;
  amount_cents: number;
  receipt_path: string | null;
  receipt_paths: string[] | null;
  property_id: string | null;
  unit_id: string | null;
  staff: { full_name: string | null } | null;
  unit: { label: string; properties: { name: string | null } | null } | null;
  property: { name: string | null } | null;
};

export default async function AdminPettyCash() {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: staff }, { data: entries }, { data: properties }, { data: units }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("role", ["owner", "admin"])
        .order("full_name")
        .returns<{ id: string; full_name: string | null; role: string }[]>(),
      db
        .from("petty_cash_entries")
        .select(
          "id, staff_id, kind, occurred_on, store, description, category, receipt_total_cents, amount_cents, receipt_path, receipt_paths, property_id, unit_id, staff:staff_id(full_name), unit:unit_id(label, properties(name)), property:property_id(name)"
        )
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .returns<EntryRow[]>(),
      supabase.from("properties").select("id, name").order("name").returns<PropOpt[]>(),
      supabase
        .from("units")
        .select("id, label, properties(name)")
        .returns<{ id: string; label: string; properties: { name: string | null } | null }[]>(),
    ]);

  const staffOpts: StaffOpt[] = (staff ?? []).map((s) => ({
    id: s.id,
    name: s.full_name ?? "Staff",
  }));
  const propOpts: PropOpt[] = properties ?? [];
  const unitOpts: UnitOpt[] = (units ?? []).map((u) => ({
    id: u.id,
    label: u.label,
    property: u.properties?.name ?? "—",
  }));
  const defaultStaffId =
    (user && staffOpts.some((s) => s.id === user.id) ? user.id : staffOpts[0]?.id) ?? "";

  // Per-envelope balances.
  const balances = new Map<string, { loaded: number; spent: number }>();
  for (const e of entries ?? []) {
    const b = balances.get(e.staff_id) ?? { loaded: 0, spent: 0 };
    if (e.kind === "topup") b.loaded += e.amount_cents;
    else b.spent += e.amount_cents;
    balances.set(e.staff_id, b);
  }

  // Sign every receipt page for viewing (handles multi-page entries).
  const admin = createAdminClient();
  const pathsByEntry = new Map<string, string[]>();
  for (const e of entries ?? []) {
    const paths = e.receipt_paths ?? (e.receipt_path ? [e.receipt_path] : []);
    if (paths.length > 0) pathsByEntry.set(e.id, paths);
  }
  const flat = [...pathsByEntry.entries()].flatMap(([id, paths]) =>
    paths.map((p) => ({ id, p }))
  );
  const signed = await Promise.all(
    flat.map((f) => admin.storage.from(RECEIPT_BUCKET).createSignedUrl(f.p, 3600))
  );
  const receiptUrls = new Map<string, string[]>();
  flat.forEach((f, i) => {
    const url = signed[i]?.data?.signedUrl;
    if (!url) return;
    const arr = receiptUrls.get(f.id) ?? [];
    arr.push(url);
    receiptUrls.set(f.id, arr);
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Petty cash"
        subtitle="Each envelope's running balance, with receipts. Log only the business portion of a receipt — the rest stays yours."
      />

      {/* Envelope balances */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {staffOpts.map((s) => {
          const b = balances.get(s.id) ?? { loaded: 0, spent: 0 };
          const remaining = b.loaded - b.spent;
          return (
            <Card key={s.id} className="p-5">
              <div className="font-display text-base font-semibold text-ink">{s.name}</div>
              <div
                className={`mt-1 font-display text-3xl font-semibold ${
                  remaining < 0 ? "text-terracotta-dark" : "text-pine"
                }`}
              >
                {formatCents(remaining)}
              </div>
              <div className="mt-2 flex gap-4 text-xs text-ink-faint">
                <span>Loaded {formatCents(b.loaded)}</span>
                <span>Spent {formatCents(b.spent)}</span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mb-8">
        <PettyCashForms
          staff={staffOpts}
          properties={propOpts}
          units={unitOpts}
          defaultStaffId={defaultStaffId}
        />
      </div>

      {entries && entries.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Envelope</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                  <th className="px-4 py-3 font-medium">Where</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Receipt</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {entries.map((e) => {
                  const where = e.unit
                    ? `${e.unit.properties?.name ?? ""} · ${e.unit.label}`
                    : e.property?.name ?? "—";
                  const isTopup = e.kind === "topup";
                  return (
                    <tr key={e.id} className="align-top hover:bg-sand/30">
                      <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                        {formatDate(e.occurred_on)}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{e.staff?.full_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        {isTopup ? (
                          <div>
                            <span className="font-medium text-pine">Cash received</span>
                            <div className="text-xs text-ink-faint">
                              {[e.store ? `from ${e.store}` : null, e.description]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-ink">
                              {e.store ?? e.description ?? "Expense"}
                            </div>
                            <div className="text-xs text-ink-faint">
                              {[e.category, e.store ? e.description : null]
                                .filter(Boolean)
                                .join(" · ")}
                              {e.receipt_total_cents != null &&
                                e.receipt_total_cents !== e.amount_cents && (
                                  <> · receipt {formatCents(e.receipt_total_cents)}</>
                                )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{isTopup ? "—" : where}</td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 text-right font-medium ${
                          isTopup ? "text-pine" : "text-ink"
                        }`}
                      >
                        {isTopup ? "+" : "−"}
                        {formatCents(e.amount_cents)}
                      </td>
                      <td className="px-4 py-3">
                        {receiptUrls.has(e.id) ? (
                          <div className="flex flex-wrap gap-2">
                            {receiptUrls.get(e.id)!.map((url, i, arr) => (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-pine hover:underline"
                              >
                                {arr.length > 1 ? `Pg ${i + 1}` : "View"}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <PettyEntryEdit
                            properties={propOpts}
                            units={unitOpts}
                            entry={{
                              id: e.id,
                              kind: e.kind,
                              occurred_on: e.occurred_on,
                              store: e.store,
                              description: e.description,
                              category: e.category,
                              propertyId: e.property_id,
                              unitId: e.unit_id,
                              amountDollars: (e.amount_cents / 100).toString(),
                              receiptTotalDollars:
                                e.receipt_total_cents != null
                                  ? (e.receipt_total_cents / 100).toString()
                                  : "",
                            }}
                          />
                          <form action={deletePettyEntry}>
                            <input type="hidden" name="id" value={e.id} />
                            <button
                              type="submit"
                              className="text-xs text-ink-faint hover:text-terracotta-dark"
                              title="Delete entry"
                            >
                              ✕
                            </button>
                          </form>
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
          title="No entries yet"
          body="Top up an envelope, then log expenses as receipts come in."
        />
      )}
    </div>
  );
}
