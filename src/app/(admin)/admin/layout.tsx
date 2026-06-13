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
    { href: "/admin/properties", label: "Properties", icon: navIcons.building },
    { href: "/admin/tenants/new", label: "Add tenant", icon: navIcons.users },
    { href: "/admin/import", label: "Import tenants", icon: navIcons.inbox },
    { href: "/admin/applications", label: "Applications", icon: navIcons.inbox },
    { href: "/admin/tours", label: "Tours", icon: navIcons.calendar },
    { href: "/admin/leases", label: "Leases", icon: navIcons.doc },
    { href: "/admin/maintenance", label: "Maintenance", icon: navIcons.wrench },
    { href: "/admin/turns", label: "Make-ready", icon: navIcons.checklist },
    { href: "/admin/payments", label: "Payments", icon: navIcons.card },
    { href: "/admin/delinquency", label: "Delinquency", icon: navIcons.alert },
    { href: "/admin/notices", label: "Notices", icon: navIcons.notice },
    { href: "/admin/messages", label: "Messages", icon: navIcons.chat },
    { href: "/admin/residents", label: "Residents", icon: navIcons.users },
    { href: "/admin/anniversaries", label: "Anniversaries", icon: navIcons.calendar },
  ];

  return (
    <DashboardShell
      brandHref="/admin"
      brandLabel="38th Ave Admin"
      nav={nav}
      user={{
        email: user.email,
        name: profile?.full_name,
        role: profile?.role,
        avatarUrl: profile?.avatar_url,
      }}
    >
      {children}
    </DashboardShell>
  );
}
