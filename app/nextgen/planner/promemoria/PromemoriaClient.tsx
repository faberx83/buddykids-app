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
    persist({ active: next });
  }

  // 20/10/2026 — PROMEMORIA V2 (Fabrizio: "layout vecchio"). Stesse
  // impostazioni e stesso salvataggio; aspetto delle Impostazioni V2:
  // interruttore blu notte, campi da 48, scelte a pillola, nota onesta sul
  // limite del piano in un riquadro neutro. Tolte le due icone decorative
  // "in arrivo" (Calendar, Maps) e il pannello "Partenza" a scomparsa: con
  // il promemoria attivo le scelte sono sempre visibili.
  const pill = (on: boolean) =>
    `min-h-[44px] rounded-full border px-4 text-[14px] font-semibold disabled:opacity-60 ${
      on ? "border-trama-primary bg-trama-primary text-white" : "border-[#E3E6EC] bg-white text-ink"
    }`;

  return (
    <div className="flex flex-col pb-10">
      <PageHeader title="Promemoria" backHref="/nextgen/profile" showBrandIcon />

      <div className="flex flex-col gap-6 px-5 pt-3">
        <p className="text-[14px] leading-snug text-ink-2">
          Un avviso sul telefono nei giorni in cui hai un&apos;attività prenotata, all&apos;ora in cui devi partire.
        </p>

        <div className="rounded-2xl border border-trama-line bg-white">
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={saving}
            className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left disabled:opacity-60"
            aria-pressed={active}
          >
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold text-ink">Promemoria attivo</span>
              <span className="text-[13px] text-ink-2">{active ? "Ti avvisiamo prima di partire" : "Spento"}</span>
            </span>
            <span aria-hidden="true" className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${active ? "bg-trama-primary" : "bg-[#D6DAE3]"}`}>
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${active ? "left-[22px]" : "left-0.5"}`} />
            </span>
          </button>

          {active && (
            <div className="flex flex-col gap-5 border-t border-[#F0F2F5] px-4 py-4">
              <div>
                <label htmlFor="promemoria-ora" className="mb-1.5 block text-[13.5px] font-semibold text-ink">
                  A che ora devi partire?
                </label>
                <input
                  id="promemoria-ora"
                  type="time"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  onBlur={() => persist({ targetTime })}
                  disabled={saving}
                  className="min-h-[48px] w-full rounded-[12px] border border-trama-line bg-white px-3.5 text-[16px] font-semibold text-ink outline-none focus:border-trama-primary disabled:opacity-60"
                />
              </div>

              <div>
                <span className="mb-1.5 block text-[13.5px] font-semibold text-ink">Avvisami</span>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Avvisami">
                  {ALARM_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={alarmMinutes === o.value}
                      disabled={saving}
                      onClick={() => {
                        setAlarmMinutes(o.value);
                        persist({ alarmMinutes: o.value });
                      }}
                      className={pill(alarmMinutes === o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {availableAddresses.length > 0 ? (
                <div>
                  <span className="mb-1.5 block text-[13.5px] font-semibold text-ink">Da dove parti?</span>
                  <div className="flex flex-wrap gap-2">
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
                          className={pill(isSelected)}
                        >
                          {originLabel(a)}
                        </button>
                      );
                    })}
                  </div>
                  {selectedOrigin && <p className="mt-1.5 truncate text-[13px] text-ink-2">{selectedOrigin.address}</p>}
                </div>
              ) : (
                <p className="text-[14px] leading-snug text-ink-2">
                  Nessun indirizzo salvato.{" "}
                  <Link href="/nextgen/planner/indirizzi" className="font-semibold text-trama-accent-ink">
                    Aggiungine uno
                  </Link>{" "}
                  per scegliere da dove parti.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-trama-line bg-white px-4 py-3.5">
          <i className="ti ti-info-circle mt-0.5 text-[18px] text-ink-3" aria-hidden="true" />
          <div className="flex flex-col gap-1.5 text-[13.5px] leading-snug text-ink-2">
            <p>
              Servono le notifiche push attive:{" "}
              <Link href="/nextgen/profile/impostazioni/preferenze" className="font-semibold text-trama-accent-ink">
                Profilo → Preferenze
              </Link>
              .
            </p>
            <p>
              <span className="sr-only">Funziona in parte: </span>
              Per ora il controllo gira una volta al giorno, verso le 16-17: se parti a un orario lontano da quella fascia il
              promemoria potrebbe non arrivare.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
