"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_STATUS = ["occupied", "available", "make_ready", "offline"];

function num(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function setUnitStatus(form: FormData) {
  const id = form.get("id") as string;
  const status = form.get("status") as string;
  if (!id || !ALLOWED_STATUS.includes(status)) return;

  const supabase = await createClient();
  await supabase.from("units").update({ status }).eq("id", id);

  revalidatePath("/admin/properties");
  revalidatePath("/admin");
}

export async function updateUnit(form: FormData) {
  const id = form.get("id") as string;
  const status = form.get("status") as string;
  if (!id || !ALLOWED_STATUS.includes(status)) return;

  const label = (form.get("label") as string)?.trim();
  if (!label) return;

  const dollars = num(form.get("rent_dollars"));

  const supabase = await createClient();
  await supabase
    .from("units")
    .update({
      label,
      status,
      bedrooms: num(form.get("bedrooms")),
      bathrooms: num(form.get("bathrooms")),
      sqft: num(form.get("sqft")),
      rent_cents: dollars == null ? null : Math.round(dollars * 100),
      notes: ((form.get("notes") as string) ?? "").trim() || null,
    })
    .eq("id", id);

  revalidatePath("/admin/properties");
  revalidatePath("/admin");
}
