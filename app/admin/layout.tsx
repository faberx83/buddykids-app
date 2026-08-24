import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Role } from "@/lib/types";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";

// Segnalazione di Fabrizio: cosa manca lato Admin tra le nuove funzionalità
// (ticketing, presenze/check-in, preferiti)? Ho proposto e costruito 3
// pannelli cross-centro (SLA Richieste, confronto Presenze, Preferiti come
// segnale di domanda) — vedi lib/data/admin-inquiries.ts,
// lib/data/admin-attendance.ts, lib/data/admin-favorites.ts.
const baseNavItems = [
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
  // SPRINT 5 (NEXTGEN) — coda "Segnala un problema" della floating CTA
  // BETA (richiesta di Fabrizio): stessa lista flat, nessuna sotto-voce.
  { href: "/admin/segnalazioni-beta", label: "Segnalazioni BETA", icon: "ti-message-report" },
  // TRAMA ONE Build Sprint 5 — coda CenterLead (J11, suggerimento centro non
  // iscritto): stessa lista flat, nessuna sotto-voce.
  { href: "/admin/center-leads", label: "Segnalazioni centri", icon: "ti-map-pin-plus" },
  { href: "/admin/feature-flags", label: "Feature flag", icon: "ti-flag-3" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Con Supabase collegato, il ruolo reale (da profiles.role) sostituisce del
  // tutto il selettore "ruolo demo" per decidere l'accesso a questa sezione.
  let realRole: Role | null | undefined;

  // CONTROLLED BETA EXPERIENCE GATE (§3/§16, DEC-58) — fase E (wiring):
  // `/admin/one` (Command Center, DEC-51) diventa PRIMARY_NAV, ma SOLO
  // condizionato a TRAMA_ONE_ENABLED risolto server-side per l'utente
  // corrente — stesso resolver già usato da app/admin/one/layout.tsx e da
  // app/center/layout.tsx per lo Spotlight. Nessuna delle altre voci di
  // questo menu è mai stata gated: questa è la prima, e resta additiva (se
  // il flag risolve a false la voce semplicemente non compare, nessun'altra
  // voce/redirect è toccata).
  let navItems = baseNavItems;

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

    const oneEnabled = await resolveFeatureFlag({
      flagName: "TRAMA_ONE_ENABLED",
      userId: user.id,
      role: realRole,
      tenant: "admin",
      correlationId: generateCorrelationId(),
    });
    if (oneEnabled) {
      // R-01 (Wave 1, 24/08/2026): Command Center promosso a PRIMA voce (era
      // in coda) per convergere la superficie Admin canonica su /admin/one
      // senza rimuovere o redirectare le pagine storiche (nessun codice
      // eliminato, nessuna route toccata — solo ordine del menu).
      navItems = [
        { href: "/admin/one", label: "Command Center", icon: "ti-target-arrow" },
        ...baseNavItems,
      ];
    }
  }

  return (
    <DashboardLayout
      brand="TRAMA Admin"
      navItems={navItems}
      requiredRole="platform_admin"
      realRole={realRole}
      variant="admin"
    >
      {children}
    </DashboardLayout>
  );
}
