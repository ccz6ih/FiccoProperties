"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { formatCents } from "@/lib/format";
import {
  importOccupancies,
  type ImportRow,
  type ImportResult,
} from "@/app/(admin)/admin/import/actions";

export type UnitRef = {
  id: string;
  label: string;
  property: string;
  slug: string;
};

// Header synonyms -> canonical field. Compared after lowercasing + stripping
// every non-alphanumeric character.
const HEADER_MAP: Record<string, keyof ParsedRow> = {
  property: "property", community: "property",
  unit: "unit", unitnumber: "unit", unitno: "unit", apt: "unit",
  apartment: "unit", label: "unit", number: "unit", unitlabel: "unit",
  tenant: "tenant_name", name: "tenant_name", tenantname: "tenant_name",
  email: "tenant_email", tenantemail: "tenant_email",
  phone: "tenant_phone", tenantphone: "tenant_phone", cell: "tenant_phone",
  movein: "move_in", moveindate: "move_in",
  leasestart: "lease_start", start: "lease_start", leasestartdate: "lease_start",
  leaseend: "lease_end", end: "lease_end", leaseenddate: "lease_end", expires: "lease_end",
  rent: "rent", monthlyrent: "rent", rentdollars: "rent", amount: "rent",
  notes: "notes", note: "notes",
};

type ParsedRow = {
  property: string;
  unit: string;
  tenant_name: string;
  tenant_email: string;
  tenant_phone: string;
  move_in: string;
  lease_start: string;
  lease_end: string;
  rent: string;
  notes: string;
};

type Preview = {
  line: number;
  raw: ParsedRow;
  unitId: string | null;
  matchedLabel: string | null;
  matchedProperty: string | null;
  rentCents: number | null;
  moveIn: string | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  errors: string[];
};

const TEMPLATE =
  "property,unit,tenant_name,tenant_email,tenant_phone,move_in,lease_start,lease_end,rent,notes\n" +
  "Senior Villa,12,Jane Doe,jane@example.com,303-555-0101,2021-06-01,2024-06-01,2025-05-31,1150,Long-time resident\n";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const trailingNum = (s: string) => {
  const m = s.match(/(\d+)\s*$/);
  return m ? m[1] : null;
};

/** Accept YYYY-MM-DD or M/D/YYYY; return ISO or null. */
function parseDate(v: string): { iso: string | null; bad: boolean } {
  const s = v.trim();
  if (!s) return { iso: null, bad: false };
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { iso: s, bad: false };
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mo, d, y] = m;
    return { iso: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`, bad: false };
  }
  return { iso: null, bad: true };
}

function parseRent(v: string): { cents: number | null; bad: boolean } {
  const s = v.trim().replace(/[$,\s]/g, "");
  if (!s) return { cents: null, bad: false };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return { cents: null, bad: true };
  return { cents: Math.round(n * 100), bad: false };
}

/** Minimal RFC-4180-ish CSV parser (handles quotes + embedded commas). */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function LeaseImporter({ units }: { units: UnitRef[] }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  // Lookups for matching.
  const { exactKey, byPropNum } = useMemo(() => {
    const exactKey = new Map<string, UnitRef>();
    const byPropNum = new Map<string, UnitRef>();
    for (const u of units) {
      const props = [norm(u.property), norm(u.slug)];
      for (const p of props) {
        exactKey.set(`${p}|${norm(u.label)}`, u);
        const n = trailingNum(u.label);
        if (n) byPropNum.set(`${p}|${n}`, u);
      }
    }
    return { exactKey, byPropNum };
  }, [units]);

  const preview = useMemo<Preview[]>(() => {
    if (!text.trim()) return [];
    const rows = parseCSV(text);
    if (rows.length === 0) return [];

    // Map header columns -> fields.
    const header = rows[0].map((h) => HEADER_MAP[norm(h)] ?? null);
    const hasHeader = header.some((h) => h !== null);
    const dataRows = hasHeader ? rows.slice(1) : rows;
    // Fallback positional order if no header recognized.
    const order: (keyof ParsedRow)[] = [
      "property", "unit", "tenant_name", "tenant_email", "tenant_phone",
      "move_in", "lease_start", "lease_end", "rent", "notes",
    ];

    return dataRows.map((cols, idx) => {
      const raw: ParsedRow = {
        property: "", unit: "", tenant_name: "", tenant_email: "",
        tenant_phone: "", move_in: "", lease_start: "", lease_end: "",
        rent: "", notes: "",
      };
      cols.forEach((val, i) => {
        const field = hasHeader ? header[i] : order[i];
        if (field) raw[field] = (val ?? "").trim();
      });

      const errors: string[] = [];
      const pkey = norm(raw.property);
      const ukey = norm(raw.unit);
      let unit: UnitRef | null = null;
      if (!raw.property || !raw.unit) {
        errors.push("Missing property or unit");
      } else {
        unit =
          exactKey.get(`${pkey}|${ukey}`) ??
          (trailingNum(raw.unit)
            ? byPropNum.get(`${pkey}|${trailingNum(raw.unit)}`) ?? null
            : null);
        if (!unit) errors.push("No matching unit");
      }

      const mi = parseDate(raw.move_in);
      const ls = parseDate(raw.lease_start);
      const le = parseDate(raw.lease_end);
      const rent = parseRent(raw.rent);
      if (mi.bad) errors.push("Bad move-in date");
      if (ls.bad) errors.push("Bad lease-start date");
      if (le.bad) errors.push("Bad lease-end date");
      if (rent.bad) errors.push("Bad rent");

      return {
        line: idx + 1,
        raw,
        unitId: unit?.id ?? null,
        matchedLabel: unit?.label ?? null,
        matchedProperty: unit?.property ?? null,
        rentCents: rent.cents,
        moveIn: mi.iso,
        leaseStart: ls.iso,
        leaseEnd: le.iso,
        errors,
      };
    });
  }, [text, exactKey, byPropNum]);

  const valid = preview.filter((p) => p.errors.length === 0);
  const invalid = preview.length - valid.length;

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tenants-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(setText);
  }

  function runImport() {
    setResult(null);
    const payload: ImportRow[] = valid.map((p) => ({
      unitId: p.unitId!,
      tenant_name: p.raw.tenant_name || null,
      tenant_email: p.raw.tenant_email || null,
      tenant_phone: p.raw.tenant_phone || null,
      move_in_date: p.moveIn,
      lease_start_date: p.leaseStart,
      lease_end_date: p.leaseEnd,
      rent_cents: p.rentCents,
      notes: p.raw.notes || null,
    }));
    start(async () => setResult(await importOccupancies(payload)));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-clay bg-sand/30 p-5 text-sm text-ink-soft">
        <p className="font-medium text-ink">How to import</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Download the template, fill one row per tenant, and save as CSV. Columns:{" "}
            <span className="text-ink">property, unit, tenant_name, tenant_email,
            tenant_phone, move_in, lease_start, lease_end, rent, notes</span>.
          </li>
          <li>Dates as <span className="text-ink">YYYY-MM-DD</span> or MM/DD/YYYY. Rent in dollars (e.g. 1150).</li>
          <li>Paste it below (or choose the file). Review the preview, then import.</li>
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-lg border border-clay-deep px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-sand"
          >
            ↓ Download template
          </button>
          <label className="cursor-pointer rounded-lg border border-clay-deep px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-sand">
            Choose CSV file
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          </label>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        spellCheck={false}
        placeholder="Paste CSV rows here…"
        className="w-full rounded-xl border border-clay-deep bg-white p-3 font-mono text-xs text-ink"
      />

      {preview.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-ink-soft">
              <span className="font-semibold text-pine">{valid.length} ready</span>
              {invalid > 0 && (
                <span className="ml-2 font-semibold text-terracotta-dark">
                  {invalid} need fixing
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="primary"
              disabled={valid.length === 0 || pending}
              onClick={runImport}
            >
              {pending ? "Importing…" : `Import ${valid.length} tenant${valid.length === 1 ? "" : "s"}`}
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-clay">
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-sand">
                  <tr className="text-left uppercase tracking-wide text-ink-faint">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Matched unit</th>
                    <th className="px-3 py-2 font-medium">Tenant</th>
                    <th className="px-3 py-2 font-medium">Move-in</th>
                    <th className="px-3 py-2 font-medium">Term</th>
                    <th className="px-3 py-2 font-medium">Rent</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-clay">
                  {preview.map((p) => {
                    const ok = p.errors.length === 0;
                    return (
                      <tr key={p.line} className={ok ? "" : "bg-terracotta-soft/40"}>
                        <td className="px-3 py-2 text-ink-faint">{p.line}</td>
                        <td className="px-3 py-2">
                          {p.matchedLabel ? (
                            <span className="text-ink">
                              <span className="font-medium">{p.matchedLabel}</span>
                              <span className="text-ink-faint"> · {p.matchedProperty}</span>
                            </span>
                          ) : (
                            <span className="text-ink-faint">
                              {p.raw.property} / {p.raw.unit}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-ink">
                          {p.raw.tenant_name || <span className="text-ink-faint">—</span>}
                          {p.raw.tenant_email && (
                            <div className="text-ink-faint">{p.raw.tenant_email}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-ink-soft">{p.moveIn ?? "—"}</td>
                        <td className="px-3 py-2 text-ink-soft">
                          {p.leaseStart ?? "—"} → {p.leaseEnd ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-ink-soft">
                          {p.rentCents != null ? formatCents(p.rentCents) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {ok ? (
                            <span className="text-pine">Ready</span>
                          ) : (
                            <span className="text-terracotta-dark">
                              {p.errors.join(", ")}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {result && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            result.ok
              ? "border-pine/30 bg-pine/5 text-ink"
              : "border-terracotta/40 bg-terracotta-soft/40 text-terracotta-dark"
          }`}
        >
          {result.ok ? (
            <>
              <span className="font-semibold text-pine">Imported {result.imported} tenancies.</span>{" "}
              {result.linked > 0 && `${result.linked} linked to existing accounts. `}
              {result.occupied > 0 && `${result.occupied} units marked occupied. `}
              {result.skipped > 0 && `${result.skipped} skipped. `}
              Next: open a property to review, then invite tenants to the portal.
            </>
          ) : (
            result.error ?? "Import failed."
          )}
        </div>
      )}
    </div>
  );
}
