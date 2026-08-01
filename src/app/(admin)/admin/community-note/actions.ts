"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";
import { sendNotification } from "@/lib/email";
import { communityNoteEmail } from "@/lib/community-email";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CommunityNoteState = {
  ok: boolean;
  error?: string;
  notice?: string;
};

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://38thaveproperties.com").replace(/\/$/, "");

function firstNameOf(fullName: string | null): string {
  const n = fullName?.trim().split(/\s+/)[0];
  return n || "there";
}

export async function sendCommunityNote(
  _prev: CommunityNoteState,
  form: FormData
): Promise<CommunityNoteState> {
  const { user, profile } = await requireProfile("/admin/community-note");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const subject = (form.get("subject") as string)?.trim();
  const heading = (form.get("heading") as string)?.trim() ?? "";
  const body = (form.get("body") as string)?.trim();
  const mode = (form.get("mode") as string) === "all" ? "all" : "test";

  if (!subject) return { ok: false, error: "Add a subject line." };
  if (!body) return { ok: false, error: "Write your note first." };

  const admin = createAdminClient() as unknown as SupabaseClient;

  if (mode === "test") {
    const to = user.email;
    if (!to) return { ok: false, error: "Your account has no email." };
    const html = communityNoteEmail({
      firstName: firstNameOf(profile?.full_name ?? null),
      heading,
      body,
      appUrl: APP_URL,
    });
    const { sent } = await sendNotification({ to, subject: `[Test] ${subject}`, html });
    return sent
      ? { ok: true, notice: `Test sent to ${to}.` }
      : { ok: false, error: "Could not send the test. Check email settings." };
  }

  // mode === "all": every resident with an email on file.
  const { data: residents } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("role", "resident")
    .not("email", "is", null)
    .returns<{ full_name: string | null; email: string | null }[]>();

  const recipients = (residents ?? []).filter((r) => r.email);
  if (recipients.length === 0) return { ok: false, error: "No residents have an email on file." };

  let sent = 0;
  for (const r of recipients) {
    const html = communityNoteEmail({
      firstName: firstNameOf(r.full_name),
      heading,
      body,
      appUrl: APP_URL,
    });
    const res = await sendNotification({ to: r.email!, subject, html });
    if (res.sent) sent++;
  }

  return {
    ok: true,
    notice: `Sent to ${sent} of ${recipients.length} resident${recipients.length === 1 ? "" : "s"}.`,
  };
}
