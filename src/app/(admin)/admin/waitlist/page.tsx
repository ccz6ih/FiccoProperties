import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { setWaitlistStatus, deleteWaitlistEntry } from "./actions";
import { formatCents, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  bedrooms: string | null;
  max_rent_cents: number | null;
  move_in_by: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  properties: { name: string | null } | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "Waiting", cls: "bg-gold/20 text-ink" },
  contacted: { label: "Contacted", cls: "bg-pine/15 text-pine" },
  converted: { label: "Converted 🎉", cls: "bg-pine text-cream" },
  closed: { label: "Closed", cls: "bg-sand text-ink-soft" },
};

export default async function AdminWaitlist({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: rows } = await db
    .from("waitlist_entries")
    .select(
      "id, name, email, phone, bedrooms, max_rent_cents, move_in_by, notes, status, created_at, properties:property_id(name)"
    )
    .order("created_at", { ascending: false })
    .returns<Row[]>();

  const all = rows ?? [];
  const activeCount = all.filter((r) => r.status === "active").length;
  const view = show === "all" ? all : all.filter((r) => r.status === "active" || r.status === "contacted");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Waitlist"
        subtitle="People waiting on a home — call down this list the moment a unit turns."
      />

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Filter active={show !== "all"} href="/admin/waitlist" label={`Open (${activeCount})`} />
        <Filter active={show === "all"} href="/admin/waitlist?show=all" label={`Everyone (${all.length})`} />
      </div>

      {view.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Person</th>
                  <th className="px-5 py-3 font-medium">Wants</th>
                  <th className="px-5 py-3 font-medium">Move in by</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {view.map((r) => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.active;
                  const wants = [
                    r.properties?.name ?? "Any community",
                    r.bedrooms && r.bedrooms !== "any" ? `${r.bedrooms} bd` : null,
                    r.max_rent_cents ? `≤ ${formatCents(r.max_rent_cents)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <tr key={r.id} className="hover:bg-sand/30 align-top">
                      <td className="px-5 py-3">
                        <div className="font-medium text-ink">{r.name}</div>
                        <div className="text-xs text-ink-soft">
                          <a href={`mailto:${r.email}`} className="text-pine hover:underline">{r.email}</a>
                          {r.phone && (
                            <>
                              {" · "}
                              <a href={`tel:${r.phone.replace(/[^0-9+]/g, "")}`} className="font-medium text-pine hover:underline">
                                {r.phone}
                              </a>
                            </>
                          )}
                        </div>
                        {r.notes && <div className="mt-0.5 text-xs text-ink-faint">“{r.notes}”</div>}
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{wants}</td>
                      <td className="px-5 py-3 text-ink-soft">
                        {r.move_in_by ? formatDate(r.move_in_by) : "Flexible"}
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{formatDate(r.created_at)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>
                          {meta.label}
                        </span>
                        <form action={setWaitlistStatus} className="mt-1.5">
                          <input type="hidden" name="id" value={r.id} />
                          <select
                            name="status"
                            defaultValue={r.status}
                            className="rounded-lg border border-clay-deep bg-white px-2 py-1 text-xs text-ink"
                          >
                            <option value="active">Waiting</option>
                            <option value="contacted">Contacted</option>
                            <option value="converted">Converted</option>
                            <option value="closed">Closed</option>
                          </select>
                          <button type="submit" className="ml-1.5 text-xs font-medium text-pine hover:underline">
                            Save
                          </button>
                        </form>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <form action={deleteWaitlistEntry}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="text-xs text-ink-faint hover:text-terracotta-dark" title="Remove">
                            ✕
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="Nobody waiting right now"
          body="Signups from the public Availability page land here — with what they want and when."
        />
      )}
    </div>
  );
}

function Filter({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 font-medium ${active ? "bg-pine text-cream" : "text-ink-soft hover:bg-sand"}`}
    >
      {label}
    </Link>
  );
}
