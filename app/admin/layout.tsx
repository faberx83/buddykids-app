import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Role } from "@/lib/types";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
// Notifica "ultimo deploy ok/ko" — vedi supabase/migration_33_deploy_events.sql,
// app/internal/deploy-notify/route.ts e components/admin/DeployStatusBanner.tsx:
// dal 12/11/2026 il banner è in "Oggi" e lo storico in /admin/sistema.
// BUILD_INFO_BUBBLE — test pipeline nuovo account (30/09/2026), temporaneo.
import BuildInfoBubble from "@/components/BuildInfoBubble";
import { resolveBuildInfoBubbleLabel } from "@/lib/build-info-bubble";

// Segnalazione di Fabrizio: cosa manca lato Admin tra le nuove funzionalità
// (ticketing, presenze/check-in, preferiti)? Ho proposto e costruito 3
// pannelli cross-centro (SLA Richieste, confronto Presenze, Preferiti come
// segnale di domanda) — vedi lib/data/admin-inquiries.ts,
// lib/data/admin-attendance.ts, lib/data/admin-favorites.ts.
//
// TRAMA — ADMIN OPERATIVO (12/11/2026). Richiesta di Fabrizio: "Organizza il
// menu in: Oggi, Famiglie, Centri, Prenotazioni, Segnalazioni, Analisi e
// crescita, Impostazioni. Evidenzia una sola voce corrente. Conserva i link
// esistenti … Togli le dashboard con dati statici dal menu operativo. Sposta
// deploy, branch e commit in 'Stato sistema'; Tag, feature flag e documenti
// legali in Impostazioni; Preferiti in Analisi come segnale di domanda. Rendi
// Fornitori secondario." Nessuna pagina tolta: Dashboard e Analisi su dati
// finti e l'elenco Attività dimostrativo si aprono da Analisi e crescita
// (/admin/crescita); /admin/one resta alias di Oggi. Una voce sola accesa:
// lib/navigation/active-nav.ts. Gruppi con sectionLabel (DashboardLayout).
type AdminNavItem = { href: string; label: string; icon: string; matchPrefixes?: string[] };

const group = (sectionLabel: string, items: AdminNavItem[]) => items.map((i) => ({ ...i, sectionLabel }));

const baseNavItems = [
  ...group("Oggi", [
    // Ex Command Center (TRAMA ONE Sprint 6, E08), ora per ogni Admin.
    { href: "/admin", label: "Oggi", icon: "ti-target-arrow", matchPrefixes: ["/admin/one"] },
  ]),
  ...group("Famiglie", [
    // TRAMA — ADMIN BETA COCKPIT (20/10/2026): la beta famiglie, una riga per
    // famiglia, con il report navigabile (/admin/beta/report).
    { href: "/admin/beta", label: "Beta Famiglie", icon: "ti-heart-handshake" },
    // Dalla richiesta all'attivazione: persone, famiglie, inviti.
    { href: "/admin/famiglie", label: "Inviti e registrazioni", icon: "ti-route" },
    // 20/10/2026 — richieste "Chiedi un invito" dalla pagina di benvenuto.
    { href: "/admin/lista-attesa", label: "Lista d'attesa", icon: "ti-mail-heart" },
    // Codici invito Beta (migration_30_beta_invite_codes.sql, 27/08/2026) —
    // auto-iscrizione alla Controlled Beta Cohort via link ?beta=CODICE.
    { href: "/admin/beta-invites", label: "Inviti Beta", icon: "ti-user-plus" },
  ]),
  ...group("Centri", [
    { href: "/admin/centers", label: "Centri", icon: "ti-building-community" },
    // Portale centri V2 (27/10/2026): attivazione dei centri (timeline, verifiche, approva).
    // Coda unica del processo: /admin/one/onboarding è la vista di prima.
    { href: "/admin/centri-attivazione", label: "Centri da attivare", icon: "ti-rosette", matchPrefixes: ["/admin/one/onboarding"] },
    // TRAMA ONE Build Sprint 5 — coda CenterLead (J11) + candidature dei centri.
    { href: "/admin/center-leads", label: "Candidature e segnalazioni", icon: "ti-map-pin-plus" },
    { href: "/admin/certifications", label: "Certificazioni", icon: "ti-certificate" },
    { href: "/admin/presenze", label: "Presenze", icon: "ti-clipboard-check" },
    // Secondaria: servizi consigliati ai centri, non una coda operativa.
    { href: "/admin/partner-offers", label: "Fornitori", icon: "ti-truck-delivery" },
  ]),
  ...group("Prenotazioni", [
    { href: "/admin/bookings", label: "Prenotazioni", icon: "ti-ticket" },
    { href: "/admin/group-requests", label: "Richieste Gruppo", icon: "ti-users-group" },
    { href: "/admin/richieste", label: "Messaggi e SLA", icon: "ti-message-circle-2" },
  ]),
  ...group("Segnalazioni", [
    // SPRINT 5 (NEXTGEN) — coda "Segnala un problema" della floating CTA BETA.
    { href: "/admin/segnalazioni-beta", label: "Segnalazioni BETA", icon: "ti-message-report" },
    { href: "/admin/radar", label: "Radar community", icon: "ti-radar" },
  ]),
  ...group("Analisi e crescita", [
    { href: "/admin/crescita", label: "Analisi e crescita", icon: "ti-chart-bar", matchPrefixes: ["/admin/demo", "/admin/analytics", "/admin/activities"] },
    { href: "/admin/preferiti", label: "Preferiti (domanda)", icon: "ti-heart" },
  ]),
  ...group("Impostazioni", [
    { href: "/admin/feature-flags", label: "Feature flag", icon: "ti-flag-3" },
    { href: "/admin/tags", label: "Tag", icon: "ti-tags" },
    // TRAMA — SCHOOL CALENDAR INTELLIGENCE (14/09/2026, §B11) — dataset
    // calendari/eventi scolastici, usato dal Planner SOLO se
    // SCHOOL_CALENDAR_INTELLIGENCE_ENABLED risolve true.
    { href: "/admin/school-calendar", label: "Calendari scolastici", icon: "ti-school" },
    // PRE-MICRO-PILOT CLOSURE GATE (task #574, 25/08/2026) — vista view-only
    // su legal_documents (Termini/Privacy Notice), non un CMS.
    { href: "/admin/legal", label: "Documenti legali", icon: "ti-file-shield" },
    // Ultimi deploy, ramo e commit (prima: banner su ogni pagina).
    { href: "/admin/sistema", label: "Stato sistema", icon: "ti-server" },
  ]),
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
  // BUILD_INFO_BUBBLE
  let buildInfoLabel: string | null = null;

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
      // R-01 (Wave 1, 24/08/2026) il Command Center era la prima voce con il
      // flag acceso. ADMIN OPERATIVO (12/11/2026): ora è "Oggi" per tutti;
      // col flag acceso si aggiunge il Pilota (/admin/one/pilot), che vive
      // sotto lo stesso gate di /admin/one.
      const idx = navItems.findIndex((i) => i.href === "/admin/beta-invites");
      navItems = [
        ...navItems.slice(0, idx + 1),
        { href: "/admin/one/pilot", label: "Pilota", icon: "ti-users", sectionLabel: "Famiglie" },
        ...navItems.slice(idx + 1),
      ];
    }

    // Notifica "ultimo deploy ok/ko" (richiesta di Fabrizio): ADMIN OPERATIVO
    // (12/11/2026) il banner compare solo in "Oggi" (app/admin/page.tsx) e lo
    // storico in Impostazioni → Stato sistema; qui non si legge più.

    // BUILD_INFO_BUBBLE
    buildInfoLabel = await resolveBuildInfoBubbleLabel({ userId: user.id, role: realRole, tenant: "admin" });
  }

  return (
    <DashboardLayout
      brand="TRAMA Admin"
      navItems={navItems}
      requiredRole="platform_admin"
      realRole={realRole}
      variant="admin"
    >
      {/* BUILD_INFO_BUBBLE */}
      <BuildInfoBubble label={buildInfoLabel} />
      {children}
    </DashboardLayout>
  );
}
