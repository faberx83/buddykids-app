"use client";

import { useState } from "react";
import Link from "next/link";
import { parentCheckinAction } from "@/app/actions/checkin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { CheckinStatus, TodayCheckin } from "@/lib/data/checkin";

// Check-in MVP: card in Home che chiede "[Bambino] è arrivato/a a
// [Attività]?" con 3 risposte, per ogni bambino con una prenotazione attiva
// OGGI (vedi lib/data/checkin.ts). Risposta manuale, nessuna
// geolocalizzazione/notifica push automatica (scope MVP concordato con
// Fabrizio: l'infrastruttura per farlo in automatico in background non è
// affidabile su web/iOS senza un investimento dedicato).
export default function CheckinPrompt({ items }: { items: TodayCheckin[] }) {
  const [statuses, setStatuses] = useState<Record<string, CheckinStatus | null>>(
    Object.fromEntries(items.map((i) => [`${i.kidId}:${i.weekId}`, i.status]))
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function answer(item: TodayCheckin, status: CheckinStatus) {
    const key = `${item.kidId}:${item.weekId}`;
    const previous = statuses[key] ?? null;
    setStatuses((prev) => ({ ...prev, [key]: status }));

    if (!isSupabaseConfigured) return; // demo: solo stato locale

    setSavingKey(key);
    const result = await parentCheckinAction({
      activityId: item.activityId,
      weekId: item.weekId,
      kidId: item.kidId,
      date: item.date,
      status,
    });
    setSavingKey(null);
    if (result.error) {
      setStatuses((prev) => ({ ...prev, [key]: previous }));
    }
  }

  return (
    <div className="mx-5 mt-4 flex flex-col gap-2.5">
      {items.map((item) => {
        const key = `${item.kidId}:${item.weekId}`;
        const status = statuses[key];
        const saving = savingKey === key;
        return (
          <div
            key={key}
            // Segnalazione di Fabrizio: il camp della settimana in corso
            // deve risaltare di più in Home, non essere una semplice striscia
            // di testo — ora la card ha la foto/copertina dell'attività, il
            // nome ben visibile e l'etichetta "Questa settimana" in evidenza.
            className="overflow-hidden rounded-xl border border-[#E3F0FB] bg-sky-light"
          >
            <div className="flex items-center gap-3 p-3.5 pb-2.5">
              <Link
                href={`/activity/${item.activitySlug}`}
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cover bg-center text-2xl"
                style={
                  item.coverImageUrl
                    ? { backgroundImage: `url(${item.coverImageUrl})` }
                    : { background: item.activityImgGradient }
                }
              >
                {!item.coverImageUrl && item.activityEmoji}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <i className="ti ti-map-pin-check text-sm text-sky" />
                  <span className="text-[10.5px] font-bold uppercase tracking-wide text-sky">
                    Questa settimana · {item.weekLabel}
                  </span>
                </div>
                {/* Testo della domanda invariato ("è arrivato/a a
                    [Attività]?") per non rompere i test esistenti
                    (TC-151/152) che lo cercano — cambia solo il contenitore
                    intorno (foto, etichetta settimana), non la domanda. */}
                <span className="block truncate text-sm font-bold text-ink">
                  {item.kidName} è arrivato/a a {item.activityName}?
                </span>
              </div>
            </div>
            <div className="flex gap-2 px-3.5 pb-3.5">
              <button
                type="button"
                disabled={saving}
                onClick={() => answer(item, "presente")}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-bold transition-colors disabled:opacity-60 ${
                  status === "presente" ? "bg-partner text-white" : "border border-[#E8EBF0] bg-white text-ink-2"
                }`}
              >
                Sì
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => answer(item, "in_ritardo")}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-bold transition-colors disabled:opacity-60 ${
                  status === "in_ritardo" ? "bg-orange text-white" : "border border-[#E8EBF0] bg-white text-ink-2"
                }`}
              >
                Siamo in ritardo
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => answer(item, "assente")}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-bold transition-colors disabled:opacity-60 ${
                  status === "assente" ? "bg-ink text-white" : "border border-[#E8EBF0] bg-white text-ink-2"
                }`}
              >
                No
              </button>
            </div>
            {status && (
              <p className="px-3.5 pb-3 text-[11px] text-ink-2">
                {status === "presente" && "Segnato come presente. Puoi cambiare risposta in ogni momento."}
                {status === "in_ritardo" && "Il centro è stato avvisato del ritardo."}
                {status === "assente" && "Segnato come assente per oggi."}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
