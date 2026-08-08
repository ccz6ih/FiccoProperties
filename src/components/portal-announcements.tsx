import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { acknowledgeAnnouncement } from "@/app/(resident)/portal/announce-actions";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResidentUnitId } from "@/lib/occupancy";

type Ann = {
  id: string;
  title: string;
  body: string;
  property_ids: string[] | null;
  expires_on: string | null;
  created_at: string;
};

/**
 * Unacknowledged building announcements for the signed-in resident's community.
 * Each card has a "Got it" button that records the read receipt. Renders
 * nothing when there's nothing new — zero clutter.
 */
export async function PortalAnnouncements({ userId }: { userId: string }) {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  // The resident's community (co-tenant aware).
  const unitId = await getResidentUnitId(userId);
  let propertyId: string | null = null;
  if (unitId) {
    const admin = createAdminClient() as unknown as SupabaseClient;
    const { data: unit } = await admin
      .from("units")
      .select("property_id")
      .eq("id", unitId)
      .maybeSingle<{ property_id: string | null }>();
    propertyId = unit?.property_id ?? null;
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const [{ data: anns }, { data: mine }] = await Promise.all([
    db
      .from("announcements")
      .select("id, title, body, property_ids, expires_on, created_at")
      .order("created_at", { ascending: false })
      .returns<Ann[]>(),
    db
      .from("announcement_receipts")
      .select("announcement_id")
      .eq("profile_id", userId)
      .returns<{ announcement_id: string }[]>(),
  ]);

  const acked = new Set((mine ?? []).map((r) => r.announcement_id));
  const visible = (anns ?? []).filter((a) => {
    if (acked.has(a.id)) return false;
    if (a.expires_on && a.expires_on < todayIso) return false;
    if (a.property_ids && a.property_ids.length > 0) {
      return !!propertyId && a.property_ids.includes(propertyId);
    }
    return true;
  });

  if (visible.length === 0) return null;

  return (
    <div className="mb-8 space-y-4">
      {visible.map((a) => (
        <Card key={a.id} className="border-gold/50 bg-gold/5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">📣</span>
                <h2 className="font-display text-lg font-semibold text-ink">{a.title}</h2>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                {a.body}
              </p>
              <p className="mt-2 text-xs text-ink-faint">
                Posted {formatDate(a.created_at)} · 38th Ave Properties
              </p>
            </div>
            <form action={acknowledgeAnnouncement} className="shrink-0">
              <input type="hidden" name="announcement_id" value={a.id} />
              <button
                type="submit"
                className="rounded-xl bg-pine px-4 py-2.5 text-sm font-semibold text-cream hover:bg-pine-dark"
              >
                Got it ✓
              </button>
            </form>
          </div>
        </Card>
      ))}
    </div>
  );
}
