"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { readVersionPreference, writeVersionPreference, AppVersion } from "@/lib/version-preference";
import { createClient } from "@/lib/supabase/client";
import { isVersionToggleTestAccount } from "@/lib/dev/test-accounts";

// Richiesta di Fabrizio: un toggle per passare da LEGACY a NEXTGEN "coerente
// su tutta l'app", più semplice da gestire rispetto ad avere solo pagine/app
// diverse. Convive con le due PWA installabili separatamente (public/
// manifest-nextgen.json, components/InstallPrompt.tsx): quelle restano per
// chi vuole due icone distinte sul telefono, questo pulsante è la
// scorciatoia rapida DENTRO l'app per chi preferisce passare dall'una
// all'altra senza installare/aprire nulla di diverso.
//
// Comportamento:
// - Visibile solo sulle pagine GENITORE (LEGACY e NEXTGEN): nascosto su
//   /center, /admin, /nextgen/center, /nextgen/admin, /auth — NEXTGEN oggi
//   non ha equivalenti per quelle aree (restano per gli Sprint 4/7/8 futuri).
// - Il target è sempre la HOME dell'altra versione ("/" o "/nextgen"), non
//   una pagina "equivalente" pagina-per-pagina: NEXTGEN oggi copre solo
//   Dashboard/Planner/Ricerca, non ogni schermata di LEGACY (dettaglio
//   attività, profilo, gruppi...), quindi non esiste un mapping 1:1
//   affidabile per ogni URL della app.
// - La scelta viene ricordata (cookie bk_version): tornando su "/" o
//   "/nextgen" (SOLO quelle due home, non le pagine interne) si riparte
//   dalla versione scelta l'ultima volta.
// - ECCEZIONE IMPORTANTE, per non rompere la richiesta precedente delle due
//   app separate: se il sito è aperto in modalità "standalone" (cioè dalla
//   propria icona installata sulla home del telefono), il redirect
//   automatico NON scatta — aprire l'icona "BuddyKids" apre sempre LEGACY,
//   aprire "BuddyKids NextGen" apre sempre NEXTGEN, a prescindere
//   dall'ultima preferenza scelta nel browser normale.
function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error -- proprietà non standard usata da Safari iOS
    window.navigator.standalone === true
  );
}

// SPRINT 5.3 — "/share" aggiunto: pagina pubblica di sola lettura (link di
// Condivisione Piano), aperta anche da chi non ha mai installato/usato
// l'app (nonni, tata) — non deve mostrare il toggle LEGACY/NEXTGEN né
// tentare redirect di preferenza versione.
//
// Gate C (28/07) — "/activity" aggiunto: BUG REALE trovato dal run live
// (TC-026, mobile-chrome). La scheda attività (app/activity/[id]/DetailClient.tsx)
// ha già i suoi controlli in alto a destra (bottone preferito, top-[18px]
// right-[18px], z-10) — questo toggle (fixed, top-4 right-4, z-50) ci si
// sovrappone sullo stesso angolo su viewport stretti, e vincendo per
// z-index intercetta il click destinato al cuore ("intercepts pointer
// events", confermato dal trace Playwright). Stesso principio delle altre
// esclusioni sopra: pagine con i propri controlli dedicati in quell'angolo
// non devono competere con lo switch versione globale.
//
// Visual Acceptance Gate (§15, TRAMA_ONE_VISUAL_ACCEPTANCE.md riga 1) —
// BUG REALE trovato da Fabrizio con screenshot a ~400px: la shell "/one"
// (Parent, PageHeader con titolo "TRAMA ONE — Parent", DEC-59) non era in
// questa lista, quindi il toggle ci si sovrapponeva coprendo parte del
// titolo. Stesso principio di "/activity": "/one" ha già la propria
// freccia indietro verso "/nextgen" nell'header (stessa destinazione di
// uno dei due versi di questo toggle), quindi il pulsante flottante è sia
// ridondante sia in conflitto visivo su viewport stretti — aggiunto qui.
const HIDDEN_PREFIXES = ["/center", "/admin", "/nextgen/center", "/nextgen/admin", "/auth", "/share", "/activity", "/one"];

// Richiesta di Fabrizio (27/08): il toggle non deve più essere visibile per
// utenti esterni/beta tester — resta attivo SOLO per le sue utenze di test
// personali (vedi lib/dev/test-accounts.ts). `allowed` parte `false` e viene
// confermato in modo asincrono (nessun flash del pulsante per utenti non
// autorizzati durante il breve istante prima che arrivi la risposta di
// auth.getUser()). Anche il redirect automatico su preferenza salvata
// (cookie bk_version) è condizionato allo stesso controllo, per non lasciare
// un comportamento residuo su account che avevano già impostato una
// preferenza prima di questa restrizione.
export default function VersionToggle() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const hidden = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  const currentVersion: AppVersion = pathname.startsWith("/nextgen") ? "nextgen" : "legacy";
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setAllowed(isVersionToggleTestAccount(data.user?.email));
    });
    return () => {
      cancelled = true;
    };
  }, [hidden]);

  useEffect(() => {
    if (hidden || !allowed) return;
    if (pathname !== "/" && pathname !== "/nextgen") return; // solo le due home, mai su pagine interne
    if (isStandaloneDisplay()) return; // icona installata: identità fissa, mai reindirizzata

    const preferred = readVersionPreference();
    if (preferred && preferred !== currentVersion) {
      router.replace(preferred === "nextgen" ? "/nextgen" : "/");
    }
  }, [pathname, hidden, allowed, currentVersion, router]);

  if (hidden || !allowed) return null;

  const target: AppVersion = currentVersion === "nextgen" ? "legacy" : "nextgen";

  function switchVersion() {
    writeVersionPreference(target);
    router.push(target === "nextgen" ? "/nextgen" : "/");
  }

  return (
    <button
      type="button"
      onClick={switchVersion}
      style={{ marginTop: "env(safe-area-inset-top)" }}
      className="fixed right-4 top-4 z-50 flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[11px] font-bold text-white shadow-lg transition-transform hover:scale-105"
    >
      <i className="ti ti-arrows-exchange text-[13px]" />
      {target === "nextgen" ? "Passa a NextGen" : "Torna a V1"}
    </button>
  );
}
