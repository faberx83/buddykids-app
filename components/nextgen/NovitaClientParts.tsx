"use client";

// TRAMA — FAMILY-FIRST BETA PASS (07/10/2026). Parti client della pagina
// Novità (app/nextgen/novita/page.tsx):
//  - NovitaSeenMarker: all'apertura segna come lette le voci visibili non
//    ancora lette, così il badge della campanella si spegne;
//  - AnnouncementVoteButtons: 👍/👎 sulle voci "In arrivo";
//  - FeedbackInviteCard: "Hai un'idea per TRAMA?" in fondo alla pagina, apre
//    il pannello feedback esistente (TRAMA → utente sopra, utente → TRAMA qui).

import { useEffect, useRef, useState } from "react";
import { markAnnouncementsSeenFromNovitaAction, setAnnouncementVoteAction } from "@/app/actions/announcements";
import { recordBetaSignalAction } from "@/app/actions/beta-signals";
import { openBetaFeedback } from "@/lib/nextgen/feedback-open";
import { nextVote, type AnnouncementVote } from "@/lib/announcements/votes";

export function NovitaSeenMarker({ unseenIds }: { unseenIds: string[] }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void recordBetaSignalAction("novita_opened");
    if (unseenIds.length > 0) void markAnnouncementsSeenFromNovitaAction(unseenIds);
  }, [unseenIds]);
  return null;
}

export function AnnouncementVoteButtons({
  announcementId,
  initialVote,
}: {
  announcementId: string;
  initialVote: AnnouncementVote | 0;
}) {
  const [vote, setVote] = useState<AnnouncementVote | 0>(initialVote);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(tapped: AnnouncementVote) {
    if (saving) return;
    const previous = vote;
    const next = nextVote(previous, tapped);
    setVote(next); // aggiornamento ottimistico
    setSaving(true);
    setError(null);
    const result = await setAnnouncementVoteAction(announcementId, next);
    setSaving(false);
    if (result.error) {
      setVote(previous);
      setError(result.error);
    }
  }

  const base =
    "flex min-h-[40px] min-w-[52px] items-center justify-center gap-1 rounded-full border px-3 text-[13px] font-semibold transition-colors active:scale-95 disabled:opacity-60";

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <span className="mr-1 text-[12px] font-medium text-ink-2">Ti sarebbe utile?</span>
        <button
          type="button"
          aria-pressed={vote === 1}
          aria-label="Sì, mi sarebbe utile"
          disabled={saving}
          onClick={() => handle(1)}
          className={`${base} ${vote === 1 ? "border-trama-green bg-trama-green/10 text-trama-green" : "border-[#E8EBF0] text-ink-2"}`}
        >
          <i className="ti ti-thumb-up text-[16px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-pressed={vote === -1}
          aria-label="No, non mi servirebbe"
          disabled={saving}
          onClick={() => handle(-1)}
          className={`${base} ${vote === -1 ? "border-trama-orange bg-trama-orange/10 text-trama-orange" : "border-[#E8EBF0] text-ink-2"}`}
        >
          <i className="ti ti-thumb-down text-[16px]" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-1.5 min-h-[16px] text-[11.5px] text-ink-3" aria-live="polite">
        {error ? <span className="text-trama-orange">{error}</span> : vote !== 0 ? "Grazie, ne terremo conto." : ""}
      </p>
    </div>
  );
}

export function FeedbackInviteCard() {
  return (
    <div className="rounded-lg border border-dashed border-trama-violet/40 bg-trama-violet/[0.04] p-4">
      <p className="text-[13.5px] font-bold text-ink">Hai un&apos;idea per TRAMA?</p>
      <p className="mt-1 text-[12.5px] leading-snug text-ink-2">
        Raccontaci cosa renderebbe TRAMA più utile alla tua famiglia, o cosa ti manca.
      </p>
      <button
        type="button"
        onClick={() => openBetaFeedback("novita")}
        className="mt-3 min-h-[44px] rounded-full bg-trama-violet px-5 text-[13.5px] font-bold text-white active:scale-[0.97]"
      >
        Scrivici
      </button>
    </div>
  );
}
