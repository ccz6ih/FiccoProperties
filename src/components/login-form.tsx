"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "reset";

export type SignupUnit = { id: string; label: string; property: string };

const inputClass =
  "w-full rounded-xl border border-clay-deep bg-white/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function LoginForm({ next, units = [] }: { next: string; units?: SignupUnit[] }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [unitId, setUnitId] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Group units by property for the picker.
  const grouped = units.reduce<Record<string, SignupUnit[]>>((acc, u) => {
    (acc[u.property] ??= []).push(u);
    return acc;
  }, {});

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setNotice(null);
  }

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
      // Hard navigation so the server renders the target with the fresh session
      // cookie (avoids a blank page from the client refresh racing the cookie).
      window.location.assign(next);
      return;
    }

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset")}`,
      });
      setPending(false);
      if (error) {
        setError(error.message);
        return;
      }
      setNotice("If that email has an account, a password-reset link is on its way.");
      return;
    }

    // sign up
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          phone: phone || undefined,
          signup_unit_id: unitId || undefined,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }
    if (data.session) {
      window.location.assign(next);
    } else {
      setNotice("Check your email to confirm your account, then sign in.");
      setMode("signin");
      setPending(false);
    }
  }

  const title =
    mode === "signin"
      ? "Sign in"
      : mode === "signup"
        ? "Create your account"
        : "Reset your password";
  const subtitle =
    mode === "signin"
      ? "Welcome back — sign in to your account."
      : mode === "signup"
        ? "Set up your portal access in a few seconds."
        : "Enter your email and we'll send you a link to set a new password.";

  return (
    <Card className="space-y-6 p-7 sm:p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <p className="text-sm text-ink-soft">{subtitle}</p>
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
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">First name</span>
                <input
                  required
                  className={inputClass}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Last name</span>
                <input
                  required
                  className={inputClass}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Phone number</span>
              <input
                type="tel"
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="(720) 555-1234"
              />
            </label>
            {units.length > 0 && (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Which home are you renting?</span>
                <select
                  className={inputClass}
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                >
                  <option value="">Select your home…</option>
                  {Object.entries(grouped).map(([property, us]) => (
                    <optgroup key={property} label={property}>
                      {us.map((u) => (
                        <option key={u.id} value={u.id}>
                          {property} · {u.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <span className="block text-[11px] text-ink-faint">
                  This helps us connect your account to your home, rent, and lease.
                </span>
              </label>
            )}
          </>
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
        {mode !== "reset" && (
          <label className="block space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Password</span>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => switchMode("reset")}
                  className="text-xs font-medium text-pine hover:text-pine-dark"
                >
                  Forgot password?
                </button>
              )}
            </div>
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
        )}

        <Button type="submit" size="lg" variant="primary" className="w-full" disabled={pending}>
          {pending
            ? "Please wait…"
            : mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : "Send reset link"}
        </Button>
      </form>

      {mode === "reset" ? (
        <p className="text-center text-sm text-ink-soft">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className="font-medium text-pine hover:text-pine-dark"
          >
            ← Back to sign in
          </button>
        </p>
      ) : (
        <p className="text-center text-sm text-ink-soft">
          {mode === "signin" ? "New resident?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
            className="font-medium text-pine hover:text-pine-dark"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      )}
    </Card>
  );
}
