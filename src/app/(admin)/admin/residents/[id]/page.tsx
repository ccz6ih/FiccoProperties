import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { PageHeader, StatCard, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { ResidentContactEdit } from "@/components/resident-contact-edit";
import { ActionFeedbackButton } from "@/components/action-feedback-button";
import { ResidentDocsForm } from "@/components/resident-docs-form";
import {
  sendPortalLogin,
  deleteResidentDocument,
} from "@/app/(admin)/admin/residents/actions";
import { formatCents, formatDate, humanize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@/types/database";

type ResidentDocRow = {
  id: string;
  label: string | null;
  note: string | null;
  path: string | null;
  created_at: string;
  uploader: { full_name: string | null } | null;
};

type Profile = Tables<"profiles">;

/** Coverage status: no doc/expiry → missing; expiry past → expired; else active. */
function insuranceStatus(profile: Profile): "missing" | "expired" | "active" {
  if (!profile.insurance_doc_path && !profile.insurance_expires_on) return "missing";
  if (profile.insurance_expires_on) {
    const expires = new Date(`${profile.insurance_expires_on}T00:00:00`);
    if (!Number.isNaN(expires.getTime()) && expires.getTime() < Date.now()) {
      return "expired";
    }
  }
  return "active";
}

type OccupancyRow = {
  unit_id: string;
  rent_cents: number | null;
  tenant_name: string | null;
  tenant_email: string | null;
  tenant_phone: string | null;
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

type VehicleRow = {
  id: string;
  make: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  plate: string | null;
  state: string | null;
};

/** "2019 Honda Civic · Silver · CO ABC-123" */
function describeVehicle(v: VehicleRow): string {
  const head = [v.year, v.make, v.model].filter(Boolean).join(" ");
  const parts: string[] = [];
  if (head) parts.push(head);
  if (v.color) parts.push(v.color);
  const plate = [v.state, v.plate].filter(Boolean).join(" ");
  if (plate) parts.push(plate);
  return parts.join(" · ") || "Vehicle";
}

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
    { data: vehicles },
  ] = await Promise.all([
    supabase
      .from("unit_occupancy")
      .select(
        "unit_id, rent_cents, tenant_name, tenant_email, tenant_phone, lease_start_date, lease_signed_date, lease_end_date, move_in_date, units(label, properties(name, slug, address_line1, city, state))"
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
    supabase
      .from("vehicles")
      .select("id, make, model, color, year, plate, state")
      .eq("profile_id", id)
      .order("created_at", { ascending: true })
      .returns<VehicleRow[]>(),
  ]);

  const balanceCents = (ledger ?? []).reduce((sum, e) => sum + e.amount_cents, 0);
  const property = occupancy?.units?.properties ?? null;
  const rulesAckAt =
    (profile as unknown as { house_rules_ack_at: string | null })
      .house_rules_ack_at ?? null;

  // Move-in check-in progress (mirrors the resident's portal checklist).
  const pendingLease = (leases ?? []).find((l) => l.status === "pending_signature");
  const hasLease = (leases ?? []).length > 0;
  const checkin = [
    { label: "Lease signed", done: hasLease && !pendingLease },
    { label: "House rules acknowledged", done: !!rulesAckAt },
    { label: "Renters insurance", done: !!(profile.insurance_provider || profile.insurance_doc_path) },
    { label: "Emergency contact", done: !!(profile.emergency_contact_name || profile.emergency_contact_phone) },
    { label: "Phone on file", done: !!(profile.phone || occupancy?.tenant_phone) },
  ];
  const checkinDone = checkin.filter((s) => s.done).length;

  // Admin-only document vault (private bucket; staff read via signed URLs).
  const adminDb = createAdminClient();
  const { data: docRows } = await (adminDb as unknown as SupabaseClient)
    .from("resident_documents")
    .select("id, label, note, path, created_at, uploader:uploaded_by(full_name)")
    .eq("resident_id", id)
    .order("created_at", { ascending: false })
    .returns<ResidentDocRow[]>();
  const residentDocs = docRows ?? [];
  const docSigned = await Promise.all(
    residentDocs
      .filter((d) => d.path)
      .map((d) => adminDb.storage.from("resident-docs").createSignedUrl(d.path!, 3600))
  );
  const docUrl = new Map<string, string>();
  residentDocs
    .filter((d) => d.path)
    .forEach((d, i) => {
      const u = docSigned[i]?.data?.signedUrl;
      if (u) docUrl.set(d.id, u);
    });

  const insStatus = insuranceStatus(profile);
  let insuranceDocUrl: string | null = null;
  if (profile.insurance_doc_path) {
    const { data: signed } = await createAdminClient()
      .storage.from("insurance-docs")
      .createSignedUrl(profile.insurance_doc_path, 60);
    insuranceDocUrl = signed?.signedUrl ?? null;
  }

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

      {profile.role === "resident" && (
        <Card className="mb-8 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">Move-in check-in</h2>
            <span className={`text-sm font-medium ${checkinDone === checkin.length ? "text-pine" : "text-ink-soft"}`}>
              {checkinDone}/{checkin.length} done
            </span>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {checkin.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    s.done ? "bg-pine text-cream" : "border border-clay-deep text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className={s.done ? "text-ink-soft" : "text-ink"}>{s.label}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Admin-only files & notes */}
      <Card className="mb-8 p-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-ink">
            Files &amp; notes
            <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-[11px] font-medium text-ink-soft">
              Admin only
            </span>
          </h2>
          <ResidentDocsForm residentId={profile.id} />
        </div>
        <p className="mb-4 text-sm text-ink-soft">
          Private records — credit reports, screening, internal notes. The resident
          never sees these.
        </p>

        {residentDocs.length > 0 ? (
          <ul className="divide-y divide-clay">
            {residentDocs.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink">
                    {d.label ?? (d.path ? "Document" : "Note")}
                  </div>
                  {d.note && (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-soft">{d.note}</p>
                  )}
                  <div className="mt-0.5 text-xs text-ink-faint">
                    {[formatDate(d.created_at), d.uploader?.full_name].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {docUrl.has(d.id) && (
                    <a
                      href={docUrl.get(d.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-pine hover:underline"
                    >
                      View
                    </a>
                  )}
                  <form action={deleteResidentDocument}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="resident_id" value={profile.id} />
                    <button
                      type="submit"
                      className="text-xs text-ink-faint hover:text-terracotta-dark"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-faint">No files or notes yet.</p>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Person & contact */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-4 border-b border-clay bg-sand/50 px-6 py-4">
            <Avatar size="lg" name={profile.full_name} url={profile.avatar_url} />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-semibold text-ink">
                {profile.full_name ?? "Resident"}
              </h2>
              <p className="text-sm text-ink-soft">Person & contact</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {profile.role === "resident" && profile.email && (
                <ActionFeedbackButton
                  action={sendPortalLogin}
                  hidden={<input type="hidden" name="profile_id" value={profile.id} />}
                  label="Send login"
                  successLabel="Login sent"
                  sendingLabel="Sending…"
                  compact
                />
              )}
              <ResidentContactEdit
                resident={{
                  id: profile.id,
                  full_name: profile.full_name,
                  phone: profile.phone ?? occupancy?.tenant_phone ?? null,
                  emergency_contact_name: profile.emergency_contact_name,
                  emergency_contact_phone: profile.emergency_contact_phone,
                }}
              />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-px bg-clay">
            <Detail label="Full name" value={profile.full_name ?? "—"} />
            <Detail label="Role" value={<StatusPill value={profile.role} />} />
            <Detail label="Email" value={profile.email ?? "—"} />
            <Detail label="Phone" value={profile.phone ?? occupancy?.tenant_phone ?? "—"} />
            <Detail label="Joined" value={formatDate(profile.created_at)} />
            <Detail
              label="House rules"
              value={
                rulesAckAt ? (
                  <span className="text-pine">✓ {formatDate(rulesAckAt)}</span>
                ) : (
                  <span className="text-ink-soft">Not yet acknowledged</span>
                )
              }
            />
            {(profile.emergency_contact_name || profile.emergency_contact_phone) && (
              <Detail
                label="Emergency contact"
                value={
                  <>
                    {profile.emergency_contact_name ?? "—"}
                    {profile.emergency_contact_phone && (
                      <span className="block text-sm font-normal text-ink-soft">
                        {profile.emergency_contact_phone}
                      </span>
                    )}
                  </>
                }
              />
            )}
          </dl>
          <div className="border-t border-clay px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-wide text-ink-faint">
                Renters insurance
              </div>
              <InsurancePill status={insStatus} />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs text-ink-faint">Provider</dt>
                <dd className="text-sm font-medium text-ink">
                  {profile.insurance_provider ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Policy #</dt>
                <dd className="text-sm font-medium text-ink">
                  {profile.insurance_policy_number ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Expires</dt>
                <dd className="text-sm font-medium text-ink">
                  {formatDate(profile.insurance_expires_on)}
                </dd>
              </div>
              {insuranceDocUrl && (
                <div>
                  <dt className="text-xs text-ink-faint">Proof</dt>
                  <dd>
                    <a
                      href={insuranceDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-pine hover:underline"
                    >
                      View proof →
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
          {vehicles && vehicles.length > 0 && (
            <div className="border-t border-clay px-6 py-4">
              <div className="text-xs uppercase tracking-wide text-ink-faint">Vehicles</div>
              <ul className="mt-2 space-y-1">
                {vehicles.map((v) => (
                  <li key={v.id} className="text-sm text-ink">
                    {describeVehicle(v)}
                  </li>
                ))}
              </ul>
            </div>
          )}
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

function InsurancePill({ status }: { status: "missing" | "expired" | "active" }) {
  const cls = {
    active: "bg-pine-soft text-pine-dark",
    expired: "bg-terracotta-soft text-terracotta-dark",
    missing: "bg-sand text-ink-soft",
  }[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {humanize(status)}
    </span>
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
