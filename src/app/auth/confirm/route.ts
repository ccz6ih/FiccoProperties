import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Verifies an email OTP / magic-link token server-side and SETS the session
 * cookie, then forwards the user on. We use this instead of Supabase's default
 * token-hash redirect because the app uses server-side (cookie) sessions — the
 * hash flow never sets the cookie, so users would land logged-out.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "magiclink") as EmailOtpType;
  const nextParam = searchParams.get("next") ?? "/portal";
  const next = nextParam.startsWith("/") ? nextParam : "/portal";

  if (token_hash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link-expired`);
}
