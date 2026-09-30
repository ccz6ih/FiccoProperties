"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { formatCents, formatDate } from "@/lib/format";
import { notifyOwnersOfMoveOut } from "@/lib/move-out-email";

/** Notes are plain text; a line break is content, not markup. */
const NL = String.fromCharCode(10);

type OccupancySnapshot = {
  occupant_profile_id: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  tenant_phone: string | null;
  rent_cents: number | null;
  deposit_cents: number | null;
  move_in_date: string | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  notes: string | null;
};

/**
 * End a tenancy: the one action that actually moves someone out.
 *
 * The tenancy is archived to tenancy_history and the unit_occupancy row is
 * cleared. That clearing is the point — every screen that reads occupancy as
 * "who lives here" (rent board, billing, reminders, notices, owner reports)
 * goes vacant the moment it happens, so nobody bills or duns a tenant who's
 * gone. The deposit disposition reads the archive, so the paperwork still works.
 */
export async function recordMoveOut(form: FormData) {
  const { profile } = await requireProfile("/admin/move-out");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  const moveOutDate = (form.get("move_out_date") as string)?.trim();
  if (!unitId || !moveOutDate) return;

  const forwarding = (form.get("forwarding_address") as string)?.trim() || null;
  const reason = (form.get("move_out_reason") as string)?.trim() || null;
  const voidFuture = form.get("void_future_charges") === "on";
  const noticeGivenOn = (form.get("notice_given_on") as string)?.trim() || null;
  const walkthroughNote = (form.get("walkthrough_note") as string)?.trim() || null;

  // The walk-through. Unticked means "not clear" — that is what the owners see
  // flagged, and what a deposit deduction would later have to rest on.
  const CHECKS: { name: string; label: string }[] = [
    { name: "chk_notice", label: "Proper written notice given" },
    { name: "chk_keys", label: "All keys, fobs and openers returned" },
    { name: "chk_empty", label: "Home emptied — nothing left behind" },
    { name: "chk_clean", label: "Cleaned to move-in standard" },
    { name: "chk_damage", label: "No damage beyond normal wear" },
    { name: "chk_photos", label: "Move-out photos taken" },
    { name: "chk_utilities", label: "Utilities transferred out of their name" },
  ];
  const checklist = CHECKS.map((c) => ({ label: c.label, ok: form.get(c.name) === "on" }));

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: occ } = await db
    .from("unit_occupancy")
    .select(
      "occupant_profile_id, tenant_name, tenant_email, tenant_phone, rent_cents, deposit_cents, move_in_date, lease_start_date, lease_end_date, notes"
    )
    .eq("unit_id", unitId)
    .maybeSingle<OccupancySnapshot>();
  if (!occ) return;

  // 1. Archive first — nothing is cleared until the record is safely stored.
  const { error: archiveError } = await db.from("tenancy_history").insert({
    unit_id: unitId,
    occupant_profile_id: occ.occupant_profile_id,
    tenant_name: occ.tenant_name,
    tenant_email: occ.tenant_email,
    tenant_phone: occ.tenant_phone,
    rent_cents: occ.rent_cents,
    deposit_cents: occ.deposit_cents,
    move_in_date: occ.move_in_date,
    move_out_date: moveOutDate,
    lease_start_date: occ.lease_start_date,
    lease_end_date: occ.lease_end_date,
    forwarding_address: forwarding,
    notes: [
      occ.notes,
      `Move-out walk-through (${formatDate(moveOutDate)}):`,
      ...checklist.map((c) => `  ${c.ok ? "[x]" : "[ ]"} ${c.label}`),
      noticeGivenOn ? `  Notice given: ${formatDate(noticeGivenOn)}` : "  Notice given: not recorded",
      walkthroughNote ? `  Note: ${walkthroughNote}` : null,
    ]
      .filter(Boolean)
      .join(NL),
    move_out_reason: reason,
    ended_by: profile!.id,
  });
  if (archiveError) return;

  // 2. Carry the deposit onto the settlement so the disposition opens ready.
  if (occ.deposit_cents) {
    await db.from("deposit_settlements").upsert(
      {
        unit_id: unitId,
        deposit_cents: occ.deposit_cents,
        status: "draft",
        updated_by: profile!.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "unit_id", ignoreDuplicates: true }
    );
  }

  // 3. Drop any rent charged for a month that starts after they were gone.
  //    Anything still owed for their time here stays on the books.
  let voided = 0;
  if (voidFuture) {
    const { data: killed } = await db
      .from("charges")
      .update({ status: "void" })
      .eq("unit_id", unitId)
      .eq("status", "open")
      .gt("due_date", moveOutDate)
      .select("id, amount_cents")
      .returns<{ id: string; amount_cents: number }[]>();
    voided = (killed ?? []).length;
  }

  // 4. Close out the tenancy records themselves.
  await db.from("unit_occupancy").delete().eq("unit_id", unitId);
  await db.from("unit_occupants").delete().eq("unit_id", unitId);
  await db.from("leases").update({ status: "ended" }).eq("unit_id", unitId).eq("status", "active");
  await db.from("units").update({ status: "make_ready" }).eq("id", unitId);

  // 5. Leave a line in the unit's own history.
  const owed = voided > 0 ? ` ${voided} future rent charge${voided === 1 ? "" : "s"} voided.` : "";
  const rent = occ.rent_cents ? ` Rent was ${formatCents(occ.rent_cents)}.` : "";
  await db.from("unit_log_entries").insert({
    unit_id: unitId,
    resident_id: occ.occupant_profile_id,
    kind: "tenancy",
    body: `Moved out ${formatDate(moveOutDate)} — ${occ.tenant_name ?? "tenant"}${
      occ.move_in_date ? `, here since ${formatDate(occ.move_in_date)}` : ""
    }.${rent}${reason ? ` Reason: ${reason}.` : ""}${owed} Home set to make-ready.`,
    performed_on: moveOutDate,
    author_id: profile!.id,
  });

  // 6. Tell the owners. A move-out starts a 30-day deposit clock, so Lou and
  //    Tony hear about it when it happens rather than when someone remembers.
  const { data: unitRow } = await db
    .from("units")
    .select("label, properties(name)")
    .eq("id", unitId)
    .maybeSingle<{ label: string; properties: { name: string | null } | null }>();
  const home = `${unitRow?.properties?.name ? `${unitRow.properties.name} · ` : ""}${
    unitRow?.label ?? ""
  }`;
  try {
    await notifyOwnersOfMoveOut({
      unitId,
      home: home || "a home",
      tenantName: occ.tenant_name ?? "The resident",
      moveInDate: occ.move_in_date,
      moveOutDate,
      rentCents: occ.rent_cents,
      depositCents: occ.deposit_cents,
      forwardingAddress: forwarding,
      reason,
      noticeGivenOn,
      checklist: walkthroughNote
        ? [...checklist, { label: "Note", ok: true, note: walkthroughNote }]
        : checklist,
      voidedCharges: voided,
    });
  } catch {
    /* the move-out itself is recorded; the email is best-effort */
  }

  revalidatePath("/admin/rent-board");
  revalidatePath("/admin/delinquency");
  revalidatePath("/admin/turns");
  revalidatePath(`/admin/units/${unitId}`);
  revalidatePath(`/admin/case-file/${unitId}`);
  redirect(`/admin/move-out/${unitId}`);
}

/** Save the deposit amount + notes/status for a unit's move-out settlement. */
export async function saveDepositSettlement(form: FormData) {
  const { profile } = await requireProfile("/admin/move-out");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  if (!unitId) return;
  const depositDollars = Number(form.get("deposit_dollars"));
  const notes = (form.get("notes") as string)?.trim() || null;
  const status = (form.get("status") as string)?.trim() === "finalized" ? "finalized" : "draft";

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("deposit_settlements").upsert(
    {
      unit_id: unitId,
      deposit_cents: Number.isFinite(depositDollars) ? Math.round(depositDollars * 100) : 0,
      notes,
      status,
      updated_by: profile!.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "unit_id" }
  );

  revalidatePath(`/admin/move-out/${unitId}`);
}

/** Add an itemized deduction. */
export async function addDeduction(form: FormData) {
  const { profile } = await requireProfile("/admin/move-out");
  if (!isStaff(profile)) return;

  const unitId = (form.get("unit_id") as string)?.trim();
  const description = (form.get("description") as string)?.trim();
  const amountDollars = Number(form.get("amount_dollars"));
  if (!unitId || !description || !Number.isFinite(amountDollars) || amountDollars <= 0) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("deposit_deductions").insert({
    unit_id: unitId,
    description,
    amount_cents: Math.round(amountDollars * 100),
    created_by: profile!.id,
  });

  revalidatePath(`/admin/move-out/${unitId}`);
}

/** Remove a deduction. */
export async function deleteDeduction(form: FormData) {
  const { profile } = await requireProfile("/admin/move-out");
  if (!isStaff(profile)) return;

  const id = (form.get("id") as string)?.trim();
  const unitId = (form.get("unit_id") as string)?.trim();
  if (!id) return;

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  await db.from("deposit_deductions").delete().eq("id", id);

  if (unitId) revalidatePath(`/admin/move-out/${unitId}`);
}
