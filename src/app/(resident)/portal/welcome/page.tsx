import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card, ButtonLink } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { PaymentPreferenceForm, MoveInDateForm } from "@/components/welcome-forms";
import { WelcomeOverview, type WelcomeFact } from "@/components/welcome-overview";
import { MoveInDue } from "@/components/move-in-due";
import { prorateFirstMonth, moveInTotal } from "@/lib/prorate";
import { formatCents, formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResidentUnitId } from "@/lib/occupancy";
import { RENT_DROPBOX } from "@/lib/rent-dropbox";

export const metadata: Metadata = { title: "Welcome home" };
export const dynamic = "force-dynamic";

type OccRow = {
  unit_id: string | null;
  tenant_name: string | null;
  rent_cents: number | null;
  deposit_cents: number | null;
  move_in_date: string | null;
  move_in_confirmed_at: string | null;
  payment_preference: string | null;
  units: {
    label: string;
    bedrooms: number | null;
    bathrooms: number | null;
    property_id: string | null;
    properties: {
      name: string | null;
      slug: string | null;
      type: string | null;
      address_line1: string | null;
      city: string | null;
    } | null;
  } | null;
};

type LeaseRow = { id: string; status: string | null; signed_at: string | null };

const PREFERENCE_LABEL: Record<string, string> = {
  money_order: `Money order, payable to ${RENT_DROPBOX.payee}`,
  check: `Check, payable to ${RENT_DROPBOX.payee}`,
  online: "Online from the portal",
};

/**
 * One step of the welcome. A finished step collapses to its answer so the page
 * shortens as they work through it, rather than staying the same length and
 * leaving them to work out what's left.
 */
function Step({
  n,
  title,
  blurb,
  done,
  answer,
  children,
}: {
  n: number;
  title: string;
  blurb?: string;
  done: boolean;
  answer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-start gap-4 px-6 py-5">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${
            done ? "bg-pine text-cream" : "bg-sand text-ink-soft"
          }`}
          aria-hidden
        >
          {done ? "✓" : n}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
          {done && answer ? (
            <div className="mt-1 text-base text-ink-soft">{answer}</div>
          ) : (
            blurb && <p className="mt-1 text-base text-ink-soft">{blurb}</p>
          )}
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </Card>
  );
}

export default async function Welcome() {
  const { user, profile } = await requireProfile("/portal/welcome");
  const admin = createAdminClient() as unknown as SupabaseClient;

  const unitId = await getResidentUnitId(user.id);
  if (!unitId) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Welcome" subtitle="Getting your home set up." />
        <EmptyState
          title="No home on file yet"
          body="Once your home is assigned, your welcome steps will appear here. Give us a call if you were expecting this to be ready."
        />
      </div>
    );
  }

  const [{ data: occ }, { data: leases }, { data: app }] = await Promise.all([
    admin
      .from("unit_occupancy")
      .select(
        "unit_id, tenant_name, rent_cents, deposit_cents, move_in_date, move_in_confirmed_at, payment_preference, units:unit_id(label, bedrooms, bathrooms, property_id, properties(name, slug, type, address_line1, city))"
      )
      .eq("unit_id", unitId)
      .maybeSingle<OccRow>(),
    admin
      .from("leases")
      .select("id, status, signed_at")
      .eq("resident_id", user.id)
      .order("start_date", { ascending: false })
      .limit(1)
      .returns<LeaseRow[]>(),
    // Their own application, for the move-in date they first told us.
    admin
      .from("applications")
      .select("desired_move_in")
      .ilike("email", user.email ?? "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ desired_move_in: string | null }>(),
  ]);

  // The community's own orientation content, fetched on its own so a missing
  // column can never take the whole page down with it.
  let welcomeNote: string | null = null;
  let welcomeFacts: WelcomeFact[] = [];
  if (occ?.units?.property_id) {
    const { data: prop } = await admin
      .from("properties")
      .select("welcome_note, welcome_facts")
      .eq("id", occ.units.property_id)
      .maybeSingle<{ welcome_note: string | null; welcome_facts: WelcomeFact[] | null }>();
    welcomeNote = prop?.welcome_note ?? null;
    welcomeFacts = Array.isArray(prop?.welcome_facts)
      ? prop.welcome_facts.filter((f) => f?.label && f?.value)
      : [];
  }

  // What's owed before the keys, and what of it has landed. Its own queries so
  // the welcome never breaks over the money block.
  const moveInIso = occ?.move_in_confirmed_at ? occ.move_in_date : null;
  const proration =
    moveInIso && occ?.rent_cents ? prorateFirstMonth(moveInIso, occ.rent_cents) : null;
  const due = moveInTotal(proration, occ?.rent_cents ?? null, occ?.deposit_cents ?? null);

  let rentPaidCents = 0;
  let depositReceivedCents = 0;
  let depositReceivedOn: string | null = null;
  if (moveInIso && proration) {
    const { data: charge } = await admin
      .from("charges")
      .select("id")
      .eq("unit_id", unitId)
      .eq("period", proration.period)
      .neq("status", "void")
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (charge) {
      const { data: paid } = await admin
        .from("payments")
        .select("amount_cents")
        .eq("charge_id", charge.id)
        .eq("status", "succeeded")
        .returns<{ amount_cents: number }[]>();
      rentPaidCents = (paid ?? []).reduce((s, p) => s + p.amount_cents, 0);
    }

    const { data: dep } = await admin
      .from("unit_occupancy")
      .select("deposit_received_cents, deposit_received_on")
      .eq("unit_id", unitId)
      .maybeSingle<{ deposit_received_cents: number | null; deposit_received_on: string | null }>();
    depositReceivedCents = dep?.deposit_received_cents ?? 0;
    depositReceivedOn = dep?.deposit_received_on ?? null;
  }
  const settledCents = rentPaidCents + depositReceivedCents;
  const moneySettled = due.totalCents > 0 && settledCents >= due.totalCents;

  const lease = leases?.[0] ?? null;
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const home = occ?.units
    ? `${occ.units.properties?.name ?? ""}${occ.units.properties?.name ? " · " : ""}${occ.units.label}`
    : null;

  const paidBy = occ?.payment_preference ?? null;
  const moveIn = occ?.move_in_confirmed_at ? occ.move_in_date : null;
  const leaseSigned = Boolean(lease?.signed_at);
  const steps = [Boolean(paidBy), Boolean(moveIn), moneySettled, leaseSigned];
  const doneCount = steps.filter(Boolean).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Welcome home, ${firstName}`}
        subtitle={
          doneCount === 4
            ? "You're all set. Everything about your home lives in this portal."
            : "A few quick things, and the keys are yours."
        }
      />

      {/* Where they're moving, stated plainly. It's the thing they most want to
          see confirmed, and it should be the first thing on the page. */}
      <Card className="mb-5 overflow-hidden p-0">
        <div className="bg-pine px-6 py-5 text-cream">
          <div className="text-[11px] uppercase tracking-wide text-cream/70">Your new home</div>
          <div className="font-display text-2xl font-semibold">{home ?? "Your home"}</div>
          {occ?.units?.properties?.address_line1 && (
            <div className="mt-0.5 text-sm text-cream/80">
              {occ.units.properties.address_line1}
              {occ.units.properties.city ? `, ${occ.units.properties.city}` : ""}
            </div>
          )}
        </div>
        <div className="grid gap-4 px-6 py-4 sm:grid-cols-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">Rent</div>
            <div className="text-lg font-semibold text-ink">
              {occ?.rent_cents ? `${formatCents(occ.rent_cents)} / mo` : "—"}
            </div>
            <div className="text-xs text-ink-faint">due the 1st</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">Deposit</div>
            <div className="text-lg font-semibold text-ink">
              {occ?.deposit_cents ? formatCents(occ.deposit_cents) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">Home</div>
            <div className="text-lg font-semibold text-ink">
              {occ?.units?.bedrooms ?? "—"} bed · {occ?.units?.bathrooms ?? "—"} bath
            </div>
          </div>
        </div>
      </Card>

      <div className="mb-5 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
          <div
            className="h-full rounded-full bg-pine transition-all"
            style={{ width: `${(doneCount / 4) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-medium text-ink-soft">{doneCount} of 4</span>
      </div>

      <div className="space-y-4">
        <Step
          n={1}
          title="How would you like to pay rent?"
          blurb="However suits you. You can change it later."
          done={Boolean(paidBy)}
          answer={paidBy ? PREFERENCE_LABEL[paidBy] : null}
        >
          <PaymentPreferenceForm chosen={paidBy} />
        </Step>

        <Step
          n={2}
          title="When do you plan to move in?"
          blurb="So we have the keys cut and the home open for you."
          done={Boolean(moveIn)}
          answer={moveIn ? `Moving in ${formatDate(moveIn)}` : null}
        >
          <MoveInDateForm current={moveIn} suggested={app?.desired_move_in ?? null} />
        </Step>

        <Step
          n={3}
          title="Your first payment"
          blurb={
            moveIn
              ? "What to bring when you come to sign. No surprises on the day."
              : "Pick your move-in day above and we'll work out exactly what's due."
          }
          done={moneySettled}
          answer={
            moneySettled
              ? `${formatCents(settledCents)} received — thank you${
                  depositReceivedOn ? `, ${formatDate(depositReceivedOn)}` : ""
                }`
              : null
          }
        >
          {moveIn && due.totalCents > 0 && (
            <MoveInDue
              proration={proration}
              rentCents={due.rentCents}
              depositCents={due.depositCents}
              totalCents={due.totalCents}
              rentPaidCents={rentPaidCents}
              depositReceivedCents={depositReceivedCents}
              monthlyRentCents={occ?.rent_cents ?? null}
            />
          )}
        </Step>

        <Step
          n={4}
          title="Review and sign your lease"
          blurb={
            lease
              ? "Read it through, then add your signature. Take your time — ask us anything first."
              : "We're drawing it up now. You'll get an email the moment it's ready to sign."
          }
          done={leaseSigned}
          answer={lease?.signed_at ? `Signed ${formatDate(lease.signed_at)} — thank you` : null}
        >
          {lease && !leaseSigned && (
            <ButtonLink href="/portal/lease" variant="primary">
              Open my lease →
            </ButtonLink>
          )}
        </Step>
      </div>

      <div className="mt-8">
        <WelcomeOverview
          propertyName={occ?.units?.properties?.name ?? null}
          propertySlug={occ?.units?.properties?.slug ?? null}
          propertyType={occ?.units?.properties?.type ?? null}
          bedrooms={occ?.units?.bedrooms ?? null}
          bathrooms={occ?.units?.bathrooms ?? null}
          welcomeNote={welcomeNote}
          facts={welcomeFacts}
        />
      </div>

      {doneCount === 4 ? (
        <Card className="mt-5 border-pine/30 bg-pine/5 p-6">
          <h2 className="font-display text-xl font-semibold text-ink">That&apos;s everything 🎉</h2>
          <p className="mt-1 text-base text-ink-soft">
            Welcome to the community. From here you can request maintenance, see your rent
            history, read the house rules and message us — all from the menu.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href="/portal" variant="primary">
              Go to my home
            </ButtonLink>
            <ButtonLink href="/portal/guide" variant="outline">
              Read the house rules
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <Card className="mt-5 p-6">
          <h2 className="font-display text-lg font-semibold text-ink">Questions? Just ask.</h2>
          <p className="mt-1 text-base text-ink-soft">
            Call us on <strong className="text-ink">{RENT_DROPBOX.phone}</strong>, or{" "}
            <Link href="/portal/messages" className="font-medium text-pine hover:underline">
              send a message
            </Link>{" "}
            and we&apos;ll come back to you. Nothing here is a hurry — we&apos;d rather you
            understood it.
          </p>
        </Card>
      )}
    </div>
  );
}
