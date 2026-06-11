import { redirect } from "next/navigation";
import { DashboardShell, type NavItem } from "@/components/dashboard-shell";
import { navIcons } from "@/components/icons";
import { requireProfile, isStaff } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireProfile("/admin");
  if (!isStaff(profile)) redirect("/portal");

  const nav: NavItem[] = [
    { href: "/admin", label: "Overview", icon: navIcons.home },
    { href: "/admin/applications", label: "Applications", icon: navIcons.inbox },
    { href: "/admin/maintenance", label: "Maintenance", icon: navIcons.wrench },
    { href: "/admin/leases", label: "Leases", icon: navIcons.doc },
    { href: "/admin/residents", label: "Residents", icon: navIcons.users },
  ];

  return (
    <DashboardShell
      brandHref="/admin"
      brandLabel="Ficco Admin"
      nav={nav}
      user={{ email: user.email, name: profile?.full_name, role: profile?.role }}
    >
      {children}
    </DashboardShell>
  );
}
