"use client";

// TRAMA — PORTALE CENTRI V2 (29/10/2026). Fabrizio: "le segnalazioni facciamole
// come lato genitori". Come nella Home famiglie (HomeDashboardV2Client, card
// "Dicci cosa ne pensi"): niente pulsante flottante, una riga che apre lo
// stesso pannello montato una volta sola nel guscio (BetaFeedbackButton con
// partnerV2), tramite l'evento di lib/nextgen/feedback-open.ts.
import { openBetaFeedback, type FeedbackOpenSource } from "@/lib/nextgen/feedback-open";

export default function PartnerFeedbackCard({ source }: { source: Extract<FeedbackOpenSource, "centro" | "oggi"> }) {
  return (
    <button
      type="button"
      onClick={() => openBetaFeedback(source)}
      data-testid="partner-feedback-open"
      className="flex min-h-[64px] w-full items-center gap-3 rounded-[18px] border border-partner-line bg-white px-4 py-3 text-left transition-colors hover:bg-partner-page active:bg-partner-soft"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#FBF1DA] text-partner-accent-ink">
        <i className="ti ti-message-heart text-[20px]" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-[15px] font-semibold text-ink">Dicci cosa ne pensi</span>
        <span className="text-[12.5px] leading-snug text-ink-2">
          Il portale è in prova: un problema, un&apos;idea o una cosa che manca ci aiutano a migliorarlo.
        </span>
      </span>
      <i className="ti ti-chevron-right flex-shrink-0 text-[18px] text-ink-2" aria-hidden="true" />
    </button>
  );
}
