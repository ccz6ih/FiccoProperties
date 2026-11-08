import { formatDate } from "@/lib/format";
import type { BoardGroup, BoardCharge } from "@/components/rent-board";

/**
 * The sheet that goes in the envelope.
 *
 * The screen board is a working surface — coloured dots, checkboxes, chips,
 * overdue first so it can be chased. Printed, all of that became noise on a
 * page handed across a desk with the takings in it.
 *
 * So paper gets its own document rather than a stylesheet fighting the screen:
 * a plain table, paid first in unit order to match the stack of cheques and
 * money orders, a total of what is enclosed, then separately who still owes.
 * Each tender is on its own line, because two money orders is the normal case
 * here and both numbers have to be checkable against the paper in the envelope.
 *
 * The tick column is deliberately empty. It gets filled in by hand while the
 * envelope is being packed, which is the job this sheet exists to serve.
 */

/**
 * Money on a document that gets counted against a physical stack: always two
 * decimals, so the points line up down the column and $1,600 can never be
 * mistaken for $1,600.75 at a glance.
 */
const dollars = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Is this tender a piece of paper that goes in the envelope?
 *
 * Rent settled another way — work done against it, a write-off — is still
 * paid, but there is nothing to hand over. Counting it in "total enclosed"
 * means the envelope comes up short against its own cover sheet, which reads
 * exactly like money having gone missing.
 */
const isPhysical = (ref: string) => /^\s*(money order|check|cheque|cash)/i.test(ref);

/** "Money order KS#123 $1,000.00" → "Money order KS#123" when the amount just
 *  repeats the tender. 24 of November's 53 payments had it typed in by hand,
 *  and printed beside the real figure it reads like an error. */
function tidyRef(ref: string, cents: number): string {
  const cleaned = ref
    .replace(/\s*\$+\s?[\d,]+(?:\.\d{2})?\s*$/, "")
    // The amount was often run on with a dash or colon; without its number
    // that separator is just a loose mark at the end of a reference.
    .replace(/[\s\-–:,;]+$/, "")
    .trim();
  if (!cleaned) return ref.trim();
  const stripped = ref.slice(cleaned.length).replace(/[^\d.]/g, "");
  if (!stripped) return cleaned;
  // Only drop it when it really is this tender's amount.
  return Math.round(Number(stripped) * 100) === cents ? cleaned : ref.trim();
}

const unitNo = (label: string) => {
  const m = label.match(/(\d+)/);
  return m ? Number(m[1]) : 9999;
};

const byUnit = (a: BoardCharge, b: BoardCharge) => unitNo(a.unit) - unitNo(b.unit);

/** "Unit 7" → "7", "House (28)" → "House 28" — the column is already labelled. */
const shortUnit = (label: string) => label.replace(/^Unit\s+/i, "").replace(/[()]/g, "");

export function RentTurnInSheet({
  groups,
  periodLabel,
  only,
}: {
  groups: BoardGroup[];
  periodLabel: string;
  /** When printing a single community, the others are left off entirely. */
  only?: string | null;
}) {
  const shown = only ? groups.filter((g) => g.property === only) : groups;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="hidden print:block">
      {shown.map((g, gi) => {
        const paid = g.charges.filter((c) => c.status === "paid").sort(byUnit);
        const owing = g.charges
          .filter((c) => c.status === "open" || c.status === "overdue" || c.status === "unbilled")
          .sort(byUnit);
        const vacant = g.charges.filter((c) => c.status === "vacant").sort(byUnit);

        // A home settled entirely without paper — work done against the rent,
        // say — is paid, but nothing goes in the envelope for it. It is listed
        // separately so "total enclosed" can be counted against the stack and
        // come out exactly right.
        const enclosed = paid.filter((c) => c.paidRefs.some((t) => isPhysical(t.ref)));
        const otherwise = paid.filter((c) => !c.paidRefs.some((t) => isPhysical(t.ref)));
        const enclosedCents = enclosed.reduce(
          (sum, c) => sum + c.paidRefs.filter((t) => isPhysical(t.ref)).reduce((n, t) => n + t.cents, 0),
          0
        );
        const itemCount = enclosed.reduce(
          (n, c) => n + c.paidRefs.filter((t) => isPhysical(t.ref)).length,
          0
        );

        return (
          <section
            key={g.property}
            className="turn-in-sheet"
            style={gi > 0 ? { breakBefore: "page" } : undefined}
          >
            <header className="turn-in-head">
              <div className="turn-in-title">
                {g.property} — rent collected
              </div>
              <div className="turn-in-sub">
                {periodLabel} · prepared {formatDate(today)} · 38th Ave Properties
              </div>
            </header>

            <table className="turn-in-table">
              <caption className="turn-in-caption">
                In the envelope — {itemCount} {itemCount === 1 ? "item" : "items"} from{" "}
                {enclosed.length} {enclosed.length === 1 ? "home" : "homes"}
              </caption>
              <thead>
                <tr>
                  <th className="col-tick">✓</th>
                  <th className="col-unit">Unit</th>
                  <th className="col-name">Resident</th>
                  <th className="col-ref">Cheque / money order</th>
                  <th className="col-amt">Amount</th>
                </tr>
              </thead>
              <tbody>
                {enclosed.map((c) => {
                  const tenders = c.paidRefs.filter((t) => isPhysical(t.ref));
                  return (
                    <tr key={`p-${c.unit}`}>
                      <td className="col-tick" />
                      <td className="col-unit">{shortUnit(c.unit)}</td>
                      <td className="col-name">{c.name}</td>
                      <td className="col-ref">
                        {tenders.map((t, i) => (
                          <span className="tender" key={`${t.ref}-${i}`}>
                            {tidyRef(t.ref, t.cents)}
                            <span className="tender-amt">{dollars(t.cents)}</span>
                          </span>
                        ))}
                      </td>
                      <td className="col-amt">
                        {dollars(tenders.reduce((n, t) => n + t.cents, 0))}
                      </td>
                    </tr>
                  );
                })}
                {enclosed.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Nothing collected yet this month.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td className="col-tick" />
                  <td colSpan={3}>Total enclosed</td>
                  <td className="col-amt">{dollars(enclosedCents)}</td>
                </tr>
              </tfoot>
            </table>

            {otherwise.length > 0 && (
              <table className="turn-in-table">
                <caption className="turn-in-caption">
                  Paid, but not in the envelope — settled another way
                </caption>
                <thead>
                  <tr>
                    <th className="col-tick" />
                    <th className="col-unit">Unit</th>
                    <th className="col-name">Resident</th>
                    <th className="col-ref">How it was settled</th>
                    <th className="col-amt">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {otherwise.map((c) => (
                    <tr key={`x-${c.unit}`}>
                      <td className="col-tick" />
                      <td className="col-unit">{shortUnit(c.unit)}</td>
                      <td className="col-name">{c.name}</td>
                      <td className="col-ref">
                        {c.paidRefs.map((t, i) => (
                          <span className="tender" key={`${t.ref}-${i}`}>
                            {tidyRef(t.ref, t.cents)}
                          </span>
                        ))}
                        {c.paidRefs.length === 0 && <span className="muted">—</span>}
                      </td>
                      <td className="col-amt">{dollars(c.billedCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {owing.length > 0 && (
              <table className="turn-in-table turn-in-owing">
                <caption className="turn-in-caption">
                  Not paid — {owing.length} {owing.length === 1 ? "home" : "homes"}
                </caption>
                <thead>
                  <tr>
                    <th className="col-tick" />
                    <th className="col-unit">Unit</th>
                    <th className="col-name">Resident</th>
                    <th className="col-ref">Status</th>
                    <th className="col-amt">Owed</th>
                  </tr>
                </thead>
                <tbody>
                  {owing.map((c) => (
                    <tr key={`o-${c.unit}`}>
                      <td className="col-tick" />
                      <td className="col-unit">{shortUnit(c.unit)}</td>
                      <td className="col-name">{c.name}</td>
                      <td className="col-ref">
                        {c.status === "overdue"
                          ? "Overdue"
                          : c.status === "unbilled"
                            ? "Not billed"
                            : "Due"}
                        {c.lateFeeCents ? (
                          <span className="tender-amt">
                            incl. {dollars(c.lateFeeCents)} late fee
                          </span>
                        ) : null}
                      </td>
                      <td className="col-amt">{dollars(c.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="col-tick" />
                    <td colSpan={3}>Still owed</td>
                    <td className="col-amt">{dollars(g.outstandingCents)}</td>
                  </tr>
                </tfoot>
              </table>
            )}

            {vacant.length > 0 && (
              <p className="turn-in-vacant">
                Empty: {vacant.map((c) => shortUnit(c.unit)).join(", ")}
              </p>
            )}

            <div className="turn-in-signoff">
              <span>
                Prepared by <span className="rule" />
              </span>
              <span>
                Received by <span className="rule" />
              </span>
              <span>
                Date <span className="rule rule-short" />
              </span>
            </div>
          </section>
        );
      })}
    </div>
  );
}
