"use client";

// CONTROLLED BETA EXPERIENCE GATE (§7-14) — Product Walkthrough Spotlight
// REALE per il Partner, a differenza del precedente WalkthroughCard (card
// testuale con pulsanti "Inizia"/"Continua" scollegati dall'interfaccia
// vera): questo componente disegna un overlay scuro con un ritaglio (cutout)
// attorno all'elemento REALE della pagina corrente (`data-spotlight="..."`,
// vedi lib/walkthrough/registry.ts), un popover ancorato a quell'elemento
// (lib/spotlight/position.ts, nessuna libreria esterna) e avanza allo step
// successivo quando l'utente clicca DAVVERO l'elemento evidenziato — non
// quando preme un pulsante "Continua" dentro il popover stesso.
//
// Montato una sola volta in app/center/layout.tsx (persiste su ogni pagina
// Partner, sopravvive alla navigazione — a differenza del vecchio
// WalkthroughCard, che viveva solo dentro la route orfana /center/one).
//
// Limite noto e documentato (non un bug): per gli step "configure_weeks",
// "configure_pricing", "configure_spot_days" e "publish" il completamento
// è legato al CLICK sull'elemento reale (es. il pulsante "Salva"), non alla
// conferma che il salvataggio sia andato a buon fine lato server — un click
// su un pulsante che poi fallisce per validazione marca comunque lo step
// completato. Accettato come compromesso v1: il target è comunque reale
// (non un pulsante decorativo dentro il tour), e l'utente può sempre
// "Ricomincia il percorso" se necessario (stessa azione già esistente).

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { WalkthroughProgressSummary } from "@/lib/walkthrough/data";
import { computeCutoutRect, computePopoverPosition, matchesSpotlightRoute, Rect } from "@/lib/spotlight/position";
import { startWalkthroughStepAction, completeWalkthroughStepAction, skipWalkthroughStepAction } from "@/app/actions/walkthrough";
import { logSpotlightEventAction } from "@/app/actions/spotlight";

export default function PartnerSpotlight({ progress }: { progress: WalkthroughProgressSummary | null }) {
  const pathname = usePathname();
  const [steps, setSteps] = useState(progress?.steps ?? []);
  const [currentKey, setCurrentKey] = useState(progress?.currentStepKey ?? null);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
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

  const current = steps.find((s) => s.key === currentKey) ?? null;

  const measure = useCallback(() => {
    if (!current?.spotlightTarget) {
      setTargetRect(null);
      setTargetMissing(false);
      return;
    }
    const routeOk = !current.spotlightRoute || matchesSpotlightRoute(current.spotlightRoute, pathname);
    if (!routeOk) {
      setTargetRect(null);
      setTargetMissing(false);
      return;
    }
    const el = document.querySelector(`[data-spotlight="${current.spotlightTarget}"]`);
    if (!el) {
      setTargetRect(null);
      setTargetMissing(true);
      return;
    }
    if (scrolledStepRef.current !== current.key) {
      scrolledStepRef.current = current.key;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const r = el.getBoundingClientRect();
    setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    setTargetMissing(false);
  }, [current, pathname]);

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

  function nextStepAfter(key: string) {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      const next = prev.slice(idx + 1).find((s) => s.status === "not_started" || s.status === "in_progress");
      setCurrentKey(next?.key ?? null);
      return prev;
    });
  }

  const handleComplete = useCallback(async () => {
    if (!current || !progress) return;
    const result = await completeWalkthroughStepAction(progress.tutorialKey, current.key);
    if (!result.error) {
      setSteps((prev) => prev.map((s) => (s.key === current.key ? { ...s, status: "completed" } : s)));
      nextStepAfter(current.key);
    }
  }, [current, progress]);

  // Azione REALE: click genuino dell'utente sull'elemento evidenziato
  // (capture phase, non blocca mai il comportamento nativo dell'elemento —
  // link/pulsante continuano a funzionare esattamente come senza Spotlight).
  useEffect(() => {
    if (!current?.spotlightTarget || current.status === "completed") return;
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
  useEffect(() => {
    if (targetRect && popoverRef.current) popoverRef.current.focus();
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
    return (
      <div
        role="status"
        className="fixed bottom-5 right-5 z-40 max-w-xs rounded-lg border border-[#E8EBF0] bg-white p-3 shadow-lg"
      >
        <p className="text-xs font-semibold text-ink">{current.title}</p>
        <p className="mt-0.5 text-[11px] text-ink-2">{current.description}</p>
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
        <div
          className="absolute rounded-lg ring-2 ring-trama-violet"
          style={{ top: cutout.top, left: cutout.left, width: cutout.width, height: cutout.height }}
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
