import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card, Eyebrow } from "@/components/ui";
import { PageHeader, StatCard, StatusPill } from "@/components/dashboard-ui";
import { TenantSearch } from "@/components/tenant-search";
import { loadSearchItems } from "@/lib/admin-search";
import { annivInfo } from "@/lib/anniversary";
import { formatDate, formatCents } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type RecentApp = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  created_at: string;
  properties: { name: string | null } | null;
};

type ConversationRow = {
  id: string;
  subject: string;
  resident_id: string;
  last_message_at: string;
  resident: { full_name: string | null } | null;
  messages: { sender_id: string; created_at: string }[];
};

type AnnivRow = {
  move_in_date: string | null;
  tenant_name: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
  profiles: { full_name: string | null } | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function AdminOverview() {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const today = new Date();

  const [
    searchItems,
    { count: unitCount },
    { data: units },
    { count: newApps },
    { data: recentApps },
    { data: openMaint },
    { data: properties },
    { data: conversations },
    { data: occ },
    { data: charges },
  ] = await Promise.all([
    loadSearchItems(),
    supabase.from("units").select("*", { count: "exact", head: true }),
    supabase.from("units").select("status"),
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("applications")
      .select("id, first_name, last_name, status, created_at, properties(name)")
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<RecentApp[]>(),
    supabase
      .from("maintenance_requests")
      .select("id, title, status, priority, created_at")
      .not("status", "in", "(completed,cancelled)")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("properties").select("id, name, slug"),
    supabase
      .from("conversations")
      .select(
        "id, subject, resident_id, last_message_at, resident:profiles!conversations_resident_id_fkey(full_name), messages(sender_id, created_at)"
      )
      .order("last_message_at", { ascending: false })
      .limit(50)
      .returns<ConversationRow[]>(),
    db
      .from("unit_occupancy")
      .select(
        "move_in_date, tenant_name, units(label, properties(name)), profiles:occupant_profile_id(full_name)"
      )
      .not("move_in_date", "is", null)
      .returns<AnnivRow[]>(),
    db
      .from("charges")
      .select("amount_cents, status")
      .in("status", ["open", "past_due"])
      .returns<{ amount_cents: number; status: string }[]>(),
  ]);

  const occupied = units?.filter((u) => u.status === "occupied").length ?? 0;
  const total = unitCount ?? 0;
  const occupancy = total ? Math.round((occupied / total) * 100) : 0;
  const openMaintCount = openMaint?.length ?? 0;

  // Conversations where the resident spoke last = awaiting our reply.
  const awaiting = (conversations ?? [])
    .map((c) => {
      const last = [...(c.messages ?? [])].sort(
        (a, b) => +new Date(a.created_at) - +new Date(b.created_at)
      ).pop();
      return { c, awaiting: !!last && last.sender_id === c.resident_id };
    })
    .filter((x) => x.awaiting)
    .map((x) => x.c);

  // Anniversaries this month (1+ years), soonest first.
  const anniversaries = (occ ?? [])
    .filter((o) => o.move_in_date)
    .map((o) => ({
      name: o.tenant_name ?? o.profiles?.full_name ?? "Resident",
      home: `${o.units?.properties?.name ?? "—"} · ${o.units?.label ?? "—"}`,
      ...annivInfo(o.move_in_date!, today),
    }))
    .filter((a) => a.isThisMonth && a.years >= 1)
    .sort((a, b) => a.day - b.day);

  const outstandingCents = (charges ?? []).reduce((s, c) => s + c.amount_cents, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Overview" subtitle="The whole portfolio at a glance." />

      <Card className="mb-8 p-5">
        <TenantSearch items={searchItems} limit={8} />
      </Card>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total homes" value={total} hint={`${properties?.length ?? 0} communities`} />
        <StatCard label="Occupancy" value={`${occupancy}%`} tone="pine" hint={`${occupied} occupied`} />
        <StatCard label="Open maintenance" value={openMaintCount} tone="terracotta" hint="Active requests" />
        <StatCard
          label="Awaiting reply"
          value={awaiting.length}
          tone="gold"
          hint={awaiting.length === 0 ? "Inbox clear" : "Residents waiting"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashCard title="Open maintenance" href="/admin/maintenance" linkLabel="View board">
          {openMaint && openMaint.length > 0 ? (
            <ul className="divide-y divide-clay">
              {openMaint.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{m.title}</div>
                    <div className="text-xs text-ink-faint">{formatDate(m.created_at)}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {m.priority !== "normal" && <StatusPill value={m.priority} />}
                    <StatusPill value={m.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing open — nice.</Empty>
          )}
        </DashCard>

        <DashCard title="Messages awaiting reply" href="/admin/messages" linkLabel="Open inbox">
          {awaiting.length > 0 ? (
            <ul className="divide-y divide-clay">
              {awaiting.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/messages/${c.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-sand/30"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">
                        {c.resident?.full_name ?? "Resident"}
                      </div>
                      <div className="truncate text-xs text-ink-faint">{c.subject}</div>
                    </div>
                    <span className="shrink-0 text-xs text-ink-faint">
                      {formatDate(c.last_message_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No one's waiting on a reply.</Empty>
          )}
        </DashCard>

        <DashCard
          title={`Anniversaries in ${MONTHS[today.getMonth()]}`}
          href="/admin/anniversaries"
          linkLabel="View all"
        >
          {anniversaries.length > 0 ? (
            <ul className="divide-y divide-clay">
              {anniversaries.slice(0, 5).map((a, i) => (
                <li key={i} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{a.name}</div>
                    <div className="text-xs text-ink-faint">{a.home}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-pine">
                      {a.years} yr{a.years === 1 ? "" : "s"}
                    </div>
                    <div className="text-xs text-ink-faint">
                      {MONTHS[today.getMonth()].slice(0, 3)} {a.day}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No anniversaries this month.</Empty>
          )}
        </DashCard>

        <DashCard title="Latest applications" href="/admin/applications" linkLabel="Review queue">
          {recentApps && recentApps.length > 0 ? (
            <ul className="divide-y divide-clay">
              {recentApps.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">
                      {a.first_name} {a.last_name}
                    </div>
                    <div className="text-xs text-ink-faint">
                      {a.properties?.name ?? "—"} · {formatDate(a.created_at)}
                    </div>
                  </div>
                  <StatusPill value={a.status} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No applications yet.</Empty>
          )}
        </DashCard>
      </div>

      {outstandingCents > 0 && (
        <Card className="mt-6 flex items-center justify-between gap-3 p-5">
          <div>
            <Eyebrow>Outstanding rent</Eyebrow>
            <div className="mt-1 font-display text-2xl font-semibold text-terracotta-dark">
              {formatCents(outstandingCents)}
            </div>
          </div>
          <Link
            href="/admin/delinquency"
            className="text-sm font-medium text-pine hover:text-pine-dark"
          >
            See who's behind →
          </Link>
        </Card>
      )}
    </div>
  );
}

function DashCard({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <Eyebrow>{title}</Eyebrow>
        <Link href={href} className="text-sm font-medium text-pine hover:text-pine-dark">
          {linkLabel}
        </Link>
      </div>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-ink-soft">{children}</p>;
}
