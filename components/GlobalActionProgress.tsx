"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// TRAMA — SCHOOL CALENDAR UX REFINEMENT §17-28 "GLOBAL CTA PROGRESS
// FEEDBACK" (14/09/2026). Barra sottile, brandizzata TRAMA, che dà un
// segnale di attività dopo il click su una CTA che avvia una VERA
// operazione percepibile (navigazione, Server Action, submit, download) —
// mai una percentuale reale: è un "activity progress indicator" (§20), non
// una progress bar di upload/download.
//
// §23 "ARCHITETTURA" — pattern esistenti cercati PRIMA di scrivere questo
// file: components/PageLoadIndicator.tsx copre già la navigazione
// (nprogress-style, montato in app/(main)/layout.tsx e DashboardLayout.tsx
// per LEGACY/Admin/Partner) ma non è montato sotto /nextgen e non espone
// alcun modo di segnalare un'azione NON di navigazione. Questo componente
// generalizza lo stesso principio (pathname-change per la navigazione,
// AUTOMATICO e gratuito per ogni Link/router.push — nessuna CTA di
// navigazione va istrumentata a mano) aggiungendo un contatore pending
// imperativo start()/complete() per le CTA esplicitamente istrumentate
// (§21) — necessario perché questo codebase non usa ancora useTransition/
// useFormStatus per le sue Server Action (sono chiamate async dirette
// dentro onClick/onSubmit, verificato via grep prima di scrivere questo
// file, §23 punto 5: "solo se realmente necessario").
//
// Nessuna nuova dipendenza (NProgress esplicitamente escluso dalla
// richiesta, §23) — solo React state + CSS (vedi app/globals.css,
// .trama-progress-fill).

interface GlobalActionProgressContextValue {
  start: () => void;
  complete: () => void;
}

const noop: GlobalActionProgressContextValue = { start: () => {}, complete: () => {} };
const GlobalActionProgressContext = createContext<GlobalActionProgressContextValue>(noop);

/**
 * Da chiamare intorno a una CTA che avvia una vera operazione asincrona
 * (Server Action, submit, fetch) — es.:
 *   const { start, complete } = useGlobalActionProgress();
 *   async function handleSave() {
 *     start();
 *     try { await someServerAction(); } finally { complete(); }
 *   }
 * Sicuro da chiamare anche FUORI da un GlobalActionProgressProvider (es.
 * pagine LEGACY, dove questo provider non è ancora montato, §29 "questa
 * sessione lo introduce solo sotto /nextgen"): start/complete diventano
 * no-op, mai un errore.
 */
export function useGlobalActionProgress() {
  return useContext(GlobalActionProgressContext);
}

type Phase = "idle" | "pending" | "finishing";

// §20: non mostrare la barra se l'azione termina entro questa soglia (evita
// il "flash" per azioni istantanee).
const SHOW_DELAY_MS = 150;
// §20: una volta comparsa, resta visibile almeno questo tempo (evita il
// lampeggio per azioni appena sopra la soglia).
const MIN_VISIBLE_MS = 350;
// §19: fade-out finale.
const FADE_MS = 200;

export function GlobalActionProgressProvider({ children }: { children: React.ReactNode }) {
  // §26 "CONCURRENT ACTIONS": contatore, non un booleano — la barra si
  // nasconde SOLO quando l'ultima azione pending è completata.
  const pendingCountRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [percent, setPercent] = useState(0);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAtRef = useRef<number | null>(null);
  const progressTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>("idle");

  const clearProgressTimers = useCallback(() => {
    progressTimersRef.current.forEach(clearTimeout);
    progressTimersRef.current = [];
  }, []);

  const beginVisible = useCallback(() => {
    shownAtRef.current = Date.now();
    phaseRef.current = "pending";
    setPhase("pending");
    setPercent(10);
    clearProgressTimers();
    // §20 "Progressione indicativa": rapida all'inizio, rallenta prima del
    // completamento, NON arriva mai da sola a 100 — solo complete() ci
    // arriva, e solo quando l'operazione è davvero conclusa.
    progressTimersRef.current.push(
      setTimeout(() => setPercent(35), 150),
      setTimeout(() => setPercent(62), 500),
      setTimeout(() => setPercent(88), 1400)
    );
  }, [clearProgressTimers]);

  const start = useCallback(() => {
    pendingCountRef.current += 1;
    if (pendingCountRef.current > 1) return; // un'azione è già pending, nessun secondo timer
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      if (pendingCountRef.current > 0) beginVisible();
    }, SHOW_DELAY_MS);
  }, [beginVisible]);

  const complete = useCallback(() => {
    pendingCountRef.current = Math.max(0, pendingCountRef.current - 1); // mai negativo
    if (pendingCountRef.current > 0) return; // un'altra azione resta pending (§26)

    if (showTimerRef.current) {
      // L'azione è finita prima della soglia SHOW_DELAY_MS: la barra non è
      // mai comparsa, non c'è nulla da chiudere (§20 anti-flash).
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
      return;
    }
    if (phaseRef.current === "idle") return; // double-complete/unmount: no-op sicuro

    clearProgressTimers();
    const elapsed = shownAtRef.current ? Date.now() - shownAtRef.current : MIN_VISIBLE_MS;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    phaseRef.current = "finishing";
    setPhase("finishing");
    finishTimerRef.current = setTimeout(() => {
      setPercent(100);
      finishTimerRef.current = setTimeout(() => {
        phaseRef.current = "idle";
        setPhase("idle");
        setPercent(0);
        shownAtRef.current = null;
      }, FADE_MS);
    }, wait);
  }, [clearProgressTimers]);

  // Navigazione (§24): stesso principio "pathname-change" già in
  // produzione in PageLoadIndicator — copre AUTOMATICAMENTE ogni Link/
  // router.push sotto questo provider, senza istrumentare le CTA di
  // navigazione una per una (§39/§23: "evitare di modificare manualmente
  // 100 CTA"). L'App Router non espone un evento nativo "navigazione
  // completata" (§24): si considera completa al render successivo del
  // nuovo pathname, stesso limite già accettato da PageLoadIndicator.
  const pathname = usePathname();
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    start();
    const id = requestAnimationFrame(() => complete());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Cleanup allo smontaggio del provider stesso (unmount di tutta l'app
  // NEXTGEN, es. cambio tenant) — evita timer orfani.
  useEffect(() => {
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      clearProgressTimers();
    };
  }, [clearProgressTimers]);

  return (
    <GlobalActionProgressContext.Provider value={{ start, complete }}>
      {children}
      <GlobalActionProgressBar phase={phase} percent={percent} />
    </GlobalActionProgressContext.Provider>
  );
}

function GlobalActionProgressBar({ phase, percent }: { phase: Phase; percent: number }) {
  if (phase === "idle") return null;
  const fadingOut = phase === "finishing" && percent === 100;
  return (
    // §27: puramente decorativa, mai annunciata da uno screen reader.
    // §18: fixed, non occupa spazio nel layout verticale; top segue la
    // safe-area iOS così non finisce sotto il notch; z-[60] stesso livello
    // già usato da PageLoadIndicator/NextgenToastProvider in questo
    // repository (sopra i badge z-20 InternalPreview/Beta, ma la barra è
    // alta solo 3px a y:0 — i badge hanno p-2/contenuto che parte qualche
    // px più in basso, nessuna sovrapposizione visiva reale).
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      <div
        className="trama-progress-fill h-full"
        style={{
          width: `${percent}%`,
          opacity: fadingOut ? 0 : 0.95,
          transition: fadingOut ? `opacity ${FADE_MS}ms ease-out, width 200ms ease-out` : "width 550ms cubic-bezier(0.22, 0.61, 0.36, 1)",
        }}
      />
    </div>
  );
}
