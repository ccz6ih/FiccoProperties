import { Card, Eyebrow } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { PhotoUploader, ForwardingForm } from "@/components/check-in-forms";
import { uploadMoveOutPhoto, deleteOwnPhoto } from "@/app/(resident)/portal/check-in/actions";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResidentUnitId } from "@/lib/occupancy";
import { CONDITION_BUCKET } from "@/lib/unit-photos";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type OccRow = {
  unit_id: string | null;
  forwarding_address: string | null;
  move_out_date: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};
type PhotoRow = { id: string; path: string; caption: string | null; created_at: string };

export default async function MoveOut() {
  const { user, profile } = await requireProfile("/portal/move-out");

  const unitId = await getResidentUnitId(user.id);
  let occ: OccRow | null = null;
  if (unitId) {
    const admin = createAdminClient() as unknown as SupabaseClient;
    const { data } = await admin
      .from("unit_occupancy")
      .select("unit_id, forwarding_address, move_out_date, units:unit_id(label, properties(name))")
      .eq("unit_id", unitId)
      .maybeSingle<OccRow>();
    occ = data;
  }

  let photos: { id: string; url: string; caption: string | null }[] = [];
  if (occ?.unit_id) {
    const admin = createAdminClient() as unknown as SupabaseClient;
    const { data: rows } = await admin
      .from("unit_photos")
      .select("id, path, caption, created_at")
      .eq("unit_id", occ.unit_id)
      .eq("kind", "move_out")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .returns<PhotoRow[]>();
    const signed = await Promise.all(
      (rows ?? []).map((r) => admin.storage.from(CONDITION_BUCKET).createSignedUrl(r.path, 3600))
    );
    photos = (rows ?? []).map((r, i) => ({ id: r.id, url: signed[i]?.data?.signedUrl ?? "", caption: r.caption }));
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const home = occ?.units ? `${occ.units.properties?.name ?? ""} · ${occ.units.label}` : null;

  if (!occ?.unit_id) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Move-out check-in" subtitle="Wrapping up your tenancy." />
        <EmptyState title="No home on file" body="Your move-out steps will appear here." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Move-out check-in"
        subtitle={home ? `${firstName} — ${home}` : firstName}
      />

      <Card className="mb-6 p-6">
        <Eyebrow>Move-out condition photos</Eyebrow>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          Take photos of each room as you leave — clean and empty. These are compared with your
          move-in photos, so anything that was already there won&apos;t be charged to you. It&apos;s
          the best way to protect your deposit.
        </p>
        <PhotoUploader action={uploadMoveOutPhoto} />

        {photos.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <div key={p.id} className="group relative overflow-hidden rounded-xl border border-clay">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? "Move-out photo"} className="aspect-square w-full object-cover" />
                {p.caption && <div className="truncate bg-cream px-2 py-1 text-xs text-ink-soft">{p.caption}</div>}
                <form action={deleteOwnPhoto} className="absolute right-1.5 top-1.5">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="back" value="/portal/move-out" />
                  <button
                    type="submit"
                    title="Remove"
                    className="rounded-full bg-ink/60 px-2 py-0.5 text-xs font-medium text-cream opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <Eyebrow>Deposit return</Eyebrow>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          Tell us where to send your deposit refund. Colorado requires us to return it, minus any
          itemized deductions, within 30 days of move-out (up to 60 if your lease says so).
        </p>
        <ForwardingForm forwarding={occ.forwarding_address} moveOut={occ.move_out_date} />
      </Card>
    </div>
  );
}
