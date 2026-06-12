import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Card } from "@/components/ui";
import { StatusPill } from "@/components/dashboard-ui";
import { PrintButton } from "@/components/print-button";
import { NoticeStatusControl } from "@/components/notice-status-control";
import { setNoticeServed } from "@/app/(admin)/admin/notices/actions";
import { NOTICE_LABELS, type NoticeType } from "@/lib/notice-template";
import { formatCents, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type NoticeRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  amount_cents: number | null;
  cure_by: string | null;
  served_at: string | null;
  served_method: string | null;
  status: string;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
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
};

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

const SERVED_METHODS: Array<{ value: string; label: string }> = [
  { value: "posted", label: "Posted on door" },
  { value: "mailed", label: "Mailed" },
  { value: "hand", label: "Hand delivered" },
  { value: "email", label: "Email" },
  { value: "portal", label: "Resident portal" },
];

export default async function NoticeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: notice } = await supabase
    .from("notices")
    .select(
      "id, type, title, body, amount_cents, cure_by, served_at, served_method, status, created_at, profiles:resident_id(full_name, email), units(label, properties(name, address_line1, city, state, postal_code))"
    )
    .eq("id", id)
    .maybeSingle()
    .returns<NoticeRow>();

  if (!notice) notFound();

  const prop = notice.units?.properties;
  const homeLabel = prop?.name ? `${prop.name} · ${notice.units?.label}` : null;
  const address = [prop?.address_line1, prop?.city, prop?.state, prop?.postal_code]
    .filter(Boolean)
    .join(", ");

  const noticeDate = formatDate(notice.created_at);
  const typeLabel = NOTICE_LABELS[notice.type as NoticeType] ?? notice.type;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-dvh bg-cream py-10 print:bg-white print:py-0">
      <Container className="max-w-3xl">
        <div className="mb-5 flex items-center justify-between print:hidden">
          <Link
            href="/admin/notices"
            className="text-sm font-medium text-pine hover:text-pine-dark"
          >
            ← Back to notices
          </Link>
          <div className="flex items-center gap-3">
            <StatusPill value={notice.status} />
            <PrintButton />
          </div>
        </div>

        {/* Printable letter */}
        <div className="rounded-2xl border border-clay bg-white p-8 print:rounded-none print:border-0 print:p-0">
          <div className="mb-6 flex items-start justify-between border-b border-clay pb-5">
            <div>
              <div className="font-display text-2xl font-semibold text-pine">
                38th Ave Properties
              </div>
              <div className="text-sm text-ink-soft">
                W 38th Ave, Wheat Ridge, CO 80033
              </div>
            </div>
            <div className="text-right text-sm text-ink-soft">
              <div className="font-display text-lg font-semibold text-ink">
                {typeLabel}
              </div>
              <div>{noticeDate}</div>
            </div>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-faint">
                Recipient
              </div>
              <div className="font-medium text-ink">
                {notice.profiles?.full_name ?? "—"}
              </div>
              {notice.profiles?.email && (
                <div className="text-sm text-ink-soft">
                  {notice.profiles.email}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-faint">
                Home
              </div>
              <div className="font-medium text-ink">{homeLabel ?? "—"}</div>
              {address && <div className="text-sm text-ink-soft">{address}</div>}
            </div>
          </div>

          <h1 className="mb-3 font-display text-xl font-semibold text-ink">
            {notice.title}
          </h1>

          <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {notice.body}
          </div>

          {/* Signature lines */}
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            <div>
              <div className="border-t border-ink-faint pt-1 text-xs text-ink-faint">
                Landlord / agent signature
              </div>
            </div>
            <div>
              <div className="border-t border-ink-faint pt-1 text-xs text-ink-faint">
                Date
              </div>
            </div>
          </div>
        </div>

        {/* Service + status controls (not printed) */}
        <div className="mt-6 space-y-6 print:hidden">
          <Card className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold text-ink">
              Record service
            </h2>
            {notice.served_at ? (
              <p className="text-sm text-ink-soft">
                Served {formatDate(notice.served_at)}
                {notice.served_method ? ` · ${notice.served_method}` : ""}. You
                can re-record below to correct it.
              </p>
            ) : (
              <p className="text-sm text-ink-soft">
                Mark when and how this notice was delivered. This sets the status
                to “served”.
              </p>
            )}
            <form action={setNoticeServed} className="grid gap-4 sm:grid-cols-3">
              <input type="hidden" name="id" value={notice.id} />
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Served date</span>
                <input
                  type="date"
                  name="served_at"
                  required
                  defaultValue={notice.served_at ?? today}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Method</span>
                <select
                  name="served_method"
                  required
                  defaultValue={notice.served_method ?? "posted"}
                  className={inputClass}
                >
                  {SERVED_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="inline-flex h-10 items-center rounded-full bg-pine px-5 text-sm font-medium text-cream transition-colors hover:bg-pine-dark"
                >
                  Record service
                </button>
              </div>
            </form>
          </Card>

          <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold text-ink">
                Status
              </h2>
              {notice.amount_cents != null && (
                <p className="text-sm text-ink-soft">
                  Amount: {formatCents(notice.amount_cents)}
                  {notice.cure_by
                    ? ` · cure by ${formatDate(notice.cure_by)}`
                    : ""}
                </p>
              )}
            </div>
            <NoticeStatusControl id={notice.id} status={notice.status} />
          </Card>

          <p className="text-xs text-ink-faint">
            Not legal advice — for an eviction filing use Colorado JDF forms /
            your attorney.
          </p>
        </div>
      </Container>
    </main>
  );
}
