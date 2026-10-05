"use client";

export type CsvRow = {
  date: string;
  /** When it was keyed in, which is often not the receipt's date. */
  entered: string;
  envelope: string;
  type: string;
  store: string;
  details: string;
  category: string;
  where: string;
  receiptTotal: string;
  amount: string;
  /** "Yes" / "On paper" / "Missing" — so a spreadsheet can be sorted by it. */
  receipt: string;
  /** Envelope balance after this entry, in order. */
  balance: string;
};

function escape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function PettyCashCsv({ rows, filename }: { rows: CsvRow[]; filename: string }) {
  function download() {
    const header = [
      "Date on receipt", "Date entered", "Envelope", "Type", "Store", "Details",
      "Category", "Where", "Receipt total", "Amount", "Receipt", "Balance after",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [r.date, r.entered, r.envelope, r.type, r.store, r.details, r.category,
         r.where, r.receiptTotal, r.amount, r.receipt, r.balance]
          .map((v) => escape(v ?? ""))
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand"
    >
      ↓ Download CSV
    </button>
  );
}
