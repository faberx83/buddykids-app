import DashboardLayout from "@/components/dashboard/DashboardLayout";

const navItems = [
  { href: "/center", label: "Dashboard", icon: "ti-layout-dashboard" },
  { href: "/center/profile", label: "Il mio centro", icon: "ti-building" },
  { href: "/center/activities", label: "Attività", icon: "ti-list-details" },
  { href: "/center/promotions", label: "Promozioni", icon: "ti-discount-2" },
];

export default function CenterLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout
      brand="BuddyKids Centro"
      brandEmoji="🏫"
      navItems={navItems}
      requiredRole="center_admin"
    >
      {children}
    </DashboardLayout>
  );
}
