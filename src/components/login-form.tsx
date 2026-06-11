"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setPending(false);
        return;
      }
      router.push(next);
      router.refresh();
      return;
    }

    // sign up
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
            : undefined,
      },
    });
    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }
    if (data.session) {
      router.push(next);
      router.refresh();
    } else {
      setNotice("Check your email to confirm your account, then sign in.");
      setMode("signin");
      setPending(false);
    }
  }

  return (
    <Card className="space-y-6 p-7 sm:p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">
          {mode === "signin" ? "Resident login" : "Create your account"}
        </h1>
        <p className="text-sm text-ink-soft">
          {mode === "signin"
            ? "Access your unit, lease, and maintenance requests."
            : "Set up your portal access in a few seconds."}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-3 text-sm text-terracotta-dark">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-pine/30 bg-pine-soft px-4 py-3 text-sm text-pine-dark">
          {notice}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "signup" && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Full name</span>
            <input
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </label>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            type="email"
            required
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Password</span>
          <input
            type="password"
            required
            minLength={6}
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </label>

        <Button type="submit" size="lg" variant="primary" className="w-full" disabled={pending}>
          {pending
            ? "Please wait…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-ink-soft">
        {mode === "signin" ? "New resident?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
          className="font-medium text-pine hover:text-pine-dark"
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </Card>
  );
}
