"use client";

import { useState } from "react";
import { buildIcsDataUrl } from "@/lib/ics";
import { buildShareCardPng } from "@/lib/share-card";

export default function BookingSuccessActions({
  activityName,
  kidNames,
  weeksLabel,
  startDate,
  endDate,
}: {
  activityName: string;
  kidNames: string;
  weeksLabel: string;
  startDate: string | null;
  endDate: string | null;
}) {
  const [shareState, setShareState] = useState<"idle" | "working" | "done">("idle");

  // Condividere un semplice testo era poco leggibile e poco "presentabile"
  // su WhatsApp — ora generiamo un'immagine riepilogo (cartolina) e la
  // condividiamo come file, cosi chi la riceve vede subito attività,
  // bambino e settimane senza dover leggere un messaggio. Se il browser non
  // supporta la condivisione di file (desktop, alcuni Android datati),
  // scarichiamo l'immagine cosi si può comunque allegare a mano.
  async function share() {
    setShareState("working");
    try {
      const blob = await buildShareCardPng({ activityName, kidNames, weeksLabel });
      if (!blob) throw new Error("canvas non disponibile");

      const file = new File([blob], "trama-prenotazione.png", { type: "image/png" });
      const shareData = {
        title: "Prenotazione TRAMA",
        text: `${activityName} — ${kidNames} — ${weeksLabel}`,
        files: [file],
      };

      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        await navigator.share(shareData);
        setShareState("idle");
        return;
      }

      // Niente condivisione file: scarichiamo la cartolina cosi l'utente può
      // allegarla manualmente in chat.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "trama-prenotazione.png";
      a.click();
      URL.revokeObjectURL(url);
      setShareState("done");
      setTimeout(() => setShareState("idle"), 2500);
    } catch {
      // utente ha annullato la condivisione, o generazione immagine fallita:
      // proviamo un ultimo fallback testuale via clipboard.
      try {
        await navigator.clipboard.writeText(
          `Ho prenotato ${activityName} per ${kidNames} — ${weeksLabel} 🎉 (via TRAMA)`
        );
        setShareState("done");
        setTimeout(() => setShareState("idle"), 2500);
      } catch {
        setShareState("idle");
      }
    }
  }

  const icsHref = startDate && endDate
    ? buildIcsDataUrl({
        title: `${activityName} — TRAMA`,
        description: `${kidNames} — ${weeksLabel}`,
        startDate,
        endDate,
      })
    : null;

  return (
    <div className="mb-2.5 grid grid-cols-2 gap-2.5">
      <button
        type="button"
        onClick={share}
        disabled={shareState === "working"}
        className="flex items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[#E8EBF0] bg-white py-3 text-xs font-bold text-ink transition-colors hover:border-sky disabled:opacity-60"
      >
        <i className={`ti ${shareState === "done" ? "ti-check" : "ti-share"} text-sm`} />
        {shareState === "working" ? "Preparo…" : shareState === "done" ? "Fatto!" : "Condividi"}
      </button>
      {icsHref ? (
        <a
          href={icsHref}
          download="trama-prenotazione.ics"
          className="flex items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[#E8EBF0] bg-white py-3 text-xs font-bold text-ink transition-colors hover:border-sky"
        >
          <i className="ti ti-calendar-plus text-sm" />
          Aggiungi al calendario
        </a>
      ) : (
        <button
          type="button"
          disabled
          className="flex items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[#E8EBF0] bg-white py-3 text-xs font-bold text-ink-3 opacity-60"
        >
          <i className="ti ti-calendar-plus text-sm" />
          Aggiungi al calendario
        </button>
      )}
    </div>
  );
}
