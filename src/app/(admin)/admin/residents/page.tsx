import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { PageHeader, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  role: string;
  avatar_url: string | null;
  house_rules_ack_at: string | null;
};

type OccRow = {
  unit_id: string;
  occupant_profile_id: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  tenant_phone: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

type Row = {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  home: string | null;
  href: string;
  linked: boolean;
  role: string | null;
  isResident: boolean;
  ackAt: string | null;
};

export default async function AdminResidents({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: profiles }, { data: occ }] = await Promise.all([
    db
      .from("profiles")
      .select("id, full_name, email, phone, created_at, role, avatar_url, house_rules_ack_at")
      .order("created_at", { ascending: false })
      .returns<ProfileRow[]>(),
    db
      .from("unit_occupancy")
      .select(
        "unit_id, occupant_profile_id, tenant_name, tenant_email, tenant_phone, units(label, properties(name))"
      )
      .returns<OccRow[]>(),
  ]);

  const homeByProfile = new Map<string, string>();
  const recordOnly: OccRow[] = [];
  for (const o of occ ?? []) {
    const home = `${o.units?.properties?.name ?? "—"} · ${o.units?.label ?? "—"}`;
    if (o.occupant_profile_id) homeByProfile.set(o.occupant_profile_id, home);
    else if (o.tenant_name || o.tenant_email) recordOnly.push(o);
  }

  const accountRows: Row[] = (profiles ?? []).map((p) => ({
    key: `p-${p.id}`,
    name: p.full_name ?? p.email ?? "—",
    email: p.email,
    phone: p.phone,
    home: homeByProfile.get(p.id) ?? null,
    href: `/admin/residents/${p.id}`,
    linked: true,
    role: p.role,
    isResident: p.role === "resident",
    ackAt: p.house_rules_ack_at,
  }));

  const recordRows: Row[] = recordOnly.map((o) => ({
    key: `o-${o.unit_id}`,
    name: o.tenant_name ?? o.tenant_email ?? "—",
    email: o.tenant_email,
    phone: o.tenant_phone,
    home: `${o.units?.properties?.name ?? "—"} · ${o.units?.label ?? "—"}`,
    href: `/admin/units/${o.unit_id}`,
    linked: false,
    role: null,
    isResident: false,
    ackAt: null,
  }));

  const all = [...accountRows, ...recordRows].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Residents (portal accounts) who haven't acknowledged the house rules.
  const pendingCount = all.filter((r) => r.isResident && !r.ackAt).length;
  // Resident accounts that didn't attach to a unit (signed up but unlinked).
  const noHomeCount = all.filter((r) => r.isResident && r.linked && !r.home).length;
  const pendingView = show === "rules-pending";
  const needsHomeView = show === "needs-home";
  const rows = pendingView
    ? all.filter((r) => r.isResident && !r.ackAt)
    : needsHomeView
      ? all.filter((r) => r.isResident && r.linked && !r.home)
      : all;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Residents & staff"
        subtitle="Everyone on file — with or without a portal account."
      />

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Filter active={!pendingView && !needsHomeView} href="/admin/residents" label={`Everyone (${all.length})`} />
        {noHomeCount > 0 && (
          <Filter
            active={needsHomeView}
            href="/admin/residents?show=needs-home"
            label={`⚠ No home linked (${noHomeCount})`}
          />
        )}
        <Filter
          active={pendingView}
          href="/admin/residents?show=rules-pending"
          label={`House rules pending (${pendingCount})`}
        />
      </div>

      {rows.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Home</th>
                  <th className="px-5 py-3 font-medium">House rules</th>
                  <th className="px-5 py-3 font-medium">Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {rows.map((r) => (
                  <tr key={r.key} className="hover:bg-sand/30">
                    <td className="px-5 py-3 font-medium text-ink">
                      <div className="flex items-center gap-3">
                        <Avatar size="sm" name={r.name} />
                        <Link href={r.href} className="text-pine hover:underline">
                          {r.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{r.email ?? "—"}</td>
                    <td className="px-5 py-3 text-ink-soft">
                      {r.home ? (
                        r.home
                      ) : r.isResident && r.linked ? (
                        <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-medium text-ink">
                          ⚠ No home
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {!r.isResident ? (
                        <span className="text-ink-faint">—</span>
                      ) : r.ackAt ? (
                        <span className="text-xs font-medium text-pine">
                          ✓ {formatDate(r.ackAt)}
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-medium text-ink">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {r.linked ? (
                        <StatusPill value={r.role ?? "resident"} />
                      ) : (
                        <span className="inline-block rounded-full bg-sand px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                          Records only
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title={
            pendingView
              ? "Everyone's acknowledged 🎉"
              : needsHomeView
                ? "Every account is linked to a home 🎉"
                : "No one on file yet"
          }
          body={
            pendingView
              ? "Every resident with a portal account has acknowledged the house rules."
              : needsHomeView
                ? "No accounts are missing a home — all good."
                : "Tenants and staff will appear here as you add them."
          }
        />
      )}
    </div>
  );
}

function Filter({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 font-medium ${
        active ? "bg-pine text-cream" : "text-ink-soft hover:bg-sand"
      }`}
    >
      {label}
    </Link>
  );
}
