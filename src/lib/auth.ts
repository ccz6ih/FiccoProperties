import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type Profile = Tables<"profiles">;

/** Require a signed-in user; returns user + profile or redirects to /login. */
export async function requireProfile(nextPath: string): Promise<{
  user: { id: string; email?: string };
  profile: Profile | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { user: { id: user.id, email: user.email }, profile };
}

export function isStaff(profile: Profile | null): boolean {
  return !!profile && ["owner", "admin"].includes(profile.role);
}
