import Link from "next/link";
import { Container, ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center bg-grain">
      <Container className="py-24 text-center">
        <div className="font-display text-7xl font-semibold text-pine">404</div>
        <h1 className="mt-4 text-3xl font-semibold text-ink">
          We couldn&apos;t find that page
        </h1>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">
          The page you&apos;re looking for may have moved. Let&apos;s get you
          back home.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <ButtonLink href="/" variant="primary">
            Back to home
          </ButtonLink>
          <Link href="/apply" className="text-sm font-medium text-pine hover:text-pine-dark">
            Apply for a home →
          </Link>
        </div>
      </Container>
    </main>
  );
}
