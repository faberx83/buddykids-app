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
//
// TRAMA — FINAL PRE-DEPLOY FIX (14/09/2026, richiesta esplicita di
// Fabrizio: "la barra NON deve andare subito a tutti gli utenti [...] non è
// ancora stata verificata visivamente live"). Prop `enabled` aggiunta —
// risolta SERVER-SIDE da app/nextgen/layout.tsx tramite
// GLOBAL_ACTION_PROGRESS_ENABLED (stesso pattern Dark Release di
// SCHOOL_CALENDAR_INTELLIGENCE_ENABLED/CALENDAR_EXPORT_ENABLED), MAI letta
// qui dentro. Quando `enabled` è false (default per QUALUNQUE utente
// normale): start()/complete() restano no-op sicuri (stesso identico
// comportamento del provider "assente" usato da LEGACY — nessuna doppia
// implementazione, un solo ramo di codice), e <GlobalActionProgressBar>
// non viene mai montata — zero differenza di rendering/comportamento
// rispetto a prima di questa capability, per costruzione.

interface GlobalActionProgressContextValue {
  start: () => void;
  complete: () => void;
  // TRAMA — FINAL PRE-DEPLOY FIX (14/09/2026, §PROGRESS COVERAGE punto B
  // "submit/Server Action: copertura tramite pattern condiviso quando
  // possibile"). Questo repository non ha un Button/Link/form-submit
  // condiviso da cui agganciarsi automaticamente (verificato via grep prima
  // di scrivere questo helper: zero useTransition, zero componente
  // components/ui/Button.tsx) — un layer del genere richiederebbe
  // riscrivere manualmente decine di call site esistenti, esattamente ciò
  // che questa sessione ha istruzione di NON fare. `run()` è invece un
  // pattern OPT-IN: una singola riga (`await run(() => someServerAction())`)
  // che qualunque CTA futura può adottare individualmente al posto del
  // try/start/finally/complete scritto a mano — riduce il rischio di
  // dimenticare complete() in un finally, ma non wira nulla da solo.
  run: <T>(fn: () => Promise<T>) => Promise<T>;
}

const noopRun = async <T,>(fn: () => Promise<T>): Promise<T> => fn();
const noop: GlobalActionProgressContextValue = { start: () => {}, complete: () => {}, run: noopRun };
const GlobalActionProgressContext = createContext<GlobalActionProgressContextValue>(noop);

/**
 * Da chiamare intorno a una CTA che avvia una vera operazione asincrona
 * (Server Action, submit, fetch) — due stili equivalenti:
 *   const { start, complete } = useGlobalActionProgress();
 *   async function handleSave() {
 *     start();
 *     try { await someServerAction(); } finally { complete(); }
 *   }
 * oppure, più compatto (stesso comportamento, un solo punto in cui
 * dimenticare start/complete non è possibile):
 *   const { run } = useGlobalActionProgress();
 *   async function handleSave() {
 *     await run(() => someServerAction());
 *   }
 * Sicuro da chiamare anche FUORI da un GlobalActionProgressProvider (es.
 * pagine LEGACY, dove questo provider non è ancora montato, §29 "questa
 * sessione lo introduce solo sotto /nextgen"): start/complete/run diventano
 * no-op (run esegue comunque la funzione, solo senza segnalare progresso),
 * mai un errore.
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

export function GlobalActionProgressProvider({
  children,
  // Default false — MAI true "per errore" se un futuro call site dimentica
  // di passare la prop: stesso principio fail-safe del resto dell'infra
  // Dark Release di questo repository (un flag non risolto è sempre "off").
  enabled = false,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
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
    // §PROGRESS FLAG: utente per cui GLOBAL_ACTION_PROGRESS_ENABLED risolve
    // false — no-op totale, stesso identico comportamento di "provider
    // assente" (nessun timer creato, nessuno stato aggiornato).
    if (!enabled) return;
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
  }, [beginVisible, enabled]);

  const complete = useCallback(() => {
    if (!enabled) return; // stesso motivo di start() sopra — no-op simmetrico
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
  }, [clearProgressTimers, enabled]);

  // §PROGRESS COVERAGE punto B: wrapper opt-in, vedi commento sull'interfaccia
  // sopra. Nessuna dipendenza da `start`/`complete` diversa da quella già
  // stabile (entrambe useCallback), quindi `run` è a sua volta stabile fra i
  // render.
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      start();
      try {
        return await fn();
      } finally {
        complete();
      }
    },
    [start, complete]
  );

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
    <GlobalActionProgressContext.Provider value={{ start, complete, run }}>
      {children}
      {/* §PROGRESS FLAG: la barra non viene mai montata per un utente per cui
          GLOBAL_ACTION_PROGRESS_ENABLED risolve false — non un "display:none"
          CSS, il componente non emette nulla nel DOM (stesso principio già
          usato da SchoolCalendarOnboardingCallout/PlannerCalendarExportCard
          per i loro flag). `phase` resta comunque sempre "idle" in quel caso
          perché start()/complete() sono no-op quando enabled=false — questa
          condizione è quindi ridondante ma esplicita per chiarezza. */}
      {enabled && <GlobalActionProgressBar phase={phase} percent={percent} />}
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
