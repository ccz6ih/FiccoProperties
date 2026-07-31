"use server";

import { sendNotification, notificationHtml, customerHtml, esc } from "@/lib/email";

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

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Required";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    fieldErrors.email = "Enter a valid email";
  if (!message) fieldErrors.message = "Required";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  // Notify staff. reply_to = the sender's email so a reply goes straight to
  // them; the recipient (staff inbox) comes from NOTIFY_EMAIL, so no personal
  // address is ever exposed to the visitor.
  await sendNotification({
    subject: `New message from ${name}`,
    replyTo: email,
    html: notificationHtml("New contact message", [
      ["Name", name],
      ["Email", email],
      ["Phone", phone],
      ["Message", esc(message)],
    ]),
  });

  // Confirmation to the sender.
  await sendNotification({
    to: email,
    subject: "We got your message — 38th Ave Properties",
    html: customerHtml(`Thanks for reaching out, ${esc(name)}!`, [
      "We've received your message and someone from our team will get back to you soon.",
      "Reply to this email any time with anything else.",
    ]),
  });

  return { ok: true };
}
