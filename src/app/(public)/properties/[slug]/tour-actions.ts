"use server";

import { createClient } from "@/lib/supabase/server";
import { sendNotification, notificationHtml } from "@/lib/email";

export type TourState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function str(form: FormData, key: string): string {
  return (form.get(key) as string | null)?.trim() ?? "";
}

export async function submitTourRequest(
  _prev: TourState,
  form: FormData
): Promise<TourState> {
  const name = str(form, "name");
  const email = str(form, "email");
  const phone = str(form, "phone");
  const preferred_date = str(form, "preferred_date");
  const preferred_time = str(form, "preferred_time");
  const message = str(form, "message");
  const property_id = str(form, "property_id");
  const property_name = str(form, "property_name");

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Required";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    fieldErrors.email = "Enter a valid email";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tour_requests").insert({
    property_id: property_id || null,
    name,
    email,
    phone: phone || null,
    preferred_date: preferred_date || null,
    preferred_time: preferred_time || null,
    message: message || null,
  });

  if (error) {
    return {
      ok: false,
      error: "Something went wrong submitting your request. Please try again.",
    };
  }

  // Notify staff (no-ops until email is configured).
  await sendNotification({
    subject: `New tour request — ${name}`,
    replyTo: email,
    html: notificationHtml("New tour request", [
      ["Name", name],
      ["Community", property_name],
      ["Email", email],
      ["Phone", phone],
      ["Preferred", [preferred_date, preferred_time].filter(Boolean).join(" ")],
      ["Review", "https://ficcoproperties.com/admin/tours"],
    ]),
  });

  return { ok: true };
}
