"use client";

// TRAMA — SETTIMANA TIPO, FASE A (21/10/2026, release "settimana-tipo").
// "La tua famiglia" → "Orario della scuola": per ogni figlio entrata, uscita
// e giorni, una volta sola. Si salva come impegno ricorrente speciale
// (external_planner_items con source_metadata.role = "school" e
// recurrence_rule — lib/planner/recurrence.ts), nessuna tabella nuova. In
// agenda è una riga discreta e sparisce nei giorni di chiusura e in vacanza.
// Iniziativa: claude/INIZIATIVA_planner_routine_settimanale.md.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import {
  createExternalPlannerItemAction,
  deleteExternalPlannerItemAction,
  updateExternalPlannerItemAction,
} from "@/app/actions/external-planner-items";
import { mondayOfIso, recurrenceLabel, schoolYearRange, WEEKDAY_LABELS_IT, type WeeklyRecurrence } from "@/lib/planner/recurrence";
import type { ExternalPlannerItemInput } from "@/lib/planner/external-planner-items-core";

export interface SchoolHoursItem {
  id: string;
  kidIds: string[];
  startTime: string | null;
  endTime: string | null;
  recurrence: WeeklyRecurrence | null;
}

const CARD = "rounded-2xl border border-trama-line bg-white";
const INPUT =
  "min-h-[48px] w-full rounded-[12px] border border-trama-line bg-white px-3.5 text-[16px] text-ink outline-none focus:border-trama-primary";

function hhmm(t: string | null): string {
  return t ? t.slice(0, 5) : "";
}

export default function SchoolHoursBlock({
  kids,
  items,
  todayIso,
}: {
  kids: { id: string; name: string }[];
  items: SchoolHoursItem[];
  todayIso: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  if (kids.length === 0) return null;
  return (
    <section aria-labelledby="scuola-h" className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <h2 id="scuola-h" className="font-poppins text-[18px] font-semibold text-ink">
          Orario della scuola
        </h2>
        <p className="text-[13.5px] leading-snug text-ink-2">
          Entrata e uscita, una volta sola: nel Planner la scuola è una riga discreta e non compare nei giorni di chiusura.
        </p>
      </div>
      <ul className={`${CARD} divide-y divide-[#F0F2F5]`}>
        {kids.map((kid) => {
          const item = items.find((i) => i.kidIds.includes(kid.id)) ?? null;
          return (
            <li key={kid.id}>
              {editing === kid.id ? (
                <SchoolHoursForm kid={kid} item={item} todayIso={todayIso} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex min-h-[60px] items-center gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] font-semibold text-ink">{kid.name}</span>
                    <span className="text-[13px] text-ink-2">
                      {item
                        ? `${(recurrenceLabel(item.recurrence) ?? "").replace(/^./, (c) => c.toUpperCase())} · ${hhmm(item.startTime)}–${hhmm(item.endTime)}`
                        : "Non ancora impostato"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditing(kid.id)}
                    className="min-h-[44px] px-2 text-[13.5px] font-semibold text-trama-accent-ink"
                  >
                    {item ? "Modifica" : "Imposta"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SchoolHoursForm({
  kid,
  item,
  todayIso,
  onDone,
}: {
  kid: { id: string; name: string };
  item: SchoolHoursItem | null;
  todayIso: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const showToast = useNextgenToast();
  const [entry, setEntry] = useState(hhmm(item?.startTime ?? null) || "08:30");
  const [exit, setExit] = useState(hhmm(item?.endTime ?? null) || "16:30");
  const [weekdays, setWeekdays] = useState<number[]>(item?.recurrence?.weekdays ?? [1, 2, 3, 4, 5]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (d: number) => setWeekdays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b)));

  async function save() {
    setError(null);
    if (weekdays.length === 0) return setError("Scegli almeno un giorno.");
    if (!entry || !exit || exit <= entry) return setError("L'uscita deve essere dopo l'entrata.");
    setBusy(true);
    const year = schoolYearRange(todayIso);
    const input: ExternalPlannerItemInput = {
      kind: "commitment",
      title: "Scuola",
      startDate: year.startDate,
      endDate: year.endDate,
      allDay: false,
      startTime: entry,
      endTime: exit,
      location: null,
      notes: null,
      externalUrl: null,
      kidIds: [kid.id],
      recurrence: { freq: "weekly", weekdays, interval: 1, anchor: mondayOfIso(year.startDate) },
      isSchool: true,
    };
    const res = item ? await updateExternalPlannerItemAction(item.id, input) : await createExternalPlannerItemAction(input);
    setBusy(false);
    if (res.error) return setError(res.error);
    showToast(`Orario della scuola di ${kid.name} salvato`);
    onDone();
    router.refresh();
  }

  async function remove() {
    if (!item) return onDone();
    setBusy(true);
    const res = await deleteExternalPlannerItemAction(item.id);
    setBusy(false);
    if (res.error) return setError(res.error);
    showToast(`Orario della scuola di ${kid.name} tolto`);
    onDone();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3.5 px-4 py-4" data-testid="school-hours-form">
      <span className="text-[15px] font-semibold text-ink">{kid.name}</span>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-ink-2">Entrata</span>
          <input type="time" value={entry} onChange={(e) => setEntry(e.target.value)} className={INPUT} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] text-ink-2">Uscita</span>
          <input type="time" value={exit} onChange={(e) => setExit(e.target.value)} className={INPUT} />
        </label>
      </div>
      <div className="flex justify-between gap-1" role="group" aria-label="Giorni di scuola">
        {[1, 2, 3, 4, 5, 6].map((d) => {
          const on = weekdays.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={WEEKDAY_LABELS_IT[d].long}
              onClick={() => toggle(d)}
              className={`flex h-11 w-11 items-center justify-center rounded-full border text-[14px] font-semibold ${
                on ? "border-trama-primary bg-trama-primary text-white" : "border-[#E3E6EC] bg-white text-ink"
              }`}
            >
              {WEEKDAY_LABELS_IT[d].letter}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-[13.5px] font-medium text-[#B3261E]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="min-h-[44px] flex-1 rounded-[12px] border border-[#D9DDE5] bg-white text-[14px] font-semibold text-trama-primary disabled:opacity-60"
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="min-h-[44px] flex-[2] rounded-[12px] bg-trama-primary text-[14px] font-semibold text-white active:bg-trama-primary-press disabled:opacity-60"
        >
          {busy ? "Salvo…" : "Salva"}
        </button>
      </div>
      {item && (
        <button type="button" onClick={remove} disabled={busy} className="min-h-[40px] self-start text-[13px] font-semibold text-ink-3">
          Togli l&apos;orario della scuola
        </button>
      )}
    </div>
  );
}
