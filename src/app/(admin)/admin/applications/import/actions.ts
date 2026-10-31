"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, isStaff } from "@/lib/auth";

export type ImportState = {
  ok: boolean;
  error?: string;
  notice?: string;
  /** Where to go next once it worked. */
  unitId?: string;
};

const text = (f: FormData, k: string) => ((f.get(k) as string) ?? "").trim();
const cents = (f: FormData, k: string) => {
  const raw = text(f, k).replace(/[$,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};
const date = (f: FormData, k: string) => {
  const raw = text(f, k);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
};

/**
 * Bring an applicant across from Zillow without making them apply again.
 *
 * Zillow has already taken the application, run the background check and
 * verified identity. Asking the same person to re-enter all of it here is the
 * fastest way to lose them, so this records what Zillow found and marks the
 * application approved and screened in one pass.
 *
 * The second adult is optional and deliberately thin: on a joint application
 * only one person usually supplies contact details, and a co-applicant with no
 * email still needs their screening on file.
 */
export async function importZillowApplication(
  _prev: ImportState,
  form: FormData
): Promise<ImportState> {
  const { profile } = await requireProfile("/admin/applications/import");
  if (!isStaff(profile)) return { ok: false, error: "Staff only." };

  const unitId = text(form, "unit_id");
  const firstName = text(form, "first_name");
  const lastName = text(form, "last_name");
  const email = text(form, "email").toLowerCase();

  if (!unitId) return { ok: false, error: "Pick the home they're moving into." };
  if (!firstName || !lastName) return { ok: false, error: "Their name is needed." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "A valid email is needed — it's how they get into the portal." };
  }

  const db = createAdminClient() as unknown as SupabaseClient;

  const { data: unit } = await db
    .from("units")
    .select("id, label, property_id, rent_cents, properties(name)")
    .eq("id", unitId)
    .maybeSingle<{
      id: string;
      label: string;
      property_id: string;
      rent_cents: number | null;
      properties: { name: string | null } | null;
    }>();
  if (!unit) return { ok: false, error: "That home could not be found." };

  const home = `${unit.properties?.name ? `${unit.properties.name} · ` : ""}${unit.label}`;

  // Guard against the same application being imported twice — easy to do when
  // you're working from an email and a browser tab.
  const { data: dupe } = await db
    .from("applications")
    .select("id")
    .eq("unit_id", unitId)
    .ilike("first_name", firstName)
    .ilike("last_name", lastName)
    .maybeSingle<{ id: string }>();
  if (dupe) {
    return {
      ok: false,
      error: `${firstName} ${lastName} is already on file for ${home}. Open the application rather than importing it again.`,
    };
  }

  const phone = text(form, "phone") || null;
  const moveIn = date(form, "desired_move_in");
  const screeningClear = text(form, "screening_clear") === "yes";
  const creditScore = text(form, "credit_score");
  const notesIn = text(form, "screening_notes");

  // Build the screening summary from what was entered, so the file reads the
  // same whoever typed it in.
  const summary = [
    "Source: Zillow Rental Manager application, imported by staff. Applicant did not re-apply here.",
    screeningClear
      ? "Background check: no criminal records, no housing-court or eviction records."
      : "Background check: FLAGGED — see notes below before proceeding.",
    creditScore ? `Credit score reported: ${creditScore}.` : null,
    notesIn || null,
  ]
    .filter(Boolean)
    .join("\n");

  const base = {
    property_id: unit.property_id,
    unit_id: unitId,
    email,
    phone,
    desired_move_in: moveIn,
    household_size: text(form, "second_first_name") ? 2 : 1,
    current_address: text(form, "current_address") || null,
    current_residency_length: text(form, "current_residency_length") || null,
    reason_for_moving: text(form, "reason_for_moving") || null,
    landlord_name: text(form, "landlord_name") || null,
    landlord_phone: text(form, "landlord_phone") || null,
    authorize_screening: true,
    authorize_landlord_contact: true,
    status: "approved",
    screening_status: screeningClear ? "passed" : "review",
    created_by: profile?.id ?? null,
  };

  const { error: appErr } = await db.from("applications").insert({
    ...base,
    first_name: firstName,
    last_name: lastName,
    date_of_birth: date(form, "date_of_birth"),
    monthly_income_cents: cents(form, "monthly_income"),
    employer_name: text(form, "employer_name") || null,
    employer_phone: text(form, "employer_phone") || null,
    signature_name: `${firstName} ${lastName}`,
    message: "Imported from Zillow. Did not re-apply here.",
    screening_notes: summary,
  });
  if (appErr) return { ok: false, error: `Could not save the application: ${appErr.message}` };

  // The second adult, where there is one.
  const secondFirst = text(form, "second_first_name");
  const secondLast = text(form, "second_last_name") || lastName;
  if (secondFirst) {
    await db.from("applications").insert({
      ...base,
      first_name: secondFirst,
      last_name: secondLast,
      date_of_birth: date(form, "second_date_of_birth"),
      message: "Imported from Zillow. Co-applicant; contact details are the primary's.",
      screening_notes: [
        "Source: Zillow Rental Manager. Co-applicant on the same application.",
        screeningClear
          ? "Background check: no criminal records, no housing-court or eviction records."
          : "Background check: FLAGGED — see the primary applicant's notes.",
      ].join("\n"),
    });
  }

  // Portal account, so the welcome and the lease have somewhere to land.
  const admin = createAdminClient();
  const fullName = `${firstName} ${lastName}`;
  let { data: account } = await db
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle<{ id: string }>();

  if (!account) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: `38thAve-${crypto.randomUUID().slice(0, 8)}`,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createErr || !created?.user) {
      return {
        ok: false,
        error: `The application saved, but the portal account failed: ${createErr?.message ?? "unknown"}. Link it by hand from the home.`,
      };
    }
    account = { id: created.user.id };
  }
  await db.from("profiles").update({ full_name: fullName, phone }).eq("id", account.id);

  await db
    .from("unit_occupants")
    .upsert(
      { unit_id: unitId, profile_id: account.id, is_primary: true },
      { onConflict: "unit_id,profile_id" }
    );

  // Set the tenancy. move_in_date is left alone on purpose — the resident
  // confirms it themselves in the welcome flow, and onboarding stays open so
  // the welcome steps show.
  const householdName = secondFirst
    ? secondLast === lastName
      ? `${firstName} & ${secondFirst} ${lastName}`
      : `${firstName} ${lastName} / ${secondFirst} ${secondLast}`
    : fullName;

  const rent = cents(form, "rent") ?? unit.rent_cents;
  const deposit = cents(form, "deposit");

  await db
    .from("unit_occupancy")
    .update({
      occupant_profile_id: account.id,
      tenant_name: householdName,
      tenant_email: email,
      tenant_phone: phone,
      ...(rent != null ? { rent_cents: rent } : {}),
      ...(deposit != null ? { deposit_cents: deposit } : {}),
      onboarding_completed_at: null,
      // A home being re-let has no outstanding notice any more.
      notice_given_on: null,
      notice_move_out_on: null,
      notice_reason: null,
    })
    .eq("unit_id", unitId);

  if (rent != null && rent !== unit.rent_cents) {
    await db.from("units").update({ rent_cents: rent }).eq("id", unitId);
  }

  await db.from("unit_log_entries").insert({
    unit_id: unitId,
    kind: "tenancy",
    body: `Imported from Zillow: ${householdName}. Screening ${
      screeningClear ? "clear" : "flagged for review"
    }. Awaiting their move-in day, payment method and the lease.`,
  });

  revalidatePath(`/admin/units/${unitId}`);
  revalidatePath("/admin/applications");
  revalidatePath("/admin");

  return {
    ok: true,
    unitId,
    notice: `${householdName} is set up on ${home}. Send them the welcome next.`,
  };
}
