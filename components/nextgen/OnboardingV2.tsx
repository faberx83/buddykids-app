"use client";

// TRAMA — ONBOARDING V2 (14/10/2026, piano unito approvato da Fabrizio).
// Dietro ONBOARDING_V2_ENABLED (release "onboarding-v2"); quando è acceso
// prende il posto di OnboardingCarousel (montato in app/nextgen/layout.tsx).
//
//   1-3. "Perché": Tutto in un posto → Anche se il centro non è su TRAMA →
//        Non solo cosa, anche chi. Card d'esempio che fluttua, notifiche che
//        escono (keyframes trama-onb2-* in app/globals.css), dati demo
//        fittizi (lib/nextgen/onboarding-v2.ts).
//   4.   I tuoi figli: riusa addKidAction (stessa dichiarazione genitoriale
//        quando LEGAL_TERMS_GATE è acceso, come AddKidForm).
//   5.   La scuola: riusa setSchoolContextForFamilyAction ("Lo faccio dopo").
//        Solo se il calendario scolastico è attivo e manca per qualcuno.
//   6.   La Home.
//
// Persistenza: tutorial_progress con la chiave NUOVA family_onboarding_v2 e
// le Server Action walkthrough esistenti (start/complete/skip), step
// sentinella "carousel". Nessuna migration.
// Accessibilità: role="dialog" + aria-modal, focus trap, ESC = Salta (dalle
// schermate "perché" porta ai passi; dai passi chiude), frecce sinistra/destra
// nelle schermate "perché", tocchi da 44px, decorazioni aria-hidden.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ONBOARDING_V2_SLIDES,
  ONBOARDING_V2_DEMO,
  ONBOARDING_V2_TUTORIAL_KEY,
  ONBOARDING_V2_STEP_KEY,
  ONBOARDING_V2_INTERESTS,
  ageFromIso,
  shouldAskSchool,
  type OnboardingV2Pop,
  type OnboardingV2Visual,
} from "@/lib/nextgen/onboarding-v2";
import type { WalkthroughProgressSummary } from "@/lib/walkthrough/data";
import {
  startWalkthroughStepAction,
  completeWalkthroughStepAction,
  skipWalkthroughStepAction,
} from "@/app/actions/walkthrough";
import { addKidAction } from "@/app/actions/kids";
import { isParentalDeclarationGateEnabledAction } from "@/app/actions/legal";
import { setSchoolContextForFamilyAction } from "@/app/actions/school-calendar";
import { ITALIAN_REGIONS } from "@/lib/school-calendar/regions";
import { interestIcon } from "@/lib/nextgen/kid-visual";
import ParentalDeclarationText from "@/components/legal/ParentalDeclarationText";
import { newKidErrorSummary, onboardingTotalSteps, validateNewKid, type NewKidField } from "@/lib/nextgen/parent-ux-fix";
// NODI THREAD (28/10/2026): benvenuto nel primo passo utile (figli), una volta sola.
import Nodi from "@/components/nextgen/Nodi";

export interface OnboardingV2Kid {
  id: string;
  name: string;
  age: number | null;
}

type Phase = "perche" | "figli" | "scuola";

const CTA_PRIMARY =
  "flex min-h-[52px] flex-1 items-center justify-center rounded-[12px] bg-trama-primary px-5 text-[15.5px] font-bold text-white active:bg-trama-primary-press disabled:bg-[#B9C0CC]";
const FIELD =
  "min-h-[46px] w-full rounded-[12px] border border-[#E3E6EC] bg-white px-3.5 text-[15px] text-ink outline-none focus:border-trama-primary";
const THREAD = ["#F66B5E", "#F6A623", "#2DBA8C", "#6F63C5"];

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])'
    )
  );
}

export default function OnboardingV2({
  progress,
  kids,
  schoolCalendarEnabled,
  kidIdsWithoutSchool,
  residenceCity,
  uxFix = false,
}: {
  progress: WalkthroughProgressSummary | null;
  kids: OnboardingV2Kid[];
  schoolCalendarEnabled: boolean;
  kidIdsWithoutSchool: string[];
  residenceCity: string | null;
  /** Secondo test UX (22/10, PARENT_UX_FIX_ENABLED): passi stabili (021) e tutti gli errori insieme (015). */
  uxFix?: boolean;
}) {
  const router = useRouter();
  const visible = progress?.currentStepKey === ONBOARDING_V2_STEP_KEY;
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<Phase>("perche");
  const [slideIndex, setSlideIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [localKids, setLocalKids] = useState<OnboardingV2Kid[]>(kids);
  const [addedKidIds, setAddedKidIds] = useState<string[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  // "Rivedi l'introduzione" (14/10, secondo motivo per cui non ripartiva):
  // questo componente vive nel layout e non si smonta cambiando pagina, quindi
  // dopo la prima chiusura `dismissed` restava true. Quando il percorso torna
  // da vedere (visible passa da false a true) si riparte da capo.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDismissed(false);
      setPhase("perche");
      setSlideIndex(0);
      setDirection(1);
      setLocalKids(kids);
      setAddedKidIds([]);
    }
  }
  useEffect(() => {
    if (!visible) startedRef.current = false;
  }, [visible]);

  const show = visible && !dismissed;
  const kidsWithoutSchoolCount = kidIdsWithoutSchool.length + addedKidIds.length;
  const askSchool = shouldAskSchool({ schoolCalendarEnabled, kidsCount: localKids.length, kidsWithoutSchoolCount });
  const totalSteps = uxFix
    ? onboardingTotalSteps({ schoolCalendarEnabled, kidsCount: localKids.length, kidsWithoutSchoolCount })
    : askSchool
      ? 2
      : 1;

  useEffect(() => {
    if (show && !startedRef.current) {
      startedRef.current = true;
      void startWalkthroughStepAction(ONBOARDING_V2_TUTORIAL_KEY, ONBOARDING_V2_STEP_KEY);
    }
  }, [show]);

  useEffect(() => {
    if (show && dialogRef.current) dialogRef.current.focus();
  }, [show, phase, slideIndex]);

  const finish = useCallback(
    async (outcome: "completed" | "skipped") => {
      setDismissed(true); // chiude subito, nessuna attesa di rete
      const action = outcome === "completed" ? completeWalkthroughStepAction : skipWalkthroughStepAction;
      await action(ONBOARDING_V2_TUTORIAL_KEY, ONBOARDING_V2_STEP_KEY);
      router.push("/nextgen");
      router.refresh();
    },
    [router]
  );

  const goToSetup = useCallback(() => {
    setDirection(1);
    setPhase("figli");
  }, []);

  const nextSlide = useCallback(() => {
    if (slideIndex === ONBOARDING_V2_SLIDES.length - 1) {
      goToSetup();
      return;
    }
    setDirection(1);
    setSlideIndex((i) => i + 1);
  }, [slideIndex, goToSetup]);

  const prevSlide = useCallback(() => {
    setDirection(-1);
    setSlideIndex((i) => Math.max(0, i - 1));
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
    if (e.key === "Escape") {
      e.preventDefault();
      if (phase === "perche") goToSetup();
      else void finish("skipped");
      return;
    }
    if (phase === "perche" && !typing) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextSlide();
        return;
      }
      if (e.key === "ArrowLeft" && slideIndex > 0) {
        e.preventDefault();
        prevSlide();
        return;
      }
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
    <div className="fixed inset-0 z-[90] flex items-stretch justify-center bg-trama-page sm:items-center sm:bg-black/40 sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-v2-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative isolate flex h-[100dvh] w-full flex-col overflow-y-auto bg-trama-page outline-none sm:h-[min(860px,92dvh)] sm:max-w-[430px] sm:rounded-[28px] sm:shadow-xl"
      >
        {phase === "perche" ? (
          <WhySlides
            index={slideIndex}
            direction={direction}
            onNext={nextSlide}
            onBack={prevSlide}
            onSkip={goToSetup}
            onGoTo={(i) => {
              setDirection(i > slideIndex ? 1 : -1);
              setSlideIndex(i);
            }}
          />
        ) : phase === "figli" ? (
          <KidsStep
            kids={localKids}
            step={1}
            totalSteps={totalSteps}
            uxFix={uxFix}
            onBack={() => {
              setDirection(-1);
              setPhase("perche");
              setSlideIndex(ONBOARDING_V2_SLIDES.length - 1);
            }}
            onKidAdded={(kid) => {
              setLocalKids((prev) => [...prev, kid]);
              setAddedKidIds((prev) => [...prev, kid.id]);
            }}
            onContinue={() => {
              if (askSchool) {
                setDirection(1);
                setPhase("scuola");
              } else {
                void finish("completed");
              }
            }}
            onLater={() => void finish("completed")}
          />
        ) : (
          <SchoolStep
            kids={localKids}
            step={2}
            totalSteps={totalSteps}
            residenceCity={residenceCity}
            onBack={() => {
              setDirection(-1);
              setPhase("figli");
            }}
            onDone={() => void finish("completed")}
          />
        )}
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————————————
// 1-3 · Le schermate "perché"
// ————————————————————————————————————————————————————————————————————————

function TitleWithHighlight({ title, highlight }: { title: string; highlight: string }) {
  const at = title.indexOf(highlight);
  if (at < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, at)}
      <span className="text-trama-accent">{highlight}</span>
      {title.slice(at + highlight.length)}
    </>
  );
}

function WhySlides({
  index,
  direction,
  onNext,
  onBack,
  onSkip,
  onGoTo,
}: {
  index: number;
  direction: 1 | -1;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onGoTo: (i: number) => void;
}) {
  const slide = ONBOARDING_V2_SLIDES[index];
  const textAnim =
    direction === 1
      ? "motion-safe:animate-[trama-onb-text-next_0.55s_cubic-bezier(0.22,1,0.36,1)_both]"
      : "motion-safe:animate-[trama-onb-text-prev_0.55s_cubic-bezier(0.22,1,0.36,1)_both]";

  return (
    <div className="relative isolate flex min-h-full flex-col overflow-hidden">
      {/* Aloni appena accennati dietro il telefono (come la versione precedente) */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-[20%] top-[6%] -z-10 h-[300px] w-[300px] rounded-full bg-trama-accent opacity-10 blur-[70px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-[25%] top-[26%] -z-10 h-[240px] w-[240px] rounded-full bg-trama-green opacity-[0.08] blur-[70px]" />

      {/* Barra alta: marchio, Salta */}
      <div className="flex items-center justify-between px-5 pt-[calc(10px+env(safe-area-inset-top,0px))]">
        {/* eslint-disable-next-line @next/next/no-img-element -- stesso logo statico di app/nextgen/trama/page.tsx */}
        <img src="/brand/trama-logo-mark.png" alt="TRAMA" className="h-8 w-auto" />
        <button
          type="button"
          onClick={onSkip}
          className="flex min-h-[44px] items-center px-1.5 text-[14px] font-semibold text-ink-2 active:opacity-70"
        >
          Salta
        </button>
      </div>

      {/* Palco: telefono 3D che fluttua e ruota a ogni schermata, card che escono */}
      <div className="relative grid min-h-[300px] flex-1 place-items-center" aria-hidden="true">
        <div className="relative z-[1] [perspective:1100px] motion-safe:animate-[trama-onb-float_2.8s_ease-in-out_infinite]">
          <div
            className="relative aspect-[9/18.5] max-h-[44dvh] w-[clamp(160px,46vw,200px)] rounded-[34px] bg-[#1B1F2B] p-1.5 shadow-[0_0_0_1px_#2B3142,0_28px_50px_rgba(23,42,77,0.18),0_8px_18px_rgba(23,42,77,0.10)] motion-safe:transition-transform motion-safe:duration-[900ms] motion-safe:ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:!transform-none"
            style={{ transform: `rotateY(${slide.tilt.y}deg) rotateX(${slide.tilt.x}deg)` }}
          >
            <div className="absolute left-1/2 top-[11px] z-[3] h-4 w-[60px] -translate-x-1/2 rounded-xl bg-[#1B1F2B]" />
            <div className="relative h-full overflow-hidden rounded-[29px] bg-trama-page">
              <div
                key={slide.key}
                className="absolute inset-0 flex flex-col gap-1.5 px-2.5 pb-2.5 pt-8 motion-safe:animate-[trama-onb-screen_0.5s_cubic-bezier(0.22,1,0.36,1)_both]"
              >
                <div className="absolute left-4 right-4 top-[11px] flex justify-between text-[7.5px] text-ink-3">
                  <span>9:41</span>
                  <span>●●● ▮</span>
                </div>
                <PhoneScreen visual={slide.key} />
              </div>
            </div>
          </div>
        </div>
        {slide.pops.map((pop, i) => (
          <PopCard key={`${slide.key}-${i}`} pop={pop} delayMs={350 + i * 140} />
        ))}
      </div>

      {/* Testo */}
      <div key={`copy-${slide.key}`} className={`px-6 ${textAnim}`}>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-trama-accent-ink">
          <span aria-hidden="true" className="flex gap-[3px]">
            {THREAD.map((c, i) => (
              <span key={c} className="h-[3px] rounded-full" style={{ width: [12, 7, 10, 6][i], background: c }} />
            ))}
          </span>
          {slide.eyebrow}
        </div>
        <h2
          id="onboarding-v2-title"
          className="my-2.5 text-balance font-poppins text-[clamp(25px,7vw,30px)] font-bold leading-[1.1] tracking-[-0.02em] text-trama-navy"
        >
          <TitleWithHighlight title={slide.title} highlight={slide.highlight} />
        </h2>
        <p className="max-w-[36ch] text-[15px] leading-relaxed text-ink-2">{slide.body}</p>
      </div>

      {/* Controlli */}
      <div className="flex flex-col gap-4 px-6 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-5">
        <div className="flex items-center gap-2.5">
          <span aria-live="polite" className="text-[11px] font-bold tabular-nums tracking-[0.08em] text-ink-3">
            {index + 1}/{ONBOARDING_V2_SLIDES.length}
          </span>
          <div className="flex gap-1.5" role="group" aria-label="Schermate">
            {ONBOARDING_V2_SLIDES.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onGoTo(i)}
                aria-label={`Schermata ${i + 1} di ${ONBOARDING_V2_SLIDES.length}`}
                aria-current={i === index ? "step" : undefined}
                className="flex h-6 items-center"
              >
                <span
                  className={`block h-1 rounded-full motion-safe:transition-all motion-safe:duration-300 ${
                    i === index ? "w-[30px] bg-trama-primary" : "w-[18px] bg-[#E6E8F0]"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2.5">
          {index > 0 && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Indietro"
              className="flex min-h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[12px] border border-[#D9DDE5] bg-white text-trama-primary active:scale-[0.97]"
            >
              <i className="ti ti-chevron-left text-[20px]" aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={onNext} className={`${CTA_PRIMARY} shadow-[0_10px_22px_rgba(23,42,77,0.22)] active:scale-[0.97]`}>
            {slide.ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const POP_TONE: Record<OnboardingV2Pop["tone"], string> = {
  navy: "bg-trama-primary-soft text-trama-primary",
  green: "bg-[#E6F6F0] text-[#1F9A72]",
  amber: "bg-[#FFF3DF] text-[#B86E00]",
  coral: "bg-[#FFEFEC] text-[#D9483B]",
};

/** Card che "esce" dal telefono verso sinistra o destra (keyframes trama-onb-pop-*). */
function PopCard({ pop, delayMs }: { pop: OnboardingV2Pop; delayMs: number }) {
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
        <b className="block font-bold">{pop.title}</b>
        {pop.subtitle && <small className="block text-[10px] text-ink-3">{pop.subtitle}</small>}
      </span>
    </div>
  );
}

/** Schermate in miniatura dentro il telefono — dati demo fittizi, mai dati reali. */
function PhoneScreen({ visual }: { visual: OnboardingV2Visual }) {
  const head = (sub: string, title: string) => (
    <>
      <div className="text-[7.5px] font-bold uppercase tracking-[0.1em] text-trama-accent-ink">{sub}</div>
      <div className="font-poppins text-[12px] font-bold text-trama-navy">{title}</div>
    </>
  );
  if (visual === "oggi") {
    const d = ONBOARDING_V2_DEMO.oggi;
    return (
      <>
        {head(d.date, d.heading)}
        {d.items.map((it) => (
          <div key={it.name} className="flex gap-1.5 rounded-[9px] border border-[#E6E8F0] bg-white px-[7px] py-1.5">
            <span className="w-[3px] flex-shrink-0 rounded-full" style={{ background: it.tone }} />
            <div className="min-w-0">
              <div className="text-[7px] font-bold tabular-nums text-trama-primary">{it.time}</div>
              <div className="text-[8.5px] font-bold text-trama-navy">{it.name}</div>
              <div className="text-[6.5px] text-ink-3">{it.meta}</div>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-1 rounded-[9px] bg-[#E6F6F0] px-[7px] py-1.5 text-[7px] font-semibold text-[#146B4F]">
          <i className="ti ti-check text-[8px]" />
          {d.items[1].who}
        </div>
        <div className="flex gap-1.5 rounded-[9px] border border-dashed border-[#C9CFDA] bg-white px-[7px] py-1.5">
          <span className="w-[3px] flex-shrink-0 rounded-full bg-[#F66B5E]" />
          <div>
            <div className="text-[7px] tabular-nums text-ink-3">Sabato</div>
            <div className="text-[8.5px] font-bold text-trama-navy">Festa di Sofia</div>
          </div>
        </div>
      </>
    );
  }
  if (visual === "fuori") {
    const d = ONBOARDING_V2_DEMO.fuori;
    return (
      <>
        {head("Aggiungi", d.heading)}
        <div className="flex flex-col rounded-[10px] border border-[#E6E8F0] bg-white px-[7px] py-1">
          {d.fields.map((f, i) => (
            <div key={f.label} className={`flex items-center justify-between gap-1 py-[5px] ${i > 0 ? "border-t border-[#F0F2F5]" : ""}`}>
              <span className="text-[6.5px] text-ink-3">{f.label}</span>
              <span className="truncate text-[7.5px] font-bold text-trama-navy">{f.value}</span>
            </div>
          ))}
        </div>
        <div className="rounded-[7px] bg-trama-primary p-1.5 text-center text-[7.5px] font-bold text-white">{d.cta}</div>
        <div className="mt-0.5 text-[6.5px] text-ink-3">Anche corsi, visite e feste: tutto nel Planner.</div>
      </>
    );
  }
  const d = ONBOARDING_V2_DEMO.chi;
  return (
    <>
      {head("Chi accompagna", d.heading)}
      <div className="grid grid-cols-[34px_1fr_1fr] gap-1 text-[6.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
        <span />
        <span>Porta</span>
        <span>Ritira</span>
      </div>
      {d.rows.map((r) => (
        <div key={r.kid} className="grid grid-cols-[34px_1fr_1fr] items-center gap-1">
          <span className="text-[8px] font-bold text-trama-navy">{r.kid}</span>
          <span className="rounded-md bg-[#E6F6F0] px-1 py-[5px] text-[7.5px] font-semibold text-[#146B4F]">{r.porta}</span>
          {r.riprende ? (
            <span className="rounded-md bg-[#E6F6F0] px-1 py-[5px] text-[7.5px] font-semibold text-[#146B4F]">{r.riprende}</span>
          ) : (
            <span className="rounded-md border border-dashed border-[#F6B84B] bg-[#FFF8EB] px-1 py-[4px] text-[7.5px] font-bold text-[#7A4500]">Chi?</span>
          )}
        </div>
      ))}
      <div className="flex items-center gap-1 rounded-[9px] bg-[#FFF8EB] px-[7px] py-1.5 text-[7px] text-[#5C3600]">
        <i className="ti ti-alert-circle text-[8px]" />
        Manca chi ritira {d.rows[0].kid}
      </div>
      <div className="flex gap-1">
        {["Tu", "Marco", "Nonna Rita", "Tata"].map((h) => (
          <span key={h} className="rounded-full border border-[#E6E8F0] bg-white px-1.5 py-[3px] text-[6.5px] font-semibold text-trama-navy">
            {h}
          </span>
        ))}
      </div>
    </>
  );
}

// ————————————————————————————————————————————————————————————————————————
// Passi di preparazione
// ————————————————————————————————————————————————————————————————————————

function StepHeader({ step, totalSteps, onBack }: { step: number; totalSteps: number; onBack: () => void }) {
  return (
    <header className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Indietro"
          className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-full text-trama-primary active:bg-black/[0.04]"
        >
          <i className="ti ti-chevron-left text-[22px]" aria-hidden="true" />
        </button>
        <span className="text-[13px] font-semibold text-ink-3">
          Passo {step} di {totalSteps}
        </span>
        <span className="w-11" />
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }} aria-hidden="true">
        {Array.from({ length: totalSteps }, (_, i) => (
          <span key={i} className={`h-[5px] rounded-full ${i < step ? "bg-trama-primary" : "bg-[#E3E6EC]"}`} />
        ))}
      </div>
    </header>
  );
}

function KidAvatar({ name, index }: { name: string; index: number }) {
  const tones = ["bg-[#ECE8F8] text-[#4A3F9E]", "bg-[#FFF0E6] text-[#8A3B12]", "bg-[#E6F6F0] text-[#146B4F]", "bg-[#FFF4E0] text-[#7A4500]"];
  return (
    <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-poppins text-[16px] font-semibold ${tones[index % tones.length]}`}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function KidsStep({
  kids,
  step,
  totalSteps,
  onBack,
  onKidAdded,
  onContinue,
  onLater,
  uxFix = false,
}: {
  kids: OnboardingV2Kid[];
  step: number;
  totalSteps: number;
  uxFix?: boolean;
  onBack: () => void;
  onKidAdded: (kid: OnboardingV2Kid) => void;
  onContinue: () => void;
  onLater: () => void;
}) {
  const [formOpen, setFormOpen] = useState(kids.length === 0);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  // 15/10/2026 (Fabrizio: "se aggiungo un figlio dal carosello non mi chiede il
  // genere"): stessa scelta facoltativa di AddKidForm (KidGender).
  const [gender, setGender] = useState<"F" | "M" | "altro" | "">("");
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badFields, setBadFields] = useState<NewKidField[]>([]);
  const [declarationRequired, setDeclarationRequired] = useState(false);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    // Stessa regola di AddKidForm: la dichiarazione si chiede solo se il gate legale è acceso per l'utente.
    isParentalDeclarationGateEnabledAction()
      .then(setDeclarationRequired)
      .catch(() => setDeclarationRequired(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBadFields([]);
    if (uxFix) {
      // Secondo test UX (22/10, UX-PARENT-015 residuo): come in La tua famiglia,
      // tutto quello che manca in una volta, non un campo alla volta.
      const problems = validateNewKid({ name, birthDate, declarationRequired, declarationAccepted, todayIso: today });
      if (problems.length > 0) {
        setBadFields(problems.map((p) => p.field));
        return setError(newKidErrorSummary(problems));
      }
    } else {
      if (!name.trim()) return setError("Scrivi il nome.");
      if (!birthDate) return setError("Inserisci la data di nascita.");
      if (declarationRequired && !declarationAccepted) return setError("Conferma la dichiarazione per continuare.");
    }
    setSaving(true);
    try {
      const res = await addKidAction(name, birthDate, gender || undefined, interests, declarationAccepted);
      if (res.error || !res.kid) {
        setError(res.error || "Non siamo riusciti a salvare. Riprova.");
        return;
      }
      onKidAdded({ id: res.kid.id, name: res.kid.name, age: ageFromIso(birthDate) });
      setName("");
      setBirthDate("");
      setInterests([]);
      setGender("");
      setDeclarationAccepted(false);
      setFormOpen(false);
    } catch {
      setError("Non siamo riusciti a salvare. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col gap-5 px-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-[calc(12px+env(safe-area-inset-top,0px))] motion-safe:animate-[trama-onb2-in_0.45s_ease-out_both]">
      <StepHeader step={step} totalSteps={totalSteps} onBack={onBack} />

      <div className="flex flex-col gap-2">
        {/* NODI THREAD: solo all'ingresso del passo (nessun figlio ancora), non negli altri passi. */}
        {kids.length === 0 && <Nodi state="welcome" size={136} className="-mb-1 self-center" />}
        <h2 id="onboarding-v2-title" className="font-poppins text-[24px] font-semibold leading-tight text-ink">
          {kids.length > 0 ? "I tuoi figli" : "Chi sono i tuoi figli?"}
        </h2>
        <p className="text-[14.5px] leading-relaxed text-ink-2">
          {kids.length > 0
            ? "Controlla che ci siano tutti: il Planner si organizza intorno a loro."
            : "Nome e data di nascita ci servono per proporti attività adatte all'età."}
        </p>
      </div>

      {kids.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Figli inseriti">
          {kids.map((k, i) => (
            <li key={k.id} className="flex items-center gap-3 rounded-2xl border border-trama-line bg-white px-4 py-3">
              <KidAvatar name={k.name} index={i} />
              <span className="flex min-w-0 flex-col">
                <span className="text-[15.5px] font-semibold text-ink">{k.name}</span>
                {k.age !== null && <span className="text-[13px] text-ink-3">{k.age === 1 ? "1 anno" : `${k.age} anni`}</span>}
              </span>
              <i className="ti ti-circle-check-filled ml-auto text-[20px] text-[#1F9A72]" aria-hidden="true" />
            </li>
          ))}
        </ul>
      )}

      {formOpen ? (
        <form onSubmit={handleAdd} className="flex flex-col gap-3.5 rounded-2xl border border-[#D9DDE5] bg-white p-4" noValidate>
          <span className="text-[14px] font-bold text-trama-primary">{kids.length > 0 ? "Aggiungi un altro figlio" : "Aggiungi un figlio"}</span>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
            Nome
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              aria-invalid={badFields.includes("name") || undefined}
              className={`${FIELD} ${badFields.includes("name") ? "border-[#C0392B]" : ""}`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
            Data di nascita
            <input
              type="date"
              value={birthDate}
              max={today}
              onChange={(e) => setBirthDate(e.target.value)}
              aria-invalid={badFields.includes("birthDate") || undefined}
              className={`${FIELD} ${badFields.includes("birthDate") ? "border-[#C0392B]" : ""}`}
            />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-semibold text-ink-2">
              È… <span className="font-normal text-ink-3">(facoltativo)</span>
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["F", "Una bambina"],
                  ["M", "Un bambino"],
                  ["", "Preferisco non dirlo"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={gender === value}
                  onClick={() => setGender(value)}
                  className={`min-h-[40px] rounded-full border px-3.5 text-[13px] font-semibold ${
                    gender === value ? "border-trama-primary bg-trama-primary text-white" : "border-[#E3E6EC] bg-white text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-semibold text-ink-2">
              Cosa {name.trim() ? `piace a ${name.trim()}` : gender === "F" ? "le piace" : "gli piace"}? <span className="font-normal text-ink-3">(facoltativo)</span>
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {ONBOARDING_V2_INTERESTS.map((opt) => {
                const on = interests.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setInterests((prev) => (on ? prev.filter((v) => v !== opt.value) : [...prev, opt.value]))}
                    className={`flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold ${
                      on ? "border-trama-primary bg-trama-primary text-white" : "border-[#E3E6EC] bg-white text-ink"
                    }`}
                  >
                    <i className={`ti ${interestIcon(opt.value)} text-[16px]`} aria-hidden="true" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {declarationRequired && (
            <label className="flex items-start gap-2 text-[12px] leading-snug text-ink-2">
              <input
                type="checkbox"
                checked={declarationAccepted}
                onChange={(e) => setDeclarationAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <ParentalDeclarationText kidName={name} />
            </label>
          )}
          {error && (
            <p role="alert" className="text-[12.5px] font-semibold text-[#C0392B]">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-[12px] border border-trama-primary bg-white text-[14px] font-bold text-trama-primary active:bg-trama-primary-soft disabled:opacity-60"
            >
              {saving ? "Salvataggio…" : name.trim() ? `Aggiungi ${name.trim()}` : "Aggiungi"}
            </button>
            {kids.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setError(null);
                }}
                className="min-h-[44px] rounded-[12px] px-3 text-[14px] font-semibold text-ink-2"
              >
                Annulla
              </button>
            )}
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-[#C9CFDA] bg-white text-[14px] font-semibold text-trama-primary active:bg-black/[0.03]"
        >
          <i className="ti ti-plus text-[16px]" aria-hidden="true" />
          Aggiungi un altro figlio
        </button>
      )}

      <div className="flex-1" />

      <div className="flex flex-col gap-1.5">
        <div className="flex">
          <button type="button" onClick={onContinue} disabled={kids.length === 0} className={CTA_PRIMARY}>
            Continua
          </button>
        </div>
        {kids.length === 0 ? (
          <button type="button" onClick={onLater} className="min-h-[44px] text-[14px] font-semibold text-trama-accent-ink">
            Lo faccio dopo
          </button>
        ) : (
          <span className="pt-1 text-center text-[12.5px] text-ink-3">Puoi cambiare tutto quando vuoi dal Profilo.</span>
        )}
      </div>
    </div>
  );
}

function SchoolStep({
  kids,
  step,
  totalSteps,
  residenceCity,
  onBack,
  onDone,
}: {
  kids: OnboardingV2Kid[];
  step: number;
  totalSteps: number;
  residenceCity: string | null;
  onBack: () => void;
  onDone: () => void;
}) {
  const [region, setRegion] = useState("");
  const [comune, setComune] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!region) return setError("Scegli la regione della scuola.");
    setSaving(true);
    setError(null);
    try {
      const res = await setSchoolContextForFamilyAction(region, comune);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone();
    } catch {
      setError("Non siamo riusciti a salvare. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  const names = kids.map((k) => k.name);
  const forWhom = names.length <= 1 ? names[0] ?? "" : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;

  return (
    <form
      onSubmit={handleSave}
      noValidate
      className="flex min-h-full flex-col gap-5 px-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-[calc(12px+env(safe-area-inset-top,0px))] motion-safe:animate-[trama-onb2-in_0.45s_ease-out_both]"
    >
      <StepHeader step={step} totalSteps={totalSteps} onBack={onBack} />

      <div className="flex flex-col gap-2">
        <h2 id="onboarding-v2-title" className="font-poppins text-[24px] font-semibold leading-tight text-ink">
          {kids.length > 1 ? "Dove vanno a scuola?" : "Dove va a scuola?"}
        </h2>
        <p className="text-[14.5px] leading-relaxed text-ink-2">
          Dal calendario della scuola ricaviamo ponti e vacanze: nel Planner vedi subito le settimane da organizzare.
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
        Regione
        <select value={region} onChange={(e) => setRegion(e.target.value)} className={FIELD}>
          <option value="">Seleziona…</option>
          {ITALIAN_REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
        <span>
          Comune della scuola <span className="font-normal text-ink-3">(facoltativo)</span>
        </span>
        <div className="flex gap-2">
          <input value={comune} onChange={(e) => setComune(e.target.value)} placeholder="Es. Milano" className={`${FIELD} min-w-0 flex-1`} />
          {residenceCity && (
            <button
              type="button"
              onClick={() => setComune(residenceCity)}
              className="min-h-[46px] whitespace-nowrap rounded-[12px] border border-[#D9DDE5] bg-white px-3 text-[13px] font-semibold text-trama-primary"
            >
              Usa {residenceCity}
            </button>
          )}
        </div>
      </label>
      {forWhom && <p className="text-[13px] text-ink-3">Vale per {forWhom}. Per un figlio in un'altra scuola lo cambi dal Profilo.</p>}
      {error && (
        <p role="alert" className="text-[12.5px] font-semibold text-[#C0392B]">
          {error}
        </p>
      )}

      <div className="flex-1" />

      <div className="flex flex-col gap-1.5">
        <div className="flex">
          <button type="submit" disabled={saving} className={CTA_PRIMARY}>
            {saving ? "Salvataggio…" : "Continua"}
          </button>
        </div>
        <button type="button" onClick={onDone} disabled={saving} className="min-h-[44px] text-[14px] font-semibold text-trama-accent-ink">
          Lo faccio dopo
        </button>
      </div>
    </form>
  );
}
