"use client";

// TRAMA — Partner Onboarding Carousel (FINAL PRE-FREEZE WAVE, sez. 19-24,
// 08/09/2026). Non esisteva alcun equivalente Partner prima di questa wave
// (audit: solo il tour guidato activity_creation_partner, "dove cliccare",
// mai un "perché TRAMA mi serve" — distinzione esplicita sez. 18 dello
// spec). Stessa a11y/persistenza/interazione di components/nextgen/
// OnboardingCarousel.tsx (il carousel Parent): duplicato deliberatamente
// invece di forzato in un componente unico condiviso — due portali, due
// layout di montaggio (app/center/layout.tsx vs app/nextgen/layout.tsx),
// stesso principio già in uso per PartnerSpotlight.tsx/ParentSpotlight.tsx
// (thin wrapper per portale). Un'estrazione di motore condiviso resta un
// miglioramento futuro possibile (vedi Open Decisions), non fatto qui per
// non rischiare una regressione sul carousel Parent già in produzione
// toccando codice condiviso sotto pressione di tempo.
//
// Persistenza: riusa 100% l'infrastruttura Walkthrough esistente — un solo
// step sentinella "carousel" del tutorial "partner_beta_onboarding"
// (lib/walkthrough/registry.ts), stesse Server Action generiche di
// app/actions/walkthrough.ts già usate dal carousel Parent e da entrambi i
// tour guidati.
//
// Gating: montato in app/center/layout.tsx, SOLO per chi risolve
// TRAMA_ONE_ENABLED=true (stesso cohort già usato per PartnerSpotlight in
// quello stesso layout) — non ancora un rollout globale, coerente con lo
// stato attuale di TUTTO l'onboarding Controlled Beta di questo prodotto
// (vedi Current State Addendum per questo gap noto, non introdotto da
// questa wave).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PARTNER_ONBOARDING_SLIDES,
  PARTNER_ONBOARDING_OFFER_ITEMS,
  PARTNER_ONBOARDING_REQUEST_OUTCOMES,
  PARTNER_ONBOARDING_LIFECYCLE_STAGES,
} from "@/lib/center/onboarding-slides";
import type { WalkthroughProgressSummary } from "@/lib/walkthrough/data";
import {
  startWalkthroughStepAction,
  completeWalkthroughStepAction,
  skipWalkthroughStepAction,
} from "@/app/actions/walkthrough";

const TUTORIAL_KEY = "partner_beta_onboarding";
const STEP_KEY = "carousel";

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  );
}

export default function PartnerOnboardingCarousel({ progress }: { progress: WalkthroughProgressSummary | null }) {
  const router = useRouter();
  const visible = progress?.currentStepKey === STEP_KEY;
  const [dismissed, setDismissed] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const focusedOnceRef = useRef(false);

  const show = visible && !dismissed;
  const slide = PARTNER_ONBOARDING_SLIDES[slideIndex];
  const isLast = slideIndex === PARTNER_ONBOARDING_SLIDES.length - 1;

  useEffect(() => {
    if (show && !startedRef.current) {
      startedRef.current = true;
      void startWalkthroughStepAction(TUTORIAL_KEY, STEP_KEY);
    }
  }, [show]);

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
      setDismissed(true);
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
    setSlideIndex((i) => Math.min(i + 1, PARTNER_ONBOARDING_SLIDES.length - 1));
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
      onClick={handleSkip}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-onboarding-carousel-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="motion-safe:animate-fade-in flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-[28px] bg-trama-page p-6 shadow-xl outline-none sm:max-w-[640px] sm:rounded-[28px] sm:p-8"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div aria-live="polite" className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{slide.progress}</span>
            <div className="flex gap-1" aria-hidden="true">
              {PARTNER_ONBOARDING_SLIDES.map((s, i) => (
                <span
                  key={s.key}
                  className={`h-1.5 w-1.5 rounded-full motion-safe:transition-colors ${
                    i === slideIndex ? "bg-partner" : i < slideIndex ? "bg-partner/50" : "bg-[#E8EBF0]"
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

        <div className="mb-5 flex-shrink-0" aria-hidden="true">
          {slide.visual === "bridge" && <BridgeVisual />}
          {slide.visual === "offer" && <OfferVisual />}
          {slide.visual === "request" && <RequestVisual />}
          {slide.visual === "lifecycle" && <LifecycleVisual />}
        </div>

        <h2
          id="partner-onboarding-carousel-title"
          className="mb-2 font-poppins text-2xl font-bold leading-tight text-ink sm:text-[28px]"
        >
          {slide.title}
        </h2>
        <p className="text-[15px] leading-relaxed text-ink-2">{slide.body}</p>
        {slide.microCopy && <p className="mt-2 text-[13px] font-medium text-partner">{slide.microCopy}</p>}

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
            className="min-h-[48px] flex-1 rounded-full bg-partner text-[15px] font-bold text-white active:scale-[0.97]"
          >
            {slide.ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————————————
// Visual per slide — stesso linguaggio (pillole, icone Tabler, mai solo
// colore) del carousel Parent, colorazione "partner" invece di "violet".
// ————————————————————————————————————————————————————————————————————————

function BridgeVisual() {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl bg-white p-5">
      <span className="rounded-xl bg-partner-light px-3 py-2 text-[12.5px] font-bold text-partner">Centro</span>
      <i className="ti ti-arrows-left-right text-xl text-ink-3" />
      <span className="rounded-xl bg-trama-card px-3 py-2 text-[12.5px] font-bold text-ink">TRAMA</span>
      <i className="ti ti-arrows-left-right text-xl text-ink-3" />
      <span className="rounded-xl bg-partner-light px-3 py-2 text-[12.5px] font-bold text-partner">Famiglia</span>
    </div>
  );
}

function OfferVisual() {
  return (
    <div className="rounded-2xl bg-white p-4">
      <div className="flex flex-wrap gap-1.5">
        {PARTNER_ONBOARDING_OFFER_ITEMS.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 rounded-full bg-trama-card px-2.5 py-1.5 text-[12px] font-semibold text-ink-2"
          >
            <i className="ti ti-adjustments text-[13px] text-partner" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function RequestVisual() {
  return (
    <div className="rounded-2xl bg-white p-4">
      <div className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
        <span className="rounded-full bg-trama-card px-2.5 py-1">Richiesta</span>
        <i className="ti ti-arrow-narrow-right text-[14px] text-ink-3" />
        <span className="rounded-full bg-trama-card px-2.5 py-1">Decisione</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PARTNER_ONBOARDING_REQUEST_OUTCOMES.map((outcome) => (
          <span
            key={outcome.label}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${outcome.className}`}
          >
            <i className={`ti ${outcome.icon} text-[13px]`} />
            {outcome.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function LifecycleVisual() {
  return (
    <div className="rounded-2xl bg-white p-4">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
        {PARTNER_ONBOARDING_LIFECYCLE_STAGES.map((stage, i) => (
          <div key={stage} className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center">
            <span className="whitespace-nowrap rounded-full bg-trama-card px-2.5 py-1 text-[11px] font-semibold text-ink-2">
              {stage}
            </span>
            {i < PARTNER_ONBOARDING_LIFECYCLE_STAGES.length - 1 && (
              <>
                <i className="ti ti-arrow-narrow-down block pl-3 text-[14px] text-ink-3 sm:hidden" aria-hidden="true" />
                <i className="ti ti-arrow-narrow-right hidden text-[14px] text-ink-3 sm:inline" aria-hidden="true" />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
