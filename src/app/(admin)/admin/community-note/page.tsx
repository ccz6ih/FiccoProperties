import { PageHeader } from "@/components/dashboard-ui";
import { CommunityNoteForm } from "@/components/community-note-form";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

export default async function CommunityNotePage() {
  const { profile } = await requireProfile("/admin/community-note");
  if (!isStaff(profile)) redirect("/admin");

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { count } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "resident")
    .not("email", "is", null);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Community note"
        subtitle="Send a warm, branded update to every resident — neighborhood happenings, seasonal reminders, or just a hello."
      />
      <p className="mb-6 text-sm text-ink-soft">
        Goes to <span className="font-medium text-ink">{count ?? 0}</span> resident
        {(count ?? 0) === 1 ? "" : "s"} with an email on file. Residents reply straight to your inbox.
      </p>
      <CommunityNoteForm recipientCount={count ?? 0} />
    </div>
  );
}
