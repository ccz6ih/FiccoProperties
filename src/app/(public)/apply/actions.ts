"use server";

import { createClient } from "@/lib/supabase/server";

export type ApplyState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function str(form: FormData, key: string): string {
  return (form.get(key) as string | null)?.trim() ?? "";
}

export async function submitApplication(
  _prev: ApplyState,
  form: FormData
): Promise<ApplyState> {
  const first_name = str(form, "first_name");
  const last_name = str(form, "last_name");
  const email = str(form, "email");
  const phone = str(form, "phone");
  const property_id = str(form, "property_id");
  const desired_move_in = str(form, "desired_move_in");
  const household_size = str(form, "household_size");
  const monthly_income = str(form, "monthly_income");
  const message = str(form, "message");

  const fieldErrors: Record<string, string> = {};
  if (!first_name) fieldErrors.first_name = "Required";
  if (!last_name) fieldErrors.last_name = "Required";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    fieldErrors.email = "Enter a valid email";
  if (!property_id) fieldErrors.property_id = "Choose a community";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("applications").insert({
    first_name,
    last_name,
    email,
    phone: phone || null,
    property_id: property_id || null,
    desired_move_in: desired_move_in || null,
    household_size: household_size ? Number(household_size) : null,
    monthly_income_cents: monthly_income
      ? Math.round(Number(monthly_income) * 100)
      : null,
    message: message || null,
    created_by: user?.id ?? null,
  });

  if (error) {
    return {
      ok: false,
      error: "Something went wrong submitting your application. Please try again.",
    };
  }

  return { ok: true };
}
