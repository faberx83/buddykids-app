import type { Metadata, Viewport } from "next";
import PhoneShell from "@/components/PhoneShell";
import InstallPrompt from "@/components/InstallPrompt";
import NextgenBottomNav from "@/components/nextgen/NextgenBottomNav";
import BetaFeedbackButton from "@/components/nextgen/BetaFeedbackButton";
import { NextgenToastProvider } from "@/components/nextgen/NextgenToastProvider";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { splashLinks } from "@/lib/tenant";
import { Role } from "@/lib/types";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { getWalkthroughProgress, WalkthroughProgressSummary } from "@/lib/walkthrough/data";
import ParentSpotlight from "@/components/spotlight/ParentSpotlight";
import OnboardingCarousel from "@/components/nextgen/OnboardingCarousel";
import NotificationCenter from "@/components/nextgen/NotificationCenter";
import NextgenAuthRedirect from "@/components/nextgen/NextgenAuthRedirect";
import { getParentNotifications } from "@/lib/data/notifications";
import { NotificationItem } from "@/lib/notifications/model";
// TRAMA BETA v1.1.1 (FINAL FUNCTIONAL + UI CONSISTENCY FIXES, punto 7) —
// vedi lib/nextgen/floating-controls.ts per la ROOT CAUSE ANALYSIS: pb-40
// (fix VIS111 punto 10, sotto) copre solo l'ULTIMA riga di contenuto, non le
// righe che transitano sotto bell/chat DURANTE uno scroll attivo. Provider +
// contenitore scrollabile condivisi qui, così ogni pagina genitore NEXTGEN
// eredita il fix senza bisogno di toccarle una per una.
import { NextgenScrollActivityProvider, NextgenScrollArea } from "@/components/nextgen/NextgenScrollActivity";

// SPRINT 0 (NEXTGEN — V2 in parallelo a LEGACY): guscio minimo dell'area
// genitore NEXTGEN. Stesso guard di autenticazione di app/(main)/layout.tsx
// (LEGACY, non toccato), ma componente NUOVO e separato: le prossime sprint
// potranno restyilizzare questo layout senza alcun impatto su LEGACY.
// Riuso: PhoneShell (unico componente visivo LEGACY riutilizzato in questo
// sprint) + stesso client Supabase/autenticazione/DB.
//
// SPRINT 3 — richiesta di Fabrizio: poter installare NEXTGEN come app SEPARATA
// da LEGACY sullo stesso telefono ("così le ho tutte e due"). Metadata/manifest
// dedicati (scope "/nextgen" — vedi public/manifest-nextgen.json) fanno sì che
// il browser la consideri un'app installabile DIVERSA da quella con scope "/".
// L'export statico "metadata" qui sotto vince su quello dinamico di
// app/layout.tsx (generateMetadata) SOLO per le rotte sotto /nextgen — nessuna
// modifica al comportamento delle altre rotte.
export const metadata: Metadata = {
  title: "TRAMA",
  description: "La nuova esperienza TRAMA: planner familiare, copertura settimane e consigli su misura.",
  manifest: "/manifest-nextgen.json",
  icons: {
    icon: [
      { url: "/icon-nextgen-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-nextgen-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon-nextgen.png",
    // Sprint correttivo: stesso splash iOS (icona a colori + claim su bianco)
    // del tenant famiglia LEGACY — NEXTGEN e' comunque "app genitori".
    other: splashLinks("/splash/nextgen"),
  },
};

// BUGFIX (Fabrizio: "lo sfondo dietro al logo è ancora sbagliato... deve
// essere bianco") — allineato a manifest-nextgen.json#background_color/
// theme_color (anch'essi passati a bianco): il viola #6F63C5 restava solo
// qui, dipinto dal browser dietro al logo/status bar prima che la pagina
// bianca facesse il render.
export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  viewportFit: "cover",
};

export default async function NextgenLayout({ children }: { children: React.ReactNode }) {
  // TRAMA ONE Parent Spotlight sprint (24/08/2026, DEC-58 lato Genitore) —
  // stesso gate additivo già usato in app/center/layout.tsx per il Partner:
  // il vero Spotlight (percorso "discover_book_parent") persiste su OGNI
  // pagina Genitore NEXTGEN, ma resta condizionato a TRAMA_ONE_ENABLED
  // risolto per l'utente corrente (Controlled Beta Cohort) — additivo, non
  // bloccante: se il flag risolve a false, spotlightProgress resta null e
  // ParentSpotlight non renderizza nulla. Nessun impatto sul resto di questo
  // layout (auth guard invariato, DEC-02).
  let spotlightProgress: WalkthroughProgressSummary | null = null;
  // TRAMA — Parent Private Beta Onboarding Carousel: stesso gate additivo
  // TRAMA_ONE_ENABLED/Controlled Beta Cohort già usato per lo Spotlight (§17
  // del task: "se l'onboarding può essere scoped naturalmente al cohort
  // Private Beta esistente, riusa l'infrastruttura" — nessun nuovo flag).
  // Gate ESPLICITO anche su realRole === "parent" (oltre al fatto che questo
  // intero layout serve solo /nextgen, l'area Parent): doppia sicurezza a
  // costo zero contro un ipotetico account Partner/Admin che navighi qui.
  let onboardingProgress: WalkthroughProgressSummary | null = null;
  // TRAMA — Wave 3 "Actionable In-App Notifications": calcolato qui (Server
  // Component, stesso principio già in uso per spotlightProgress/
  // onboardingProgress sopra) e passato come prop a NotificationCenter
  // (client), montato una sola volta più sotto — copre ogni pagina genitore
  // NEXTGEN senza aggiungerlo pagina per pagina. getParentNotifications()
  // verifica ESSA STESSA sessione+ruolo "parent" (vedi lib/data/notifications.ts,
  // stesso principio del security check Wave 1 su /admin/one/pilot): anche
  // se in futuro questo layout cambiasse, il notification center non
  // dipenderebbe comunque solo dal gate qui.
  let notifications: NotificationItem[] = [];
  // NOTIF-P11 — il notification center è una superficie SOLO Genitore: un
  // Partner/Admin che aprisse comunque /nextgen (non bloccato da questo
  // layout, solo dal flag TRAMA_ONE_ENABLED/route dedicate) non deve vedere
  // nemmeno il bottone, non solo un elenco vuoto — la garanzia sui DATI vive
  // comunque anche in lib/data/notifications.ts (fail-closed indipendente).
  // Senza Supabase configurato (demo) resta true, stesso comportamento
  // "esperienza genitore di default" già usato altrove in questo layout.
  let isParentUser = !isSupabaseConfigured;

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // FIX (01/09/2026, vedi NextgenAuthRedirect.tsx per il motivo completo):
    // niente più redirect() lato server verso /auth/login (fuori dallo
    // scope "/nextgen" della PWA installata) — si esce presto con una shell
    // minima che fa il redirect lato client.
    if (!user) {
      return (
        <PhoneShell>
          <NextgenAuthRedirect />
        </PhoneShell>
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const realRole = (profile?.role as Role) ?? "parent";

    if (realRole === "parent") {
      isParentUser = true;
      notifications = await getParentNotifications();
    }

    const enabled = await resolveFeatureFlag({
      flagName: "TRAMA_ONE_ENABLED",
      userId: user.id,
      role: realRole,
      tenant: "family",
      correlationId: generateCorrelationId(),
    });
    if (enabled && realRole === "parent") {
      onboardingProgress = await getWalkthroughProgress(user.id, "parent_beta_onboarding");
      // Sequenza richiesta: il carousel di benvenuto precede il tour
      // Spotlight in-context — non recuperare/montare quest'ultimo finché il
      // carousel non risulta completato o saltato (currentStepKey null),
      // per non sovrapporre due overlay nella stessissima prima sessione.
      if (!onboardingProgress || onboardingProgress.currentStepKey === null) {
        spotlightProgress = await getWalkthroughProgress(user.id, "discover_book_parent");
      }
    } else if (enabled) {
      spotlightProgress = await getWalkthroughProgress(user.id, "discover_book_parent");
    }
  }

  return (
    <PhoneShell>
      <NextgenToastProvider>
        {/* TRAMA BETA v1.1.1 (FINAL FUNCTIONAL + UI CONSISTENCY FIXES,
            punto 7) — Provider condiviso: bell/chat sotto sono FRATELLI del
            div scrollabile (non figli), quindi lo stato "sto scrollando"
            deve passare per context invece che per prop — vedi
            components/nextgen/NextgenScrollActivity.tsx. */}
        <NextgenScrollActivityProvider>
          <div className="flex h-full min-h-0 flex-col">
            {/* TRAMA BETA v1.1.1 (FINAL VISUAL CONFORMANCE PASS, punto 10) —
                segnalazione: bell (NotificationCenter, bottom-24 left-4) e
                chat (BetaFeedbackButton, bottom-24 right-4) sono
                position:absolute ancorati a .app-shell, quindi FLUTTUANO
                SEMPRE nella stessa fascia (96-148px dal fondo dell'app-shell)
                — non sono figli di questo div scrollabile, quindi lo scroll
                del contenuto non li "supera" mai: qualunque riga/CTA che
                finisce in quella fascia quando si scrolla in fondo alla
                pagina resta coperta. Fix layout unico (non per singola
                schermata, verificato su Planner Overview e Week Detail, ma
                si applica a OGNI pagina genitore NEXTGEN essendo qui nel
                layout condiviso): padding-bottom sul contenitore scrollabile
                abbastanza grande da garantire che l'ULTIMA riga di contenuto
                reale possa sempre scorrere sopra la fascia dei floating
                button (96px offset + 52px altezza pulsante + margine), invece
                di restarci sotto. Nessun impatto sulle pagine senza
                contenuto lungo: è solo spazio bianco extra in fondo.
                TRAMA BETA v1.1.1 (FINAL FUNCTIONAL + UI CONSISTENCY FIXES,
                punto 7) — questo copre solo l'ULTIMA riga; segnalazione
                successiva: durante uno scroll attivo una riga che transita
                MOMENTANEAMENTE sotto la fascia bell/chat resta comunque
                intercettata dal tap. NextgenScrollArea (invece del div
                semplice) notifica il Provider ad ogni evento onScroll, cosi
                bell/chat possono attenuarsi e lasciar passare il tap SOLO
                mentre il contenuto si sta davvero muovendo — vedi
                lib/nextgen/floating-controls.ts per la ROOT CAUSE completa e
                BetaFeedbackButton.tsx/NotificationCenter.tsx per il
                consumo. */}
            <NextgenScrollArea className="no-scrollbar flex-1 overflow-y-auto pb-40">{children}</NextgenScrollArea>
            {/* Estensione 31/08/2026 (Fabrizio): pallini "Prenotazioni"/"Profilo"
                contestualizzati, stessa lista `notifications` già calcolata
                sopra per la campanella — zero nuove query, vedi
                useNavBadges in NextgenBottomNav.tsx. */}
            <NextgenBottomNav notifications={notifications} />
          </div>
          {/* SPRINT 5 — floating CTA "Segnala un problema", montata qui una
              sola volta cosi copre ogni pagina genitore NEXTGEN (il componente
              stesso si nasconde su /nextgen/admin e /nextgen/center, vedi
              BetaFeedbackButton.tsx). */}
          <BetaFeedbackButton />
          <ParentSpotlight progress={spotlightProgress} />
          <OnboardingCarousel progress={onboardingProgress} />
          {isParentUser && <NotificationCenter initialNotifications={notifications} />}
        </NextgenScrollActivityProvider>
      </NextgenToastProvider>
      {/* Istanza DEDICATA a NEXTGEN: appName diverso ("TRAMA" vs quello di
          LEGACY, vedi lib/tenant.ts) -> chiave di dismiss separata in
          localStorage, e nessun routeExclude (è già scoped a /nextgen dal
          punto in cui è mountata). Quella "storica" in app/layout.tsx si
          autoesclude qui (routeExclude), quindi non appare mai insieme a
          questa. swScope="/nextgen" (BUG FIX): registra il service worker su
          uno scope diverso da quello di LEGACY ("/"), altrimenti Chrome
          unifica le due app sotto un'unica identità installata (vedi
          commento in components/InstallPrompt.tsx). */}
      <InstallPrompt appName="TRAMA" themeColor="#6F63C5" swScope="/nextgen" />
    </PhoneShell>
  );
}
