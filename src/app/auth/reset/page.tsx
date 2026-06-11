import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Send staff back to /admin, residents to /portal after resetting.
  let next = "/portal";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile && ["owner", "admin"].includes(profile.role)) next = "/admin";
  }

  return (
    <main className="flex min-h-dvh items-center bg-grain">
      <Container className="max-w-md py-12">
        <div className="rounded-2xl border border-clay bg-white/70 p-7 shadow-[0_1px_2px_rgba(44,38,34,0.04)] sm:p-8">
          <h1 className="mb-1 font-display text-2xl font-semibold text-ink">
            Set a new password
          </h1>
          {user ? (
            <>
              <p className="mb-6 text-sm text-ink-soft">
                Choose a new password for {user.email}.
              </p>
              <ResetPasswordForm next={next} />
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              This reset link is invalid or has expired.{" "}
              <Link href="/login" className="font-medium text-pine hover:text-pine-dark">
                Request a new one →
              </Link>
            </p>
          )}
        </div>
      </Container>
    </main>
  );
}
