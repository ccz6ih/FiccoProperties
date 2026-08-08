import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { PageHeader } from "@/components/dashboard-ui";
import { VendorAddForm, VendorTable, type Vendor } from "@/components/vendor-directory";
import { createClient } from "@/lib/supabase/server";

export default async function AdminVendors() {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: vendors } = await db
    .from("vendors")
    .select("id, name, trade, phone, email, notes, coi_expires_on, w9_on_file, active")
    .order("name")
    .returns<Vendor[]>();

  const list = vendors ?? [];
  const lapsed = list.filter((v) => {
    if (!v.active || !v.coi_expires_on) return false;
    const [y, m, d] = v.coi_expires_on.split("-").map(Number);
    return new Date(y, m - 1, d).getTime() < Date.now();
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Vendors"
        subtitle="Your contractors — with insurance and W-9 tracking so nothing lapses quietly."
      />

      {lapsed.length > 0 && (
        <div className="mb-6 rounded-xl border border-terracotta/40 bg-terracotta-soft px-4 py-3 text-sm text-terracotta-dark">
          <strong>{lapsed.length} vendor{lapsed.length === 1 ? " has" : "s have"} expired insurance:</strong>{" "}
          {lapsed.map((v) => v.name).join(", ")}. Ask for a current certificate before their next job —
          an uninsured contractor on your property is your exposure.
        </div>
      )}

      <Card className="mb-8 p-6">
        <h2 className="mb-1 font-display text-lg font-semibold text-ink">Add a vendor</h2>
        <p className="mb-4 text-xs text-ink-faint">
          Track the COI expiration and W-9 now — January-you will thank you at 1099 time.
        </p>
        <VendorAddForm />
      </Card>

      <VendorTable vendors={list} />
    </div>
  );
}
