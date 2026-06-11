import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { AccountForm } from "@/components/account-form";
import { requireProfile, isStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const { user, profile } = await requireProfile("/account");
  const backHref = isStaff(profile) ? "/admin" : "/portal";

  return (
    <main className="min-h-dvh bg-grain py-12">
      <Container className="max-w-2xl">
        <Link
          href={backHref}
          className="mb-4 inline-block text-sm font-medium text-pine hover:text-pine-dark"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mb-1 font-display text-3xl font-semibold text-ink">Your account</h1>
        <p className="mb-8 text-ink-soft">
          Update your photo and contact details.
        </p>
        <AccountForm
          fullName={profile?.full_name ?? null}
          phone={profile?.phone ?? null}
          email={user.email ?? null}
          avatarUrl={profile?.avatar_url ?? null}
        />
      </Container>
    </main>
  );
}
