import Link from "next/link";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { PageHeader, StatusPill, EmptyState } from "@/components/dashboard-ui";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  role: string;
  avatar_url: string | null;
};

export default async function AdminResidents() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, created_at, role, avatar_url")
    .order("created_at", { ascending: false })
    .returns<ProfileRow[]>();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Residents & staff" subtitle="Everyone with portal access." />

      {profiles && profiles.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clay bg-sand/50 text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-sand/30">
                    <td className="px-5 py-3 font-medium text-ink">
                      <div className="flex items-center gap-3">
                        <Avatar size="sm" name={p.full_name} url={p.avatar_url} />
                        <Link href={`/admin/residents/${p.id}`} className="text-pine hover:underline">
                          {p.full_name ?? "—"}
                        </Link>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{p.email}</td>
                    <td className="px-5 py-3 text-ink-soft">{p.phone ?? "—"}</td>
                    <td className="px-5 py-3 text-ink-soft">{formatDate(p.created_at)}</td>
                    <td className="px-5 py-3">
                      <StatusPill value={p.role} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No accounts yet"
          body="Residents appear here after they create a portal account."
        />
      )}
    </div>
  );
}
