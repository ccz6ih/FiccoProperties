import { Card } from "@/components/ui";
import { formatCents, formatDate } from "@/lib/format";

export type PastTenancy = {
  id: string;
  tenantName: string | null;
  tenantEmail: string | null;
  tenantPhone: string | null;
  moveInDate: string | null;
  moveOutDate: string | null;
  rentCents: number | null;
  depositCents: number | null;
  forwardingAddress: string | null;
  moveOutReason: string | null;
  notes: string | null;
};

/** "5 years" / "8 months" — how long they were here, in plain words. */
function tenure(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const months = Math.max(
    0,
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  );
  const years = Math.floor(months / 12);
  if (years >= 1) {
    const rem = months % 12;
    return rem > 0
      ? `${years} year${years === 1 ? "" : "s"} ${rem} mo`
      : `${years} year${years === 1 ? "" : "s"}`;
  }
  return `${months} month${months === 1 ? "" : "s"}`;
}

/**
 * Who lived here before.
 *
 * A move-out archives the tenancy and clears the home, which is right — the
 * rent board shouldn't still show someone who left. But it also meant the
 * previous resident vanished from the home entirely, and answering "what did
 * Nick pay, and did he leave owing anything?" meant going to the payments
 * screen and knowing to look. Their record belongs on the home it happened in.
 *
 * The rent ledger below this card is keyed to the home, not the person, so
 * their charges and payments are still there — this names whose they were.
 */
export function PastResidents({ rows }: { rows: PastTenancy[] }) {
  if (rows.length === 0) return null;

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-clay bg-sand/50 px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-ink">Who lived here before</h2>
        <p className="mt-0.5 text-xs text-ink-faint">
          Past tenancies on this home. The rent history below covers them too — it&apos;s kept
          by home, not by person.
        </p>
      </div>

      <ul className="divide-y divide-clay">
        {rows.map((r) => {
          const stay = tenure(r.moveInDate, r.moveOutDate);
          return (
            <li key={r.id} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="font-display text-base font-semibold text-ink">
                  {r.tenantName ?? "Resident"}
                </div>
                <div className="text-xs text-ink-faint">
                  {r.moveInDate ? formatDate(r.moveInDate) : "—"} →{" "}
                  {r.moveOutDate ? formatDate(r.moveOutDate) : "—"}
                  {stay ? ` · ${stay}` : ""}
                </div>
              </div>

              <dl className="mt-2 grid gap-x-5 gap-y-1.5 text-sm sm:grid-cols-2">
                {r.rentCents != null && (
                  <div className="flex gap-2">
                    <dt className="text-ink-faint">Paid</dt>
                    <dd className="font-medium text-ink">{formatCents(r.rentCents)} / mo</dd>
                  </div>
                )}
                {r.depositCents != null && (
                  <div className="flex gap-2">
                    <dt className="text-ink-faint">Deposit</dt>
                    <dd className="font-medium text-ink">{formatCents(r.depositCents)}</dd>
                  </div>
                )}
                {r.moveOutReason && (
                  <div className="flex gap-2">
                    <dt className="text-ink-faint">Why they left</dt>
                    <dd className="text-ink">{r.moveOutReason}</dd>
                  </div>
                )}
                {r.tenantPhone && (
                  <div className="flex gap-2">
                    <dt className="text-ink-faint">Phone</dt>
                    <dd className="text-ink">{r.tenantPhone}</dd>
                  </div>
                )}
                {r.tenantEmail && (
                  <div className="flex gap-2">
                    <dt className="text-ink-faint">Email</dt>
                    <dd className="truncate text-ink">{r.tenantEmail}</dd>
                  </div>
                )}
                {/* Kept visible because the deposit statute runs on it and a
                    question about an old deposit always starts here. */}
                {r.forwardingAddress && (
                  <div className="flex gap-2 sm:col-span-2">
                    <dt className="shrink-0 text-ink-faint">Forwarding</dt>
                    <dd className="text-ink">{r.forwardingAddress}</dd>
                  </div>
                )}
              </dl>

              {r.notes && (
                <details className="mt-2.5">
                  <summary className="cursor-pointer text-xs font-medium text-pine hover:underline">
                    Move-out walk-through
                  </summary>
                  <pre className="mt-1.5 whitespace-pre-wrap rounded-lg bg-sand/60 p-3 font-sans text-[13px] leading-relaxed text-ink-soft">
                    {r.notes}
                  </pre>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
