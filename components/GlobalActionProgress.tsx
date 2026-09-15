"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isInternalNavigableClick, type LinkClickInfo } from "@/lib/nextgen/navigation-progress-core";

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
//
// TRAMA — GLOBAL ACTION PROGRESS · LIVE FIX (15/09/2026, segnalazione di
// Fabrizio dopo attivazione reale di cohort:internal-preview: "la progress
// bar non è visibile/percepibile"). ROOT CAUSE dimostrata tracciando il
// lifecycle della versione precedente:
//   CLICK su un <Link> → Next.js avvia la transizione client-side
//   → il DOM/React si aggiorna sulla nuova rotta
//   → SOLO A QUEL PUNTO usePathname() cambia e l'effetto precedente
//     chiamava start() E complete() (quest'ultimo via requestAnimationFrame,
//     ~16ms dopo) → pendingCount torna a 0 ben PRIMA della soglia anti-flash
//     (era 150ms) → il showTimer che avrebbe reso visibile la barra veniva
//     SEMPRE cancellato da complete() prima di scattare (vedi il ramo
//     `if (showTimerRef.current) { clearTimeout(...); return; }` in
//     complete() sotto) → la barra non diventava MAI visibile per la
//     navigazione, per costruzione del lifecycle, non per un timeout mal
//     tarato.
// In altre parole: usePathname() segnalava una navigazione già FINITA, non
// una in corso — start() partiva quando ormai non c'era più nulla da
// aspettare. Fix: la navigazione ora parte dal GESTO dell'utente (click
// intercettato in capture phase, vedi useEffect più sotto e
// lib/nextgen/navigation-progress-core.ts per la logica pura di filtro),
// e usePathname()/useSearchParams() restano SOLO il segnale di
// COMPLETAMENTO — mai più il trigger di partenza.
//
// (Verificato anche il sospetto di un secondo bug, il clipping CSS di
// .app-shell overflow:hidden su desktop: escluso — components/
// PageLoadIndicator.tsx usa lo stesso identico pattern `fixed ... top-0`
// dentro lo stesso PhoneShell/.app-shell da mesi, senza mai essere
// segnalato come invisibile. position:fixed non viene "tagliato" da un
// overflow:hidden ancestor a meno che quell'ancestor non stabilisca un
// containing block per elementi fixed — transform/filter/perspective/
// contain, nessuno dei quali è presente su .app-shell. Non è quindi la
// causa: non serve alcun cambio di posizionamento.)

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
  // TRAMA — GLOBAL ACTION PROGRESS · LIVE FIX (15/09/2026, §6 "PROGRAMMATIC
  // ROUTER.PUSH"). I click su <Link>/<a> sono coperti AUTOMATICAMENTE dal
  // listener in capture phase (vedi useEffect più sotto) — questo copre già
  // la maggior parte della navigazione "in avanti" di questo repository
  // (verificato: "Riempi settimana" e le righe Planner Week Detail sono
  // entrambe <Link>, non router.push). Per le poche CTA che chiamano
  // router.push() PROGRAMMATICAMENTE (senza passare da un click su <a>, es.
  // PageHeader "indietro"), non c'è alcun click da intercettare — il
  // chiamante deve segnalarlo esplicitamente chiamando runNavigation() SUBITO
  // PRIMA di router.push(...). Stesso meccanismo di startNavigation()
  // interno (contatore pending + safety timeout), esposto con un nome che
  // ne chiarisce l'uso specifico invece di riusare lo `start()` generico.
  runNavigation: () => void;
}

const noopRun = async <T,>(fn: () => Promise<T>): Promise<T> => fn();
const noop: GlobalActionProgressContextValue = { start: () => {}, complete: () => {}, run: noopRun, runNavigation: () => {} };
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
 * Per una navigazione PROGRAMMATICA (router.push() senza un click su <a>,
 * es. PageHeader "indietro"), chiama runNavigation() subito prima:
 *   const { runNavigation } = useGlobalActionProgress();
 *   function goBack() {
 *     runNavigation();
 *     router.push(previousUrl);
 *   }
 * I click reali su <Link>/<a> sono invece coperti AUTOMATICAMENTE da un
 * listener in capture phase — non serve mai chiamare runNavigation() per
 * quelli.
 *
 * Sicuro da chiamare anche FUORI da un GlobalActionProgressProvider (es.
 * pagine LEGACY, dove questo provider non è ancora montato, §29 "questa
 * sessione lo introduce solo sotto /nextgen"): start/complete/run/
 * runNavigation diventano no-op (run esegue comunque la funzione, solo
 * senza segnalare progresso), mai un errore.
 */
export function useGlobalActionProgress() {
  return useContext(GlobalActionProgressContext);
}

type Phase = "idle" | "pending" | "finishing";

// TRAMA — GLOBAL ACTION PROGRESS · LIVE FIX (15/09/2026, §8 "ANTI-FLASH").
// 150ms → 100ms: con la root cause del §ROOT CAUSE corretta (start() ora
// parte davvero al click, non all'arrivo sulla rotta), 150ms sarebbe
// comunque bastato per la navigazione — ma per le Server Action dirette
// (Salva scuola, Salva bambino, ecc.), che su una Vercel Hobby possono
// completare in 100-300ms, 150ms lasciava una finestra reale in cui
// l'azione finiva PRIMA che la barra diventasse visibile, rendendola
// "percepibile solo a volte". 100ms (dentro il range 80-120ms indicato)
// resta comunque sufficiente a filtrare un vero flash per un toggle
// istantaneo, mentre rende percepibile qualunque round-trip di rete reale.
const SHOW_DELAY_MS = 100;
// Già dentro il range 300-400ms richiesto — nessun cambio: una volta
// comparsa, la barra resta visibile almeno questo tempo (evita il
// lampeggio per azioni appena sopra la soglia SHOW_DELAY_MS).
const MIN_VISIBLE_MS = 350;
// §19: fade-out finale.
const FADE_MS = 200;
// TRAMA — GLOBAL ACTION PROGRESS · LIVE FIX (15/09/2026, §5 "NAVIGATION
// COMPLETE": "deve restare un timeout di sicurezza ragionevole solo per
// evitare una barra bloccata per sempre in caso di navigazione abortita/
// errori"). 8s: generoso rispetto a qualunque navigazione client-side reale
// (anche un cold start Vercel + rete lenta raramente supera pochi secondi),
// ma abbastanza breve da non lasciare la barra visibile a lungo se una
// navigazione viene interrotta (tasto Indietro del browser durante il
// caricamento, errore di rete, un link che per qualche motivo non cambia
// mai pathname/searchParams).
const NAVIGATION_SAFETY_TIMEOUT_MS = 8000;

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

  // ───────────────────────────────────────────────────────────────────────
  // TRAMA — GLOBAL ACTION PROGRESS · LIVE FIX (15/09/2026). Vedi il grande
  // commento in cima al file per la root cause completa. Qui: la
  // navigazione ora parte dal CLICK (startNavigation, sotto), mai più da
  // usePathname() — che resta SOLO il segnale di completamento.
  // ───────────────────────────────────────────────────────────────────────
  const navigationPendingRef = useRef(false);
  const navigationSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startNavigation = useCallback(() => {
    navigationPendingRef.current = true;
    start();
    if (navigationSafetyTimerRef.current) clearTimeout(navigationSafetyTimerRef.current);
    // §5 "safety timeout": se pathname/searchParams non cambiano entro
    // questa finestra (navigazione abortita, errore, o un link che per
    // qualche motivo non porta mai a un cambio di rotta), completa comunque
    // — mai una barra bloccata per sempre.
    navigationSafetyTimerRef.current = setTimeout(() => {
      navigationSafetyTimerRef.current = null;
      if (navigationPendingRef.current) {
        navigationPendingRef.current = false;
        complete();
      }
    }, NAVIGATION_SAFETY_TIMEOUT_MS);
  }, [start, complete]);

  const completeNavigationIfPending = useCallback(() => {
    // Chiamata ad OGNI cambio di pathname/searchParams (vedi effetto sotto)
    // — ma completa DAVVERO solo se una navigazione era stata segnalata da
    // startNavigation(). Senza questo guard, un cambio di pathname non
    // collegato a nessun click/runNavigation() (es. un redirect lato server
    // indipendente) chiamerebbe complete() su un pendingCount che start()
    // non ha mai incrementato per quella ragione — innocuo per il contatore
    // (complete() satura già a 0, mai negativo), ma renderebbe il segnale
    // meno preciso; il guard lo evita del tutto.
    if (!navigationPendingRef.current) return;
    navigationPendingRef.current = false;
    if (navigationSafetyTimerRef.current) {
      clearTimeout(navigationSafetyTimerRef.current);
      navigationSafetyTimerRef.current = null;
    }
    complete();
  }, [complete]);

  const runNavigation = useCallback(() => {
    startNavigation();
  }, [startNavigation]);

  // Segnale di COMPLETAMENTO (mai più di partenza, vedi root cause) — resta
  // usePathname()/useSearchParams(), perché l'App Router non espone un
  // evento nativo "navigazione completata" (§24, limite già accettato da
  // PageLoadIndicator): si considera completa al render successivo della
  // nuova rotta.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    completeNavigationIfPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParamsString]);

  // §3 "INTERNAL LINK INTERCEPTION": un solo listener nativo in capture
  // phase su document, NON un handler per singolo <Link> (§39/§23: "evitare
  // di modificare manualmente 51 <Link>"), nessun monkey-patch di
  // window.history/router. Capture phase garantisce che questo listener
  // veda il click PRIMA che il proprio handler bubble di Next.js su <Link>
  // chiami preventDefault() — quindi start() parte davvero al gesto
  // dell'utente, non dopo.
  useEffect(() => {
    if (typeof document === "undefined") return;

    function handleClickCapture(event: MouseEvent) {
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const info: LinkClickInfo = {
        href: anchor.getAttribute("href"),
        target: anchor.getAttribute("target"),
        hasDownloadAttr: anchor.hasAttribute("download"),
        button: event.button,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        defaultPrevented: event.defaultPrevented,
      };

      if (isInternalNavigableClick(info, window.location.origin, window.location.href)) {
        startNavigation();
      }
    }

    document.addEventListener("click", handleClickCapture, true);
    return () => document.removeEventListener("click", handleClickCapture, true);
  }, [startNavigation]);

  // Cleanup allo smontaggio del provider stesso (unmount di tutta l'app
  // NEXTGEN, es. cambio tenant) — evita timer orfani.
  useEffect(() => {
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      if (navigationSafetyTimerRef.current) clearTimeout(navigationSafetyTimerRef.current);
      clearProgressTimers();
    };
  }, [clearProgressTimers]);

  return (
    <GlobalActionProgressContext.Provider value={{ start, complete, run, runNavigation }}>
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
          // TRAMA — GLOBAL ACTION PROGRESS · LIVE FIX (15/09/2026, §9
          // "VISUAL": "per il test live: opacity: 1"). Era 0.95 — quasi
          // impercettibile su una barra alta 3px in movimento veloce, si
          // sommava alla root cause come ulteriore motivo di scarsa
          // percettibilità. 1 solo nello stato attivo; il fade-out finale
          // resta 0 via `fadingOut`, invariato.
          opacity: fadingOut ? 0 : 1,
          transition: fadingOut ? `opacity ${FADE_MS}ms ease-out, width 200ms ease-out` : "width 550ms cubic-bezier(0.22, 0.61, 0.36, 1)",
        }}
      />
    </div>
  );
}
