"use server";

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNotification, notificationHtml, customerHtml, esc } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { HONEYPOT_FIELD } from "@/lib/contact-honeypot";
import {
  clientIp,
  hashIp,
  screenContent,
  withinRateLimit,
  recordSubmission,
} from "@/lib/contact-guard";

export type ContactState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function str(form: FormData, key: string): string {
  return (form.get(key) as string | null)?.trim() ?? "";
}

export async function submitContactMessage(
  _prev: ContactState,
  form: FormData
): Promise<ContactState> {
  const name = str(form, "name");
  const email = str(form, "email");
  const phone = str(form, "phone");
  const message = str(form, "message");
  const honeypot = str(form, HONEYPOT_FIELD);

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Required";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    fieldErrors.email = "Enter a valid email";
  if (!message) fieldErrors.message = "Required";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const db = createAdminClient() as unknown as SupabaseClient;
  const ipHash = hashIp(clientIp(await headers()));

  // Every rejection below returns `ok: true` and sends nothing. A bot that is
  // told which rule it broke simply edits its payload and tries again; one
  // that believes it succeeded keeps posting into a void.
  const screened = screenContent({ name, email, phone, message, honeypot });
  if (!screened.ok) {
    await recordSubmission(db, {
      ipHash, name, email, phone, message,
      verdict: screened.verdict, reason: screened.reason,
    });
    return { ok: true };
  }

  const rated = await withinRateLimit(db, ipHash, email);
  if (!rated.ok) {
    await recordSubmission(db, {
      ipHash, name, email, phone, message,
      verdict: rated.verdict, reason: rated.reason,
    });
    return { ok: true };
  }

  await recordSubmission(db, { ipHash, name, email, phone, message, verdict: "accepted" });

  // Notify staff. reply_to = the sender's email so a reply goes straight to
  // them; the recipient (staff inbox) comes from NOTIFY_EMAIL, so no personal
  // address is ever exposed to the visitor.
  await sendNotification({
    subject: `New message from ${name}`,
    replyTo: email,
    meta: { kind: "contact_enquiry" },
    html: notificationHtml("New contact message", [
      ["Name", name],
      ["Email", email],
      ["Phone", phone],
      ["Message", esc(message)],
    ]),
  });

  // Confirmation to the sender.
  //
  // This is the line that was abused: it emails an address a stranger typed,
  // so it is only ever reached after the checks above have passed. It also
  // carries none of their text any more — the greeting used to repeat the
  // submitted name, which let a spammer put their message in front of someone
  // who never asked for it, with our domain on the envelope.
  await sendNotification({
    to: email,
    subject: "We got your message — 38th Ave Properties",
    meta: { kind: "contact_ack" },
    html: customerHtml("Thanks for reaching out!", [
      "We've received your message and someone from our team will get back to you soon.",
      "Reply to this email any time with anything else.",
    ]),
  });

  return { ok: true };
}
