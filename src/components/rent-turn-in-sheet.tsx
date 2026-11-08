import { formatCents, formatDate } from "@/lib/format";
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
                In the envelope — {paid.length} {paid.length === 1 ? "home" : "homes"}
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
                {paid.map((c) => (
                  <tr key={`p-${c.unit}`}>
                    <td className="col-tick" />
                    <td className="col-unit">{shortUnit(c.unit)}</td>
                    <td className="col-name">{c.name}</td>
                    <td className="col-ref">
                      {c.paidRefs.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        c.paidRefs.map((t, i) => (
                          <span className="tender" key={`${t.ref}-${i}`}>
                            {t.ref}
                            {c.paidRefs.length > 1 && (
                              <span className="tender-amt">{formatCents(t.cents)}</span>
                            )}
                          </span>
                        ))
                      )}
                    </td>
                    <td className="col-amt">{formatCents(c.billedCents)}</td>
                  </tr>
                ))}
                {paid.length === 0 && (
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
                  <td className="col-amt">{formatCents(g.collectedCents)}</td>
                </tr>
              </tfoot>
            </table>

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
                            incl. {formatCents(c.lateFeeCents)} late fee
                          </span>
                        ) : null}
                      </td>
                      <td className="col-amt">{formatCents(c.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="col-tick" />
                    <td colSpan={3}>Still owed</td>
                    <td className="col-amt">{formatCents(g.outstandingCents)}</td>
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
