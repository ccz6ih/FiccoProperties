"use client";

export type CsvRow = {
  date: string;
  envelope: string;
  type: string;
  store: string;
  details: string;
  category: string;
  where: string;
  receiptTotal: string;
  amount: string;
};

function escape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function PettyCashCsv({ rows, filename }: { rows: CsvRow[]; filename: string }) {
  function download() {
    const header = [
      "Date", "Envelope", "Type", "Store", "Details", "Category", "Where",
      "Receipt total", "Amount",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [r.date, r.envelope, r.type, r.store, r.details, r.category, r.where, r.receiptTotal, r.amount]
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
