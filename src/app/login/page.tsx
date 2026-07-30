import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui";
import { LoginForm, type SignupUnit } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next && next.startsWith("/") ? next : "/portal";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(target);

  // Units for the "which home?" picker on signup (service role — just labels).
  const admin = createAdminClient() as unknown as SupabaseClient;
  const { data: unitRows } = await admin
    .from("units")
    .select("id, label, properties(name)")
    .returns<{ id: string; label: string; properties: { name: string | null } | null }[]>();
  const units: SignupUnit[] = (unitRows ?? [])
    .map((u) => ({ id: u.id, label: u.label, property: u.properties?.name ?? "—" }))
    .sort(
      (a, b) =>
        a.property.localeCompare(b.property) ||
        a.label.localeCompare(b.label, undefined, { numeric: true })
    );

  return (
    <main className="flex min-h-dvh flex-col bg-grain">
      <Container className="flex h-16 items-center">
        <Link href="/" className="flex items-center gap-2.5">
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-pine text-cream">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 11l9-7 9 7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 10v9h14v-9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-display text-lg font-semibold text-ink">
            38th Ave Properties
          </span>
        </Link>
      </Container>

      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <LoginForm next={target} units={units} />
          <p className="mt-6 text-center text-sm text-ink-soft">
            Already renting with us? Use <span className="font-medium text-ink">Create an account</span>{" "}
            above to set up your portal.
          </p>
          <p className="mt-1 text-center text-xs text-ink-faint">
            Not a resident yet?{" "}
            <Link href="/apply" className="font-medium text-pine hover:text-pine-dark">
              Apply online
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
