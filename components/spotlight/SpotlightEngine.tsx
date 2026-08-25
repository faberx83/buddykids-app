"use client";

// TRAMA ONE Parent Spotlight sprint (24/08/2026) — motore Spotlight generico,
// ESTRATTO da components/spotlight/PartnerSpotlight.tsx (che ora è un thin
// wrapper attorno a questo componente, vedi lì) per essere riusato anche dal
// lato Genitore (components/spotlight/ParentSpotlight.tsx). Nessuna modifica
// di comportamento in questa estrazione: stesso overlay scuro con cutout,
// stesso popover ancorato (lib/spotlight/position.ts), stessa logica di
// avanzamento via click reale sull'elemento (data-spotlight="...", vedi
// lib/walkthrough/registry.ts) — solo il nome del componente e un nuovo prop
// opzionale `canLinkFromHere` (prima hardcoded sulla regex Partner
// "/center/activities/[id]") sono cambiati, per permettere a ogni wrapper
// tenant-specifico (Partner/Genitore) di decidere DA QUALE pagina è
// sensato mostrare il link di deep-link sul badge "target non trovato"
// (spotlightMissingHint) — vedi DEC-69. Tutti i commenti storici DEC-6x/7x
// (bug reali trovati da Fabrizio durante il Visual Acceptance Gate §15)
// restano invariati: descrivono il motore, non un dettaglio Partner-only.
//
// Montato una sola volta per portale (app/center/layout.tsx per il Partner,
// app/nextgen/layout.tsx per il Genitore), persiste su ogni pagina di quel
// portale, sopravvive alla navigazione.
//
// Limite noto e documentato (non un bug): per gli step con
// spotlightManualAdvance il completamento è legato al CLICK sull'elemento
// reale (es. il pulsante "Salva"), non alla conferma che l'azione sia andata
// a buon fine lato server — un click su un pulsante che poi fallisce per
// validazione marca comunque lo step completato. Accettato come compromesso
// v1: il target è comunque reale (non un pulsante decorativo dentro il
// tour), e l'utente può sempre "Ricomincia il percorso" se necessario.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { WalkthroughProgressSummary } from "@/lib/walkthrough/data";
import {
  computeCutoutRect,
  computePopoverPosition,
  isPathRelevantToRoute,
  matchesSpotlightRoute,
  padBorderRadius,
  pickVisibleTargetIndex,
  Rect,
} from "@/lib/spotlight/position";
import { startWalkthroughStepAction, completeWalkthroughStepAction, skipWalkthroughStepAction } from "@/app/actions/walkthrough";
import { logSpotlightEventAction } from "@/app/actions/spotlight";

export default function SpotlightEngine({
  progress,
  canLinkFromHere,
}: {
  progress: WalkthroughProgressSummary | null;
  // Facoltativo: quando lo step corrente ha spotlightMissingHint E il target
  // non è stato trovato sulla pagina attuale, decide se mostrare il link di
  // deep-link nel badge di fallback. Default: mai (nessun link) — sicuro per
  // un wrapper che non ha ancora bisogno di questo comportamento (es.
  // ParentSpotlight, i cui step non usano spotlightMissingHint).
  canLinkFromHere?: (pathname: string) => boolean;
}) {
  const pathname = usePathname();
  const [steps, setSteps] = useState(progress?.steps ?? []);
  const [currentKey, setCurrentKey] = useState(progress?.currentStepKey ?? null);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  // Visual Acceptance Gate (§15, DEC-70) — border-radius REALE dell'elemento
  // evidenziato (letto via getComputedStyle), usato per disegnare il ring
  // del cutout della stessa forma del target invece di un raggio fisso.
  // Richiesta di Fabrizio: "non si può fare uno spotlight della stessa forma
  // del pulsante? gli spigoli non sono belli". Default "8px" = lo stesso
  // valore fisso (rounded-lg) usato finché questo campo non è ancora stato
  // popolato dalla prima misurazione.
  const [cutoutRadius, setCutoutRadius] = useState("8px");
  const popoverRef = useRef<HTMLDivElement>(null);
  const loggedShownRef = useRef<string | null>(null);
  const loggedMissingRef = useRef<string | null>(null);
  // Visual Acceptance Gate (§15, DEC-68) — bug reale trovato da Fabrizio: un
  // target molto più in basso della viewport corrente (pagina non ancora
  // scrollata, es. la card "Servizi extra e pasto" o il calendario
  // disponibilità) produceva un popover posizionato fuori dai bordi della
  // viewport ("fixed" con top oltre l'altezza visibile) — invisibile a
  // qualunque scroll, perché getBoundingClientRect() è relativo al viewport
  // corrente, non al documento. Fix: quando lo step corrente CAMBIA (non ad
  // ogni remeasure), scrollare il target reale in vista una sola volta.
  // Tracciato per step-key (non per ogni measure()) per non combattere uno
  // scroll manuale dell'utente durante lo stesso step.
  const scrolledStepRef = useRef<string | null>(null);
  // Visual Acceptance Gate (§15, DEC-72) — vedi commento sotto: traccia per
  // quale step il popover ha già ricevuto il focus iniziale, per non
  // rifocalizzarlo a ogni remeasure (stesso pattern di scrolledStepRef).
  const focusedStepRef = useRef<string | null>(null);

  const current = steps.find((s) => s.key === currentKey) ?? null;

  const measure = useCallback(() => {
    if (!current?.spotlightTarget) {
      setTargetRect(null);
      setTargetMissing(false);
      return;
    }
    const routeOk = !current.spotlightRoute || matchesSpotlightRoute(current.spotlightRoute, pathname);
    if (!routeOk) {
      // Visual Acceptance Gate (§15, DEC-72) — bug reale trovato da
      // Fabrizio ("dopo aver fatto salva non mi fa capire che devo andare
      // nel Calendario disponibilità"): quando la pagina corrente non
      // corrisponde affatto allo spotlightRoute dello step (es. lo step
      // "Giorni spot" richiede /center/activities/[id]/calendar, ma dopo il
      // salvataggio si resta su /center/activities/[id], SENZA /calendar),
      // questo ramo marcava `targetMissing` FALSE — e più sotto, "if
      // (!targetRect && !targetMissing) return null" faceva sì che l'intero
      // componente non renderizzasse NULLA: niente overlay, niente badge,
      // nessun indizio per l'utente. Il badge "target non trovato" (con
      // l'eventuale link di spotlightMissingHint) è pensato ESATTAMENTE per
      // questo caso — "il target vive altrove" — quindi qui va TRUE, non
      // FALSE: bug di un singolo booleano invertito, mai emerso prima perché
      // gli unici step con questo comportamento validati manualmente da
      // Fabrizio (create_activity/configure_weeks) usano un pattern di
      // route "prefisso*" che nella pratica combacia quasi sempre (matcha
      // anche /new), mascherando il bug. Corregge anche la riga 18 della
      // matrice del Visual Acceptance Gate (già documentata così, mai
      // realmente verificabile finché questo ramo restava sbagliato).
      //
      // Segnalazione 24/08/2026 (Fabrizio, screenshot) — secondo bug reale
      // trovato QUI: il ramo sopra rende il badge "target non trovato"
      // visibile su QUALUNQUE pagina del portale, non solo su quelle vicine
      // al contesto dello step — es. "Configura i Giorni spot" (contesto:
      // creazione/modifica attività) restava visibile anche navigando su
      // /center/account (Impostazioni), del tutto estraneo. isPathRelevantToRoute
      // risponde alla domanda più larga "sono almeno nell'AREA di questo
      // step?" (deriva l'area dal prefisso statico di spotlightRoute, nessun
      // nuovo campo nel registry): se la pagina corrente non vi appartiene
      // affatto, non c'è nulla da mostrare qui — comportamento invariato per
      // "dashboard" (route "*", area = ovunque, DEC-73).
      if (!isPathRelevantToRoute(current.spotlightRoute ?? "", pathname)) {
        setTargetRect(null);
        setTargetMissing(false);
        return;
      }
      setTargetRect(null);
      setTargetMissing(true);
      return;
    }
    // Visual Acceptance Gate (§15, DEC-70) — bug reale trovato da Fabrizio,
    // visibile solo su mobile 390px (non su 768/1440): alcuni target (es.
    // "dashboard") esistono DUE VOLTE nel DOM, una copia nella sidebar
    // desktop (sempre presente ma `display:none` sotto md=768px) e una nel
    // cassetto mobile (esiste solo a menu aperto). `querySelector` prende
    // sempre il PRIMO elemento nel DOM a prescindere dalla visibilità — su
    // mobile era sempre la copia nascosta, il cui rect è (0,0,0,0) e produce
    // un popover ancorato in un punto senza senso. Ora leggiamo TUTTI i
    // candidati e scegliamo il primo davvero visibile (pickVisibleTargetIndex,
    // funzione pura testata in tests/one/spotlight-position.spec.ts); se
    // nessuno lo è (es. cassetto mobile chiuso), trattiamo lo step come
    // "target non trovato" invece di mostrare un popover rotto.
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-spotlight="${current.spotlightTarget}"]`));
    const rects = candidates.map((c) => c.getBoundingClientRect());
    const idx = pickVisibleTargetIndex(rects);
    if (idx === -1) {
      // Nessun candidato visibile: sia il caso "l'attributo non esiste
      // affatto su questa pagina" (es. configure_weeks su /new) sia il caso
      // "esiste ma è nascosto ovunque in questo momento" (es. dashboard con
      // il cassetto mobile chiuso) ricadono nello stesso badge di fallback —
      // stesso comportamento di prima per il primo caso (TC-N416), fix per
      // il secondo (prima produceva un popover rotto invece del badge).
      setTargetRect(null);
      setTargetMissing(true);
      return;
    }
    const el = candidates[idx];
    const r = rects[idx];
    if (scrolledStepRef.current !== current.key) {
      scrolledStepRef.current = current.key;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setCutoutRadius(window.getComputedStyle(el).borderRadius || "8px");
    // Visual Acceptance Gate (§15, DEC-72) — bug reale trovato da Fabrizio
    // ("se clicco nel campo il cursore poi sembra sparire", "la scelta del
    // pasto appare ma non riesco a selezionare per tempo"): questo `measure`
    // gira ogni 500ms via setInterval (riga sotto) PIÙ su ogni resize/scroll
    // — prima di questo fix chiamava `setTargetRect({...})` con un oggetto
    // NUOVO ogni volta, anche quando il rettangolo non era affatto cambiato.
    // React confronta gli state object per IDENTITÀ di riferimento, quindi
    // ogni tick considerava `targetRect` "cambiato" — e l'effetto di focus
    // qui sotto (che dipende da `targetRect`) rifocalizzava il popover ogni
    // 500ms, portando via il focus da qualunque campo reale l'utente stesse
    // usando (input di testo: il cursore "spariva"; <select> nativo: il
    // menu si chiudeva prima di poter scegliere un'opzione, perché perdeva
    // focus). Fix: aggiornare lo state SOLO se il rettangolo è realmente
    // cambiato (funzione di update che ritorna la stessa referenza se i 4
    // valori sono identici) — React non ri-renderizza né ri-attiva effetti
    // quando il setter ritorna lo stesso riferimento.
    setTargetRect((prev) => {
      if (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height) {
        return prev;
      }
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    });
    setTargetMissing(false);
  }, [current, pathname]);

  // Visual Acceptance Gate (§15, DEC-73) — bug reale trovato da Fabrizio
  // ("nel passaggio da step 3 a 4 la schermata cambia... è sovrapposto",
  // non riuscito a registrarlo perché durava un solo frame): quando
  // `currentKey` cambia (nextStepAfter), `targetRect`/`cutoutRadius`
  // restavano quelli dello step APPENA CONCLUSO fino al prossimo tick di
  // `measure()` (schedulato via rAF, un frame dopo). In quella finestra
  // React renderizzava già titolo/descrizione del NUOVO step ma ancorati
  // alla POSIZIONE del vecchio target — un frame di popover/cutout
  // disallineati o sovrapposti a un elemento che non c'entra, troppo breve
  // per uno screenshot ma visibile a occhio. Fix: pattern React consigliato
  // per "adjusting state when a prop changes" (aggiustare lo stato DURANTE
  // il render confrontando con il valore renderizzato in precedenza, non in
  // un effetto — evita sia il flash sia il warning react-hooks/
  // set-state-in-effect di un setState sincrono dentro un effetto). Se
  // `currentKey` è cambiato rispetto all'ultimo render, azzeriamo subito
  // `targetRect`/`targetMissing` PRIMA che il browser dipinga: il componente
  // ritorna `null` per quel render invece di mostrare la posizione sbagliata,
  // poi la prossima `measure()` (già schedulata dall'effetto sotto, che
  // dipende da `measure` e quindi da `current`) aggiorna con la posizione
  // corretta del nuovo target.
  const [lastMeasuredKey, setLastMeasuredKey] = useState(currentKey);
  if (currentKey !== lastMeasuredKey) {
    setLastMeasuredKey(currentKey);
    setTargetRect(null);
    setTargetMissing(false);
  }

  // Ricalcola a ogni cambio pagina/step e su resize/scroll: il target reale
  // può muoversi (non un overlay statico indipendente dal layout). La prima
  // misurazione è schedulata via rAF (non chiamata sincrona nel corpo
  // dell'effetto) per rispettare react-hooks/set-state-in-effect: evita
  // render a cascata sincroni al mount/aggiornamento dell'effetto.
  useEffect(() => {
    const raf = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const id = window.setInterval(measure, 500); // il DOM della pagina reale può cambiare senza resize/scroll (dati caricati async)
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.clearInterval(id);
    };
  }, [measure]);

  // Telemetria: una sola emissione per step (non a ogni measure), vedi
  // lib/telemetry/known-events.ts.
  useEffect(() => {
    if (!current?.spotlightTarget || !progress) return;
    if (targetRect && loggedShownRef.current !== current.key) {
      loggedShownRef.current = current.key;
      void logSpotlightEventAction("spotlight_shown", `${progress.tutorialKey}/${current.key}`);
    }
    if (targetMissing) {
      const marker = `${current.key}:${pathname}`;
      if (loggedMissingRef.current !== marker) {
        loggedMissingRef.current = marker;
        void logSpotlightEventAction("spotlight_target_not_found", `${progress.tutorialKey}/${current.key}`);
      }
    }
  }, [current, targetRect, targetMissing, pathname, progress]);

  // Visual Acceptance Gate (§15, DEC-72) — richiesta esplicita di Fabrizio
  // ("nello step 4 'inizia' non ha senso..ci vuole coerenza"): prima di
  // questo fix, OGNI step (non solo il primo) partiva "not_started" e
  // richiedeva un nuovo click su "Inizia" prima di poter agire — anche
  // subito DOPO che l'utente aveva appena completato o saltato lo step
  // precedente, cioè quando è già chiaramente dentro il percorso guidato in
  // modo deliberato. Ora, quando si passa allo step successivo, se questo è
  // ancora "not_started" lo avviamo automaticamente (stessa azione server
  // di handleStart, `startWalkthroughStepAction`) — il popover mostra così
  // subito "Ho finito, continua →" (step manuali) o "Fatto? Clicca..."
  // (step click-based) senza un secondo "Inizia" di troppo. Il gate
  // "Inizia" resta SOLO per il primissimo step mostrato al mount (un
  // opt-in esplicito e unico all'intero tour, comportamento invariato e
  // già coperto da TC-N414/TC-N415).
  const nextStepAfter = useCallback(
    (key: string) => {
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.key === key);
        const next = prev.slice(idx + 1).find((s) => s.status === "not_started" || s.status === "in_progress");
        setCurrentKey(next?.key ?? null);
        if (next && next.status === "not_started" && progress) {
          void startWalkthroughStepAction(progress.tutorialKey, next.key);
          return prev.map((s) => (s.key === next.key ? { ...s, status: "in_progress" } : s));
        }
        return prev;
      });
    },
    [progress]
  );

  const handleComplete = useCallback(async () => {
    if (!current || !progress) return;
    const result = await completeWalkthroughStepAction(progress.tutorialKey, current.key);
    if (!result.error) {
      setSteps((prev) => prev.map((s) => (s.key === current.key ? { ...s, status: "completed" } : s)));
      nextStepAfter(current.key);
    }
  }, [current, progress, nextStepAfter]);

  // Azione REALE: click genuino dell'utente sull'elemento evidenziato
  // (capture phase, non blocca mai il comportamento nativo dell'elemento —
  // link/pulsante continuano a funzionare esattamente come senza Spotlight).
  //
  // Visual Acceptance Gate (§15, DEC-71) — bug reale trovato da Fabrizio:
  // per gli step "manuali" (spotlightManualAdvance, es. configure_pricing —
  // il target è l'intera card "Servizi extra e pasto" con più campi), il
  // primo click su QUALUNQUE campo dentro la card (es. la checkbox
  // "Ingresso anticipato") faceva scattare subito handleComplete() e
  // avanzava allo step successivo, impedendo di finire di compilare gli
  // altri campi. Per questi step il listener non si attacca affatto: il
  // completamento passa dal pulsante esplicito "Ho finito, continua →" nel
  // popover (vedi sotto). Comportamento invariato per gli step il cui
  // target È l'azione stessa (create_activity, publish).
  useEffect(() => {
    if (!current?.spotlightTarget || current.status === "completed") return;
    if (current.spotlightManualAdvance) return;
    function onClickCapture(e: MouseEvent) {
      const el = (e.target as HTMLElement)?.closest?.(`[data-spotlight="${current!.spotlightTarget}"]`);
      if (el) void handleComplete();
    }
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [current, handleComplete]);

  async function handleStart() {
    if (!current || !progress) return;
    const result = await startWalkthroughStepAction(progress.tutorialKey, current.key);
    if (!result.error) {
      setSteps((prev) => prev.map((s) => (s.key === current.key ? { ...s, status: "in_progress" } : s)));
    }
  }

  async function handleDismiss() {
    if (!current || !progress) return;
    await logSpotlightEventAction("spotlight_dismissed", `${progress.tutorialKey}/${current.key}`);
    const result = await skipWalkthroughStepAction(progress.tutorialKey, current.key);
    if (!result.error) {
      setSteps((prev) => prev.map((s) => (s.key === current.key ? { ...s, status: "skipped" } : s)));
      nextStepAfter(current.key);
    }
  }

  // Accessibilità: focus sul popover quando compare; Escape lo scarta
  // (equivalente a "Salta per ora" per lo step corrente, non l'intero
  // percorso — coerente con la microcopy già stabilita in DEC-54).
  //
  // Visual Acceptance Gate (§15, DEC-72) — anche con la stabilizzazione di
  // `targetRect` sopra, questo effetto dipendeva da `targetRect` e poteva
  // rifocalizzare il popover ogni volta che il target si sposta per un
  // motivo LEGITTIMO (scroll della pagina, resize/tastiera virtuale su
  // mobile), portando via il focus da un campo reale che l'utente sta
  // ancora usando. Il focus iniziale del popover ha senso solo la PRIMA
  // volta che appare per uno step — non a ogni remeasure successiva: usa lo
  // stesso pattern di scrolledStepRef per farlo una sola volta per step.
  useEffect(() => {
    if (targetRect && popoverRef.current && focusedStepRef.current !== current?.key) {
      focusedStepRef.current = current?.key ?? null;
      popoverRef.current.focus();
    }
  }, [targetRect, current?.key]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && targetRect) void handleDismiss();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRect, current]);

  if (!current || !current.spotlightTarget) return null;
  if (!targetRect && !targetMissing) return null;

  if (targetMissing) {
    // Visual Acceptance Gate (§15, DEC-69) — bug reale trovato da Fabrizio:
    // quando il target di questo step vive su un'altra pagina, il badge
    // dava solo una descrizione testuale ("apri il calendario...") senza un
    // modo cliccabile per arrivarci — l'utente doveva indovinare l'URL.
    // Se lo step lo prevede (spotlightMissingHint) E il wrapper tenant lo
    // consente per la pagina corrente (canLinkFromHere), aggiungiamo un link
    // reale verso `pathname corrente + suffix`.
    const hint = current.spotlightMissingHint;
    const canShowHintLink = Boolean(hint) && (canLinkFromHere ? canLinkFromHere(pathname) : false);
    return (
      // Visual Acceptance Gate (§15, DEC-70) — bug reale trovato da
      // Fabrizio: ancorato "bottom-5 right-5" (angolo in basso a destra),
      // questo badge finiva sopra al pulsante di invio di form corte (es.
      // "Crea attività" su /center/activities/new), coprendolo del tutto su
      // mobile. Le azioni primarie delle pagine Partner sono quasi sempre in
      // fondo alla pagina (submit di un form, "Salva modifiche"...), mai in
      // alto: spostato sotto l'header (fisso su mobile, assente su
      // desktop/tablet dove la sidebar vive a sinistra) in alto a destra,
      // zona che nessuna pagina usa per azioni cliccabili.
      <div
        role="status"
        className="fixed top-20 right-4 z-40 max-w-xs rounded-lg border border-[#E8EBF0] bg-white p-3 shadow-lg sm:right-5"
      >
        <p className="text-xs font-semibold text-ink">{current.title}</p>
        <p className="mt-0.5 text-[11px] text-ink-2">{current.description}</p>
        {canShowHintLink && hint && (
          <Link href={`${pathname}${hint.suffix}`} className="mt-2 block text-[11px] font-bold text-trama-violet">
            {hint.label}
          </Link>
        )}
        {current.spotlightMissingNote && (
          <p className="mt-2 text-[11px] font-medium text-ink-3">{current.spotlightMissingNote}</p>
        )}
      </div>
    );
  }

  const rect = targetRect as Rect;
  const cutout = computeCutoutRect(rect);
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const popover = computePopoverPosition(rect, viewport);
  const stepIndex = steps.findIndex((s) => s.key === current.key);

  return (
    <div aria-live="polite">
      {/* Overlay a 4 pannelli attorno al cutout: click-through SUL target
          (nessun pannello lo copre) — l'elemento reale resta cliccabile
          normalmente, l'overlay serve solo a dirigere l'attenzione. */}
      <div className="pointer-events-none fixed inset-0 z-30" aria-hidden="true">
        <div className="absolute bg-black/50" style={{ top: 0, left: 0, right: 0, height: Math.max(0, cutout.top) }} />
        <div
          className="absolute bg-black/50"
          style={{ top: cutout.top, left: 0, width: Math.max(0, cutout.left), height: cutout.height }}
        />
        <div
          className="absolute bg-black/50"
          style={{ top: cutout.top, left: cutout.left + cutout.width, right: 0, height: cutout.height }}
        />
        <div className="absolute bg-black/50" style={{ top: cutout.top + cutout.height, left: 0, right: 0, bottom: 0 }} />
        {/* Visual Acceptance Gate (§15, DEC-70) — richiesta di Fabrizio: il
            ring aveva un raggio fisso (rounded-lg, 8px) indipendente dalla
            forma reale del target, "spigoli non belli" su elementi con un
            border-radius diverso (es. pulsanti pillola, rounded-full). Ora
            usa il border-radius REALE letto da getComputedStyle nel measure()
            qui sopra (cutoutRadius), applicato via style invece della classe
            Tailwind fissa. */}
        <div
          data-testid="spotlight-cutout-ring"
          className="absolute ring-2 ring-trama-violet"
          style={{
            top: cutout.top,
            left: cutout.left,
            width: cutout.width,
            height: cutout.height,
            // DEC-73 — vedi padBorderRadius in lib/spotlight/position.ts:
            // il ring non usa più il raggio "grezzo" del target, ma quello
            // corretto per il fatto che il cutout è il target ingrandito di
            // 8px per lato (era questo lo scarto che rendeva il riquadro
            // "ancora squadrato" nonostante DEC-70).
            borderRadius: padBorderRadius(cutoutRadius),
          }}
        />
      </div>

      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-label={current.title}
        tabIndex={-1}
        className="fixed z-40 w-80 rounded-lg border border-[#E8EBF0] bg-white p-4 shadow-xl outline-none"
        style={{ top: popover.top, left: popover.left }}
      >
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
          Passo {stepIndex + 1} di {steps.length}
        </div>
        <h3 className="text-sm font-bold text-ink">{current.title}</h3>
        <p className="mt-1 text-[13px] text-ink-2">{current.description}</p>
        {current.status === "not_started" ? (
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleStart}
              className="rounded-md bg-trama-violet px-3.5 py-2 text-[13px] font-bold text-white"
            >
              Inizia
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-md border border-[#E8EBF0] px-3.5 py-2 text-[13px] font-semibold text-ink"
            >
              Salta per ora
            </button>
          </div>
        ) : current.spotlightManualAdvance ? (
          // Visual Acceptance Gate (§15, DEC-71) — step "manuale": la card ha
          // più campi da compilare, il completamento è un pulsante esplicito
          // invece del primo click dentro il target (vedi motivazione sopra
          // sull'effetto di click-capture).
          <div className="mt-3">
            <p className="text-[12px] font-medium text-ink-2">
              Compila con calma i campi di questa sezione, poi continua.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleComplete}
                className="rounded-md bg-trama-violet px-3.5 py-2 text-[13px] font-bold text-white"
              >
                Ho finito, continua →
              </button>
              <button
                onClick={handleDismiss}
                className="rounded-md border border-[#E8EBF0] px-3.5 py-2 text-[13px] font-semibold text-ink"
              >
                Salta per ora
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-[12px] font-medium text-trama-violet">
              Fatto? Clicca l&apos;elemento evidenziato per continuare.
            </p>
            <button
              onClick={handleDismiss}
              className="mt-2 rounded-md border border-[#E8EBF0] px-3.5 py-2 text-[13px] font-semibold text-ink"
            >
              Salta per ora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
