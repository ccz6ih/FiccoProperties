import { DashboardShell, type NavItem } from "@/components/dashboard-shell";
import { navIcons } from "@/components/icons";
import { requireProfile, isStaff } from "@/lib/auth";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireProfile("/portal");

  const nav: NavItem[] = [
    { href: "/portal", label: "My home", icon: navIcons.home },
    { href: "/portal/tenancy", label: "My tenancy", icon: navIcons.calendar },
    { href: "/portal/maintenance", label: "Maintenance", icon: navIcons.wrench },
    { href: "/portal/lease", label: "Lease", icon: navIcons.doc },
    { href: "/portal/payments", label: "Payments", icon: navIcons.card },
    { href: "/portal/messages", label: "Messages", icon: navIcons.chat },
    { href: "/portal/notices", label: "Notices", icon: navIcons.notice },
    { href: "/portal/guide", label: "House rules", icon: navIcons.book },
    { href: "/portal/community", label: "Community", icon: navIcons.info },
  ];
  if (isStaff(profile)) {
    nav.push({ href: "/admin", label: "Admin", icon: navIcons.building });
  }

  return (
    <DashboardShell
      brandHref="/portal"
      brandLabel="Resident Portal"
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
