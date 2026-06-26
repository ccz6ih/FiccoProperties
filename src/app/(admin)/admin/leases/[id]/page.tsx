import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card, Button } from "@/components/ui";
import { PageHeader, StatusPill } from "@/components/dashboard-ui";
import { LeaseTimeline, type LeaseEvent } from "@/components/lease-timeline";
import { LeaseTermsEditor } from "@/components/lease-terms-editor";
import { ActionFeedbackButton } from "@/components/action-feedback-button";
import { formatCents, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  sendForSignature,
  endLease,
  terminateLease,
  setupTenancy,
  createProratedCharge,
} from "@/app/(admin)/admin/leases/actions";

type LeaseDetail = {
  id: string;
  rent_cents: number;
  deposit_cents: number;
  start_date: string;
  end_date: string | null;
  status: string;
  terms: string | null;
  signature_name: string | null;
  signature_ip: string | null;
  signed_at: string | null;
  units: {
    label: string;
    properties: {
      name: string | null;
      address_line1: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
    } | null;
  } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lease } = await supabase
    .from("leases")
    .select(
      "id, rent_cents, deposit_cents, start_date, end_date, status, terms, signature_name, signature_ip, signed_at, units(label, properties(name, address_line1, city, state, postal_code)), profiles(full_name, email)"
    )
    .eq("id", id)
    .maybeSingle<LeaseDetail>();

  if (!lease) notFound();

  // lease_events isn't in the generated types yet — use a loose handle.
  const db = supabase as unknown as SupabaseClient;
  const { data: events } = await db
    .from("lease_events")
    .select("id, type, note, created_at, actor_id, profiles(full_name)")
    .eq("lease_id", id)
    .order("created_at", { ascending: false })
    .returns<LeaseEvent[]>();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Lease"
        subtitle={`${lease.profiles?.full_name ?? "Resident"} · ${lease.units?.properties?.name ?? ""} ${lease.units?.label ?? ""}`}
        action={
          <Link href="/admin/leases" className="text-sm text-pine hover:underline">
            ← Back to leases
          </Link>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-clay bg-sand/50 px-6 py-4">
              <div className="font-display text-lg font-semibold text-ink">
                {lease.units?.properties?.name} · {lease.units?.label}
              </div>
              <StatusPill value={lease.status} />
            </div>
            <dl className="grid grid-cols-2 gap-px bg-clay">
              <Detail label="Resident" value={lease.profiles?.full_name ?? "—"} />
              <Detail label="Email" value={lease.profiles?.email ?? "—"} />
              <Detail label="Monthly rent" value={formatCents(lease.rent_cents)} />
              <Detail label="Deposit" value={formatCents(lease.deposit_cents)} />
              <Detail label="Start date" value={formatDate(lease.start_date)} />
              <Detail
                label="End date"
                value={lease.end_date ? formatDate(lease.end_date) : "—"}
              />
            </dl>
          </Card>

          <Card className="p-6">
            <h2 className="mb-3 font-display text-lg font-semibold text-ink">Terms</h2>
            {lease.status === "draft" ? (
              <LeaseTermsEditor
                leaseId={lease.id}
                initialTerms={lease.terms}
                regen={{
                  tenantName: lease.profiles?.full_name ?? null,
                  propertyName: lease.units?.properties?.name ?? null,
                  unitLabel: lease.units?.label ?? null,
                  rentDollars: String(lease.rent_cents / 100),
                  depositDollars: String(lease.deposit_cents / 100),
                  startDate: lease.start_date,
                  endDate: lease.end_date,
                  addressLine1: lease.units?.properties?.address_line1 ?? null,
                  city: lease.units?.properties?.city ?? null,
                  state: lease.units?.properties?.state ?? null,
                  postalCode: lease.units?.properties?.postal_code ?? null,
                }}
              />
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-xl border border-clay bg-cream px-4 py-3 text-sm leading-relaxed text-ink-soft whitespace-pre-wrap">
                {lease.terms?.trim() || "No terms have been added to this lease."}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="mb-3 font-display text-lg font-semibold text-ink">
              Signature record
            </h2>
            {lease.signed_at ? (
              <dl className="space-y-1.5 text-sm">
                <RecordRow label="Signed by" value={lease.signature_name ?? "—"} />
                <RecordRow label="Signed at" value={formatDate(lease.signed_at)} />
                <RecordRow label="IP address" value={lease.signature_ip ?? "—"} />
              </dl>
            ) : (
              <p className="text-sm text-ink-faint">Not yet signed.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 font-display text-lg font-semibold text-ink">Actions</h2>
            <div className="space-y-3">
              {lease.status === "draft" && (
                <ActionFeedbackButton
                  action={sendForSignature}
                  hidden={<input type="hidden" name="id" value={lease.id} />}
                  label="Send for signature"
                  successLabel="Sign link sent"
                  sendingLabel="Sending…"
                  variant="primary"
                />
              )}

              {lease.status === "pending_signature" && (
                <div className="space-y-2">
                  <p className="rounded-xl border border-clay bg-cream px-4 py-2.5 text-sm text-ink-soft">
                    Awaiting the resident&apos;s signature. We email them a sign link
                    each time you send.
                  </p>
                  <ActionFeedbackButton
                    action={sendForSignature}
                    hidden={<input type="hidden" name="id" value={lease.id} />}
                    label={`Resend sign link to ${lease.profiles?.email ?? "resident"}`}
                    successLabel="Sign link sent"
                    sendingLabel="Sending…"
                    variant="outline"
                  />
                </div>
              )}

              {lease.status === "active" && (
                <form action={endLease}>
                  <input type="hidden" name="id" value={lease.id} />
                  <Button type="submit" variant="outline" className="w-full">
                    End lease
                  </Button>
                </form>
              )}

              {(lease.status === "active" ||
                lease.status === "draft" ||
                lease.status === "pending_signature") && (
                <form action={terminateLease} className="space-y-2">
                  <input type="hidden" name="id" value={lease.id} />
                  <input
                    name="note"
                    placeholder="Reason (optional)"
                    className="w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30"
                  />
                  <Button type="submit" variant="accent" className="w-full">
                    Terminate lease
                  </Button>
                </form>
              )}

              {(lease.status === "ended" || lease.status === "terminated") && (
                <p className="rounded-xl border border-clay bg-cream px-4 py-2.5 text-sm text-ink-soft">
                  This lease is closed.
                </p>
              )}
            </div>
          </Card>

          {lease.status === "active" && (
            <Card className="p-6">
              <h2 className="mb-3 font-display text-lg font-semibold text-ink">
                Move-in &amp; keys
              </h2>
              <form className="space-y-3">
                <input type="hidden" name="id" value={lease.id} />
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-ink-soft">Move-in date</span>
                  <input
                    type="date"
                    name="move_in_date"
                    defaultValue={lease.start_date}
                    className="w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30"
                  />
                </label>
                <Button
                  type="submit"
                  formAction={setupTenancy}
                  variant="primary"
                  className="w-full"
                >
                  Save move-in &amp; set up tenancy
                </Button>
                <Button
                  type="submit"
                  formAction={createProratedCharge}
                  variant="outline"
                  className="w-full"
                >
                  Create prorated first-month charge
                </Button>
              </form>
              <p className="mt-3 text-xs text-ink-faint">
                &ldquo;Set up tenancy&rdquo; links this unit to the resident (their portal,
                statements, maintenance) and marks it occupied. Proration charges only the
                days from move-in through the end of that month.
              </p>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="mb-4 font-display text-lg font-semibold text-ink">Activity</h2>
            <LeaseTimeline events={events ?? []} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-cream px-6 py-4">
      <dt className="text-xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}

function RecordRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
