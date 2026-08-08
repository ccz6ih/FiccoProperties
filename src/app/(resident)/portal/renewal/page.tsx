import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { RenewalRespondForm, type PortalOffer } from "@/components/renewal-respond-form";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getResidentUnitId } from "@/lib/occupancy";

type OfferRow = {
  id: string;
  status: string;
  current_rent_cents: number;
  new_rent_cents: number;
  term_months: number;
  effective_date: string;
  new_end_date: string | null;
  accepted_at: string | null;
  signed_name: string | null;
  created_at: string;
};

export default async function PortalRenewalPage() {
  const { user, profile } = await requireProfile("/portal/renewal");
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const unitId = await getResidentUnitId(user.id);

  // RLS scopes this to the resident's own offers; filter to their unit anyway.
  let offers: OfferRow[] = [];
  if (unitId) {
    const { data } = await db
      .from("renewal_offers")
      .select(
        "id, status, current_rent_cents, new_rent_cents, term_months, effective_date, new_end_date, accepted_at, signed_name, created_at"
      )
      .eq("unit_id", unitId)
      .neq("status", "withdrawn")
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .returns<OfferRow[]>();
    offers = data ?? [];
  }

  const open = offers.find((o) => o.status === "sent") ?? null;
  const settled = offers.find((o) => o.status === "accepted" || o.status === "applied") ?? null;
  const declined = !open && !settled ? offers.find((o) => o.status === "declined") ?? null : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Lease renewal"
        subtitle="Review your renewal offer and respond in a couple of clicks."
      />

      {open ? (
        <RenewalRespondForm
          defaultName={profile?.full_name ?? ""}
          offer={
            {
              id: open.id,
              newRentCents: open.new_rent_cents,
              currentRentCents: open.current_rent_cents,
              termMonths: open.term_months,
              effectiveDate: formatDate(open.effective_date),
              endDate: open.new_end_date ? formatDate(open.new_end_date) : null,
            } satisfies PortalOffer
          }
        />
      ) : settled ? (
        <Card className="space-y-4 p-8 text-center">
          <div className="text-3xl">🏡</div>
          <h2 className="font-display text-2xl font-semibold text-ink">You&apos;re renewed!</h2>
          <p className="mx-auto max-w-md text-sm text-ink-soft">
            Your renewal at {formatCents(settled.new_rent_cents)}/month starts{" "}
            {formatDate(settled.effective_date)}
            {settled.new_end_date ? ` and runs through ${formatDate(settled.new_end_date)}` : " on a month-to-month basis"}.
            {settled.signed_name ? ` Signed by ${settled.signed_name}.` : ""}
          </p>
          <p className="text-xs text-ink-faint">
            Nothing changes before the start date. Questions? Message us anytime.
          </p>
        </Card>
      ) : declined ? (
        <Card className="space-y-3 p-8 text-center">
          <h2 className="font-display text-xl font-semibold text-ink">You chose not to renew</h2>
          <p className="mx-auto max-w-md text-sm text-ink-soft">
            We have your response on file. If anything changes — or you&apos;d like to talk through
            options — call (720) 527-2596 or message us from the portal. We&apos;d love to keep you.
          </p>
        </Card>
      ) : (
        <Card className="space-y-3 p-8 text-center">
          <h2 className="font-display text-xl font-semibold text-ink">No renewal offer right now</h2>
          <p className="mx-auto max-w-md text-sm text-ink-soft">
            When your lease is coming up for renewal, your offer will appear here and we&apos;ll email
            you a link. In the meantime, you can review your current lease anytime.
          </p>
          <Link href="/portal/lease" className="text-sm font-medium text-pine hover:text-pine-dark">
            View your lease →
          </Link>
        </Card>
      )}
    </div>
  );
}
