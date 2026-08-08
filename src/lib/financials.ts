/**
 * Owner financials — assembles a per-property P&L for a calendar year from
 * what's already recorded: rent payments (income), contractor bills
 * (unit_costs), petty cash, and property-level expenses. Expense sources are
 * normalized into Schedule E categories so the tax export is one click.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type ScheduleECategory =
  | "advertising"
  | "auto_travel"
  | "cleaning_maintenance"
  | "insurance"
  | "legal_professional"
  | "management_fees"
  | "mortgage_interest"
  | "repairs"
  | "supplies"
  | "taxes"
  | "utilities"
  | "other";

/** Schedule E (Form 1040) line labels, in form order. */
export const CATEGORY_LABEL: Record<ScheduleECategory, string> = {
  advertising: "Advertising (line 5)",
  auto_travel: "Auto & travel (line 6)",
  cleaning_maintenance: "Cleaning & maintenance (line 7)",
  insurance: "Insurance (line 9)",
  legal_professional: "Legal & professional fees (line 10)",
  management_fees: "Management fees (line 11)",
  mortgage_interest: "Mortgage interest (line 12)",
  repairs: "Repairs (line 14)",
  supplies: "Supplies (line 15)",
  taxes: "Taxes (line 16)",
  utilities: "Utilities (line 17)",
  other: "Other (line 19)",
};

export const CATEGORY_ORDER: ScheduleECategory[] = [
  "advertising", "auto_travel", "cleaning_maintenance", "insurance",
  "legal_professional", "management_fees", "mortgage_interest", "repairs",
  "supplies", "taxes", "utilities", "other",
];

/** Contractor trades → Schedule E buckets. */
function mapTrade(trade: string | null): ScheduleECategory {
  const t = (trade ?? "").toLowerCase();
  if (t.includes("clean") || t.includes("landscap") || t.includes("snow") || t.includes("trash")) {
    return "cleaning_maintenance";
  }
  if (t.includes("legal") || t.includes("attorney") || t.includes("account")) return "legal_professional";
  return "repairs";
}

/** Petty-cash categories → Schedule E buckets. */
function mapPetty(category: string | null): ScheduleECategory {
  const c = (category ?? "").toLowerCase();
  if (c.includes("clean")) return "cleaning_maintenance";
  if (c.includes("repair") || c.includes("part")) return "repairs";
  if (c.includes("gas") || c.includes("mile") || c.includes("travel")) return "auto_travel";
  return "supplies";
}

export type PropertyFinancials = {
  propertyId: string | null; // null = unassigned/office
  name: string;
  incomeByMonth: number[]; // 12 entries, cents
  expenseByMonth: number[];
  incomeCents: number;
  expenseCents: number;
  byCategory: Partial<Record<ScheduleECategory, number>>;
};

export type YearFinancials = {
  year: number;
  properties: PropertyFinancials[];
  totalIncomeCents: number;
  totalExpenseCents: number;
};

type PaymentRow = { amount_cents: number; unit_id: string | null; charge_id: string | null; created_at: string };
type UnitRow = { id: string; property_id: string | null };
type ChargeRow = { id: string; unit_id: string | null };
type CostRow = { unit_id: string; trade: string | null; amount_cents: number; incurred_on: string };
type PettyRow = { property_id: string | null; unit_id: string | null; category: string | null; amount_cents: number; occurred_on: string };
type PropExpRow = { property_id: string; category: string; amount_cents: number; incurred_on: string };
type PropertyRow = { id: string; name: string | null };

export async function buildYearFinancials(year: number): Promise<YearFinancials> {
  const db = createAdminClient() as unknown as SupabaseClient;
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;

  const [
    { data: properties },
    { data: units },
    { data: payments },
    { data: charges },
    { data: costs },
    { data: petty },
    { data: propExp },
  ] = await Promise.all([
    db.from("properties").select("id, name").order("name").returns<PropertyRow[]>(),
    db.from("units").select("id, property_id").returns<UnitRow[]>(),
    db
      .from("payments")
      .select("amount_cents, unit_id, charge_id, created_at")
      .eq("status", "succeeded")
      .gte("created_at", from)
      .lt("created_at", to)
      .returns<PaymentRow[]>(),
    db.from("charges").select("id, unit_id").returns<ChargeRow[]>(),
    db
      .from("unit_costs")
      .select("unit_id, trade, amount_cents, incurred_on")
      .gte("incurred_on", from)
      .lt("incurred_on", to)
      .returns<CostRow[]>(),
    db
      .from("petty_cash_entries")
      .select("property_id, unit_id, category, amount_cents, occurred_on")
      .eq("kind", "expense")
      .gte("occurred_on", from)
      .lt("occurred_on", to)
      .returns<PettyRow[]>(),
    db
      .from("property_expenses")
      .select("property_id, category, amount_cents, incurred_on")
      .gte("incurred_on", from)
      .lt("incurred_on", to)
      .returns<PropExpRow[]>(),
  ]);

  const propByUnit = new Map<string, string>();
  for (const u of units ?? []) if (u.property_id) propByUnit.set(u.id, u.property_id);
  const unitByCharge = new Map<string, string>();
  for (const c of charges ?? []) if (c.unit_id) unitByCharge.set(c.id, c.unit_id);

  const blank = (): PropertyFinancials => ({
    propertyId: null,
    name: "Unassigned",
    incomeByMonth: Array(12).fill(0),
    expenseByMonth: Array(12).fill(0),
    incomeCents: 0,
    expenseCents: 0,
    byCategory: {},
  });

  const byProp = new Map<string, PropertyFinancials>();
  for (const p of properties ?? []) {
    byProp.set(p.id, { ...blank(), propertyId: p.id, name: p.name ?? "—" });
  }
  const UNASSIGNED = "__unassigned__";

  function bucket(propertyId: string | null): PropertyFinancials {
    const key = propertyId ?? UNASSIGNED;
    let b = byProp.get(key);
    if (!b) {
      b = blank();
      byProp.set(key, b);
    }
    return b;
  }

  function monthOf(dateIso: string): number {
    return Math.min(11, Math.max(0, Number(dateIso.slice(5, 7)) - 1));
  }

  // Income — resolve each payment to a property via unit, falling back to its charge's unit.
  for (const p of payments ?? []) {
    const unitId = p.unit_id ?? (p.charge_id ? unitByCharge.get(p.charge_id) ?? null : null);
    const propId = unitId ? propByUnit.get(unitId) ?? null : null;
    const b = bucket(propId);
    b.incomeCents += p.amount_cents;
    b.incomeByMonth[monthOf(p.created_at)] += p.amount_cents;
  }

  function addExpense(
    propId: string | null,
    category: ScheduleECategory,
    cents: number,
    dateIso: string
  ) {
    const b = bucket(propId);
    b.expenseCents += cents;
    b.expenseByMonth[monthOf(dateIso)] += cents;
    b.byCategory[category] = (b.byCategory[category] ?? 0) + cents;
  }

  for (const c of costs ?? []) {
    addExpense(propByUnit.get(c.unit_id) ?? null, mapTrade(c.trade), c.amount_cents, c.incurred_on);
  }
  for (const p of petty ?? []) {
    const propId = p.property_id ?? (p.unit_id ? propByUnit.get(p.unit_id) ?? null : null);
    addExpense(propId, mapPetty(p.category), p.amount_cents, p.occurred_on);
  }
  for (const e of propExp ?? []) {
    addExpense(e.property_id, (e.category as ScheduleECategory) ?? "other", e.amount_cents, e.incurred_on);
  }

  // Ordered list: real properties first (alphabetical), unassigned last if used.
  const list = [...byProp.entries()]
    .filter(([, v]) => v.incomeCents > 0 || v.expenseCents > 0 || v.propertyId != null)
    .map(([, v]) => v)
    .sort((a, b) => {
      if (a.propertyId == null) return 1;
      if (b.propertyId == null) return -1;
      return a.name.localeCompare(b.name);
    });

  return {
    year,
    properties: list,
    totalIncomeCents: list.reduce((s, p) => s + p.incomeCents, 0),
    totalExpenseCents: list.reduce((s, p) => s + p.expenseCents, 0),
  };
}
