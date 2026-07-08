import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Role } from "@/lib/types";

const navItems = [
  { href: "/center", label: "Dashboard", icon: "ti-layout-dashboard" },
  { href: "/center/profile", label: "Il mio centro", icon: "ti-building" },
  { href: "/center/activities", label: "Attività", icon: "ti-list-details" },
  { href: "/center/promotions", label: "Promozioni", icon: "ti-discount-2" },
  { href: "/center/group-requests", label: "Richieste Gruppo", icon: "ti-users-group" },
];

export default async function CenterLayout({ children }: { children: React.ReactNode }) {
  // Con Supabase collegato, il ruolo reale (da profiles.role) sostituisce del
  // tutto il selettore "ruolo demo" per decidere l'accesso a questa sezione.
  let realRole: Role | null | undefined;

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    realRole = (profile?.role as Role) ?? "parent";
  }

  return (
    <DashboardLayout
      brand="BuddyKids Partner"
      brandEmoji="🏫"
      navItems={navItems}
      requiredRole="center_admin"
      realRole={realRole}
      variant="partner"
    >
      {children}
    </DashboardLayout>
  );
}
