"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification, notificationHtml, customerHtml, esc } from "@/lib/email";
import { logFunnelEvent } from "@/lib/funnel";

export type GrowthState = { ok: boolean; error?: string };

function str(form: FormData, key: string): string | null {
  const v = (form.get(key) as string | null)?.trim();
  return v || null;
}

/** Join the waitlist — the list you lean on the moment a unit turns. */
export async function joinWaitlist(
  _prev: GrowthState,
  form: FormData
): Promise<GrowthState> {
  const name = str(form, "name");
  const email = str(form, "email");
  if (!name) return { ok: false, error: "Tell us your name." };
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email so we can reach you." };
  }

  const maxRent = str(form, "max_rent");
  const maxRentCents = maxRent
    ? Math.round(Number(maxRent.replace(/[$,\s]/g, "")) * 100) || null
    : null;

  const admin = createAdminClient() as unknown as SupabaseClient;
  const propertyId = str(form, "property_id");
  const { error } = await admin.from("waitlist_entries").insert({
    name,
    email,
    phone: str(form, "phone"),
    property_id: propertyId,
    bedrooms: str(form, "bedrooms"),
    max_rent_cents: maxRentCents,
    move_in_by: str(form, "move_in_by"),
    notes: str(form, "notes"),
  });
  if (error) return { ok: false, error: "Could not save — please try again." };

  await logFunnelEvent({
    step: "waitlist_join",
    sessionId: str(form, "fsid"),
    propertyId,
  });

  // Heads-up to the office + a warm confirmation to the prospect.
  await sendNotification({
    subject: `New waitlist signup — ${name}`,
    replyTo: email,
    html: notificationHtml("New waitlist signup", [
      ["Name", name],
      ["Email", email],
      ["Phone", str(form, "phone") ?? "—"],
      ["Wants", str(form, "bedrooms") ?? "any size"],
      ["Move-in by", str(form, "move_in_by") ?? "flexible"],
      ["Review", "https://38thaveproperties.com/admin/waitlist"],
    ]),
  });
  await sendNotification({
    to: email,
    subject: "You're on the list — 38th Ave Properties",
    html: customerHtml(`You're on the list, ${esc(name)}!`, [
      "Thanks for your interest in our Wheat Ridge communities. We'll reach out the moment a home that fits opens up — our units turn fast and the waitlist hears first.",
      "Reply to this email any time if your plans change.",
    ]),
  });

  return { ok: true };
}

/** Store a pre-qualification check. Soft screen only — never a denial. */
export async function submitPrequal(
  _prev: GrowthState,
  form: FormData
): Promise<GrowthState> {
  const incomeBand = str(form, "income_band");
  const hadEviction = form.get("had_eviction") === "yes";
  // Soft verdict: strong fit unless income is under ~2x or a prior eviction.
  const passed = incomeBand !== "under2x" && !hadEviction;

  const admin = createAdminClient() as unknown as SupabaseClient;
  await admin.from("prequal_submissions").insert({
    property_id: str(form, "property_id"),
    move_in: str(form, "move_in"),
    income_band: incomeBand,
    occupants: str(form, "occupants"),
    has_pets: form.get("has_pets") === "yes",
    has_voucher: form.get("has_voucher") === "yes",
    had_eviction: hadEviction,
    passed,
    email: str(form, "email"),
  });

  await logFunnelEvent({
    step: "prequal_complete",
    sessionId: str(form, "fsid"),
    propertyId: str(form, "property_id"),
  });

  return { ok: true };
}
