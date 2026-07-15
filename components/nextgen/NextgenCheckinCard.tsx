"use client";

import { useState } from "react";
import { parentCheckinAction } from "@/app/actions/checkin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { CheckinStatus, TodayCheckin } from "@/lib/data/checkin";
import { useNextgenToast } from "./NextgenToastProvider";

// SPRINT CORRETTIVO (NEXTGEN) — "Ripristinare e valorizzare il flusso di
// Check-in... non è una funzione secondaria ma un momento fondamentale"
// (richiesta di Fabrizio). NEXTGEN oggi non mostrava check-in da nessuna
// parte (il flusso esiste solo in LEGACY, components/CheckinPrompt.tsx).
// Riuso totale dei dati/azioni (getTodayCheckinsForParent, parentCheckinAction
// — INVARIATI, stessa tabella attendance_records) — qui cambia solo la
// veste: più cerimoniale, badge "codice" ben visibile, feedback positivo via
// toast al salvataggio invece del solo testo statico sotto i pulsanti.
//
// NOTA DI SCOPE (segnalata esplicitamente, non una scelta silenziosa): un
// vero QR code SCANSIONABILE richiederebbe un lettore lato Gestore che oggi
// non esiste (il Registro presenze è manuale, vedi app/center/registro).
// Il badge sotto è quindi un codice visivo ben in vista (identificativo
// bambino+settimana), pronto a diventare un QR reale il giorno in cui il
// Gestore avrà uno scanner — non una simulazione ingannevole di una
// funzione che non c'è.
const STATUS_SUMMARY: Record<CheckinStatus, { label: string; cls: string; icon: string; toast: string }> = {
  presente: { label: "Presente", cls: "bg-partner text-white", icon: "ti-check", toast: "registrato con successo" },
  in_ritardo: { label: "In ritardo", cls: "bg-orange text-white", icon: "ti-clock", toast: "il centro è stato avvisato" },
  assente: { label: "Assente", cls: "bg-ink text-white", icon: "ti-x", toast: "segnato come assente per oggi" },
};

function checkinCode(item: TodayCheckin): string {
  // Codice leggibile e stabile (non un vero token di sicurezza): prime 4
  // lettere del nome attività + ultime 4 dell'id settimana, ad uso puramente
  // visivo/cerimoniale.
  const a = item.activityName.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "BUDK";
  const w = item.weekId.replace(/-/g, "").slice(-4).toUpperCase();
  return `${a}-${w}`;
}

export default function NextgenCheckinCard({ items }: { items: TodayCheckin[] }) {
  const toast = useNextgenToast();
  const [statuses, setStatuses] = useState<Record<string, CheckinStatus | null>>(
    Object.fromEntries(items.map((i) => [`${i.kidId}:${i.weekId}`, i.status]))
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (items.length === 0) return null;

  async function answer(item: TodayCheckin, status: CheckinStatus) {
    const key = `${item.kidId}:${item.weekId}`;
    const previous = statuses[key] ?? null;
    setStatuses((prev) => ({ ...prev, [key]: status }));

    if (!isSupabaseConfigured) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      toast(`${item.kidName} ${STATUS_SUMMARY[status].toast}`);
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
      toast("Non siamo riusciti a salvare, riprova.", "info");
      return;
    }
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    // Micro-feedback positivo richiesto da Fabrizio: momento cerimoniale, non
    // solo una riga di testo statico sotto i pulsanti.
    toast(`${item.kidName} ${STATUS_SUMMARY[status].toast}`);
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
    <div className="flex flex-col gap-2.5">
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
              className="nextgen-warm-shadow flex items-center gap-2.5 rounded-2xl border border-[#FBE4CE] bg-[#FFF7EE] px-4 py-3 text-left active:scale-[0.99]"
            >
              <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${summary.cls}`}>
                <i className={`ti ${summary.icon} text-xs`} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {item.kidName} · {item.activityName}
              </span>
              <span className="flex-shrink-0 text-[11px] font-bold uppercase tracking-wide text-trama-orange">
                {summary.label}
              </span>
              <i className="ti ti-pencil flex-shrink-0 text-xs text-ink-3" aria-label="Modifica risposta" />
            </button>
          );
        }

        return (
          <div key={key} className="nextgen-warm-shadow overflow-hidden rounded-2xl border border-[#FBE4CE] bg-[#FFF7EE]">
            <div className="flex items-center gap-3 p-4 pb-2.5">
              <div
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-cover bg-center text-2xl"
                style={
                  item.coverImageUrl
                    ? { backgroundImage: `url(${item.coverImageUrl})` }
                    : { background: item.activityImgGradient }
                }
              >
                {!item.coverImageUrl && item.activityEmoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <i className="ti ti-map-pin-check text-sm text-trama-orange" />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-trama-orange">
                    Oggi · {item.weekLabel}
                  </span>
                </div>
                <span className="block truncate text-base font-bold text-ink">
                  {item.kidName} è arrivato/a a {item.activityName}?
                </span>
              </div>
            </div>

            {/* Badge "codice" ben visibile — momento cerimoniale del check-in,
                non solo due bottoni. Vedi nota di scope sopra: non è ancora
                scansionabile da nessuno, è un identificativo visivo pronto
                a diventarlo. */}
            <div className="mx-4 mb-3 flex items-center gap-2.5 rounded-xl border border-dashed border-[#F0C9A0] bg-white/70 px-3 py-2.5">
              <i className="ti ti-qrcode text-xl text-trama-orange" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wide text-ink-3">Codice check-in</div>
                <div className="font-mono text-sm font-bold tracking-wider text-ink">{checkinCode(item)}</div>
              </div>
            </div>

            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => answer(item, "presente")}
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors active:scale-95 disabled:opacity-60 ${
                  status === "presente" ? "bg-partner text-white" : "border border-[#F0C9A0] bg-white text-ink-2"
                }`}
              >
                Sì
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => answer(item, "in_ritardo")}
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors active:scale-95 disabled:opacity-60 ${
                  status === "in_ritardo" ? "bg-orange text-white" : "border border-[#F0C9A0] bg-white text-ink-2"
                }`}
              >
                In ritardo
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => answer(item, "assente")}
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors active:scale-95 disabled:opacity-60 ${
                  status === "assente" ? "bg-ink text-white" : "border border-[#F0C9A0] bg-white text-ink-2"
                }`}
              >
                No
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
