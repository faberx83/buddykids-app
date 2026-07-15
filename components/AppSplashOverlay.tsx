"use client";

import { useEffect, useState } from "react";

// BUGFIX (segnalato da Fabrizio: "si vede ancora lo sfondo colorato in
// apertura della PWA, dovrebbe essere bianco... aggiungi anche nome TRAMA e
// claim con font/dimensioni/proporzioni giuste") — Android/Chrome non
// permette di personalizzare lo splash screen nativo della PWA: mostra solo
// icona su manifest#background_color, MAI testo (limite della piattaforma,
// non un bug nostro — vedi commento su splashLinks() in lib/tenant.ts per lo
// stesso limite lato iOS, lì risolto con immagini statiche perché Safari le
// supporta). Per avere davvero logo + "TRAMA" + claim al primo apertura
// serve un overlay nostro.
//
// Montato UNA sola volta nel root layout (app/layout.tsx): essendo dentro il
// layout radice, non viene rimontato dalle navigazioni client-side interne
// (stesso principio di RoleSwitcher/InstallPrompt/VersionToggle) — quindi
// l'effetto di mount (e il timer sotto) scatta una sola volta per apertura
// reale dell'app/refresh, mai a ogni cambio pagina. Nessun localStorage o
// sessionStorage necessario per "mostralo una sola volta": lo stato React
// stesso già garantisce questo, ed è anche più corretto (un vero refresh
// dell'app DEVE far ricomparire lo splash, non solo la primissima visita mai
// fatta).
//
// Renderizzato lato server (nessun gate "mounted" prima del primo render):
// il markup con lo sfondo/logo giusti è già nell'HTML iniziale, visibile fin
// dal primo paint, prima ancora che React idrati — così non c'è nessun
// istante con uno sfondo "sbagliato" o bianco vuoto prima che compaia.
//
// pointer-events-none FIN DALL'INIZIO: è puramente decorativo, non deve mai
// bloccare un tap reale dell'utente (né rompere la suite Playwright
// esistente, che clicca sugli elementi subito dopo goto() senza aspettare
// questo timer).
const HOLD_MS = 900;
const FADE_MS = 350;

export default function AppSplashOverlay({
  logoSrc,
  wordmarkSrc,
  claim,
  background,
}: {
  logoSrc: string;
  wordmarkSrc: string;
  claim?: string;
  background: string;
}) {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase("fading"), HOLD_MS);
    const removeTimer = setTimeout(() => setPhase("gone"), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden="true"
      data-testid="app-splash-overlay"
      style={{ backgroundColor: background }}
      className={`pointer-events-none fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 transition-opacity duration-[350ms] ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      <img src={logoSrc} alt="" className="h-20 w-20" />
      <img src={wordmarkSrc} alt="TRAMA" className="h-7 w-auto" />
      {claim && <p className="text-[13px] text-ink-2">{claim}</p>}
    </div>
  );
}
