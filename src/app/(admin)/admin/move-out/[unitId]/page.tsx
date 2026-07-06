import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Container } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONDITION_BUCKET } from "@/lib/unit-photos";
import { saveDepositSettlement, addDeduction, deleteDeduction } from "@/app/(admin)/admin/move-out/actions";

export const metadata: Metadata = { title: "Move-out & deposit" };
export const dynamic = "force-dynamic";

type UnitRow = {
  label: string;
  properties: { name: string | null; address_line1: string | null; city: string | null; state: string | null } | null;
};
type OccRow = { tenant_name: string | null; forwarding_address: string | null; move_out_date: string | null };
type LeaseRow = { deposit_cents: number | null };
type SettlementRow = { deposit_cents: number; notes: string | null; status: string };
type DeductionRow = { id: string; description: string; amount_cents: number };
type PhotoRow = { id: string; kind: string; path: string; caption: string | null };

const inputClass = "rounded-lg border border-clay-deep bg-white px-3 py-2 text-sm text-ink";

export default async function MoveOutDeposit({ params }: { params: Promise<{ unitId: string }> }) {
  const { profile } = await requireProfile("/admin/move-out");
  if (!isStaff(profile)) redirect("/portal");

  const { unitId } = await params;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const admin = createAdminClient() as unknown as SupabaseClient;

  const [{ data: unit }, { data: occ }, { data: lease }, { data: settlement }, { data: deductions }, { data: photoRows }] =
    await Promise.all([
      db.from("units").select("label, properties(name, address_line1, city, state)").eq("id", unitId).maybeSingle<UnitRow>(),
      db.from("unit_occupancy").select("tenant_name, forwarding_address, move_out_date").eq("unit_id", unitId).maybeSingle<OccRow>(),
      db.from("leases").select("deposit_cents").eq("unit_id", unitId).order("start_date", { ascending: false }).limit(1).maybeSingle<LeaseRow>(),
      db.from("deposit_settlements").select("deposit_cents, notes, status").eq("unit_id", unitId).maybeSingle<SettlementRow>(),
      db.from("deposit_deductions").select("id, description, amount_cents").eq("unit_id", unitId).order("created_at", { ascending: true }).returns<DeductionRow[]>(),
      admin.from("unit_photos").select("id, kind, path, caption").eq("unit_id", unitId).in("kind", ["move_in", "move_out"]).order("created_at", { ascending: true }).returns<PhotoRow[]>(),
    ]);

  if (!unit) redirect("/admin/delinquency");

  const signed = await Promise.all(
    (photoRows ?? []).map((p) => admin.storage.from(CONDITION_BUCKET).createSignedUrl(p.path, 3600))
  );
  const photos = (photoRows ?? []).map((p, i) => ({ ...p, url: signed[i]?.data?.signedUrl ?? "" }));
  const moveInPhotos = photos.filter((p) => p.kind === "move_in");
  const moveOutPhotos = photos.filter((p) => p.kind === "move_out");

  const depositCents = settlement?.deposit_cents ?? lease?.deposit_cents ?? 0;
  const items = deductions ?? [];
  const deductionsCents = items.reduce((s, d) => s + d.amount_cents, 0);
  const refundCents = depositCents - deductionsCents;

  const p = unit.properties;
  const premises = [p?.address_line1, unit.label, p?.city, p?.state].filter(Boolean).join(", ");
  const tenant = occ?.tenant_name ?? "—";
  const reportDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <main
      className="min-h-dvh bg-cream py-10 print:bg-white print:py-0"
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
    >
      <Container className="max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
          <Link href={`/admin/case-file/${unitId}`} className="text-sm font-medium text-pine hover:text-pine-dark">
            ← Case file
          </Link>
          <PrintButton label="Print disposition" />
        </div>

        {/* Photo comparison (screen only) */}
        <div className="mb-6 grid gap-6 rounded-2xl border border-clay bg-white p-6 sm:grid-cols-2 print:hidden">
          <PhotoColumn title="Move-in condition" photos={moveInPhotos} empty="No move-in photos on file." />
          <PhotoColumn title="Move-out condition" photos={moveOutPhotos} empty="No move-out photos yet." />
        </div>

        {/* Editing controls (screen only) */}
        <div className="mb-6 grid gap-4 rounded-2xl border border-clay bg-white p-6 sm:grid-cols-2 print:hidden">
          <form action={saveDepositSettlement} className="space-y-3">
            <input type="hidden" name="unit_id" value={unitId} />
            <div className="text-sm font-semibold text-ink">Deposit &amp; status</div>
            <label className="block space-y-1">
              <span className="text-xs text-ink-soft">Deposit held</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink-faint">$</span>
                <input name="deposit_dollars" type="number" step="0.01" min={0} defaultValue={(depositCents / 100).toFixed(2)} className={`${inputClass} w-full pl-6`} />
              </div>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-soft">Notes (shown on the statement)</span>
              <textarea name="notes" rows={2} defaultValue={settlement?.notes ?? ""} className={`${inputClass} w-full`} />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="status" value="finalized" defaultChecked={settlement?.status === "finalized"} className="h-4 w-4 rounded border-clay-deep accent-pine" />
              Mark finalized
            </label>
            <button type="submit" className="rounded-lg bg-pine px-3 py-2 text-sm font-medium text-cream hover:bg-pine-dark">Save</button>
          </form>

          <form action={addDeduction} className="space-y-3">
            <input type="hidden" name="unit_id" value={unitId} />
            <div className="text-sm font-semibold text-ink">Add a deduction</div>
            <input name="description" type="text" placeholder="e.g. Carpet cleaning, wall repair" className={`${inputClass} w-full`} required />
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink-faint">$</span>
              <input name="amount_dollars" type="number" step="0.01" min={0} placeholder="0.00" className={`${inputClass} w-full pl-6`} required />
            </div>
            <button type="submit" className="rounded-lg border border-clay-deep px-3 py-2 text-sm font-medium text-ink-soft hover:bg-sand">Add deduction</button>
            <p className="text-xs text-ink-faint">Compare the photos above — only charge for damage beyond normal wear.</p>
          </form>
        </div>

        {/* Printable disposition statement */}
        <div className="rounded-2xl border border-clay bg-white p-8 print:rounded-none print:border-0 print:p-0">
          <div className="mb-6 flex items-start justify-between border-b border-clay pb-5">
            <div>
              <div className="font-display text-2xl font-semibold text-pine">38th Ave Properties</div>
              <div className="text-sm text-ink-soft">W 38th Ave, Wheat Ridge, CO 80033</div>
            </div>
            <div className="text-right text-sm text-ink-soft">
              <div className="font-display text-lg font-semibold text-ink">Security Deposit Disposition</div>
              <div className="text-xs text-ink-faint">Prepared {reportDate}</div>
            </div>
          </div>

          <div className="mb-6 grid gap-px overflow-hidden rounded-xl border border-clay bg-clay sm:grid-cols-2">
            <Field label="Tenant" value={tenant} />
            <Field label="Premises" value={premises || `${p?.name ?? ""} · ${unit.label}`} />
            <Field label="Move-out date" value={occ?.move_out_date ? formatDate(occ.move_out_date) : "—"} />
            <Field label="Forwarding address" value={occ?.forwarding_address ?? "—"} />
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-clay text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="py-2 pr-3 font-medium">Item</th>
                <th className="py-2 text-right font-medium">Amount</th>
                <th className="w-8 print:hidden" />
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-clay/60">
                <td className="py-2 pr-3 font-medium text-ink">Security deposit held</td>
                <td className="py-2 text-right font-medium text-pine">{formatCents(depositCents)}</td>
                <td className="print:hidden" />
              </tr>
              {items.map((d) => (
                <tr key={d.id} className="border-b border-clay/60 break-inside-avoid">
                  <td className="py-2 pr-3 text-ink-soft">Less: {d.description}</td>
                  <td className="py-2 text-right text-terracotta-dark">− {formatCents(d.amount_cents)}</td>
                  <td className="py-2 text-right print:hidden">
                    <form action={deleteDeduction}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="unit_id" value={unitId} />
                      <button className="text-xs text-ink-faint hover:text-terracotta-dark" title="Remove">✕</button>
                    </form>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr className="border-b border-clay/60">
                  <td className="py-2 pr-3 text-ink-faint">No deductions — full deposit refunded.</td>
                  <td className="py-2 text-right text-ink-faint">$0.00</td>
                  <td className="print:hidden" />
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-clay font-semibold">
                <td className="py-2 pr-3 text-ink">Refund due to tenant</td>
                <td className={`py-2 text-right ${refundCents >= 0 ? "text-pine" : "text-terracotta-dark"}`}>
                  {formatCents(refundCents)}
                </td>
                <td className="print:hidden" />
              </tr>
            </tfoot>
          </table>

          {refundCents < 0 && (
            <p className="mt-3 text-sm text-terracotta-dark">
              Deductions exceed the deposit by {formatCents(-refundCents)} — the tenant may owe this balance.
            </p>
          )}

          {settlement?.notes && (
            <div className="mt-5 rounded-xl border border-clay bg-sand/30 px-4 py-3 text-sm text-ink-soft">
              {settlement.notes}
            </div>
          )}

          <p className="mt-6 text-xs text-ink-faint">
            Colorado requires the deposit, less any itemized deductions, to be returned to the tenant&apos;s
            forwarding address within 30 days of move-out (up to 60 days if the lease specifies). Deductions
            may cover unpaid rent and damage beyond normal wear and tear, not ordinary wear. This is a
            workflow aid, not legal advice — verify current law.
          </p>

          <div className="mt-8 max-w-xs">
            <div className="h-10 border-b border-ink" />
            <div className="mt-1 text-xs text-ink-faint">Landlord — 38th Ave Properties · Date</div>
          </div>
        </div>
      </Container>
    </main>
  );
}

function PhotoColumn({
  title,
  photos,
  empty,
}: {
  title: string;
  photos: { id: string; url: string; caption: string | null }[];
  empty: string;
}) {
  return (
    <div>
      <div className="mb-2 font-display text-sm font-semibold text-ink">{title}</div>
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-clay">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption ?? title} className="aspect-square w-full object-cover" />
              {p.caption && <div className="truncate bg-cream px-1.5 py-0.5 text-[11px] text-ink-soft">{p.caption}</div>}
            </a>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-faint">{empty}</p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-0.5 whitespace-pre-wrap font-medium text-ink">{value}</div>
    </div>
  );
}
