import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Role } from "@/lib/types";
import { getGroupRequestsForCenter } from "@/lib/data/group-requests";

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

  // Badge rosso sulla voce "Richieste Gruppo" col conteggio in attesa —
  // richiede un giro reale ai dati (vuoto/0 in demo senza Supabase, come per
  // il resto di questa sezione).
  const pendingGroupRequests = (await getGroupRequestsForCenter()).filter(
    (r) => r.status === "pending"
  ).length;

  const navItems = [
    { href: "/center", label: "Dashboard", icon: "ti-layout-dashboard", sectionLabel: "Oggi" },
    { href: "/center/profile", label: "Il mio centro", icon: "ti-building", sectionLabel: "Gestione" },
    { href: "/center/activities", label: "Attività", icon: "ti-list-details", sectionLabel: "Gestione" },
    { href: "/center/promotions", label: "Promozioni", icon: "ti-discount-2", sectionLabel: "Gestione" },
    {
      href: "/center/group-requests",
      label: "Richieste Gruppo",
      icon: "ti-users-group",
      sectionLabel: "Gestione",
      badgeCount: pendingGroupRequests,
    },
    {
      href: "/center/servizi-consigliati",
      label: "Servizi consigliati",
      icon: "ti-map-2",
      sectionLabel: "Gestione",
    },
    {
      href: "/center/invites",
      label: "Inviti",
      icon: "ti-user-plus",
      sectionLabel: "Gestione",
    },
  ];

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
