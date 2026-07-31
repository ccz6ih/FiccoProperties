"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification, esc } from "@/lib/email";
import { formatCents } from "@/lib/format";

export type SignState = { ok: boolean; error?: string };

type LeaseDetail = {
  rent_cents: number;
  deposit_cents: number;
  start_date: string;
  end_date: string | null;
  terms: string | null;
  units: { label: string; properties: { name: string | null } | null } | null;
};

/** Email signed-lease copies to the resident and the owners (you + Lou). */
async function emailLeaseCopies(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leaseId: string,
  residentEmail: string | undefined,
  signatureName: string
) {
  const { data: ld } = await supabase
    .from("leases")
    .select(
      "rent_cents, deposit_cents, start_date, end_date, terms, units(label, properties(name))"
    )
    .eq("id", leaseId)
    .maybeSingle<LeaseDetail>();

  const home = ld?.units?.properties?.name
    ? `${ld.units.properties.name} — ${ld.units.label}`
    : "Your home";
  const signedOn = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const row = (k: string, v: string) =>
    `<tr><td style="padding:3px 14px 3px 0;color:#6f655a;font-size:13px">${k}</td><td style="padding:3px 0;font-size:13px"><strong>${v}</strong></td></tr>`;
  const details = `<table style="border-collapse:collapse;margin:10px 0">${[
    row("Home", esc(home)),
    row("Monthly rent", ld ? esc(formatCents(ld.rent_cents)) : "—"),
    row("Deposit", ld ? esc(formatCents(ld.deposit_cents)) : "—"),
    row(
      "Term",
      `${esc(ld?.start_date ?? "—")}${ld?.end_date ? " – " + esc(ld.end_date) : ""}`
    ),
    row("Signed by", `${esc(signatureName)} on ${signedOn}`),
  ].join("")}</table>`;
  const termsBlock = ld?.terms
    ? `<pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;color:#2c2622;background:#faf7f1;border:1px solid #e6dcc8;border-radius:8px;padding:12px;margin-top:10px">${esc(ld.terms)}</pre>`
    : "";

  if (residentEmail) {
    await sendNotification({
      to: residentEmail,
      subject: "Your signed lease — 38th Ave Properties",
      html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:620px;color:#2c2622"><div style="font-family:Georgia,serif;font-size:20px;color:#2f5d50">Your lease is signed ✓</div><p style="font-size:14px;line-height:1.6">Thank you, ${esc(
        signatureName
      )}. Here's your copy — you can also view it anytime in your resident portal.</p>${details}${termsBlock}<p style="font-size:12px;color:#9b9286;margin-top:16px">38th Ave Properties · W 38th Ave, Wheat Ridge, CO</p></div>`,
    });
  }

  // Read staff emails with the service-role client — the resident's own session
  // can't see other profiles under RLS (which is why no notice was sent before).
  const { data: owners } = await createAdminClient()
    .from("profiles")
    .select("email")
    .in("role", ["owner", "admin"]);
  const ownerEmails = [
    ...(owners ?? []).map((o) => o.email).filter((e): e is string => !!e),
    ...(process.env.NOTIFY_EMAIL ? [process.env.NOTIFY_EMAIL] : []),
  ];
  const staffTo = [...new Set(ownerEmails)].join(",");
  if (staffTo) {
    await sendNotification({
      to: staffTo,
      subject: `Lease signed — ${signatureName} (${home})`,
      html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:620px;color:#2c2622"><div style="font-family:Georgia,serif;font-size:20px;color:#2f5d50">Lease signed</div><p style="font-size:14px">A lease was just e-signed.</p>${details}<p style="font-size:13px"><a href="https://38thaveproperties.com/admin/leases/${leaseId}" style="color:#2f5d50;font-weight:600">Open in admin →</a></p>${termsBlock}</div>`,
    });
  }
}

/** Resident e-signs their own pending lease, flipping it to active. */
export async function signLease(
  _prev: SignState,
  form: FormData
): Promise<SignState> {
  const lease_id = (form.get("lease_id") as string)?.trim();
  const signature_name = (form.get("signature_name") as string)?.trim();
  const consent = form.get("consent");

  const ackLabels = form.getAll("ack_label").map((s) => String(s));
  const ackInits = form.getAll("ack_initials").map((s) => String(s).trim());

  if (!lease_id) return { ok: false, error: "Missing lease reference." };
  if (!signature_name) return { ok: false, error: "Please type your full legal name." };
  if (ackLabels.length === 0 || ackInits.length !== ackLabels.length || ackInits.some((x) => !x))
    return { ok: false, error: "Please initial each acknowledgement." };
  if (!consent) return { ok: false, error: "Please check the consent box to sign." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  // Confirm the lease belongs to this resident and is awaiting signature. RLS
  // also enforces this, but we check to give a clear message.
  const { data: lease } = await supabase
    .from("leases")
    .select("id, status, resident_id")
    .eq("id", lease_id)
    .maybeSingle();

  if (!lease || lease.resident_id !== user.id)
    return { ok: false, error: "Lease not found." };
  if (lease.status !== "pending_signature")
    return { ok: false, error: "This lease is not awaiting your signature." };

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    null;

  const db = supabase as unknown as SupabaseClient;

  const { error } = await db
    .from("leases")
    .update({
      status: "active",
      signature_name,
      signature_ip: ip,
      signed_at: new Date().toISOString(),
    })
    .eq("id", lease_id);

  if (error) return { ok: false, error: "Could not record your signature. Please try again." };

  await db.from("lease_events").insert([
    {
      lease_id,
      actor_id: user.id,
      type: "signed",
      note: `Signed electronically by ${signature_name}`,
    },
    ...ackLabels.map((label, i) => ({
      lease_id,
      actor_id: user.id,
      type: "initial",
      note: `Initialed (${ackInits[i]}): ${label}`,
    })),
  ]);

  // Email copies to the resident and the owners.
  await emailLeaseCopies(supabase, lease_id, user.email, signature_name);

  revalidatePath("/portal/lease");
  revalidatePath("/portal");
  revalidatePath(`/admin/leases/${lease_id}`);
  return { ok: true };
}
