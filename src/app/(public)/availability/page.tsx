import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Container, Card, Eyebrow } from "@/components/ui";
import { FunnelPing } from "@/components/funnel-ping";
import { PrequalQuiz } from "@/components/prequal-quiz";
import { WaitlistForm } from "@/components/waitlist-form";
import { formatCents } from "@/lib/format";
import { listingPublicUrl } from "@/lib/unit-photos";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Availability",
  description:
    "See every available home across our four Wheat Ridge communities — or join the waitlist and hear first when one opens up.",
};

type UnitRow = {
  id: string;
  label: string;
  status: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  rent_cents: number | null;
  properties: { id: string; name: string | null; slug: string | null } | null;
  unit_photos: { path: string; sort: number | null; created_at: string }[];
};

export default async function AvailabilityPage() {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const [{ data: units }, { data: props }] = await Promise.all([
    db
      .from("units")
      .select(
        "id, label, status, bedrooms, bathrooms, sqft, rent_cents, properties(id, name, slug), unit_photos(path, sort, created_at)"
      )
      .in("status", ["available", "make_ready"])
      .eq("unit_photos.kind", "listing")
      .returns<UnitRow[]>(),
    db
      .from("properties")
      .select("id, name")
      .order("name")
      .returns<{ id: string; name: string | null }[]>(),
  ]);

  const properties = (props ?? []).filter(
    (p): p is { id: string; name: string } => !!p.name
  );
  const homes = (units ?? [])
    .map((u) => ({
      ...u,
      photo: [...u.unit_photos].sort(
        (a, b) => (a.sort ?? 99) - (b.sort ?? 99) || a.created_at.localeCompare(b.created_at)
      )[0],
    }))
    .sort(
      (a, b) =>
        (a.properties?.name ?? "").localeCompare(b.properties?.name ?? "") ||
        a.label.localeCompare(b.label, undefined, { numeric: true })
    );

  return (
    <>
      <FunnelPing step="listing_view" />

      {/* Hero */}
      <section className="border-b border-clay bg-sand/50 py-14">
        <Container className="max-w-3xl text-center">
          <Eyebrow>Availability</Eyebrow>
          <h1 className="mt-2 text-4xl font-semibold leading-tight text-ink">
            {homes.length > 0
              ? `${homes.length} home${homes.length === 1 ? "" : "s"} available on 38th`
              : "Nothing open right now — but homes turn fast"}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-ink-soft">
            {homes.length > 0
              ? "Family-owned, pet-free communities in Wheat Ridge. No application fee."
              : "Our four communities stay full for a reason. Join the waitlist and you'll hear the moment a home opens — before it's posted anywhere."}
          </p>
        </Container>
      </section>

      {/* Available homes */}
      {homes.length > 0 && (
        <section className="py-14">
          <Container>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {homes.map((u) => (
                <Card key={u.id} className="overflow-hidden">
                  {u.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={listingPublicUrl(u.photo.path)}
                      alt={`${u.properties?.name ?? ""} ${u.label}`}
                      loading="lazy"
                      className="h-48 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center bg-sand text-3xl">🏡</div>
                  )}
                  <div className="p-5">
                    <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                      {u.properties?.name}
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <h2 className="font-display text-lg font-semibold text-ink">{u.label}</h2>
                      {u.rent_cents != null && (
                        <span className="font-display text-lg font-semibold text-pine">
                          {formatCents(u.rent_cents)}/mo
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-ink-soft">
                      {[
                        u.bedrooms != null ? `${u.bedrooms} bd` : null,
                        u.bathrooms != null ? `${u.bathrooms} ba` : null,
                        u.sqft != null ? `${u.sqft.toLocaleString("en-US")} sqft` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Ask for details"}
                    </div>
                    <div className="mt-4 flex gap-2">
                      {u.properties?.slug && (
                        <Link
                          href={`/properties/${u.properties.slug}`}
                          className="flex-1 rounded-xl border border-clay-deep px-4 py-2.5 text-center text-sm font-semibold text-ink hover:bg-sand"
                        >
                          See it
                        </Link>
                      )}
                      <Link
                        href="/apply"
                        className="flex-1 rounded-xl bg-pine px-4 py-2.5 text-center text-sm font-semibold text-cream hover:bg-pine-dark"
                      >
                        Apply
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Pre-qual + waitlist */}
      <section className={homes.length > 0 ? "border-t border-clay bg-sand/40 py-14" : "py-14"}>
        <Container className="grid max-w-5xl gap-8 lg:grid-cols-2">
          <PrequalQuiz properties={properties} />
          <WaitlistForm properties={properties} />
        </Container>
      </section>
    </>
  );
}
