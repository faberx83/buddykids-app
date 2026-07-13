"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { readVersionPreference, writeVersionPreference, AppVersion } from "@/lib/version-preference";

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

const HIDDEN_PREFIXES = ["/center", "/admin", "/nextgen/center", "/nextgen/admin", "/auth"];

export default function VersionToggle() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const hidden = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  const currentVersion: AppVersion = pathname.startsWith("/nextgen") ? "nextgen" : "legacy";

  useEffect(() => {
    if (hidden) return;
    if (pathname !== "/" && pathname !== "/nextgen") return; // solo le due home, mai su pagine interne
    if (isStandaloneDisplay()) return; // icona installata: identità fissa, mai reindirizzata

    const preferred = readVersionPreference();
    if (preferred && preferred !== currentVersion) {
      router.replace(preferred === "nextgen" ? "/nextgen" : "/");
    }
  }, [pathname, hidden, currentVersion, router]);

  if (hidden) return null;

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
