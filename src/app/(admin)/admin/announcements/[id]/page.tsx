import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { PrintButton } from "@/components/print-button";
import { createClient } from "@/lib/supabase/server";

type Ann = {
  id: string;
  title: string;
  body: string;
  property_ids: string[] | null;
  expires_on: string | null;
  created_at: string;
};

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default async function AnnouncementDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: ann } = await db
    .from("announcements")
    .select("id, title, body, property_ids, expires_on, created_at")
    .eq("id", id)
    .maybeSingle<Ann>();
  if (!ann) notFound();

  const [{ data: receipts }, { data: props }, { data: occ }, { data: members }, { data: profiles }] =
    await Promise.all([
      db
        .from("announcement_receipts")
        .select("profile_id, acknowledged_at")
        .eq("announcement_id", id)
        .returns<{ profile_id: string; acknowledged_at: string }[]>(),
      db.from("properties").select("id, name").returns<{ id: string; name: string | null }[]>(),
      db
        .from("unit_occupancy")
        .select("unit_id, occupant_profile_id, units(label, property_id, properties(name))")
        .returns<{
          unit_id: string;
          occupant_profile_id: string | null;
          units: { label: string; property_id: string | null; properties: { name: string | null } | null } | null;
        }[]>(),
      db
        .from("unit_occupants")
        .select("unit_id, profile_id")
        .returns<{ unit_id: string; profile_id: string }[]>(),
      db
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "resident")
        .returns<{ id: string; full_name: string | null; email: string | null }[]>(),
    ]);

  const profById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const unitInfo = new Map(
    (occ ?? []).map((o) => [
      o.unit_id,
      {
        propertyId: o.units?.property_id ?? null,
        home: o.units
          ? `${o.units.properties?.name ?? "—"} · ${o.units.label}`
          : "—",
      },
    ])
  );

  // Every portal account in scope, with their home.
  const accountHome = new Map<string, { home: string; propertyId: string | null }>();
  for (const o of occ ?? []) {
    if (o.occupant_profile_id) {
      const u = unitInfo.get(o.unit_id);
      if (u) accountHome.set(o.occupant_profile_id, { home: u.home, propertyId: u.propertyId });
    }
  }
  for (const m of members ?? []) {
    if (!accountHome.has(m.profile_id)) {
      const u = unitInfo.get(m.unit_id);
      if (u) accountHome.set(m.profile_id, { home: u.home, propertyId: u.propertyId });
    }
  }

  const targets = ann.property_ids && ann.property_ids.length > 0 ? new Set(ann.property_ids) : null;
  const ackAt = new Map((receipts ?? []).map((r) => [r.profile_id, r.acknowledged_at]));

  type Person = { name: string; home: string; when?: string };
  const acknowledged: Person[] = [];
  const pending: Person[] = [];
  for (const [profileId, info] of accountHome) {
    if (targets && (!info.propertyId || !targets.has(info.propertyId))) continue;
    const p = profById.get(profileId);
    if (!p) continue;
    const person = { name: p.full_name ?? p.email ?? "Resident", home: info.home };
    const when = ackAt.get(profileId);
    if (when) acknowledged.push({ ...person, when });
    else pending.push(person);
  }
  acknowledged.sort((a, b) => (a.when ?? "").localeCompare(b.when ?? ""));
  pending.sort((a, b) => a.home.localeCompare(b.home, undefined, { numeric: true }));

  const propName = new Map((props ?? []).map((p) => [p.id, p.name ?? "—"]));
  const communities = targets
    ? [...targets].map((t) => propName.get(t) ?? "—").join(", ")
    : "All communities";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="print:hidden">
        <PageHeader
          title={ann.title}
          subtitle={`Posted ${stamp(ann.created_at)} · ${communities}`}
          action={
            <div className="flex items-center gap-3">
              <Link
                href="/admin/announcements"
                className="text-sm font-medium text-pine hover:text-pine-dark"
              >
                ← All announcements
              </Link>
              <PrintButton />
            </div>
          }
        />
      </div>

      <div className="mb-4 hidden print:block">
        <div className="font-display text-xl font-semibold text-ink">
          38th Ave Properties — Announcement receipt log
        </div>
        <div className="text-sm text-ink-soft">
          &ldquo;{ann.title}&rdquo; · Posted {stamp(ann.created_at)} · {communities}
        </div>
      </div>

      <Card className="mb-6 p-6 print:border-0 print:shadow-none">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{ann.body}</p>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="p-6 print:border-0 print:shadow-none">
          <h2 className="mb-3 font-display text-lg font-semibold text-pine">
            Acknowledged ({acknowledged.length})
          </h2>
          {acknowledged.length > 0 ? (
            <ul className="divide-y divide-clay">
              {acknowledged.map((p, i) => (
                <li key={i} className="py-2.5">
                  <div className="text-sm font-medium text-ink">{p.name}</div>
                  <div className="text-xs text-ink-faint">
                    {p.home} · ✓ {p.when ? stamp(p.when) : ""}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-faint">No acknowledgments yet.</p>
          )}
        </Card>

        <Card className="p-6 print:border-0 print:shadow-none">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">
            Not yet ({pending.length})
          </h2>
          {pending.length > 0 ? (
            <ul className="divide-y divide-clay">
              {pending.map((p, i) => (
                <li key={i} className="py-2.5">
                  <div className="text-sm font-medium text-ink">{p.name}</div>
                  <div className="text-xs text-ink-faint">{p.home}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-medium text-pine">Everyone&apos;s seen it 🎉</p>
          )}
        </Card>
      </div>

      <p className="mt-4 text-xs text-ink-faint">
        Only residents with portal accounts can acknowledge. Record-only tenants received the email
        if &ldquo;also email everyone&rdquo; was checked when posting.
      </p>
    </div>
  );
}
