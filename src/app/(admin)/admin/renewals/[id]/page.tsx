import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { PrintButton } from "@/components/print-button";
import {
  RenewalEmailButton,
  RenewalServeForm,
  RenewalApplyButton,
  RenewalWithdrawButton,
} from "@/components/renewal-detail-actions";
import { formatCents, formatDate } from "@/lib/format";
import { RENT_DROPBOX } from "@/lib/rent-dropbox";
import { createClient } from "@/lib/supabase/server";

type Offer = {
  id: string;
  created_at: string;
  unit_id: string;
  resident_id: string | null;
  current_rent_cents: number;
  new_rent_cents: number;
  term_months: number;
  effective_date: string;
  new_end_date: string | null;
  status: string;
  notice_served_on: string | null;
  served_method: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  signed_name: string | null;
  signed_ip: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  applied_at: string | null;
  note: string | null;
  units: {
    label: string;
    properties: { name: string | null; address_line1: string | null; city: string | null; state: string | null; postal_code: string | null } | null;
  } | null;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft — not sent yet", cls: "bg-sand text-ink-soft" },
  sent: { label: "Sent — awaiting response", cls: "bg-gold/20 text-ink" },
  accepted: { label: "Accepted ✓", cls: "bg-pine/15 text-pine" },
  declined: { label: "Declined", cls: "bg-terracotta-soft text-terracotta-dark" },
  withdrawn: { label: "Withdrawn", cls: "bg-sand text-ink-soft" },
  applied: { label: "Applied — tenancy updated ✓", cls: "bg-pine/15 text-pine" },
};

function termLabel(months: number): string {
  if (months === 0) return "Month-to-month";
  return `${months} month${months === 1 ? "" : "s"}`;
}

function stamp(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default async function RenewalDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: offer } = await db
    .from("renewal_offers")
    .select(
      "id, created_at, unit_id, resident_id, current_rent_cents, new_rent_cents, term_months, effective_date, new_end_date, status, notice_served_on, served_method, sent_at, accepted_at, signed_name, signed_ip, declined_at, decline_reason, applied_at, note, units:unit_id(label, properties(name, address_line1, city, state, postal_code))"
    )
    .eq("id", id)
    .maybeSingle<Offer>();
  if (!offer) notFound();

  const { data: occ } = await db
    .from("unit_occupancy")
    .select("tenant_name, tenant_email")
    .eq("unit_id", offer.unit_id)
    .maybeSingle<{ tenant_name: string | null; tenant_email: string | null }>();

  const prop = offer.units?.properties;
  const home = offer.units
    ? `${prop?.name ? `${prop.name} · ` : ""}${offer.units.label}`
    : "—";
  const address = [prop?.address_line1, prop?.city, prop?.state, prop?.postal_code]
    .filter(Boolean)
    .join(", ");
  const tenant = occ?.tenant_name ?? "Resident";
  const st = STATUS_LABEL[offer.status] ?? STATUS_LABEL.draft;
  const delta = offer.new_rent_cents - offer.current_rent_cents;
  const isIncrease = delta > 0;

  // Notice math: days between (served or sent or today) and the effective date.
  const noticeBasis = offer.notice_served_on ?? offer.sent_at?.slice(0, 10) ?? null;
  let noticeDays: number | null = null;
  if (noticeBasis) {
    const [by, bm, bd] = noticeBasis.split("-").map(Number);
    const [ey, em, ed] = offer.effective_date.split("-").map(Number);
    noticeDays = Math.round(
      (new Date(ey, em - 1, ed).getTime() - new Date(by, bm - 1, bd).getTime()) / 86_400_000
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="print:hidden">
        <PageHeader
          title={`Renewal — ${home}`}
          subtitle={`${tenant} · created ${formatDate(offer.created_at)}`}
          action={
            <div className="flex items-center gap-3">
              <Link href="/admin/renewals" className="text-sm font-medium text-pine hover:text-pine-dark">
                ← All renewals
              </Link>
              <PrintButton label="Print notice" />
            </div>
          }
        />

        <div className={`mb-6 inline-block rounded-full px-3 py-1 text-sm font-medium ${st.cls}`}>
          {st.label}
        </div>

        {/* Terms */}
        <Card className="mb-6 p-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-faint">Current rent</div>
              <div className="font-display text-xl font-semibold text-ink">{formatCents(offer.current_rent_cents)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-faint">New rent</div>
              <div className="font-display text-xl font-semibold text-pine">{formatCents(offer.new_rent_cents)}</div>
              {delta !== 0 && (
                <div className={`text-xs ${isIncrease ? "text-terracotta-dark" : "text-pine"}`}>
                  {isIncrease ? "+" : "−"}{formatCents(Math.abs(delta))}/mo
                </div>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-faint">Term</div>
              <div className="text-sm font-medium text-ink">{termLabel(offer.term_months)}</div>
              <div className="text-xs text-ink-faint">
                {formatDate(offer.effective_date)}
                {offer.new_end_date ? ` → ${formatDate(offer.new_end_date)}` : ""}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-faint">Notice given</div>
              <div className={`text-sm font-medium ${noticeDays != null && noticeDays < 60 && isIncrease ? "text-terracotta-dark" : "text-ink"}`}>
                {noticeDays != null ? `${noticeDays} days` : "Not served yet"}
              </div>
              {isIncrease && (
                <div className="text-xs text-ink-faint">CO needs 60+ for an increase</div>
              )}
            </div>
          </div>
          {offer.note && <p className="mt-4 border-t border-clay pt-3 text-sm text-ink-soft">{offer.note}</p>}
        </Card>

        {/* Response record */}
        {(offer.accepted_at || offer.declined_at) && (
          <Card className="mb-6 p-6">
            <h2 className="mb-3 font-display text-lg font-semibold text-ink">Resident response</h2>
            {offer.accepted_at ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Accepted" value={stamp(offer.accepted_at)} />
                <Field label="Signed (typed name)" value={offer.signed_name} />
                <Field label="From IP" value={offer.signed_ip} />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Declined" value={stamp(offer.declined_at)} />
                <Field label="Reason" value={offer.decline_reason ?? "Not given"} />
              </div>
            )}
          </Card>
        )}

        {/* Actions */}
        <Card className="mb-6 space-y-5 p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Actions</h2>
          {["draft", "sent"].includes(offer.status) && (
            <>
              <RenewalEmailButton offerId={offer.id} />
              <div className="border-t border-clay pt-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
                  Served the printed notice? Record it
                </div>
                <RenewalServeForm offerId={offer.id} />
                {offer.notice_served_on && (
                  <p className="mt-2 text-xs text-pine">
                    ✓ Served {formatDate(offer.notice_served_on)} ({offer.served_method ?? "—"})
                  </p>
                )}
              </div>
            </>
          )}
          {offer.status === "accepted" && (
            <>
              <p className="text-sm text-ink-soft">
                Accepted — the new terms apply automatically on {formatDate(offer.effective_date)}, or apply them now:
              </p>
              <RenewalApplyButton offerId={offer.id} />
            </>
          )}
          {offer.status === "applied" && (
            <p className="text-sm text-pine">
              ✓ Applied {stamp(offer.applied_at)} — the tenancy and billing now use the new terms.
            </p>
          )}
          {["draft", "sent", "declined"].includes(offer.status) && (
            <div className="border-t border-clay pt-4">
              <RenewalWithdrawButton offerId={offer.id} />
            </div>
          )}
        </Card>
      </div>

      {/* ------- printable notice (print only) ------- */}
      <div className="hidden print:block">
        <div className="mb-6 border-b-2 border-ink pb-3">
          <div className="font-display text-2xl font-semibold text-ink">
            {isIncrease ? "Notice of Rent Change & Lease Renewal Offer" : "Lease Renewal Offer"}
          </div>
          <div className="mt-1 text-sm text-ink-soft">38th Ave Properties · {RENT_DROPBOX.full} · {RENT_DROPBOX.phone}</div>
        </div>

        <table className="mb-5 w-full text-sm">
          <tbody>
            <PrintRow label="To" value={`${tenant}${address ? `, ${offer.units?.label}, ${address}` : ""}`} />
            <PrintRow label="Date of notice" value={formatDate(offer.notice_served_on ?? new Date().toISOString().slice(0, 10))} />
            <PrintRow label="Home" value={home} />
          </tbody>
        </table>

        <p className="mb-4 text-sm leading-relaxed text-ink">
          Dear {tenant},
        </p>
        <p className="mb-4 text-sm leading-relaxed text-ink">
          We value you as a resident and would like to offer you a renewal of your tenancy at {home} on the
          following terms:
        </p>

        <table className="mb-5 w-full border border-ink text-sm">
          <tbody>
            <tr className="border-b border-ink">
              <td className="border-r border-ink px-3 py-2 font-medium">New monthly rent</td>
              <td className="px-3 py-2 font-semibold">{formatCents(offer.new_rent_cents)} (currently {formatCents(offer.current_rent_cents)})</td>
            </tr>
            <tr className="border-b border-ink">
              <td className="border-r border-ink px-3 py-2 font-medium">Term</td>
              <td className="px-3 py-2">{termLabel(offer.term_months)}</td>
            </tr>
            <tr>
              <td className="border-r border-ink px-3 py-2 font-medium">Effective date</td>
              <td className="px-3 py-2">
                {formatDate(offer.effective_date)}
                {offer.new_end_date ? ` through ${formatDate(offer.new_end_date)}` : ""}
              </td>
            </tr>
          </tbody>
        </table>

        {isIncrease && (
          <p className="mb-4 text-sm leading-relaxed text-ink">
            This letter serves as written notice of a change in rent effective {formatDate(offer.effective_date)},
            provided at least sixty (60) days in advance in accordance with Colorado law (C.R.S. § 38-12-701).
            Rent will not be increased more than once in any twelve-month period (C.R.S. § 38-12-702).
          </p>
        )}

        <p className="mb-4 text-sm leading-relaxed text-ink">
          You may accept this offer in your resident portal at 38thaveproperties.com, or contact us at{" "}
          {RENT_DROPBOX.phone}. If you do not wish to renew, please let us know as soon as possible so we can
          plan accordingly. If no new agreement is reached by the end of your current term, your tenancy may
          continue month-to-month at the new rent stated above, subject to applicable law.
        </p>

        <p className="mb-10 text-sm leading-relaxed text-ink">
          Thank you for being part of our community — we hope you&apos;ll stay.
        </p>

        <div className="flex gap-12 text-sm">
          <div className="flex-1">
            <div className="border-b border-ink pb-8" />
            <div className="mt-1 text-xs uppercase tracking-wide text-ink-soft">Owner / Agent</div>
          </div>
          <div className="w-40">
            <div className="border-b border-ink pb-8" />
            <div className="mt-1 text-xs uppercase tracking-wide text-ink-soft">Date</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="text-sm font-medium text-ink">{value || "—"}</div>
    </div>
  );
}

function PrintRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="w-32 py-1 pr-3 align-top text-ink-soft">{label}:</td>
      <td className="py-1 font-medium text-ink">{value}</td>
    </tr>
  );
}
