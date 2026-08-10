"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResidentUnitId } from "@/lib/occupancy";
import { sendNotification, notificationHtml } from "@/lib/email";
import { TENANT_ATTESTATION, maybeSendExecutedCopies } from "@/lib/repayment-esign";

export type SignState = { ok: boolean; error?: string };

/** Tenant signs their repayment agreement — typed name + attestation, IP/UA captured. */
export async function signRepaymentPlan(_prev: SignState, form: FormData): Promise<SignState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const planId = (form.get("plan_id") as string)?.trim();
  const signedName = (form.get("signed_name") as string)?.trim();
  if (!planId) return { ok: false, error: "Missing agreement." };
  if (!signedName) return { ok: false, error: "Type your full name to sign." };
  if (form.get("attest") !== "on") {
    return { ok: false, error: "Please check the box to agree to the schedule." };
  }

  const unitId = await getResidentUnitId(user.id);
  if (!unitId) return { ok: false, error: "No home is on file for your account yet." };

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: plan } = await db
    .from("repayment_plans")
    .select("id, unit_id, status, tenant_signed_at, units:unit_id(label, properties(name))")
    .eq("id", planId)
    .maybeSingle<{
      id: string;
      unit_id: string | null;
      status: string;
      tenant_signed_at: string | null;
      units: { label: string; properties: { name: string | null } | null } | null;
    }>();

  // Only the resident of this plan's unit may sign, once, on a live plan.
  if (!plan || plan.unit_id !== unitId) return { ok: false, error: "Agreement not found." };
  if (plan.status === "cancelled") return { ok: false, error: "This agreement has been cancelled." };
  if (plan.tenant_signed_at) return { ok: false, error: "You've already signed this agreement." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const ua = h.get("user-agent") || null;

  const { error } = await db
    .from("repayment_plans")
    .update({
      tenant_signed_name: signedName,
      tenant_signed_at: new Date().toISOString(),
      tenant_signed_ip: ip,
      tenant_signed_ua: ua,
      tenant_attestation: TENANT_ATTESTATION,
    })
    .eq("id", planId);
  if (error) return { ok: false, error: "Could not record your signature. Please try again." };

  const home = `${plan.units?.properties?.name ? `${plan.units.properties.name} · ` : ""}${plan.units?.label ?? ""}`;
  await sendNotification({
    subject: `Repayment agreement signed by tenant — ${home}`,
    html: notificationHtml("Tenant signed the repayment agreement", [
      ["Signed by", signedName],
      ["Home", home],
      ["Countersign", `https://38thaveproperties.com/admin/repayment-plans/${planId}`],
    ]),
  });

  // If the landlord already countersigned, both sides get the executed copy now.
  await maybeSendExecutedCopies(planId);

  revalidatePath("/portal/repayment");
  revalidatePath(`/admin/repayment-plans/${planId}`);
  return { ok: true };
}
