import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Role } from "@/lib/types";
import { getGroupRequestsForCenter } from "@/lib/data/group-requests";
import { getGestoreAccountProfile } from "@/lib/data/profile";
import { getUnreadCountForCenter } from "@/lib/data/inquiries";
import { getUnconfirmedParentCheckinsCount } from "@/lib/data/attendance";
import { getUnreadBookingsCountForCenter } from "@/lib/data/center-bookings";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { getWalkthroughProgress, WalkthroughProgressSummary } from "@/lib/walkthrough/data";
import PartnerSpotlight from "@/components/spotlight/PartnerSpotlight";
import BetaFeedbackButton from "@/components/nextgen/BetaFeedbackButton";
import NotificationCenter from "@/components/nextgen/NotificationCenter";
import { getPartnerNotifications } from "@/lib/data/notifications-partner";

export default async function CenterLayout({ children }: { children: React.ReactNode }) {
  // Con Supabase collegato, il ruolo reale (da profiles.role) sostituisce del
  // tutto il selettore "ruolo demo" per decidere l'accesso a questa sezione.
  let realRole: Role | null | undefined;
  // CONTROLLED BETA EXPERIENCE GATE (§7-14, DEC-58) — il vero Spotlight vive
  // ora qui (persiste su OGNI pagina Partner, non solo sulla shell orfana
  // /center/one) ma NON deve mai apparire fuori dalla coorte Controlled
  // Beta: a differenza del resto di questo layout (invariato, Legacy/NextGen
  // per COSTRUZIONE non gated, DEC-02), il solo overlay Spotlight è
  // condizionato a TRAMA_ONE_ENABLED risolto per l'utente corrente — stesso
  // resolver già usato da app/center/one/layout.tsx, qui applicato in modo
  // additivo (nessun redirect, nessun blocco: se il flag risolve a false,
  // spotlightProgress resta null e PartnerSpotlight non renderizza nulla).
  let spotlightProgress: WalkthroughProgressSummary | null = null;

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

    const enabled = await resolveFeatureFlag({
      flagName: "TRAMA_ONE_ENABLED",
      userId: user.id,
      role: realRole,
      tenant: "center",
      correlationId: generateCorrelationId(),
    });
    if (enabled) {
      spotlightProgress = await getWalkthroughProgress(user.id, "activity_creation_partner");
    }
  }

  // Badge rosso sulla voce "Richieste Gruppo" col conteggio in attesa —
  // richiede un giro reale ai dati (vuoto/0 in demo senza Supabase, come per
  // il resto di questa sezione).
  const pendingGroupRequests = (await getGroupRequestsForCenter()).filter(
    (r) => r.status === "pending"
  ).length;

  // Badge rosso su "Le mie richieste" (ticketing "Contatta il gestore") col
  // numero di richieste NON LETTE (non solo "aperte" — segnalazione di
  // Fabrizio: vuole essere avvisato dell'arrivo di un messaggio, anche se
  // poi la lascia aperta per rispondere più tardi).
  const openInquiries = await getUnreadCountForCenter();

  // Badge rosso su "Registro presenze" col numero di check-in fatti dal
  // genitore (Home) e non ancora confermati/corretti dal gestore —
  // segnalazione di Fabrizio: vuole lo stesso trattamento di notifica già
  // fatto per "Le mie richieste" su ogni sezione con un avviso da una
  // parte all'altra.
  const unconfirmedCheckins = await getUnconfirmedParentCheckinsCount();

  // Badge rosso su "Prenotazioni" (Sprint 4, PCR-029 P0) col numero di
  // prenotazioni non lette dal centro — stesso trattamento delle altre
  // sezioni con notifica da una parte all'altra.
  const unreadBookings = await getUnreadBookingsCountForCenter();

  // Notification center Partner (31/08/2026, "stesso stile" del genitore) —
  // aggrega gli STESSI 4 segnali già calcolati sopra (nessuna nuova query,
  // getPartnerNotifications richiama le stesse funzioni data layer). Passato
  // a NotificationCenter con scope="partner" più sotto.
  const partnerNotifications = await getPartnerNotifications();

  // Badge profilo in alto a destra (coerente con l'app genitore) — vedi
  // AccountBadge in components/dashboard/DashboardLayout.tsx.
  const gestoreProfile = await getGestoreAccountProfile();
  const accountInitials =
    (gestoreProfile.fullName || gestoreProfile.email.split("@")[0] || "?")
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  // Segnalazione di Fabrizio: "nidifichiamo un po' il menu... report e
  // registro presenze insieme va benone!". Il vecchio unico gruppo
  // "Gestione" (7 voci) è stato diviso in sotto-gruppi tematici (stesso
  // meccanismo di intestazioni già esistente in DashboardLayout, solo
  // applicato con più granularità): "Attività" (anagrafica/offerta),
  // "Presenze" (Registro + Report, la coppia che Fabrizio ha approvato come
  // esempio), "Richieste" (Gruppo + ticketing genitori, stesso concetto).
  const navItems = [
    {
      href: "/center",
      label: "Dashboard",
      icon: "ti-layout-dashboard",
      sectionLabel: "Oggi",
      // CONTROLLED BETA EXPERIENCE GATE (§7-14) — ultimo step del percorso
      // "activity_creation_partner" (registry.ts): il target reale è questa
      // voce di menu, sempre presente, non una pagina specifica.
      spotlightTarget: "dashboard",
    },

    { href: "/center/profile", label: "Il mio centro", icon: "ti-building", sectionLabel: "Attività" },
    { href: "/center/activities", label: "Attività", icon: "ti-list-details", sectionLabel: "Attività" },
    { href: "/center/promotions", label: "Promozioni", icon: "ti-discount-2", sectionLabel: "Attività" },
    {
      href: "/center/servizi-consigliati",
      label: "Servizi consigliati",
      icon: "ti-map-2",
      sectionLabel: "Attività",
    },

    {
      href: "/center/attendance",
      label: "Registro presenze",
      icon: "ti-clipboard-check",
      sectionLabel: "Presenze",
      badgeCount: unconfirmedCheckins,
    },
    {
      href: "/center/report-presenze",
      label: "Report presenze",
      icon: "ti-chart-bar",
      sectionLabel: "Presenze",
    },

    {
      href: "/center/prenotazioni",
      label: "Prenotazioni",
      icon: "ti-calendar-event",
      sectionLabel: "Richieste",
      badgeCount: unreadBookings,
    },
    {
      href: "/center/group-requests",
      label: "Richieste Gruppo",
      icon: "ti-users-group",
      sectionLabel: "Richieste",
      badgeCount: pendingGroupRequests,
    },
    {
      href: "/center/richieste",
      label: "Le mie richieste",
      icon: "ti-message-circle-2",
      sectionLabel: "Richieste",
      badgeCount: openInquiries,
    },

    {
      href: "/center/invites",
      label: "Inviti",
      icon: "ti-user-plus",
      sectionLabel: "Team",
    },

    {
      href: "/center/account",
      label: "Il mio account",
      icon: "ti-user-circle",
      sectionLabel: "Account",
    },
  ];

  return (
    <DashboardLayout
      brand="TRAMA Partner"
      navItems={navItems}
      requiredRole="center_admin"
      realRole={realRole}
      variant="partner"
      accountHref="/center/account"
      accountInitials={accountInitials}
      accountAvatarUrl={gestoreProfile.avatarUrl}
    >
      {children}
      <PartnerSpotlight progress={spotlightProgress} />
      {/* Notification center Partner (31/08/2026) — stesso componente del
          genitore (components/nextgen/NotificationCenter.tsx), scope
          "partner": chiave cursore localStorage separata, nessun hide su
          rotte placeholder (questo layout È già il layout Partner reale).
          Montato una sola volta qui, copre ogni pagina /center/*. */}
      <NotificationCenter initialNotifications={partnerNotifications} scope="partner" />
      {/* SPRINT 5 (NEXTGEN) → ESTENSIONE PARTNER — stesso meccanismo "Segnala
          un problema" già in uso lato genitore (app/nextgen/layout.tsx),
          contestualizzato per il Partner: area calcolata sulle rotte
          /center/*, invio con app_source="gestore" (già supportato da
          schema/RLS/Admin, vedi commenti in BetaFeedbackButton.tsx e
          app/actions/beta-feedback.ts). A differenza di PartnerSpotlight qui
          sopra, NON è gated da TRAMA_ONE_ENABLED: è un canale di raccolta
          feedback indipendente dal tour guidato, utile durante tutta la
          BETA a prescindere da quale coorte vede lo Spotlight. */}
      <BetaFeedbackButton appSource="gestore" />
    </DashboardLayout>
  );
}
