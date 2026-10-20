"use client";

// TRAMA — pagina di benvenuto (20/10/2026). Telefono con le stesse schermate
// demo del carosello di primo ingresso (PhoneScreen di OnboardingCarousel,
// dati fittizi): REUSE, nessuna schermata ridisegnata o finta in più.
// Leggero galleggiamento solo con movimento consentito.

import { PhoneScreen } from "@/components/nextgen/OnboardingCarousel";
import type { OnboardingSlideVisual } from "@/lib/nextgen/onboarding-slides";

export default function LandingPhone({
  visual,
  tilt = 0,
  float = false,
  className = "",
}: {
  visual: OnboardingSlideVisual;
  tilt?: number;
  float?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={`[perspective:1100px] ${float ? "motion-safe:animate-[trama-onb-float_2.8s_ease-in-out_infinite]" : ""} ${className}`}>
      <div
        className="relative aspect-[9/18.5] w-[200px] rounded-[34px] bg-[#1B1F2B] p-1.5 shadow-[0_0_0_1px_#2B3142,0_28px_50px_rgba(23,42,77,0.18),0_8px_18px_rgba(23,42,77,0.10)] motion-reduce:!transform-none"
        style={{ transform: `rotateY(${tilt}deg) rotateX(4deg)` }}
      >
        <div className="absolute left-1/2 top-[11px] z-[3] h-4 w-[60px] -translate-x-1/2 rounded-xl bg-[#1B1F2B]" />
        <div className="relative h-full overflow-hidden rounded-[29px] bg-white">
          <div className="absolute inset-0 flex flex-col gap-1.5 px-2.5 pb-2.5 pt-8">
            <div className="absolute left-4 right-4 top-[11px] flex justify-between text-[7.5px] text-ink-3">
              <span>9:41</span>
              <span>●●● ▮</span>
            </div>
            <PhoneScreen visual={visual} />
          </div>
        </div>
      </div>
    </div>
  );
}
