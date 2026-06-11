import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, ButtonLink } from "@/components/ui";
import { PageHeader, StatusPill } from "@/components/dashboard-ui";
import { ApplicationStatusControl } from "@/components/application-status-control";
import { ScreeningRecordForm } from "@/components/screening-record-form";
import { formatCents, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database";

type ApplicationRow = Tables<"applications"> & {
  properties: { name: string | null } | null;
};

export default async function ApplicationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: application } = await supabase
    .from("applications")
    .select("*, properties(name)")
    .eq("id", id)
    .maybeSingle()
    .returns<ApplicationRow>();

  if (!application) notFound();

  // Mint a short-lived signed URL for the private ID photo, if present.
  let idPhotoUrl: string | null = null;
  if (application.id_photo_path) {
    const { data: signed } = await createAdminClient()
      .storage.from("application-docs")
      .createSignedUrl(application.id_photo_path, 60);
    idPhotoUrl = signed?.signedUrl ?? null;
  }

  const a = application;
  const fullName = `${a.first_name} ${a.last_name}`;
  const subject = encodeURIComponent("Your Ficco Properties application — background check");

  // Applicant history — other applications + tour requests from the same email.
  type HistoryRow = {
    id: string;
    status: string;
    created_at: string;
    properties: { name: string | null } | null;
  };
  const [{ data: priorApps }, { data: priorTours }] = await Promise.all([
    supabase
      .from("applications")
      .select("id, status, created_at, properties(name)")
      .eq("email", a.email)
      .neq("id", a.id)
      .order("created_at", { ascending: false })
      .returns<HistoryRow[]>(),
    supabase
      .from("tour_requests")
      .select("id, status, created_at, properties(name)")
      .eq("email", a.email)
      .order("created_at", { ascending: false })
      .returns<HistoryRow[]>(),
  ]);
  const otherApps = priorApps ?? [];
  const tours = priorTours ?? [];
  const hasHistory = otherApps.length > 0 || tours.length > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={fullName}
        subtitle={a.properties?.name ?? "No community selected"}
        action={
          <Link
            href="/admin/applications"
            className="text-sm font-medium text-pine hover:text-pine-dark"
          >
            ← Back to applications
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Contact</h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Item label="Email" value={a.email} />
              <Item label="Phone" value={a.phone} />
              <Item label="Date of birth" value={formatDate(a.date_of_birth)} />
              <Item label="Household size" value={a.household_size?.toString()} />
              <Item label="Desired move-in" value={formatDate(a.desired_move_in)} />
              <Item
                label="Monthly income"
                value={a.monthly_income_cents ? `${formatCents(a.monthly_income_cents)}/mo` : null}
              />
            </dl>
            {a.message && (
              <div className="space-y-1 border-t border-clay pt-4">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                  Notes
                </span>
                <p className="whitespace-pre-line text-sm text-ink-soft">{a.message}</p>
              </div>
            )}
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Current residence</h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Item label="Current address" value={a.current_address} wide />
              <Item label="Time at address" value={a.current_residency_length} />
              <Item label="Reason for moving" value={a.reason_for_moving} />
            </dl>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Employment</h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Item label="Employer" value={a.employer_name} />
              <Item label="Employer phone" value={a.employer_phone} />
            </dl>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Current landlord</h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Item label="Name" value={a.landlord_name} />
              <Item label="Phone" value={a.landlord_phone} />
              <Item label="Email" value={a.landlord_email} wide />
            </dl>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Authorizations</h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Item label="Signed by" value={a.signature_name} />
              <Item label="Signed on" value={formatDate(a.created_at)} />
              <Consent label="Pet policy acknowledged" value={a.pets_ack} />
              <Consent label="Screening authorized" value={a.authorize_screening} />
              <Consent
                label="Landlord / employer contact authorized"
                value={a.authorize_landlord_contact}
              />
            </dl>
          </Card>

          {a.id_photo_path && (
            <Card className="space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold text-ink">Photo ID</h2>
              {idPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={idPhotoUrl}
                  alt="Applicant photo ID"
                  className="max-h-96 w-full rounded-xl border border-clay object-contain"
                />
              ) : (
                <p className="text-sm text-ink-faint">
                  Unable to load the ID photo. Try refreshing.
                </p>
              )}
              <p className="text-xs text-ink-faint">
                Private document — this link expires in 60 seconds.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="h-fit space-y-5 p-6">
            <div className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                Application status
              </span>
              <div className="flex items-center gap-3">
                <ApplicationStatusControl id={a.id} status={a.status} />
                {a.status === "approved" && (
                  <Link
                    href={`/admin/leases/new?application=${a.id}`}
                    className="whitespace-nowrap text-xs font-medium text-pine hover:text-pine-dark"
                  >
                    Create lease →
                  </Link>
                )}
              </div>
            </div>
          </Card>

          <Card className="h-fit space-y-5 p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-ink">Screening</h2>
              <StatusPill value={a.screening_status} />
            </div>

            <ol className="space-y-1 text-xs text-ink-soft">
              <li>1. Open SmartMove → start a screening for this applicant.</li>
              <li>2. Email the applicant their invite link (they pay ~$40 + enter their SSN with TransUnion).</li>
              <li>3. When the report comes back, paste its link + your decision below and set the status.</li>
            </ol>

            <div className="flex flex-col gap-2">
              <ButtonLink
                href="https://www.mysmartmove.com/"
                target="_blank"
                rel="noopener noreferrer"
                size="md"
                variant="primary"
              >
                Open SmartMove
              </ButtonLink>
              <ButtonLink
                href={`mailto:${a.email}?subject=${subject}`}
                size="md"
                variant="outline"
              >
                Email applicant
              </ButtonLink>
            </div>

            {a.screening_requested_at && (
              <p className="text-xs text-ink-faint">
                Screening started {formatDate(a.screening_requested_at)}.
              </p>
            )}
            {a.screening_report_url && (
              <a
                href={a.screening_report_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm font-medium text-pine hover:text-pine-dark"
              >
                View saved report →
              </a>
            )}

            <div className="border-t border-clay pt-4">
              <ScreeningRecordForm
                id={a.id}
                status={a.screening_status}
                reportUrl={a.screening_report_url}
                notes={a.screening_notes}
              />
            </div>
          </Card>

          <Card className="h-fit space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold text-ink">
              Applicant history
            </h2>
            {hasHistory ? (
              <div className="space-y-4">
                {otherApps.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                      Other applications
                    </span>
                    <ul className="space-y-1.5">
                      {otherApps.map((h) => (
                        <li key={h.id}>
                          <Link
                            href={`/admin/applications/${h.id}`}
                            className="flex items-center justify-between gap-2 text-sm hover:text-pine"
                          >
                            <span className="text-ink-soft">
                              {h.properties?.name ?? "—"} · {formatDate(h.created_at)}
                            </span>
                            <StatusPill value={h.status} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tours.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                      Tour requests
                    </span>
                    <ul className="space-y-1.5">
                      {tours.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="text-ink-soft">
                            {t.properties?.name ?? "—"} · {formatDate(t.created_at)}
                          </span>
                          <StatusPill value={t.status} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-faint">
                No other activity from {a.email} — first-time applicant.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Item({
  label,
  value,
  wide,
}: {
  label: string;
  value?: string | null;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-1 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </dt>
      <dd className="text-sm text-ink">{value || "—"}</dd>
    </div>
  );
}

function Consent({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <StatusPill value={value ? "approved" : "pending"} />
      <span className="text-sm text-ink-soft">{label}</span>
    </div>
  );
}
