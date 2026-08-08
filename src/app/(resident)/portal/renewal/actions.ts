"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResidentUnitId } from "@/lib/occupancy";
import { sendNotification } from "@/lib/email";
import { getOwnerRecipients } from "@/lib/owners";
import { renewalResponseAlert, renewalAcceptedReceipt } from "@/lib/renewal-email";
import { formatDate } from "@/lib/format";

export type RespondState = { ok: boolean; error?: string };

type OfferRow = {
  id: string;
  unit_id: string;
  resident_id: string | null;
  new_rent_cents: number;
  term_months: number;
  effective_date: string;
  status: string;
};

export async function respondToRenewal(
  _prev: RespondState,
  form: FormData
): Promise<RespondState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const offerId = (form.get("offer_id") as string)?.trim();
  const mode = (form.get("mode") as string)?.trim(); // accept | decline
  if (!offerId || !["accept", "decline"].includes(mode)) {
    return { ok: false, error: "Something went wrong — please refresh and try again." };
  }

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: offer } = await db
    .from("renewal_offers")
    .select("id, unit_id, resident_id, new_rent_cents, term_months, effective_date, status")
    .eq("id", offerId)
    .maybeSingle<OfferRow>();
  if (!offer) return { ok: false, error: "This offer no longer exists." };
  if (offer.status !== "sent" && offer.status !== "draft") {
    return { ok: false, error: "This offer has already been answered or closed." };
  }

  // The responder must live in the offer's unit.
  const myUnit = await getResidentUnitId(user.id);
  const isMine = offer.resident_id === user.id || myUnit === offer.unit_id;
  if (!isMine) return { ok: false, error: "This offer isn't linked to your home." };

  const nowIso = new Date().toISOString();

  // Home + names for the emails.
  const [{ data: unit }, { data: profile }] = await Promise.all([
    db
      .from("units")
      .select("label, properties(name)")
      .eq("id", offer.unit_id)
      .maybeSingle<{ label: string; properties: { name: string | null } | null }>(),
    db
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null; email: string | null }>(),
  ]);
  const home = unit ? `${unit.properties?.name ? `${unit.properties.name} · ` : ""}${unit.label}` : "your home";
  const tenantName = profile?.full_name ?? user.email ?? "Resident";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://38thaveproperties.com").replace(/\/$/, "");
  const adminUrl = `${appUrl}/admin/renewals/${offer.id}`;

  if (mode === "accept") {
    const signedName = (form.get("signed_name") as string)?.trim();
    if (!signedName) return { ok: false, error: "Type your full name to sign." };
    if (form.get("agree") !== "on") {
      return { ok: false, error: "Please check the box to agree to the new terms." };
    }

    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;

    const { error } = await db
      .from("renewal_offers")
      .update({
        status: "accepted",
        accepted_at: nowIso,
        accepted_by: user.id,
        signed_name: signedName,
        signed_ip: ip,
      })
      .eq("id", offer.id)
      .in("status", ["sent", "draft"]);
    if (error) return { ok: false, error: "Could not record your acceptance. Please try again." };

    const alert = renewalResponseAlert({
      tenantName,
      home,
      newRentCents: offer.new_rent_cents,
      termMonths: offer.term_months,
      effectiveDate: formatDate(offer.effective_date),
      accepted: true,
      adminUrl,
    });
    const owners = await getOwnerRecipients();
    if (owners.length > 0) {
      await sendNotification({
        to: owners.join(","),
        subject: alert.subject,
        html: alert.html,
        meta: { kind: "renewal_accepted", refType: "renewal", refId: offer.id },
      });
    }
    if (profile?.email) {
      const receipt = renewalAcceptedReceipt({
        firstName: tenantName.split(" ")[0],
        home,
        newRentCents: offer.new_rent_cents,
        termMonths: offer.term_months,
        effectiveDate: formatDate(offer.effective_date),
        signedName,
        signedAt: new Date(nowIso).toLocaleString("en-US", {
          year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
        }),
      });
      await sendNotification({ to: profile.email, subject: receipt.subject, html: receipt.html });
    }
  } else {
    const reason = (form.get("reason") as string)?.trim() || null;
    const { error } = await db
      .from("renewal_offers")
      .update({ status: "declined", declined_at: nowIso, decline_reason: reason })
      .eq("id", offer.id)
      .in("status", ["sent", "draft"]);
    if (error) return { ok: false, error: "Could not record your response. Please try again." };

    const alert = renewalResponseAlert({
      tenantName,
      home,
      newRentCents: offer.new_rent_cents,
      termMonths: offer.term_months,
      effectiveDate: formatDate(offer.effective_date),
      accepted: false,
      declineReason: reason,
      adminUrl,
    });
    const owners = await getOwnerRecipients();
    if (owners.length > 0) {
      await sendNotification({
        to: owners.join(","),
        subject: alert.subject,
        html: alert.html,
        meta: { kind: "renewal_declined", refType: "renewal", refId: offer.id },
      });
    }
  }

  revalidatePath("/portal/renewal");
  revalidatePath("/admin/renewals");
  revalidatePath(`/admin/renewals/${offer.id}`);
  return { ok: true };
}
