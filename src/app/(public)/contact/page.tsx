import type { Metadata } from "next";
import Link from "next/link";
import { Container, Eyebrow } from "@/components/ui";
import { ContactForm } from "@/components/contact-form";
import { RENT_DROPBOX } from "@/lib/rent-dropbox";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with 38th Ave Properties — family-owned communities in Wheat Ridge, Colorado.",
};

export default function ContactPage() {
  return (
    <section className="py-16">
      <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Eyebrow>Contact us</Eyebrow>
          <h1 className="text-4xl font-semibold leading-tight text-ink">
            We&apos;re happy to help
          </h1>
          <p className="text-lg leading-relaxed text-ink-soft">
            Questions about our communities, availability, or your tenancy? Send
            us a note and our on-site team will get back to you.
          </p>
          <div className="space-y-1 text-sm text-ink-soft">
            <div>W 38th Ave, Wheat Ridge, CO 80033</div>
            <div>
              <a href={`tel:+17205272596`} className="font-medium text-pine hover:text-pine-dark">
                {RENT_DROPBOX.phone}
              </a>
            </div>
          </div>
          <p className="text-xs text-ink-faint">
            Current resident? You can also message us right from your{" "}
            <Link href="/portal/messages" className="font-medium text-pine hover:text-pine-dark">
              resident portal
            </Link>
            .
          </p>
        </div>

        <ContactForm />
      </Container>
    </section>
  );
}
