import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { PageHeader, StatCard, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { formatCents, formatDate, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type Profile = Tables<"profiles">;

type OccupancyRow = {
  unit_id: string;
  rent_cents: number | null;
  lease_start_date: string | null;
  lease_signed_date: string | null;
  lease_end_date: string | null;
  move_in_date: string | null;
  units: {
    label: string;
    properties: {
      name: string;
      slug: string;
      address_line1: string | null;
      city: string | null;
      state: string | null;
    } | null;
  } | null;
};

type MaintenanceRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
};

type ConversationRow = {
  id: string;
  subject: string;
  last_message_at: string;
};

type ChargeRow = {
  id: string;
  amount_cents: number;
  status: string;
  description: string | null;
  due_date: string | null;
};

type LedgerRow = { amount_cents: number };

type LeaseRow = {
  id: string;
  status: string;
  signed_at: string | null;
};

/** Compute tenure from a start date to today as e.g. "1 yr 3 mo". */
function tenureLabel(startIso: string | null): string {
  if (!startIso) return "—";
  const start = new Date(startIso);
  const now = new Date();
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yr${years === 1 ? "" : "s"}`);
  parts.push(`${rem} mo`);
  return parts.join(" ");
}

export default async function ResidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle<Profile>();

  if (!profile) notFound();

  const [
    { data: occupancy },
    { data: maintenance },
    { data: conversations },
    { data: charges },
    { data: ledger },
    { data: leases },
  ] = await Promise.all([
    supabase
      .from("unit_occupancy")
      .select(
        "unit_id, rent_cents, lease_start_date, lease_signed_date, lease_end_date, move_in_date, units(label, properties(name, slug, address_line1, city, state))"
      )
      .eq("occupant_profile_id", id)
      .maybeSingle<OccupancyRow>(),
    supabase
      .from("maintenance_requests")
      .select("id, title, status, priority, created_at")
      .eq("created_by", id)
      .order("created_at", { ascending: false })
      .returns<MaintenanceRow[]>(),
    supabase
      .from("conversations")
      .select("id, subject, last_message_at")
      .eq("resident_id", id)
      .order("last_message_at", { ascending: false })
      .returns<ConversationRow[]>(),
    supabase
      .from("charges")
      .select("id, amount_cents, status, description, due_date")
      .eq("resident_id", id)
      .neq("status", "paid")
      .neq("status", "void")
      .order("due_date", { ascending: true })
      .returns<ChargeRow[]>(),
    supabase
      .from("ledger_entries")
      .select("amount_cents")
      .eq("resident_id", id)
      .returns<LedgerRow[]>(),
    supabase
      .from("leases")
      .select("id, status, signed_at")
      .eq("resident_id", id)
      .order("start_date", { ascending: false })
      .returns<LeaseRow[]>(),
  ]);

  const balanceCents = (ledger ?? []).reduce((sum, e) => sum + e.amount_cents, 0);
  const property = occupancy?.units?.properties ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={profile.full_name ?? "Resident"}
        subtitle={profile.email ?? undefined}
        action={
          <Link href="/admin/residents" className="text-sm text-pine hover:underline">
            ← Back to residents
          </Link>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Home"
          value={occupancy?.units?.label ?? "—"}
          hint={property?.name ?? "Not linked to a unit"}
        />
        <StatCard
          label="Monthly rent"
          value={occupancy?.rent_cents != null ? formatCents(occupancy.rent_cents) : "—"}
          tone="terracotta"
          hint={occupancy ? `Tenure: ${tenureLabel(occupancy.lease_start_date)}` : undefined}
        />
        <StatCard
          label="Balance"
          value={formatCents(balanceCents)}
          tone={balanceCents > 0 ? "gold" : "pine"}
          hint={balanceCents > 0 ? "Owed" : "Up to date"}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Person & contact */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-4 border-b border-clay bg-sand/50 px-6 py-4">
            <Avatar size="lg" name={profile.full_name} url={profile.avatar_url} />
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">
                {profile.full_name ?? "Resident"}
              </h2>
              <p className="text-sm text-ink-soft">Person & contact</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-px bg-clay">
            <Detail label="Full name" value={profile.full_name ?? "—"} />
            <Detail label="Role" value={<StatusPill value={profile.role} />} />
            <Detail label="Email" value={profile.email ?? "—"} />
            <Detail label="Phone" value={profile.phone ?? "—"} />
            <Detail label="Joined" value={formatDate(profile.created_at)} />
          </dl>
        </Card>

        {/* Home */}
        <Card className="overflow-hidden">
          <div className="border-b border-clay bg-sand/50 px-6 py-4">
            <h2 className="font-display text-lg font-semibold text-ink">Home</h2>
          </div>
          {occupancy ? (
            <>
              <div className="flex items-start justify-between gap-4 px-6 py-4">
                <div>
                  <div className="font-display text-lg font-semibold text-ink">
                    {property?.name ?? "—"} · {occupancy.units?.label ?? "—"}
                  </div>
                  {property && (
                    <div className="text-sm text-ink-soft">
                      {property.address_line1}
                      {property.city ? `, ${property.city}` : ""} {property.state ?? ""}
                    </div>
                  )}
                </div>
                {property?.slug && (
                  <Link
                    href={`/admin/properties/${property.slug}`}
                    className="shrink-0 text-sm text-pine hover:underline"
                  >
                    View property →
                  </Link>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-px border-t border-clay bg-clay">
                <Detail
                  label="Monthly rent"
                  value={occupancy.rent_cents != null ? formatCents(occupancy.rent_cents) : "—"}
                />
                <Detail label="Tenure" value={tenureLabel(occupancy.lease_start_date)} />
                <Detail label="Lease signed" value={formatDate(occupancy.lease_signed_date)} />
                <Detail label="Move-in" value={formatDate(occupancy.move_in_date)} />
                <Detail label="Lease start" value={formatDate(occupancy.lease_start_date)} />
                <Detail label="Lease end" value={formatDate(occupancy.lease_end_date)} />
              </dl>
            </>
          ) : (
            <div className="p-6">
              <EmptyState
                title="Not linked to a unit yet"
                body="This resident isn't assigned to a unit. Link them through unit occupancy to tie their portal, maintenance, and rent to a home."
              />
            </div>
          )}
        </Card>

        {/* Maintenance history */}
        <Card className="overflow-hidden">
          <div className="border-b border-clay bg-sand/50 px-6 py-4">
            <h2 className="font-display text-lg font-semibold text-ink">Maintenance history</h2>
          </div>
          {maintenance && maintenance.length > 0 ? (
            <ul className="divide-y divide-clay">
              {maintenance.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div>
                    <div className="text-sm font-medium text-ink">{m.title}</div>
                    <div className="text-xs text-ink-faint">
                      {formatDate(m.created_at)} · {humanize(m.priority)}
                    </div>
                  </div>
                  <StatusPill value={m.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-6 text-sm text-ink-soft">No maintenance requests.</p>
          )}
        </Card>

        {/* Messages */}
        <Card className="overflow-hidden">
          <div className="border-b border-clay bg-sand/50 px-6 py-4">
            <h2 className="font-display text-lg font-semibold text-ink">Messages</h2>
          </div>
          {conversations && conversations.length > 0 ? (
            <ul className="divide-y divide-clay">
              {conversations.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div className="text-sm font-medium text-ink">
                    {c.subject || "Conversation"}
                  </div>
                  <div className="text-xs text-ink-faint">{formatDate(c.last_message_at)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-6 text-sm text-ink-soft">No conversations.</p>
          )}
        </Card>

        {/* Payments */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-clay bg-sand/50 px-6 py-4">
            <h2 className="font-display text-lg font-semibold text-ink">Payments</h2>
            <span className="text-sm text-ink-soft">
              Balance:{" "}
              <span className={balanceCents > 0 ? "font-medium text-terracotta-dark" : "font-medium text-pine-dark"}>
                {formatCents(balanceCents)}
              </span>
            </span>
          </div>
          {charges && charges.length > 0 ? (
            <ul className="divide-y divide-clay">
              {charges.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {c.description || "Charge"}
                    </div>
                    <div className="text-xs text-ink-faint">
                      {c.due_date ? `Due ${formatDate(c.due_date)}` : "No due date"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-ink">
                      {formatCents(c.amount_cents)}
                    </span>
                    <StatusPill value={c.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-6 text-sm text-ink-soft">No open charges.</p>
          )}
        </Card>

        {/* Leases */}
        {leases && leases.length > 0 && (
          <Card className="overflow-hidden">
            <div className="border-b border-clay bg-sand/50 px-6 py-4">
              <h2 className="font-display text-lg font-semibold text-ink">Leases</h2>
            </div>
            <ul className="divide-y divide-clay">
              {leases.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <Link href={`/admin/leases/${l.id}`} className="text-sm font-medium text-pine hover:underline">
                    {l.signed_at ? `Signed ${formatDate(l.signed_at)}` : "Not yet signed"}
                  </Link>
                  <StatusPill value={l.status} />
                </li>
              ))}
            </ul>
          </Card>
        )}
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
