"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

// TRAMA BETA v1.1.1 — FINAL FUNCTIONAL + UI CONSISTENCY FIXES (punto 7).
// Vedi lib/nextgen/floating-controls.ts per la ROOT CAUSE ANALYSIS completa
// e il motivo del fix. Questo file è SOLO l'infrastruttura client (context +
// listener di scroll) — nessuna logica di dominio qui, per questo non
// finisce in lib/nextgen (che punta a moduli puri testabili senza React).
//
// NotificationCenter e BetaFeedbackButton sono montati come FRATELLI del div
// scrollabile in app/nextgen/layout.tsx (non figli), quindi lo stato
// "sto scrollando" va condiviso via context invece che passato come prop
// lungo l'albero — un solo Provider, montato una volta nel layout condiviso,
// copre ogni pagina genitore NEXTGEN senza bisogno di fix per-schermata.

const IDLE_MS = 220;

const ScrollActivityContext = createContext<{ isScrolling: boolean; notifyScroll: () => void }>({
  isScrolling: false,
  notifyScroll: () => {},
});

export function NextgenScrollActivityProvider({ children }: { children: React.ReactNode }) {
  const [isScrolling, setIsScrolling] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function notifyScroll() {
    setIsScrolling(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsScrolling(false), IDLE_MS);
  }

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  return (
    <ScrollActivityContext.Provider value={{ isScrolling, notifyScroll }}>{children}</ScrollActivityContext.Provider>
  );
}

// Consumata dal contenitore scrollabile (vedi NextgenScrollArea sotto).
export function useNotifyNextgenScroll(): () => void {
  return useContext(ScrollActivityContext).notifyScroll;
}

// Consumata da NotificationCenter/BetaFeedbackButton per attenuarsi/lasciar
// passare il tap durante uno scroll attivo — vedi floatingControlClassName.
export function useNextgenIsScrolling(): boolean {
  return useContext(ScrollActivityContext).isScrolling;
}

// Piccolo wrapper per il div scrollabile condiviso: stessa identica resa di
// prima (classi invariate, passate dal chiamante), solo con l'onScroll
// collegato al Provider qui sopra.
export function NextgenScrollArea({ className, children }: { className: string; children: React.ReactNode }) {
  const notifyScroll = useNotifyNextgenScroll();
  return (
    <div className={className} onScroll={notifyScroll}>
      {children}
    </div>
  );
}
