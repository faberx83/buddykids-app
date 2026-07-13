import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Role } from "@/lib/types";

// Segnalazione di Fabrizio: cosa manca lato Admin tra le nuove funzionalità
// (ticketing, presenze/check-in, preferiti)? Ho proposto e costruito 3
// pannelli cross-centro (SLA Richieste, confronto Presenze, Preferiti come
// segnale di domanda) — vedi lib/data/admin-inquiries.ts,
// lib/data/admin-attendance.ts, lib/data/admin-favorites.ts.
const navItems = [
  { href: "/admin", label: "Dashboard", icon: "ti-layout-dashboard" },
  { href: "/admin/analytics", label: "Analisi", icon: "ti-chart-bar" },
  { href: "/admin/centers", label: "Centri", icon: "ti-building-community" },
  { href: "/admin/activities", label: "Attività", icon: "ti-list-details" },
  { href: "/admin/tags", label: "Tag", icon: "ti-tags" },
  { href: "/admin/bookings", label: "Prenotazioni", icon: "ti-ticket" },
  { href: "/admin/group-requests", label: "Richieste Gruppo", icon: "ti-users-group" },
  { href: "/admin/richieste", label: "Richieste (SLA)", icon: "ti-message-circle-2" },
  { href: "/admin/certifications", label: "Certificazioni", icon: "ti-certificate" },
  { href: "/admin/presenze", label: "Presenze", icon: "ti-clipboard-check" },
  { href: "/admin/preferiti", label: "Preferiti", icon: "ti-heart" },
  { href: "/admin/partner-offers", label: "Fornitori", icon: "ti-truck-delivery" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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
      brand="TRAMA Admin"
      brandEmoji="🛠️"
      navItems={navItems}
      requiredRole="platform_admin"
      realRole={realRole}
      variant="admin"
    >
      {children}
    </DashboardLayout>
  );
}
