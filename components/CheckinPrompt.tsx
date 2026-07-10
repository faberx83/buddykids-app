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
// Etichette compatte per il riepilogo dopo la risposta (card ridotta).
const STATUS_SUMMARY: Record<CheckinStatus, { label: string; cls: string; icon: string }> = {
  presente: { label: "Presente", cls: "bg-partner text-white", icon: "ti-check" },
  in_ritardo: { label: "In ritardo", cls: "bg-orange text-white", icon: "ti-clock" },
  assente: { label: "Assente", cls: "bg-ink text-white", icon: "ti-x" },
};

export default function CheckinPrompt({ items }: { items: TodayCheckin[] }) {
  const [statuses, setStatuses] = useState<Record<string, CheckinStatus | null>>(
    Object.fromEntries(items.map((i) => [`${i.kidId}:${i.weekId}`, i.status]))
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);
  // Segnalazione di Fabrizio: dopo aver risposto, la card deve ridursi a un
  // riepilogo compatto (info di massima) invece di restare grande — ma deve
  // rimanere gestibile: un tocco sul riepilogo la riespande per correggere
  // un errore di selezione. Un set esplicito di chiavi "espanse" tiene
  // traccia di quali card, pur avendo già una risposta, l'utente ha
  // riaperto per modificarla.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (items.length === 0) return null;

  async function answer(item: TodayCheckin, status: CheckinStatus) {
    const key = `${item.kidId}:${item.weekId}`;
    const previous = statuses[key] ?? null;
    setStatuses((prev) => ({ ...prev, [key]: status }));

    if (!isSupabaseConfigured) {
      // demo: solo stato locale — ridurre comunque la card dopo la risposta
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return;
    }

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
      return;
    }
    // Risposta salvata con successo: richiudiamo la card a riepilogo (anche
    // se era stata riaperta per correggere una risposta precedente).
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="mx-5 mt-4 flex flex-col gap-2.5">
      {items.map((item) => {
        const key = `${item.kidId}:${item.weekId}`;
        const status = statuses[key];
        const saving = savingKey === key;
        const isCollapsed = !!status && !expanded.has(key);

        if (isCollapsed) {
          const summary = STATUS_SUMMARY[status];
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleExpanded(key)}
              className="flex items-center gap-2.5 rounded-xl border border-[#E3F0FB] bg-sky-light px-3.5 py-2.5 text-left"
            >
              <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${summary.cls}`}>
                <i className={`ti ${summary.icon} text-xs`} />
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
                {item.kidName} · {item.activityName}
              </span>
              <span className="flex-shrink-0 text-[10.5px] font-bold uppercase tracking-wide text-sky">
                {summary.label}
              </span>
              <i className="ti ti-pencil flex-shrink-0 text-xs text-ink-3" aria-label="Modifica risposta" />
            </button>
          );
        }

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
