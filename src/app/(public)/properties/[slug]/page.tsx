import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container, Eyebrow, Badge, ButtonLink, Card } from "@/components/ui";
import { UnitGallery } from "@/components/unit-gallery";
import { TourRequestForm } from "@/components/tour-request-form";
import { getPropertyBySlug } from "@/lib/queries";
import { getCommunityContent, NEIGHBORHOOD } from "@/lib/content";
import { createClient } from "@/lib/supabase/server";
import { listingPublicUrl } from "@/lib/unit-photos";
import { propertyTypeLabel, formatCents } from "@/lib/format";

export const revalidate = 60;

type Params = { params: Promise<{ slug: string }> };

type VacantUnitRow = {
  id: string;
  label: string;
  status: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  rent_cents: number | null;
  unit_photos: {
    id: string;
    path: string;
    caption: string | null;
    sort: number;
    created_at: string;
  }[];
};

/** Vacant units (available/make_ready) that have at least one listing photo. */
async function getAvailableHomes(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select(
      "id, label, status, bedrooms, bathrooms, sqft, rent_cents, unit_photos(id, path, caption, sort, created_at)"
    )
    .eq("property_id", propertyId)
    .in("status", ["available", "make_ready"])
    .eq("unit_photos.kind", "listing")
    .order("label")
    .returns<VacantUnitRow[]>();

  return (data ?? [])
    .map((unit) => ({
      ...unit,
      photos: [...unit.unit_photos]
        .sort(
          (a, b) =>
            a.sort - b.sort || a.created_at.localeCompare(b.created_at)
        )
        .map((p) => ({ url: listingPublicUrl(p.path), caption: p.caption })),
    }))
    .filter((unit) => unit.photos.length > 0);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPropertyBySlug(slug);
  if (!data) return { title: "Community not found" };
  return {
    title: data.property.name,
    description: getCommunityContent(slug).blurb,
  };
}

export default async function PropertyPage({ params }: Params) {
  const { slug } = await params;
  const data = await getPropertyBySlug(slug);
  if (!data) notFound();

  const { property, units } = data;
  const content = getCommunityContent(slug);
  const total = units.length;
  const available = units.filter(
    (u) => u.status === "available" || u.status === "make_ready"
  ).length;

  const availableHomes = await getAvailableHomes(property.id);
  const fullAddress = [
    property.address_line1,
    property.city,
    property.state,
    property.postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      {/* Hero */}
      <section className={`relative bg-gradient-to-br ${content.gradient} text-cream`}>
        {property.hero_image && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={property.hero_image}
              alt={property.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/60 to-ink/30" />
          </>
        )}
        <div className="bg-grain relative">
          <Container className="py-16 lg:py-24">
            <div className="max-w-2xl space-y-5">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-cream/15 px-3 py-1 text-xs font-medium text-cream backdrop-blur">
                  {propertyTypeLabel(property.type)}
                </span>
                <span className="text-sm text-cream/80">{content.tagline}</span>
              </div>
              <h1 className="text-5xl font-semibold leading-tight">
                {property.name}
              </h1>
              <p className="text-lg leading-relaxed text-cream/85">
                {content.blurb}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <ButtonLink
                  href={`/apply?property=${property.slug}`}
                  size="lg"
                  variant="accent"
                >
                  Apply to {property.name.split(" ")[0]}
                </ButtonLink>
                <span className="text-sm text-cream/80">
                  {property.address_line1}, {property.city}, {property.state}{" "}
                  {property.postal_code}
                </span>
              </div>
            </div>
          </Container>
        </div>
      </section>

      {/* Stats + highlights */}
      <section className="py-16">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <Card className="grid grid-cols-3 gap-px overflow-hidden bg-clay p-0">
              <MiniStat value={String(total)} label="Homes" />
              <MiniStat
                value={available > 0 ? String(available) : "0"}
                label="Available"
              />
              <MiniStat value={property.state ?? "CO"} label="Location" />
            </Card>
            <Card className="space-y-3 p-6">
              <Eyebrow>Availability</Eyebrow>
              {available > 0 ? (
                <p className="text-ink-soft">
                  <span className="font-semibold text-pine">
                    {available} {available === 1 ? "home is" : "homes are"}
                  </span>{" "}
                  ready for new applications right now.
                </p>
              ) : (
                <p className="text-ink-soft">
                  This community is fully leased. Apply to join the waitlist —
                  we&apos;ll reach out the moment something opens up.
                </p>
              )}
              <ButtonLink href={`/apply?property=${property.slug}`} variant="primary">
                {available > 0 ? "Apply now" : "Join the waitlist"}
              </ButtonLink>
            </Card>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <Eyebrow>What you&apos;ll love</Eyebrow>
              <h2 className="text-3xl font-semibold text-ink">
                Life at {property.name}
              </h2>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {content.highlights.map((h) => (
                <li
                  key={h}
                  className="flex items-center gap-3 rounded-xl border border-clay bg-white/60 px-4 py-3"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-pine-soft text-pine-dark">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-ink">{h}</span>
                </li>
              ))}
            </ul>

            <Card className="flex flex-col items-start gap-3 bg-sand/60 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-display text-lg font-semibold text-ink">
                  Questions before you apply?
                </div>
                <p className="text-sm text-ink-soft">
                  Our on-site team is happy to help.
                </p>
              </div>
              <ButtonLink href="mailto:hello@ficcoproperties.com" variant="outline">
                Contact us
              </ButtonLink>
            </Card>
          </div>
        </Container>
      </section>

      {/* Neighborhood */}
      <section className="py-16">
        <Container className="space-y-8">
          <div className="max-w-2xl space-y-3">
            <Eyebrow>{NEIGHBORHOOD.heading}</Eyebrow>
            <h2 className="text-3xl font-semibold text-ink">A great place to land</h2>
            <p className="text-lg text-ink-soft">{NEIGHBORHOOD.blurb}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {NEIGHBORHOOD.highlights.map((h) => (
              <Card key={h.title} className="space-y-2 p-5">
                <h3 className="font-display text-lg font-semibold text-ink">{h.title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{h.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* Available homes */}
      {availableHomes.length > 0 && (
        <section className="border-t border-clay bg-sand/40 py-16">
          <Container className="space-y-8">
            <div className="space-y-3">
              <Eyebrow>Available homes</Eyebrow>
              <h2 className="text-3xl font-semibold text-ink">
                Take a look inside
              </h2>
              <p className="max-w-2xl text-ink-soft">
                {availableHomes.length}{" "}
                {availableHomes.length === 1 ? "home is" : "homes are"}{" "}
                ready to tour and apply for right now.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {availableHomes.map((unit) => (
                <Card key={unit.id} className="space-y-5 p-5">
                  <UnitGallery photos={unit.photos} label={unit.label} />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-display text-xl font-semibold text-ink">
                        {unit.label}
                      </h3>
                      <Badge
                        tone={
                          unit.status === "available" ? "pine" : "terracotta"
                        }
                      >
                        {unit.status === "available"
                          ? "Available now"
                          : "Coming soon"}
                      </Badge>
                    </div>

                    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
                      <UnitSpec
                        label="Beds"
                        value={unit.bedrooms != null ? String(unit.bedrooms) : "—"}
                      />
                      <UnitSpec
                        label="Baths"
                        value={
                          unit.bathrooms != null ? String(unit.bathrooms) : "—"
                        }
                      />
                      <UnitSpec
                        label="Sq ft"
                        value={
                          unit.sqft != null
                            ? unit.sqft.toLocaleString("en-US")
                            : "—"
                        }
                      />
                    </dl>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="font-display text-lg font-semibold text-pine">
                        {unit.rent_cents != null
                          ? `${formatCents(unit.rent_cents)}/mo`
                          : "Contact for pricing"}
                      </div>
                      <ButtonLink
                        href={`/apply?property=${property.slug}`}
                        variant="accent"
                      >
                        Apply
                      </ButtonLink>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Location / map */}
      <section className="border-t border-clay py-16">
        <Container className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          <div className="space-y-3">
            <Eyebrow>Location</Eyebrow>
            <h2 className="text-3xl font-semibold text-ink">On W 38th Avenue</h2>
            <p className="text-ink-soft">
              {property.address_line1}
              <br />
              {property.city}, {property.state} {property.postal_code}
            </p>
            <ButtonLink
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                fullAddress
              )}`}
              variant="outline"
            >
              Get directions →
            </ButtonLink>
          </div>
          <div className="overflow-hidden rounded-2xl border border-clay shadow-sm">
            <iframe
              title={`Map of ${property.name}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(
                fullAddress
              )}&output=embed`}
              className="h-72 w-full lg:h-80"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </Container>
      </section>

      {/* Request a tour */}
      <section className="border-t border-clay bg-sand/40 py-16">
        <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="space-y-3 lg:sticky lg:top-24">
            <Eyebrow>Visit us</Eyebrow>
            <h2 className="text-3xl font-semibold text-ink">Request a tour</h2>
            <p className="text-lg text-ink-soft">
              Come see {property.name} in person. Tell us when works and our
              on-site team will reach out to set it up.
            </p>
          </div>
          <TourRequestForm propertyId={property.id} propertyName={property.name} />
        </Container>
      </section>

      {/* Back link */}
      <section className="pb-16">
        <Container>
          <ButtonLink href="/#communities" variant="ghost">
            ← All communities
          </ButtonLink>
          <Badge tone="neutral" className="ml-2">
            Updated regularly
          </Badge>
        </Container>
      </section>
    </>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-cream p-5 text-center">
      <div className="font-display text-2xl font-semibold text-pine">{value}</div>
      <div className="mt-0.5 text-xs text-ink-soft">{label}</div>
    </div>
  );
}

function UnitSpec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
