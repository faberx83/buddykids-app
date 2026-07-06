import DashboardLayout from "@/components/dashboard/DashboardLayout";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "ti-layout-dashboard" },
  { href: "/admin/centers", label: "Centri", icon: "ti-building-community" },
  { href: "/admin/activities", label: "Attività", icon: "ti-list-details" },
  { href: "/admin/bookings", label: "Prenotazioni", icon: "ti-ticket" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout
      brand="BuddyKids Admin"
      brandEmoji="🛠️"
      navItems={navItems}
      requiredRole="platform_admin"
    >
      {children}
    </DashboardLayout>
  );
}
