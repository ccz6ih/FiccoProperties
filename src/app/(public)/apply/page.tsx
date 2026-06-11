import type { Metadata } from "next";
import { Container, Eyebrow } from "@/components/ui";
import { ApplyForm } from "@/components/apply-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Apply",
  description:
    "Apply online to any of the four Ficco Properties communities in Wheat Ridge, Colorado.",
};

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const { property: propertySlug } = await searchParams;

  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("id, slug, name")
    .order("created_at");

  const options = properties ?? [];
  const defaultPropertyId = options.find((p) => p.slug === propertySlug)?.id;

  return (
    <section className="py-16">
      <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Eyebrow>Apply online</Eyebrow>
          <h1 className="text-4xl font-semibold leading-tight text-ink">
            Let&apos;s find your home on 38th
          </h1>
          <p className="text-lg leading-relaxed text-ink-soft">
            Tell us a bit about you and where you&apos;d like to live. There&apos;s
            no fee to apply. Our communities are pet-free, and a credit and
            background check (about $40, paid by you to TransUnion SmartMove) is
            part of the process.
          </p>
          <ul className="space-y-3 pt-2">
            {[
              "Apply to any of our four communities",
              "We review every application personally",
              "All Ficco communities are pet-free",
              "A ~$40 background check is part of the process",
              "We'll email you within a few business days",
            ].map((line) => (
              <li key={line} className="flex items-start gap-3 text-sm text-ink-soft">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pine-soft text-pine-dark">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <ApplyForm properties={options} defaultPropertyId={defaultPropertyId} />
      </Container>
    </section>
  );
}
