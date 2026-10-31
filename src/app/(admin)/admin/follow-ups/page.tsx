import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageHeader } from "@/components/dashboard-ui";
import { FollowUpsCard } from "@/components/follow-ups-card";
import { getFollowUps } from "@/lib/follow-ups";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Waiting on you" };
export const dynamic = "force-dynamic";

export default async function FollowUps() {
  const { profile } = await requireProfile("/admin/follow-ups");
  if (!isStaff(profile)) redirect("/portal");

  const supabase = await createClient();
  const items = await getFollowUps(supabase as unknown as SupabaseClient);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Waiting on you"
        subtitle="Everything that was started and hasn't been closed off."
      />
      <FollowUpsCard items={items} limit={100} />
      <p className="text-xs text-ink-faint">
        Nothing here is a to-do list you have to keep tidy — each line is worked out from
        the records themselves and disappears the moment the thing is actually dealt with.
      </p>
    </div>
  );
}
