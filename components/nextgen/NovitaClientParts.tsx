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

  // 20/10/2026 — V2: pulsanti con testo ("Sì" / "No") invece delle sole
  // icone, selezione in blu notte come le altre scelte dell'app.
  const base =
    "flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border px-4 text-[14px] font-semibold transition-colors disabled:opacity-60";
  const on = "border-trama-primary bg-trama-primary text-white";
  const off = "border-[#E3E6EC] bg-white text-ink";

  return (
    <div className="mt-3 border-t border-[#F0F2F5] pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[13.5px] font-semibold text-ink">Ti sarebbe utile?</span>
        <button
          type="button"
          aria-pressed={vote === 1}
          aria-label="Sì, mi sarebbe utile"
          disabled={saving}
          onClick={() => handle(1)}
          className={`${base} ${vote === 1 ? on : off}`}
        >
          <i className="ti ti-thumb-up text-[16px]" aria-hidden="true" />
          Sì
        </button>
        <button
          type="button"
          aria-pressed={vote === -1}
          aria-label="No, non mi servirebbe"
          disabled={saving}
          onClick={() => handle(-1)}
          className={`${base} ${vote === -1 ? on : off}`}
        >
          <i className="ti ti-thumb-down text-[16px]" aria-hidden="true" />
          No
        </button>
      </div>
      <p className="mt-1.5 min-h-[18px] text-[13px] text-ink-2" aria-live="polite">
        {error ? <span className="text-[#B3261E]">{error}</span> : vote !== 0 ? "Grazie, ne terremo conto." : ""}
      </p>
    </div>
  );
}

export function FeedbackInviteCard() {
  // 20/10/2026 — V2: card come le altre, pulsante blu notte a raggio 12.
  return (
    <div className="rounded-2xl border border-trama-line bg-white px-4 py-4">
      <p className="font-poppins text-[16px] font-semibold text-ink">Hai un&apos;idea per TRAMA?</p>
      <p className="mt-1 text-[14px] leading-snug text-ink-2">Raccontaci cosa renderebbe TRAMA più utile alla tua famiglia, o cosa ti manca.</p>
      <button
        type="button"
        onClick={() => openBetaFeedback("novita")}
        className="mt-3 min-h-[48px] rounded-[12px] bg-trama-primary px-5 text-[15px] font-semibold text-white active:bg-trama-primary-press"
      >
        Scrivici
      </button>
    </div>
  );
}
