"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import { ADDRESS_KIND_LABELS, ParentAddress } from "@/lib/nextgen/address-kinds";
import { saveTravelReminderAction, SaveTravelReminderInput } from "@/app/actions/travel-reminders";
import type { TravelReminderSettings } from "@/lib/data/travel-reminders";

// SPRINT CORRETTIVO 3 (Fabrizio 03/09/2026: "possiamo attivare i reminder
// ora che ci sono le notifiche?") — non più solo anteprima. Vedi
// supabase/migration_36_travel_reminders.sql per il contesto completo.
//
// SCOPE RIDOTTO PER LA BETA (confermato con Fabrizio): l'orario di partenza
// è impostato MANUALMENTE dal genitore ("A che ora devi partire?"), non
// calcolato da un tempo di percorrenza reale — servirebbe geocodifica +
// un servizio di instradamento a pagamento, non presente oggi (gli
// indirizzi salvati sono testo libero senza coordinate). Il resto
// dell'esperienza resta uguale all'anteprima: toggle attivo, allarme N
// minuti prima, scelta dell'indirizzo di partenza (usato solo nel testo del
// messaggio push, non nel calcolo).
//
// "Ripeti" (3 opzioni nell'anteprima originale) rimosso: un sistema di push
// non ha un modo di "chiedere conferma ogni volta" prima di inviare (nessun
// passaggio interattivo lato server) — tenerlo come selettore decorativo
// che non fa nulla sarebbe un controllo finto, peggio di non averlo.
// "Mai" è già coperto dal toggle "Promemoria attivo".
const ALARM_OPTIONS = [
  { value: 15, label: "15 min prima" },
  { value: 30, label: "30 min prima" },
  { value: 60, label: "1 ora prima" },
] as const;

export default function PromemoriaClient({
  addresses,
  initial,
}: {
  addresses: ParentAddress[];
  initial: TravelReminderSettings;
}) {
  const router = useRouter();
  const toast = useNextgenToast();
  const [active, setActive] = useState(initial.active);
  const [expanded, setExpanded] = useState(initial.active);
  const [targetTime, setTargetTime] = useState(initial.targetTime);
  const [alarmMinutes, setAlarmMinutes] = useState<number>(initial.alarmMinutes);
  const [saving, setSaving] = useState(false);

  const availableAddresses = useMemo(() => addresses.filter((a) => a.address.trim() !== ""), [addresses]);
  const [originKind, setOriginKind] = useState<string | null>(() => {
    if (initial.originKind && availableAddresses.some((a) => a.kind === initial.originKind)) return initial.originKind;
    const casa = availableAddresses.find((a) => a.kind === "casa");
    return casa?.kind ?? availableAddresses[0]?.kind ?? null;
  });
  const selectedOrigin = availableAddresses.find((a) => a.kind === originKind) ?? null;
  const originLabel = (a: ParentAddress) => a.label || ADDRESS_KIND_LABELS[a.kind];

  // Salvataggio immediato a ogni modifica (stesso pattern del toggle
  // "Visibile in Scopri" in GroupDetailClient.tsx) invece di un pulsante
  // "Salva" separato — l'anteprima precedente non ne aveva uno, restare
  // vicini a quell'esperienza per non introdurre un passaggio in più.
  async function persist(next: Partial<SaveTravelReminderInput>) {
    setSaving(true);
    const payload: SaveTravelReminderInput = {
      active,
      targetTime,
      alarmMinutes: alarmMinutes as 15 | 30 | 60,
      originKind,
      ...next,
    };
    const result = await saveTravelReminderAction(payload);
    setSaving(false);
    if (result.error) {
      toast("Non siamo riusciti a salvare, riprova.", "info");
      return;
    }
    router.refresh();
  }

  function handleToggleActive() {
    const next = !active;
    setActive(next);
    setExpanded(next);
    persist({ active: next });
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* SPRINT CORRETTIVO — Promemoria non è più un link diretto da Profilo:
          vive dietro l'hub "Famiglia e logistica" (vedi
          app/nextgen/profile/famiglia/), "indietro" torna lì invece che
          direttamente al Profilo. */}
      <PageHeader title="Promemoria" onBack={() => router.push("/nextgen/profile/famiglia")} showBrandIcon />

      <div className="flex flex-col gap-3 px-5 py-4">
        {/* SPRINT CORRETTIVO 3 — rimosso il badge "Anteprima": le
            impostazioni sotto sono ora salvate davvero. Nota onesta sul
            requisito di piattaforma (permesso push del browser) invece del
            vecchio avviso "non ancora salvate". */}
        <p className="text-[11.5px] text-ink-2">
          Riceverai una notifica push nei giorni in cui hai un&apos;attività prenotata. Assicurati di aver attivato le
          notifiche in{" "}
          <Link href="/nextgen/profile/impostazioni/preferenze" className="font-semibold text-trama-violet active:bg-black/[0.04]">
            Profilo → Preferenze
          </Link>
          .
        </p>

        <div className="rounded-2xl bg-white p-4">
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={saving}
            className="flex w-full items-center justify-between active:bg-black/[0.04] disabled:opacity-60"
            aria-pressed={active}
          >
            <span className="text-[14px] font-bold text-ink">Promemoria attivo</span>
            {/* Stesso pattern del toggle già corretto qui sotto (vedi
                storico bug "il pallino restava a destra anche a interruttore
                spento" — mancava un'ancora "left" esplicita). */}
            <span
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${active ? "bg-green" : "bg-[#E0E3E9]"}`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${active ? "translate-x-5" : "translate-x-0"}`}
              />
            </span>
          </button>

          {active && (
            <>
              <p className="mt-3 text-[12.5px] text-ink-2">
                Ti avviseremo all&apos;orario che imposti qui sotto, nei giorni in cui hai un&apos;attività prenotata.
              </p>

              <div className="mt-3 border-t border-[#F0F2F5] pt-3">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="flex w-full items-center justify-between text-[13px] font-bold text-green active:bg-black/[0.04]"
                >
                  Partenza
                  <i className={`ti ${expanded ? "ti-chevron-up" : "ti-chevron-down"} text-[16px]`} />
                </button>

                {expanded && (
                  <div className="mt-2.5 flex flex-col gap-2.5">
                    {/* SPRINT CORRETTIVO 3 — sostituito il calcolo finto
                        ("Esempio: 16:00") con un orario REALE impostato dal
                        genitore: vedi nota di scope in cima al file sul
                        perché non calcoliamo un tempo di percorrenza vero
                        in questa fase. */}
                    <div className="flex items-center gap-2.5 rounded-xl bg-bg p-3">
                      <i className="ti ti-clock-hour-4 text-[22px] text-trama-violet" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 text-[11.5px] font-semibold text-ink-2">A che ora devi partire?</div>
                        <input
                          type="time"
                          value={targetTime}
                          onChange={(e) => setTargetTime(e.target.value)}
                          onBlur={() => persist({ targetTime })}
                          disabled={saving}
                          className="w-full rounded-lg border border-[#E8EBF0] bg-white px-2.5 py-1.5 text-[14px] font-bold text-ink outline-none disabled:opacity-60"
                        />
                      </div>
                    </div>

                    {availableAddresses.length > 0 ? (
                      <div>
                        <div className="mb-1.5 text-[11.5px] font-semibold text-ink-2">Da dove parti?</div>
                        <div className="flex flex-wrap gap-1.5">
                          {availableAddresses.map((a) => {
                            const isSelected = originKind === a.kind;
                            return (
                              <button
                                key={a.kind}
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                  setOriginKind(a.kind);
                                  persist({ originKind: a.kind });
                                }}
                                aria-pressed={isSelected}
                                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors active:scale-95 disabled:opacity-60 ${
                                  isSelected
                                    ? "bg-trama-violet text-white"
                                    : "bg-bg text-ink-2 hover:bg-[#EEF0F4]"
                                }`}
                              >
                                {originLabel(a)}
                              </button>
                            );
                          })}
                        </div>
                        {selectedOrigin && (
                          <p className="mt-1.5 truncate text-[11px] text-ink-3">{selectedOrigin.address}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11.5px] text-ink-2">
                        Nessun indirizzo salvato.{" "}
                        <Link href="/nextgen/planner/indirizzi" className="font-semibold text-trama-violet active:bg-black/[0.04]">
                          Aggiungine uno
                        </Link>{" "}
                        per personalizzare l&apos;avviso.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[#F0F2F5] pt-3 text-[13px]">
                <span className="font-semibold text-ink">Allarme</span>
                <select
                  value={alarmMinutes}
                  disabled={saving}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setAlarmMinutes(next);
                    persist({ alarmMinutes: next as 15 | 30 | 60 });
                  }}
                  className="rounded-lg border border-[#E8EBF0] bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-ink disabled:opacity-60"
                >
                  {ALARM_OPTIONS.map((o) => (
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
