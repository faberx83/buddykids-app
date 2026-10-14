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
}: {
  progress: WalkthroughProgressSummary | null;
  kids: OnboardingV2Kid[];
  schoolCalendarEnabled: boolean;
  kidIdsWithoutSchool: string[];
  residenceCity: string | null;
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

  const show = visible && !dismissed;
  const kidsWithoutSchoolCount = kidIdsWithoutSchool.length + addedKidIds.length;
  const askSchool = shouldAskSchool({ schoolCalendarEnabled, kidsCount: localKids.length, kidsWithoutSchoolCount });
  const totalSteps = askSchool ? 2 : 1;

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

function ThreadMark({ animate }: { animate: boolean }) {
  const widths = [16, 10, 13, 8];
  return (
    <span aria-hidden="true" className="flex gap-[3px]">
      {THREAD.map((c, i) => (
        <span
          key={c}
          className={`h-1 origin-left rounded-[2px] ${animate ? "motion-safe:animate-[trama-onb2-thread_0.5s_ease-out_both]" : ""}`}
          style={{ width: widths[i], background: c, animationDelay: `${0.15 + i * 0.1}s` }}
        />
      ))}
    </span>
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
    <div className="flex min-h-full flex-col gap-5 px-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-[calc(12px+env(safe-area-inset-top,0px))]">
      <header className="flex items-center justify-between">
        <div className="flex gap-1.5" role="group" aria-label="Schermate">
          {ONBOARDING_V2_SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onGoTo(i)}
              aria-label={`Schermata ${i + 1} di ${ONBOARDING_V2_SLIDES.length}`}
              aria-current={i === index ? "step" : undefined}
              className="flex h-11 items-center"
            >
              <span
                className={`block h-1.5 rounded-full motion-safe:transition-all motion-safe:duration-300 ${
                  i === index ? "w-[22px] bg-trama-primary" : "w-1.5 bg-[#D6DAE3]"
                }`}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="flex min-h-[44px] items-center px-1 text-[14px] font-semibold text-ink-2 active:opacity-70"
        >
          Salta
        </button>
      </header>

      <div key={`copy-${slide.key}`} className={`flex flex-col gap-3 ${index === 0 ? "" : "pt-6"} ${textAnim}`}>
        {index === 0 && (
          // eslint-disable-next-line @next/next/no-img-element -- stesso logo statico di app/nextgen/trama/page.tsx
          <img src="/brand/trama-logo-mark.png" alt="TRAMA" className="h-auto w-14" />
        )}
        <span className="text-[13px] font-semibold tracking-[0.02em] text-ink-3">{slide.eyebrow}</span>
        <h2 id="onboarding-v2-title" className="text-balance font-poppins text-[clamp(25px,7vw,28px)] font-semibold leading-[1.18] text-ink">
          {slide.title}
        </h2>
        <ThreadMark animate />
        <p aria-live="polite" className="text-[15px] leading-relaxed text-ink-2">
          {slide.body}
        </p>
      </div>

      <div key={`stage-${slide.key}`} aria-hidden="true" className="relative mx-1 mb-3 mt-2 [perspective:900px]">
        <div className="motion-safe:animate-[trama-onb2-in_0.6s_ease-out_both]">
          <div className="[transform-style:preserve-3d] motion-safe:animate-[trama-onb2-tilt_6s_ease-in-out_infinite]">
            <DemoCard visual={slide.key} />
          </div>
        </div>
        <Pop pop={slide.pops[0]} delayMs={500} />
        <Pop pop={slide.pops[1]} delayMs={900} />
      </div>

      <div className="flex-1" />

      <div className="flex gap-2.5">
        {index > 0 && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Indietro"
            className="flex min-h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[12px] border border-[#D9DDE5] bg-white text-trama-primary active:bg-black/[0.03]"
          >
            <i className="ti ti-chevron-left text-[20px]" aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={onNext} className={CTA_PRIMARY}>
          {slide.ctaLabel}
        </button>
      </div>
    </div>
  );
}

const POP_TONE: Record<OnboardingV2Pop["tone"], string> = {
  navy: "text-trama-primary",
  green: "text-[#1F9A72]",
  amber: "text-[#B87400]",
  coral: "text-[#D9483B]",
};

function Pop({ pop, delayMs }: { pop: OnboardingV2Pop; delayMs: number }) {
  return (
    <span
      className={`absolute z-[2] flex max-w-[78%] items-center gap-2 rounded-[14px] bg-white px-3 py-2 text-[12.5px] font-semibold text-ink shadow-[0_8px_24px_rgba(23,42,77,0.16)] motion-safe:animate-[trama-onb2-pop_0.7s_cubic-bezier(0.2,0.9,0.3,1.25)_both] ${
        pop.side === "left" ? "-left-2" : "-right-2"
      } ${pop.edge === "top" ? "-top-3" : "-bottom-4"}`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <i className={`ti ${pop.icon} text-[15px] ${POP_TONE[pop.tone]}`} />
      <span className="truncate">
        {pop.title}
        {pop.subtitle && <span className="font-normal text-ink-3"> {pop.subtitle}</span>}
      </span>
    </span>
  );
}

function DemoCard({ visual }: { visual: OnboardingV2Visual }) {
  const shell = "flex flex-col gap-3 rounded-2xl border border-trama-line bg-white p-4 shadow-[0_6px_20px_rgba(23,42,77,0.06)]";
  if (visual === "oggi") {
    const d = ONBOARDING_V2_DEMO.oggi;
    return (
      <section className={shell}>
        <div className="flex items-baseline justify-between">
          <span className="font-poppins text-[17px] font-semibold text-ink">{d.heading}</span>
          <span className="text-[12.5px] text-ink-3">{d.date}</span>
        </div>
        {d.items.map((it) => (
          <div key={it.name} className="flex items-center gap-3">
            <span className="w-11 text-[13px] font-bold tabular-nums text-trama-primary">{it.time}</span>
            <span className="h-9 w-1 rounded-sm" style={{ background: it.tone }} />
            <span className="flex min-w-0 flex-col">
              <span className="text-[14.5px] font-semibold text-ink">{it.name}</span>
              <span className="text-[12.5px] text-ink-3">{it.meta}</span>
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 border-t border-[#F0F2F5] pt-3 text-[13px] text-ink-2">
          <i className="ti ti-check text-[17px] text-[#1F9A72]" />
          {d.items[1].who}
        </div>
      </section>
    );
  }
  if (visual === "fuori") {
    const d = ONBOARDING_V2_DEMO.fuori;
    return (
      <section className={shell}>
        <span className="font-poppins text-[17px] font-semibold text-ink">{d.heading}</span>
        <div className="flex flex-col">
          {d.fields.map((f, i) => (
            <div key={f.label} className={`flex items-center justify-between py-2 text-[13.5px] ${i > 0 ? "border-t border-[#F0F2F5]" : ""}`}>
              <span className="text-ink-3">{f.label}</span>
              <span className="font-semibold text-ink">{f.value}</span>
            </div>
          ))}
        </div>
        <span className="flex min-h-[40px] items-center justify-center rounded-[12px] bg-trama-primary text-[13.5px] font-bold text-white">{d.cta}</span>
      </section>
    );
  }
  const d = ONBOARDING_V2_DEMO.chi;
  return (
    <section className={shell}>
      <div className="flex items-baseline justify-between">
        <span className="font-poppins text-[17px] font-semibold text-ink">{d.heading}</span>
        <span className="text-[12.5px] text-ink-3">chi accompagna</span>
      </div>
      <div className="grid grid-cols-[64px_1fr_1fr] gap-2 text-[12px] font-semibold text-ink-3">
        <span />
        <span>Porta</span>
        <span>Riprende</span>
      </div>
      {d.rows.map((r, i) => (
        <div key={r.kid} className="grid grid-cols-[64px_1fr_1fr] items-center gap-2">
          <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${i === 0 ? "bg-[#ECE8F8] text-[#4A3F9E]" : "bg-[#FFF0E6] text-[#8A3B12]"}`}>
              {r.kid[0]}
            </span>
            {r.kid}
          </span>
          <span className="rounded-[10px] bg-[#E6F6F0] px-2.5 py-2 text-[13px] font-semibold text-[#146B4F]">{r.porta}</span>
          {r.riprende ? (
            <span className="rounded-[10px] bg-[#E6F6F0] px-2.5 py-2 text-[13px] font-semibold text-[#146B4F]">{r.riprende}</span>
          ) : (
            <span className="rounded-[10px] border-[1.5px] border-dashed border-[#F6B84B] bg-[#FFF8EB] px-2.5 py-[7px] text-[13px] font-bold text-[#7A4500]">Chi riprende?</span>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2 rounded-[12px] bg-[#FFF8EB] px-3 py-2.5 text-[13px] text-[#5C3600]">
        <i className="ti ti-alert-circle text-[17px] text-[#9A5A00]" />
        Manca chi riprende {d.rows[0].kid} alle 18:00
      </div>
    </section>
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
}: {
  kids: OnboardingV2Kid[];
  step: number;
  totalSteps: number;
  onBack: () => void;
  onKidAdded: (kid: OnboardingV2Kid) => void;
  onContinue: () => void;
  onLater: () => void;
}) {
  const [formOpen, setFormOpen] = useState(kids.length === 0);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (!name.trim()) return setError("Scrivi il nome.");
    if (!birthDate) return setError("Inserisci la data di nascita.");
    if (declarationRequired && !declarationAccepted) return setError("Conferma la dichiarazione per continuare.");
    setSaving(true);
    try {
      const res = await addKidAction(name, birthDate, undefined, interests, declarationAccepted);
      if (res.error || !res.kid) {
        setError(res.error || "Non siamo riusciti a salvare. Riprova.");
        return;
      }
      onKidAdded({ id: res.kid.id, name: res.kid.name, age: ageFromIso(birthDate) });
      setName("");
      setBirthDate("");
      setInterests([]);
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
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className={FIELD} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
            Data di nascita
            <input type="date" value={birthDate} max={today} onChange={(e) => setBirthDate(e.target.value)} className={FIELD} />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-semibold text-ink-2">
              Cosa {name.trim() ? `piace a ${name.trim()}` : "gli piace"}? <span className="font-normal text-ink-3">(facoltativo)</span>
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
                    className={`min-h-[40px] rounded-full border px-3.5 text-[13px] font-semibold ${
                      on ? "border-trama-primary bg-trama-primary text-white" : "border-[#E3E6EC] bg-white text-ink"
                    }`}
                  >
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
              <span>
                Dichiaro di essere titolare della responsabilità genitoriale su {name.trim() || "questo bambino"} e autorizzo il
                trattamento dei suoi dati per l&apos;uso del servizio.
              </span>
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
