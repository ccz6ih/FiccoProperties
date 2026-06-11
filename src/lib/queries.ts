import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type Property = Tables<"properties">;
export type Unit = Tables<"units">;

export type PropertyWithCounts = Property & {
  unitCount: number;
  availableCount: number;
};

/** All properties with their total and available unit counts. */
export async function getPropertiesWithCounts(): Promise<PropertyWithCounts[]> {
  const supabase = await createClient();

  const [{ data: properties }, { data: units }] = await Promise.all([
    supabase.from("properties").select("*").order("created_at"),
    supabase.from("units").select("property_id, status"),
  ]);

  const byProperty = new Map<string, { total: number; available: number }>();
  for (const u of units ?? []) {
    const agg = byProperty.get(u.property_id) ?? { total: 0, available: 0 };
    agg.total += 1;
    if (u.status === "available" || u.status === "make_ready") agg.available += 1;
    byProperty.set(u.property_id, agg);
  }

  return (properties ?? []).map((p) => ({
    ...p,
    unitCount: byProperty.get(p.id)?.total ?? 0,
    availableCount: byProperty.get(p.id)?.available ?? 0,
  }));
}

/** A single property by slug plus its units. */
export async function getPropertyBySlug(slug: string) {
  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!property) return null;

  const { data: units } = await supabase
    .from("units")
    .select("*")
    .eq("property_id", property.id)
    .order("label");

  return { property, units: units ?? [] };
}
