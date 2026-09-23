"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Turns whatever a password-reset link arrives with into a real session.
 *
 * Supabase hands the browser back one of three things depending on the auth
 * flow and how the link was opened, and the app only ever handled the first:
 *   • `?code=…`               — PKCE; needs the verifier cookie set when the
 *                               reset was requested, so it fails when the link
 *                               is opened in a different browser (tapping a
 *                               link in iOS Mail is exactly this)
 *   • `#access_token=…`       — implicit flow; the tokens are right there in
 *                               the fragment, which never reaches the server
 *   • nothing usable          — genuinely expired
 *
 * Running on the client is what makes the fragment reachable at all. On
 * success it reloads so the server component picks up the new cookie.
 */
export function RecoveryBridge() {
  const [state, setState] = useState<"working" | "expired">("working");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();

      // Fragment first — it survives a cross-browser open, unlike PKCE.
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!cancelled && !error) {
          window.location.replace("/auth/reset");
          return;
        }
      }

      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled && !error) {
          window.location.replace("/auth/reset");
          return;
        }
      }

      if (!cancelled) setState("expired");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "working") {
    return <p className="mt-2 text-sm text-ink-soft">Checking your reset link…</p>;
  }

  return (
    <p className="mt-2 text-sm text-ink-soft">
      This reset link is invalid or has expired — they last one hour, and each new one
      replaces the last.{" "}
      <Link href="/login" className="font-medium text-pine hover:text-pine-dark">
        Request a new one →
      </Link>
      <br />
      <span className="text-ink-faint">
        Still stuck? Email the office and we&apos;ll send you a password directly.
      </span>
    </p>
  );
}
