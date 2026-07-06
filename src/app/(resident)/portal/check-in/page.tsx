import { Card, Eyebrow } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/dashboard-ui";
import { AssistanceDisclosureForm, MoveInPhotoUploader } from "@/components/check-in-forms";
import { deleteMoveInPhoto } from "@/app/(resident)/portal/check-in/actions";
import { formatDate } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONDITION_BUCKET } from "@/lib/unit-photos";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type OccRow = {
  unit_id: string | null;
  assistance_programs: string[] | null;
  assistance_disclosed_at: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};
type PhotoRow = { id: string; path: string; caption: string | null; created_at: string };

export default async function CheckIn() {
  const { user, profile } = await requireProfile("/portal/check-in");
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: occ } = await db
    .from("unit_occupancy")
    .select("unit_id, assistance_programs, assistance_disclosed_at, units:unit_id(label, properties(name))")
    .eq("occupant_profile_id", user.id)
    .maybeSingle<OccRow>();

  // Move-in photos this resident uploaded, via signed URLs (private bucket).
  let photos: { id: string; url: string; caption: string | null }[] = [];
  if (occ?.unit_id) {
    const admin = createAdminClient() as unknown as SupabaseClient;
    const { data: rows } = await admin
      .from("unit_photos")
      .select("id, path, caption, created_at")
      .eq("unit_id", occ.unit_id)
      .eq("kind", "move_in")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .returns<PhotoRow[]>();
    const signed = await Promise.all(
      (rows ?? []).map((r) => admin.storage.from(CONDITION_BUCKET).createSignedUrl(r.path, 3600))
    );
    photos = (rows ?? []).map((r, i) => ({
      id: r.id,
      url: signed[i]?.data?.signedUrl ?? "",
      caption: r.caption,
    }));
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const home = occ?.units
    ? `${occ.units.properties?.name ?? ""} · ${occ.units.label}`
    : null;

  if (!occ?.unit_id) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Move-in check-in" subtitle="Get your new home set up." />
        <EmptyState
          title="No home on file yet"
          body="Once your tenancy is set up, your move-in check-in will appear here."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Move-in check-in"
        subtitle={home ? `Welcome, ${firstName} — ${home}` : `Welcome, ${firstName}`}
      />

      {/* Condition photos */}
      <Card className="mb-6 p-6">
        <Eyebrow>Move-in condition photos</Eyebrow>
        <p className="mb-4 mt-1 text-sm text-ink-soft">
          Optional but recommended: take a few photos of your home&apos;s condition as you move in
          (any existing marks, wear, or damage). These are saved to your file so there&apos;s a
          shared record — it protects you at move-out.
        </p>
        <MoveInPhotoUploader />

        {photos.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <div key={p.id} className="group relative overflow-hidden rounded-xl border border-clay">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? "Move-in photo"} className="aspect-square w-full object-cover" />
                {p.caption && (
                  <div className="truncate bg-cream px-2 py-1 text-xs text-ink-soft">{p.caption}</div>
                )}
                <form action={deleteMoveInPhoto} className="absolute right-1.5 top-1.5">
                  <input type="hidden" name="id" value={p.id} />
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

      {/* Assistance disclosure */}
      <Card className="p-6">
        <Eyebrow>A quick question (optional)</Eyebrow>
        <div className="mt-3">
          <AssistanceDisclosureForm selected={occ?.assistance_programs ?? []} />
        </div>
        {occ?.assistance_disclosed_at && (
          <p className="mt-3 text-xs text-ink-faint">
            Last updated {formatDate(occ.assistance_disclosed_at)}.
          </p>
        )}
      </Card>
    </div>
  );
}
