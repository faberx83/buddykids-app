"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { DemoBadge } from "@/components/StatusBadge";

// SPRINT CORRETTIVO (Fabrizio, screenshot "13. PROMEMORIA E AVVISI") —
// anteprima dell'impostazione "avvisami prima di partire" (promemoria di
// spostamento legato a calendario/mappa, con allarme e ripetizione
// configurabili). ANTEPRIMA: nessuna notifica push reale, nessun salvataggio
// su Supabase — solo stato locale, per far vedere la direzione della
// funzione prima di costruire l'integrazione vera (notifiche push +
// geocodifica reale degli indirizzi, oggi ancora stubbata anche in
// PlannerMapView). Non va confuso con i Promemoria testuali già reali nel
// Planner (lib/nextgen/reminders.ts): quelli restano invariati, sono
// alert basati su dati veri (finestra di cancellazione, budget, ecc.),
// senza impostazioni utente. Questa pagina è la futura UI di preferenze per
// UN tipo diverso di promemoria (spostamento/partenza), non ancora esistito.
const ALARM_OPTIONS = [
  { value: 15, label: "15 min prima" },
  { value: 30, label: "30 min prima" },
  { value: 60, label: "1 ora prima" },
];

const REPEAT_OPTIONS = [
  { value: "sempre", label: "Ogni volta che succede" },
  { value: "chiedimi", label: "Chiedimi ogni volta" },
  { value: "mai", label: "Mai (disattiva)" },
];

export default function PromemoriaClient() {
  const router = useRouter();
  const [active, setActive] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [alarmMinutes, setAlarmMinutes] = useState(30);
  const [repeat, setRepeat] = useState("sempre");

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Promemoria" onBack={() => router.push("/nextgen/profile")} showBrandIcon />

      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex items-center gap-2">
          <DemoBadge label="Anteprima" />
          <p className="text-[11.5px] text-ink-2">
            Le impostazioni qui sotto non vengono ancora salvate: arriveranno con le notifiche push in una prossima
            release.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4">
          <button
            type="button"
            onClick={() => setActive((v) => !v)}
            className="flex w-full items-center justify-between"
            aria-pressed={active}
          >
            <span className="text-[14px] font-bold text-ink">Promemoria attivo</span>
            <span
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${active ? "bg-green" : "bg-[#E0E3E9]"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${active ? "translate-x-[22px]" : "translate-x-0.5"}`}
              />
            </span>
          </button>

          {active && (
            <>
              <p className="mt-3 text-[12.5px] text-ink-2">
                Ti avviseremo quando è ora di partire per la prossima attività in calendario, in base al tragitto
                stimato.
              </p>

              <div className="mt-3 border-t border-[#F0F2F5] pt-3">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="flex w-full items-center justify-between text-[13px] font-bold text-green"
                >
                  Partenza consigliata
                  <i className={`ti ${expanded ? "ti-chevron-up" : "ti-chevron-down"} text-[16px]`} />
                </button>

                {expanded && (
                  <div className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-bg p-3">
                    <i className="ti ti-clock-hour-4 text-[22px] text-trama-violet" />
                    <div>
                      <div className="text-[15px] font-bold text-ink">Esempio: 16:00</div>
                      <div className="text-[11px] text-ink-2">Calcolata sul tragitto stimato prima di partire</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[#F0F2F5] pt-3 text-[13px]">
                <span className="font-semibold text-ink">Allarme</span>
                <select
                  value={alarmMinutes}
                  onChange={(e) => setAlarmMinutes(Number(e.target.value))}
                  className="rounded-lg border border-[#E8EBF0] bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-ink"
                >
                  {ALARM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[13px]">
                <span className="font-semibold text-ink">Ripeti</span>
                <select
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  className="rounded-lg border border-[#E8EBF0] bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-ink"
                >
                  {REPEAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 flex items-center gap-2.5 border-t border-[#F0F2F5] pt-3">
                <p className="flex-1 text-[11px] text-ink-2">
                  Riceverai notifiche su spostamenti, eventi e attività nel calendario.
                </p>
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-bg text-ink-3"
                  title="Integrazione Google Calendar — in arrivo"
                >
                  <i className="ti ti-calendar-event text-[16px]" />
                </span>
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-bg text-ink-3"
                  title="Integrazione Maps — in arrivo"
                >
                  <i className="ti ti-map-2 text-[16px]" />
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
