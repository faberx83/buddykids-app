"use client";

// TRAMA — Parent Private Beta Onboarding Carousel (implementazione finale).
// Fonte visiva: trama-onboarding-private-beta-final.pptx (composizione,
// hierarchy, copy, palette, typography, CTA, progress già approvati — vedi
// TRAMA_PARENT_ONBOARDING_IMPLEMENTATION.md per la nota di trasparenza su
// come questo file non fosse presente in questo ambiente di sviluppo).
//
// Montato in app/nextgen/layout.tsx, UNA sola volta, gated a Parent + cohort
// TRAMA_ONE_ENABLED (stesso meccanismo già usato per ParentSpotlight/
// discover_book_parent — "Private Beta" è letteralmente quel cohort).
//
// Persistenza: riusa 100% l'infrastruttura Walkthrough esistente (nessuna
// nuova migration) — un solo step sentinella "carousel" del tutorial
// "parent_beta_onboarding" (lib/walkthrough/registry.ts), scritto su
// public.tutorial_progress tramite le stesse Server Action generiche di
// app/actions/walkthrough.ts (completeWalkthroughStepAction/
// skipWalkthroughStepAction/startWalkthroughStepAction) già usate da
// PartnerSpotlight/ParentSpotlight. L'avanzamento INTERNO delle 5 slide
// (quale schermata sto guardando ora) vive solo in useState qui: non ha
// senso persisterlo passo-passo, conta solo il risultato finale.
//
// Accessibilità (WCAG AA + tastiera, requisito esplicito del task):
// role="dialog" + aria-modal, focus trap manuale (Tab/Shift+Tab ciclano
// solo dentro), focus iniziale sul dialog stesso, ESC = equivalente di
// "Salta" (stessa convenzione già stabilita in SpotlightEngine.tsx), frecce
// sinistra/destra per Indietro/Continua, elementi decorativi aria-hidden,
// stato "Passo N di 5" annunciato via aria-live, prefers-reduced-motion
// rispettata con le varianti Tailwind motion-safe:/motion-reduce:. Nessuno
// stato è affidato SOLO al colore (icone + testo affiancano sempre i colori
// di stato in ogni slide).
//
// Swipe mobile: deliberatamente NON implementato (istruzione esplicita del
// task: "non introdurre gesture fragili solo per rispettare il design") —
// la navigazione touch avviene tramite i pulsanti Continua/Indietro, già a
// piena larghezza e con touch target ampio.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ONBOARDING_SLIDES,
  ONBOARDING_DEMO_KIDS,
  ONBOARDING_DEMO_ACTIVITIES_CHAOS,
  ONBOARDING_DEMO_CENTER,
  ONBOARDING_DEMO_ACTIVITY_SEARCH,
  ONBOARDING_DEMO_WEEK_LABEL,
  ONBOARDING_REQUEST_FLOW,
  ONBOARDING_REQUEST_OUTCOMES,
} from "@/lib/nextgen/onboarding-slides";
import type { WalkthroughProgressSummary } from "@/lib/walkthrough/data";
import {
  startWalkthroughStepAction,
  completeWalkthroughStepAction,
  skipWalkthroughStepAction,
} from "@/app/actions/walkthrough";

const TUTORIAL_KEY = "parent_beta_onboarding";
const STEP_KEY = "carousel";

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  );
}

// Slide 2 — mini Planner illustrativo per bambino: copertura fittizia ma
// realistica (Coperta/Parziale/Da organizzare), MAI solo colore: ogni stato
// ha anche un'icona + etichetta.
const PLANNER_DEMO: Record<(typeof ONBOARDING_DEMO_KIDS)[number], ("covered" | "partial" | "open")[]> = {
  Sofia: ["covered", "covered", "partial", "open", "open", "open"],
  Luca: ["covered", "open", "open", "covered", "open", "open"],
};
const WEEK_STATE_META: Record<"covered" | "partial" | "open", { icon: string; label: string; className: string }> = {
  covered: { icon: "ti-circle-check-filled", label: "Coperta", className: "bg-trama-green/15 text-trama-green" },
  partial: { icon: "ti-circle-half-2", label: "Parziale", className: "bg-trama-orange/15 text-trama-orange" },
  open: { icon: "ti-circle-dashed", label: "Da organizzare", className: "bg-[#F0F2F5] text-ink-3" },
};

export default function OnboardingCarousel({ progress }: { progress: WalkthroughProgressSummary | null }) {
  const router = useRouter();
  const visible = progress?.currentStepKey === STEP_KEY;
  const [dismissed, setDismissed] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const focusedOnceRef = useRef(false);

  const show = visible && !dismissed;
  const slide = ONBOARDING_SLIDES[slideIndex];
  const isLast = slideIndex === ONBOARDING_SLIDES.length - 1;

  // "Inizia" implicito: il percorso parte "in_progress" appena il carousel
  // compare, stesso pattern di stato già usato dal motore Spotlight (nessun
  // secondo "Inizia" richiesto qui: la prima CTA è già "Continua").
  useEffect(() => {
    if (show && !startedRef.current) {
      startedRef.current = true;
      void startWalkthroughStepAction(TUTORIAL_KEY, STEP_KEY);
    }
  }, [show]);

  // Focus iniziale sul dialog quando compare o quando cambia slide (annuncia
  // il nuovo contenuto agli screen reader tramite il titolo, letto subito
  // dopo per via di aria-labelledby).
  useEffect(() => {
    if (show && dialogRef.current && !focusedOnceRef.current) {
      focusedOnceRef.current = true;
      dialogRef.current.focus();
    }
  }, [show]);
  useEffect(() => {
    if (show && dialogRef.current) dialogRef.current.focus();
  }, [slideIndex, show]);

  const finish = useCallback(
    async (outcome: "completed" | "skipped") => {
      setDismissed(true); // optimistic: chiude subito, nessuna attesa di rete
      const action = outcome === "completed" ? completeWalkthroughStepAction : skipWalkthroughStepAction;
      await action(TUTORIAL_KEY, STEP_KEY);
      router.refresh();
    },
    [router]
  );

  const handleSkip = useCallback(() => void finish("skipped"), [finish]);
  const handleContinue = useCallback(() => {
    if (isLast) {
      void finish("completed");
      return;
    }
    setSlideIndex((i) => Math.min(i + 1, ONBOARDING_SLIDES.length - 1));
  }, [isLast, finish]);
  const handleBack = useCallback(() => {
    setSlideIndex((i) => Math.max(i - 1, 0));
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      handleSkip();
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      handleContinue();
      return;
    }
    if (e.key === "ArrowLeft" && slideIndex > 0) {
      e.preventDefault();
      handleBack();
      return;
    }
    if (e.key === "Tab" && dialogRef.current) {
      const focusable = getFocusable(dialogRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      // Click sull'overlay = "Salta" (nessuna conferma richiesta, requisito
      // esplicito): stesso comportamento del pulsante "Salta" espliciito.
      onClick={handleSkip}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-carousel-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="motion-safe:animate-fade-in flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-[28px] bg-trama-page p-6 shadow-xl outline-none sm:max-w-[640px] sm:rounded-[28px] sm:p-8"
      >
        {/* Header: progress + Salta (sempre visibile, ogni slide) */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div aria-live="polite" className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{slide.progress}</span>
            <div className="flex gap-1" aria-hidden="true">
              {ONBOARDING_SLIDES.map((s, i) => (
                <span
                  key={s.key}
                  className={`h-1.5 w-1.5 rounded-full motion-safe:transition-colors ${
                    i === slideIndex ? "bg-trama-violet" : i < slideIndex ? "bg-trama-violet/50" : "bg-[#E8EBF0]"
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="min-h-[36px] rounded-full px-3 text-[13px] font-semibold text-ink-2 active:scale-95"
          >
            Salta
          </button>
        </div>

        {/* Visual illustrativo, per slide */}
        <div className="mb-5 flex-shrink-0" aria-hidden="true">
          {slide.visual === "chaos" && <ChaosVisual />}
          {slide.visual === "planner" && <PlannerVisual />}
          {slide.visual === "search" && <SearchVisual />}
          {slide.visual === "request" && <RequestVisual />}
          {slide.visual === "final" && <FinalVisual />}
        </div>

        {/* Copy */}
        <h2
          id="onboarding-carousel-title"
          className="mb-2 font-poppins text-2xl font-bold leading-tight text-ink sm:text-[28px]"
        >
          {slide.title}
        </h2>
        <p className="text-[15px] leading-relaxed text-ink-2">{slide.body}</p>
        {slide.microCopy && <p className="mt-2 text-[13px] font-medium text-trama-violet">{slide.microCopy}</p>}

        {/* Navigazione */}
        <div className="mt-6 flex items-center gap-3">
          {slideIndex > 0 && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Indietro"
              className="flex min-h-[48px] flex-shrink-0 items-center justify-center rounded-full border border-[#E8EBF0] px-4 text-[15px] font-semibold text-ink active:scale-[0.97]"
            >
              <i className="ti ti-chevron-left text-[18px]" />
            </button>
          )}
          <button
            type="button"
            onClick={handleContinue}
            className="min-h-[48px] flex-1 rounded-full bg-trama-violet text-[15px] font-bold text-white active:scale-[0.97]"
          >
            {slide.ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————————————
// Visual per slide — SVG/HTML nativi, nessun raster. Dati fittizi da
// lib/nextgen/onboarding-slides.ts, mai dati reali dell'utente.
// ————————————————————————————————————————————————————————————————————————

function KidChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-trama-violet/10 px-2.5 py-1 text-[12px] font-semibold text-trama-violet">
      <i className="ti ti-user-circle text-[14px]" />
      {name}
    </span>
  );
}

function ChaosVisual() {
  return (
    <div className="rounded-2xl bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        {/* Impegni sparsi — chip ruotate a piccolo angolo casuale ma FISSO
            (mai Math.random: deve renderizzare identico ad ogni load/test,
            niente hydration mismatch). */}
        <div className="relative h-24 flex-1">
          {ONBOARDING_DEMO_ACTIVITIES_CHAOS.map((a, i) => {
            const rotations = [-6, 4, -3, 7];
            const tops = [0, 14, 34, 4];
            const lefts = [0, 55, 20, 70];
            return (
              <span
                key={a}
                style={{
                  transform: `rotate(${rotations[i % rotations.length]}deg)`,
                  top: tops[i % tops.length],
                  left: `${lefts[i % lefts.length]}%`,
                }}
                className="absolute whitespace-nowrap rounded-lg border border-[#E8EBF0] bg-trama-card px-2 py-1 text-[11px] font-semibold text-ink-2 shadow-sm"
              >
                {a}
              </span>
            );
          })}
        </div>
        <i className="ti ti-arrow-narrow-right flex-shrink-0 text-2xl text-ink-3" />
        {/* Settimane organizzate */}
        <div className="flex flex-1 flex-col gap-1.5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="flex items-center gap-2 rounded-lg bg-trama-green/10 px-2.5 py-1.5 text-[11px] font-semibold text-trama-green"
            >
              <i className="ti ti-circle-check-filled text-[13px]" />
              Settimana {n}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        {ONBOARDING_DEMO_KIDS.map((k) => (
          <KidChip key={k} name={k} />
        ))}
      </div>
    </div>
  );
}

function PlannerVisual() {
  return (
    <div className="rounded-2xl bg-white p-4">
      {ONBOARDING_DEMO_KIDS.map((kid) => (
        <div key={kid} className="mb-3 last:mb-0">
          <div className="mb-1.5">
            <KidChip name={kid} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PLANNER_DEMO[kid].map((state, i) => {
              const meta = WEEK_STATE_META[state];
              return (
                <span
                  key={i}
                  // Sprint responsive (S2, richiesto): riduci il numero di
                  // settimane visibili insieme su mobile — le ultime 2
                  // chip per bambino restano nascoste sotto 640px.
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-semibold ${meta.className} ${
                    i >= 4 ? "hidden sm:inline-flex" : ""
                  }`}
                >
                  <i className={`ti ${meta.icon} text-[12px]`} />
                  {meta.label}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchVisual() {
  return (
    <div className="rounded-2xl bg-white p-4">
      <div className="mb-2.5 flex items-center gap-2 rounded-full bg-trama-orange/10 px-3 py-1.5 text-[12px] font-semibold text-trama-orange">
        <i className="ti ti-calendar-exclamation text-[14px]" />
        {ONBOARDING_DEMO_WEEK_LABEL}
      </div>
      <div className="mb-2.5 flex items-center gap-2 rounded-xl border border-[#E8EBF0] px-3 py-2 text-[13px] text-ink-2">
        <i className="ti ti-search text-[15px]" />
        {ONBOARDING_DEMO_CENTER}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-trama-card p-3">
        <div>
          <div className="text-[13px] font-bold text-ink">{ONBOARDING_DEMO_ACTIVITY_SEARCH}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-trama-green">
            <i className="ti ti-circle-check-filled text-[12px]" />
            Disponibile
          </div>
        </div>
        <i className="ti ti-chevron-right text-ink-3" />
      </div>
    </div>
  );
}

function RequestVisual() {
  return (
    <div className="rounded-2xl bg-white p-4">
      {/* Flow: colonna su mobile (richiesto: "impila le risposte e
          semplifica il flow"), riga su sm+. */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5">
        {ONBOARDING_REQUEST_FLOW.map((step, i) => (
          <div key={step} className="flex items-center gap-1.5">
            <span
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                step === "In attesa" ? "bg-trama-orange/15 text-trama-orange" : "bg-trama-card text-ink-2"
              }`}
            >
              {step}
            </span>
            {i < ONBOARDING_REQUEST_FLOW.length - 1 && (
              <i className="ti ti-arrow-narrow-right hidden text-[14px] text-ink-3 sm:inline" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        {ONBOARDING_REQUEST_OUTCOMES.map((outcome) => (
          <span
            key={outcome}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              outcome === "Confermata" ? "bg-trama-green/15 text-trama-green" : "bg-trama-lilac/25 text-trama-violet"
            }`}
          >
            <i className={`ti ${outcome === "Confermata" ? "ti-circle-check-filled" : "ti-replace"} text-[13px]`} />
            {outcome}
          </span>
        ))}
      </div>
    </div>
  );
}

function FinalVisual() {
  return (
    <div className="flex items-center justify-center rounded-2xl bg-trama-violet/10 p-6">
      <i className="ti ti-compass text-4xl text-trama-violet" />
    </div>
  );
}
