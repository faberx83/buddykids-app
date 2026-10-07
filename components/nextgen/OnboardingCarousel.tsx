"use client";

// TRAMA — Onboarding famiglie (FAMILY-FIRST BETA PASS, 07/10/2026).
// Versione approvata da Fabrizio sull'anteprima animata: fondo bianco,
// telefono 3D leggero che fluttua, card che escono dal telefono, transizioni
// con leggero blur. Quattro schermate (lib/nextgen/onboarding-slides.ts):
// Scopri → Organizza → Coordina → Insieme.
//
// Animazioni: solo CSS (keyframes trama-onb-* in app/globals.css), nessuna
// libreria nuova. prefers-reduced-motion: niente movimento, solo il cambio
// di contenuto.
//
// Motore invariato rispetto alla versione precedente:
//  - montato UNA volta in app/nextgen/layout.tsx (Parent o Admin piattaforma
//    con TRAMA_ONE_ENABLED);
//  - persistenza su tutorial_progress tramite le Server Action walkthrough
//    esistenti (start/complete/skip), un solo step sentinella "carousel";
//  - accessibilità: role="dialog" + aria-modal, focus trap, ESC = Salta,
//    frecce sinistra/destra, "N/4" annunciato via aria-live, elementi
//    decorativi aria-hidden. Nessuno swipe (scelta già fatta: niente gesture
//    fragili, i pulsanti sono a piena larghezza).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ONBOARDING_SLIDES,
  ONBOARDING_DEMO_DISCOVER,
  ONBOARDING_DEMO_WEEK,
  ONBOARDING_DEMO_RESPONSIBILITY,
  ONBOARDING_DEMO_GROUPS,
  PARENT_ONBOARDING_TUTORIAL_KEY,
  PARENT_ONBOARDING_STEP_KEY,
  type OnboardingPop,
  type OnboardingSlideVisual,
} from "@/lib/nextgen/onboarding-slides";
import type { WalkthroughProgressSummary } from "@/lib/walkthrough/data";
import {
  startWalkthroughStepAction,
  completeWalkthroughStepAction,
  skipWalkthroughStepAction,
} from "@/app/actions/walkthrough";

const TUTORIAL_KEY = PARENT_ONBOARDING_TUTORIAL_KEY;
const STEP_KEY = PARENT_ONBOARDING_STEP_KEY;

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  );
}

export default function OnboardingCarousel({ progress }: { progress: WalkthroughProgressSummary | null }) {
  const router = useRouter();
  const visible = progress?.currentStepKey === STEP_KEY;
  const [dismissed, setDismissed] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const focusedOnceRef = useRef(false);

  const show = visible && !dismissed;
  const slide = ONBOARDING_SLIDES[slideIndex];
  const isLast = slideIndex === ONBOARDING_SLIDES.length - 1;

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
      setDismissed(true); // chiude subito, nessuna attesa di rete
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
    setDirection(1);
    setSlideIndex((i) => Math.min(i + 1, ONBOARDING_SLIDES.length - 1));
  }, [isLast, finish]);
  const handleBack = useCallback(() => {
    setDirection(-1);
    setSlideIndex((i) => Math.max(i - 1, 0));
  }, []);
  const goTo = useCallback(
    (i: number) => {
      if (i === slideIndex) return;
      setDirection(i > slideIndex ? 1 : -1);
      setSlideIndex(i);
    },
    [slideIndex]
  );

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
      className="fixed inset-0 z-[90] flex items-stretch justify-center bg-white sm:items-center sm:bg-black/40 sm:p-4"
      // Click fuori dal riquadro (solo desktop, su mobile è a tutto schermo) = "Salta".
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
        className="relative isolate flex h-[100dvh] w-full flex-col overflow-hidden bg-white outline-none sm:h-[min(860px,92dvh)] sm:max-w-[430px] sm:rounded-[28px] sm:shadow-xl"
      >
        {/* Aloni appena accennati dietro il telefono */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[20%] top-[6%] -z-10 h-[300px] w-[300px] rounded-full bg-trama-violet opacity-10 blur-[70px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-[25%] top-[26%] -z-10 h-[240px] w-[240px] rounded-full bg-trama-green opacity-[0.08] blur-[70px]"
        />

        {/* Barra alta: marchio + BETA, Salta */}
        <div className="flex items-center justify-between px-5 pt-[calc(14px+env(safe-area-inset-top,0px))]">
          <div className="flex items-center gap-2 font-poppins text-[13px] font-bold tracking-[0.14em] text-trama-navy">
            <span aria-hidden="true" className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-trama-violet">
              <i className="ti ti-menu-2 text-[13px] text-white" />
            </span>
            TRAMA
            <span className="rounded-full bg-trama-violet/10 px-[7px] py-[2px] font-sans text-[10px] font-bold tracking-[0.08em] text-trama-violet">
              BETA
            </span>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="min-h-[44px] rounded-lg px-1.5 text-[13px] font-semibold text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-trama-violet active:scale-95"
          >
            Salta
          </button>
        </div>

        {/* Palco: telefono + card che escono */}
        <div className="relative grid min-h-0 flex-1 place-items-center" aria-hidden="true">
          <div className="relative z-[1] [perspective:1100px] motion-safe:animate-[trama-onb-float_2.8s_ease-in-out_infinite]">
            <div
              className="relative aspect-[9/18.5] max-h-[44dvh] w-[clamp(160px,46vw,200px)] rounded-[34px] bg-[#1B1F2B] p-1.5 shadow-[0_0_0_1px_#2B3142,0_28px_50px_rgba(23,42,77,0.18),0_8px_18px_rgba(23,42,77,0.10)] motion-safe:transition-transform motion-safe:duration-[900ms] motion-safe:ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:!transform-none"
              style={{ transform: `rotateY(${slide.tilt.y}deg) rotateX(${slide.tilt.x}deg)` }}
            >
              <div className="absolute left-1/2 top-[11px] z-[3] h-4 w-[60px] -translate-x-1/2 rounded-xl bg-[#1B1F2B]" />
              <div className="relative h-full overflow-hidden rounded-[29px] bg-white">
                <div
                  key={slide.key}
                  className="absolute inset-0 flex flex-col gap-1.5 px-2.5 pb-2.5 pt-8 motion-safe:animate-[trama-onb-screen_0.5s_cubic-bezier(0.22,1,0.36,1)_both]"
                >
                  <div className="absolute left-4 right-4 top-[11px] flex justify-between text-[7.5px] text-ink-3">
                    <span>9:41</span>
                    <span>●●● ▮</span>
                  </div>
                  <PhoneScreen visual={slide.visual} />
                </div>
              </div>
            </div>
          </div>
          {slide.pops.map((pop, i) => (
            <PopCard key={`${slide.key}-${i}`} pop={pop} delayMs={350 + i * 140} />
          ))}
        </div>

        {/* Testo */}
        <div
          key={`copy-${slide.key}`}
          className={`px-6 ${direction === 1 ? "motion-safe:animate-[trama-onb-text-next_0.55s_cubic-bezier(0.22,1,0.36,1)_both]" : "motion-safe:animate-[trama-onb-text-prev_0.55s_cubic-bezier(0.22,1,0.36,1)_both]"}`}
        >
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-trama-violet">
            <span aria-hidden="true" className="h-[1.5px] w-[22px] bg-trama-violet" />
            {slide.eyebrow}
          </div>
          <h2
            id="onboarding-carousel-title"
            className="my-2.5 text-balance font-poppins text-[clamp(26px,7.4vw,32px)] font-bold leading-[1.08] tracking-[-0.02em] text-trama-navy"
          >
            {slide.titleBefore}
            <span className="text-trama-violet">{slide.titleHighlight}</span>
            {slide.titleAfter}
          </h2>
          <p className="max-w-[34ch] text-[15px] leading-relaxed text-ink-2">{slide.body}</p>
          <p className="mt-2.5 text-[12px] text-ink-3">{slide.note}</p>
        </div>

        {/* Controlli */}
        <div className="flex flex-col gap-4 px-6 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-4">
          <div className="flex items-center gap-2.5">
            <span aria-live="polite" className="text-[11px] font-bold tabular-nums tracking-[0.08em] text-ink-3">
              {slide.progress}
            </span>
            <div className="flex gap-1.5" role="group" aria-label="Schermate">
              {ONBOARDING_SLIDES.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Schermata ${i + 1}, ${s.eyebrow}`}
                  aria-current={i === slideIndex ? "step" : undefined}
                  className={`h-1 rounded-full motion-safe:transition-all motion-safe:duration-300 ${
                    i === slideIndex ? "w-[30px] bg-trama-violet" : "w-[18px] bg-[#E6E8F0]"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2.5">
            {slideIndex > 0 && (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Indietro"
                className="flex min-h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full border border-[#E6E8F0] text-ink active:scale-[0.97]"
              >
                <i className="ti ti-chevron-left text-[18px]" />
              </button>
            )}
            <button
              type="button"
              onClick={handleContinue}
              className="min-h-[52px] flex-1 rounded-full bg-trama-violet text-[15.5px] font-bold text-white shadow-[0_10px_22px_rgba(111,99,197,0.25)] active:scale-[0.97]"
            >
              {slide.ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————————————
// Card che escono dal telefono
// ————————————————————————————————————————————————————————————————————————

const POP_TONE: Record<OnboardingPop["tone"], string> = {
  violet: "bg-trama-violet/10 text-trama-violet",
  green: "bg-trama-green/10 text-trama-green",
  amber: "bg-[#FFF3DF] text-[#B86E00]",
};

function PopCard({ pop, delayMs }: { pop: OnboardingPop; delayMs: number }) {
  return (
    <div
      className={`absolute z-[2] flex max-w-[64%] items-center gap-2 rounded-[14px] border border-[#E6E8F0] bg-white px-[11px] py-2 text-[11.5px] text-trama-navy shadow-[0_14px_30px_rgba(23,42,77,0.12),0_2px_6px_rgba(23,42,77,0.06)] ${
        pop.side === "left"
          ? "left-4 motion-safe:animate-[trama-onb-pop-left_0.7s_cubic-bezier(0.34,1.56,0.64,1)_both]"
          : "right-4 motion-safe:animate-[trama-onb-pop-right_0.7s_cubic-bezier(0.34,1.56,0.64,1)_both]"
      }`}
      style={{ top: `${pop.top}%`, animationDelay: `${delayMs}ms` }}
    >
      <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[13px] ${POP_TONE[pop.tone]}`}>
        <i className={`ti ${pop.icon}`} />
      </span>
      <span className="min-w-0">
        <b className="block font-bold">
          {pop.title}
          {pop.comingSoon && (
            <span className="ml-1 whitespace-nowrap rounded-full bg-[#FFF3DF] px-1.5 py-px text-[9px] font-bold text-[#B86E00]">
              In arrivo
            </span>
          )}
        </b>
        <small className="block text-[10px] text-ink-3">{pop.subtitle}</small>
      </span>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————————————
// Schermate dentro il telefono — dati demo fittizi, mai dati reali.
// ————————————————————————————————————————————————————————————————————————

const TONE_BAR: Record<string, string> = {
  violet: "bg-trama-violet",
  green: "bg-trama-green",
  amber: "bg-trama-orange",
};

function ScreenHeader({ sub, title }: { sub: string; title: string }) {
  return (
    <>
      <div className="text-[7.5px] font-bold uppercase tracking-[0.1em] text-trama-violet">{sub}</div>
      <div className="font-poppins text-[12px] font-bold text-trama-navy">{title}</div>
    </>
  );
}

function MiniCard({
  emoji,
  tag,
  tagTone,
  name,
  meta,
  cta,
  ctaSolid,
  heroTone,
}: {
  emoji: string;
  tag: string;
  tagTone: "trama" | "found";
  name: string;
  meta: string;
  cta: string;
  ctaSolid: boolean;
  heroTone: "violet" | "green";
}) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[#E6E8F0] bg-white">
      <div className={`relative grid h-9 place-items-center text-[17px] ${heroTone === "violet" ? "bg-trama-violet/10" : "bg-trama-green/10"}`}>
        {emoji}
        <span
          className={`absolute bottom-1 left-1.5 rounded-full px-[5px] py-[2px] text-[6.5px] font-bold ${
            tagTone === "trama" ? "bg-trama-violet text-white" : "border border-[#E6E8F0] bg-white text-trama-navy"
          }`}
        >
          {tag}
        </span>
      </div>
      <div className="px-[7px] pb-1.5 pt-[5px]">
        <div className="text-[8.5px] font-bold text-trama-navy">{name}</div>
        <div className="mt-px text-[7px] text-ink-3">{meta}</div>
        <div
          className={`mt-[5px] rounded-full p-1 text-center text-[7px] font-bold ${
            ctaSolid ? "bg-trama-violet text-white" : "border border-[#E6E8F0] text-trama-navy"
          }`}
        >
          {cta}
        </div>
      </div>
    </div>
  );
}

function Avatar({ letter, tone }: { letter: string; tone: number }) {
  const tones = ["bg-[#FBD9E6]", "bg-[#D5ECFF]", "bg-[#FFE9C7]", "bg-trama-green/15", "bg-trama-violet/15"];
  return (
    <span
      className={`grid h-[18px] w-[18px] place-items-center rounded-full text-[8px] font-bold text-trama-navy ${tones[tone % tones.length]}`}
    >
      {letter}
    </span>
  );
}

function PhoneScreen({ visual }: { visual: OnboardingSlideVisual }) {
  if (visual === "discover") {
    const d = ONBOARDING_DEMO_DISCOVER;
    return (
      <>
        <ScreenHeader sub="Scopri" title={d.heading} />
        <div className="flex items-center gap-1 rounded-[9px] bg-trama-card px-2 py-1.5 text-[8px] text-ink-2">
          <i className="ti ti-search text-[9px] text-ink-3" />
          {d.query}
        </div>
        <div className="flex flex-wrap gap-1">
          {d.filters.map((f, i) => (
            <span
              key={f}
              className={`rounded-full border px-1.5 py-[3px] text-[7px] ${
                i === 0 ? "border-trama-violet/10 bg-trama-violet/10 font-bold text-trama-violet" : "border-[#E6E8F0] text-ink-2"
              }`}
            >
              {f}
            </span>
          ))}
        </div>
        <MiniCard
          emoji={d.partner.emoji}
          tag="Su TRAMA"
          tagTone="trama"
          name={d.partner.name}
          meta={d.partner.meta}
          cta={d.partner.cta}
          ctaSolid
          heroTone="violet"
        />
        <MiniCard
          emoji={d.curated.emoji}
          tag="Scoperta TRAMA"
          tagTone="found"
          name={d.curated.name}
          meta={d.curated.meta}
          cta={d.curated.cta}
          ctaSolid={false}
          heroTone="green"
        />
      </>
    );
  }
  if (visual === "organize") {
    const w = ONBOARDING_DEMO_WEEK;
    return (
      <>
        <ScreenHeader sub="Planner" title={w.heading} />
        <div className="grid grid-cols-5 gap-[3px]">
          {w.days.map((day, i) => (
            <div
              key={`${day.label}-${i}`}
              className={`rounded-[7px] py-1 text-center text-[7px] text-ink-3 ${"active" in day && day.active ? "bg-trama-violet/10" : ""}`}
            >
              {day.label}
              <b className="block font-poppins text-[10px] text-trama-navy">{day.day}</b>
            </div>
          ))}
        </div>
        {w.items.map((item) => (
          <div key={item.name} className="flex gap-1.5 rounded-[9px] border border-[#E6E8F0] bg-white px-[7px] py-1.5">
            <span className={`w-[3px] flex-shrink-0 rounded-full ${TONE_BAR[item.tone]}`} />
            <div>
              <div className="text-[7px] tabular-nums text-ink-3">{item.time}</div>
              <div className="text-[8.5px] font-bold text-trama-navy">{item.name}</div>
              <div className="text-[6.5px] text-ink-3">{item.source}</div>
            </div>
          </div>
        ))}
      </>
    );
  }
  if (visual === "coordinate") {
    const r = ONBOARDING_DEMO_RESPONSIBILITY;
    return (
      <>
        <ScreenHeader sub="Chi fa cosa" title={r.heading} />
        <div className="flex gap-1">
          {r.helpers.map((h, i) => (
            <Avatar key={h} letter={h} tone={i} />
          ))}
        </div>
        {r.rows.map((row, i) => (
          <div key={row.kid} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[8.5px] font-bold text-trama-navy">
              <Avatar letter={row.kid[0]} tone={i} />
              {row.kid} · {row.activity}
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="rounded-lg bg-trama-card px-1.5 py-[5px]">
                <small className="block text-[6.5px] uppercase tracking-[0.08em] text-ink-3">Porta</small>
                <strong className="text-[8.5px] text-trama-navy">{row.porta}</strong>
              </div>
              <div className="rounded-lg bg-trama-card px-1.5 py-[5px]">
                <small className="block text-[6.5px] uppercase tracking-[0.08em] text-ink-3">Riprende</small>
                <strong className="text-[8.5px] text-trama-navy">{row.riprende}</strong>
              </div>
            </div>
          </div>
        ))}
        <div className="text-[7px] font-bold text-trama-green">✓ Giornata organizzata</div>
      </>
    );
  }
  const g = ONBOARDING_DEMO_GROUPS;
  return (
    <>
      <ScreenHeader sub="Gruppi" title={g.heading} />
      {g.groups.map((group) => (
        <div key={group.name} className="flex flex-col gap-1 rounded-[10px] border border-[#E6E8F0] p-[7px]">
          <div className="flex items-center justify-between">
            <div className="text-[8.5px] font-bold text-trama-navy">{group.name}</div>
            <div className="flex">
              {group.members.map((m, i) => (
                <span key={m} className={i === 0 ? "" : "-ml-[5px]"}>
                  <Avatar letter={m} tone={i + 2} />
                </span>
              ))}
            </div>
          </div>
          <div className="text-[7px] text-ink-3">{group.meta}</div>
          {"cta" in group && group.cta && (
            <div className="rounded-full bg-trama-violet p-1 text-center text-[7px] font-bold text-white">{group.cta}</div>
          )}
        </div>
      ))}
      <div className="flex gap-1.5 rounded-[9px] border border-[#E6E8F0] bg-white px-[7px] py-1.5">
        <span className="w-[3px] flex-shrink-0 rounded-full bg-trama-violet" />
        <div>
          <div className="text-[8.5px] font-bold text-trama-navy">{g.shared.name}</div>
          <div className="text-[6.5px] text-ink-3">{g.shared.meta}</div>
        </div>
      </div>
    </>
  );
}
