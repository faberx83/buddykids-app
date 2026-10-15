"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { consumeBackOnMount, noteNavigation, scrollKey } from "@/lib/nextgen/in-app-history";

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

// TRAMA — DISCOVERY FINAL UX PASS (22/09/2026), §3 "MAP + FLOATING BUTTON
// OVERLAY". Stesso context già usato per isScrolling (stessa ragione:
// NotificationCenter/BetaFeedbackButton sono FRATELLI del contenuto, non
// figli — uno stato condiviso via context invece di prop-drilling lungo
// l'albero). `hideFloatingControls`/`setHideFloatingControls` sono
// FACOLTATIVI e di default `false`: ogni pagina NEXTGEN che non li tocca
// mai (tutte, tranne SearchDiscoveryClient in vista Mappa) si comporta
// ESATTAMENTE come prima. Soluzione preferita dal prompt ("se questi
// controlli non sono essenziali mentre l'utente interagisce con la mappa,
// possono essere nascosti nella sola Map view") invece di un
// riposizionamento con z-index/margini dedicati: più semplice, robusta, e
// non richiede coordinare due componenti indipendenti con le dimensioni
// mutevoli della mappa/legenda/microcopy sotto di essa.
const ScrollActivityContext = createContext<{
  isScrolling: boolean;
  notifyScroll: () => void;
  hideFloatingControls: boolean;
  setHideFloatingControls: (hidden: boolean) => void;
}>({
  isScrolling: false,
  notifyScroll: () => {},
  hideFloatingControls: false,
  setHideFloatingControls: () => {},
});

export function NextgenScrollActivityProvider({ children }: { children: React.ReactNode }) {
  const [isScrolling, setIsScrolling] = useState(false);
  const [hideFloatingControls, setHideFloatingControls] = useState(false);
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
    <ScrollActivityContext.Provider value={{ isScrolling, notifyScroll, hideFloatingControls, setHideFloatingControls }}>
      {children}
    </ScrollActivityContext.Provider>
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

// Consumata da NotificationCenter/BetaFeedbackButton per non renderizzarsi
// affatto mentre una pagina segnala che i controlli flottanti
// interferirebbero con un'area di interazione a schermo intero (oggi: solo
// la vista Mappa di Scopri). Default `false` per ogni pagina che non la
// imposta mai — nessun impatto altrove.
export function useNextgenHideFloatingControls(): boolean {
  return useContext(ScrollActivityContext).hideFloatingControls;
}

// Consumata da SearchDiscoveryClient (o qualunque altra pagina futura con lo
// stesso bisogno): imposta/rimuove il flag sopra. Va richiamata con `false`
// quando la pagina lascia lo stato che nasconde i controlli (es. un
// useEffect con cleanup — vedi SearchDiscoveryClient.tsx) per non lasciare i
// bottoni nascosti su un'altra pagina dopo la navigazione.
export function useSetNextgenHideFloatingControls(): (hidden: boolean) => void {
  return useContext(ScrollActivityContext).setHideFloatingControls;
}

// Piccolo wrapper per il div scrollabile condiviso: stessa identica resa di
// prima (classi invariate, passate dal chiamante), solo con l'onScroll
// collegato al Provider qui sopra.
//
// 15/10/2026 — "tornando indietro la pagina riparte da dove ero" (Fabrizio,
// per tutta l'app). Lo scorrimento delle pagine famiglie avviene QUI, non
// nella finestra: il ripristino automatico del browser/Next non lo vede,
// quindi si salva la posizione per indirizzo (sessionStorage) e la si
// rimette quando si torna indietro. Tiene anche il conto delle pagine
// visitate per la freccia "indietro" (lib/nextgen/in-app-history.ts).
export function NextgenScrollArea({ className, children }: { className: string; children: React.ReactNode }) {
  const notifyScroll = useNotifyNextgenScroll();
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement | null>(null);
  const frame = useRef<number | null>(null);

  const firstRender = useRef(true);
  useEffect(() => {
    // Prima pagina montata: non cambia il conteggio delle pagine, ma se ci si
    // arriva con "indietro" (es. dalla scheda attività a Scopri) si ripristina
    // comunque la posizione.
    let wasBack: boolean;
    if (firstRender.current) {
      firstRender.current = false;
      wasBack = consumeBackOnMount(window.location.href);
    } else {
      wasBack = noteNavigation(window.location.href).wasBack;
    }
    if (!wasBack) return;
    let target = 0;
    try {
      target = Number(sessionStorage.getItem(scrollKey(window.location.pathname, window.location.search)) ?? 0);
    } catch {
      return;
    }
    if (!target) return;
    // Il contenuto può arrivare un attimo dopo (dati dal server): si riprova
    // finché la pagina è abbastanza lunga, al massimo per ~2 secondi.
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      if (el.scrollHeight - el.clientHeight >= target || tries >= 40) {
        el.scrollTop = target;
        return;
      }
      tries += 1;
      timer = setTimeout(apply, 50);
    };
    apply();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [pathname]);

  function onScroll() {
    notifyScroll();
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const el = ref.current;
      if (!el) return;
      try {
        sessionStorage.setItem(scrollKey(window.location.pathname, window.location.search), String(Math.round(el.scrollTop)));
      } catch {
        // modalità privata o spazio pieno: niente ripristino, nessun errore
      }
    });
  }

  return (
    <div ref={ref} className={className} onScroll={onScroll}>
      {children}
    </div>
  );
}
