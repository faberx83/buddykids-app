"use client";

import { useMemo, useState } from "react";
import type { AttendanceWeekGroup, AttendanceDayStatus, AttendanceStatusValue } from "@/lib/data/attendance";
import { setAttendanceAction } from "@/app/actions/attendance";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type AttendanceStatus = AttendanceStatusValue;
type AttendanceMap = Record<string, AttendanceStatus>; // key: `${kidId}:${date}`
type ParentReportMap = Record<string, boolean>; // key: `${kidId}:${date}` -> checked_in_by === "parent"

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  presente: "Presente",
  in_ritardo: "In ritardo",
  assente: "Assente",
};

const DAY_LABELS_IT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MONTH_LABELS_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

// Segnalazione di Fabrizio: "non si capisce i giorni di che mese siano..
// sulla sinistra bisogna avere un raggruppamento per mese..e deve essere
// leggibile anche nel registro presenze giornaliero sulla destra".
function monthLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${MONTH_LABELS_IT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Elenco dei giorni coperti da una settimana (di solito lun-ven) — duplica
// volutamente la logica di lib/data/attendance.ts#daysInWeek in una versione
// senza dipendenze server-only, per poter girare lato client.
function daysInWeekClient(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${DAY_LABELS_IT[d.getUTCDay()]} ${d.getUTCDate()}`;
}

export default function AttendanceClient({
  weekGroups,
  attendanceByWeek,
}: {
  weekGroups: AttendanceWeekGroup[];
  attendanceByWeek: Record<string, AttendanceDayStatus[]>;
}) {
  // BUG TROVATO+CORRETTO (segnalato da Fabrizio: "faccio il check-in lato
  // genitori ma non si aggiorna lato gestore"): la settimana selezionata di
  // default era semplicemente la prima in ordine alfabetico+data
  // (weekGroups[0]), quasi mai quella che copre OGGI — il gestore si
  // ritrovava quindi a guardare una settimana diversa da quella in cui il
  // genitore aveva appena fatto il check-in, e la presenza sembrava "non
  // registrata" mentre in realtà era semplicemente altrove. Ora si
  // preferisce la prima settimana che copre la data odierna (isCurrentWeek,
  // calcolato in lib/data/attendance.ts), con fallback al comportamento
  // precedente se nessuna attività ha una settimana per oggi.
  const defaultGroup = weekGroups.find((g) => g.isCurrentWeek) ?? weekGroups[0] ?? null;
  const [selectedKey, setSelectedKey] = useState<string | null>(
    defaultGroup ? `${defaultGroup.activityId}:${defaultGroup.weekId}` : null
  );

  const { initialAttendance, initialParentReport } = useMemo(() => {
    const map: AttendanceMap = {};
    const parentMap: ParentReportMap = {};
    for (const records of Object.values(attendanceByWeek)) {
      for (const r of records) {
        map[`${r.kidId}:${r.date}`] = r.status;
        parentMap[`${r.kidId}:${r.date}`] = r.checkedInByParent;
      }
    }
    return { initialAttendance: map, initialParentReport: parentMap };
  }, [attendanceByWeek]);

  const [attendance, setAttendance] = useState<AttendanceMap>(initialAttendance);
  const [parentReport, setParentReport] = useState<ParentReportMap>(initialParentReport);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Raggruppamento per mese in sidebar (segnalazione di Fabrizio): weekGroups
  // arriva ordinato per attività+settimana (vedi lib/data/attendance.ts), non
  // in ordine cronologico — qui si ricostruiscono i "bucket" per mese, in
  // ordine cronologico, mantenendo l'ordine relativo originale all'interno
  // di ciascun mese.
  const monthBuckets = useMemo(() => {
    const buckets = new Map<string, { label: string; items: AttendanceWeekGroup[] }>();
    for (const g of weekGroups) {
      const monthKey = g.startDate.slice(0, 7); // "YYYY-MM", ordinabile come stringa
      if (!buckets.has(monthKey)) buckets.set(monthKey, { label: monthLabel(g.startDate), items: [] });
      buckets.get(monthKey)!.items.push(g);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [weekGroups]);

  const selectedGroup = weekGroups.find((g) => `${g.activityId}:${g.weekId}` === selectedKey) ?? null;
  const days = selectedGroup ? daysInWeekClient(selectedGroup.startDate, selectedGroup.endDate) : [];
  // Se oggi rientra nella settimana selezionata, parte da lì di default
  // (altrimenti si rischia di guardare Lunedì e non vedere un check-in del
  // genitore fatto oggi, magari di Giovedì — segnalazione di Fabrizio: "non
  // si vede l'info del check-in").
  const todayIso = new Date().toISOString().slice(0, 10);
  const defaultDay = days.includes(todayIso) ? todayIso : days[0];
  const activeDay = selectedDay && days.includes(selectedDay) ? selectedDay : defaultDay;

  // Riepilogo "arrivati su prenotati" per il giorno attivo (richiesto da
  // Fabrizio) — un bambino conta come presente solo se esplicitamente
  // marcato tale: lo stato di default (nessun record) è "assente", quindi
  // il conteggio "assenti" include sia chi è stato marcato assente sia chi
  // non è ancora stato spuntato per niente.
  const bookedCount = selectedGroup?.kids.length ?? 0;
  const presentKids = selectedGroup
    ? selectedGroup.kids.filter((k) => attendance[`${k.kidId}:${activeDay}`] === "presente")
    : [];
  const lateKids = selectedGroup
    ? selectedGroup.kids.filter((k) => attendance[`${k.kidId}:${activeDay}`] === "in_ritardo")
    : [];
  const absentKids = selectedGroup
    ? selectedGroup.kids.filter((k) => (attendance[`${k.kidId}:${activeDay}`] ?? "assente") === "assente")
    : [];

  // Il gestore può impostare direttamente uno dei 3 stati (non più solo un
  // toggle presente/assente) — copre anche la conferma/correzione di
  // "in_ritardo" segnalato dal check-in del genitore (Home).
  async function setStatus(kidId: string, date: string, next: AttendanceStatus) {
    if (!selectedGroup) return;
    const key = `${kidId}:${date}`;
    const current = attendance[key] ?? "assente";
    const currentParentReport = parentReport[key] ?? false;
    if (current === next) return;

    setAttendance((prev) => ({ ...prev, [key]: next }));
    setParentReport((prev) => ({ ...prev, [key]: false })); // scrittura del gestore: non più "auto-segnalato"

    if (!isSupabaseConfigured) return; // demo: solo stato locale

    setSavingKey(key);
    const result = await setAttendanceAction({
      activityId: selectedGroup.activityId,
      weekId: selectedGroup.weekId,
      kidId,
      date,
      status: next,
    });
    setSavingKey(null);
    if (result.error) {
      // rollback in caso di errore
      setAttendance((prev) => ({ ...prev, [key]: current }));
      setParentReport((prev) => ({ ...prev, [key]: currentParentReport }));
    }
  }

  return (
    <div className="animate-fade-in px-5 py-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink">Registro presenze</h1>
        <p className="text-sm text-ink-2">
          Partecipanti divisi per attività e settimana, con appello giornaliero.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-5 rounded-lg border border-orange-mid bg-orange-light p-4 text-sm text-ink">
          Supabase non è collegato in questo ambiente: qui vedrai i partecipanti reali una volta
          collegato. Le spunte presenza in questa vista non vengono salvate.
        </div>
      )}

      {weekGroups.length === 0 && isSupabaseConfigured && (
        <p className="rounded-lg border border-[#E8EBF0] bg-white px-4 py-6 text-center text-sm text-ink-2">
          Nessun partecipante trovato per le tue attività al momento.
        </p>
      )}

      {weekGroups.length > 0 && (
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full flex-shrink-0 rounded-lg border border-[#E8EBF0] bg-white md:w-64">
            <div className="divide-y divide-[#F0F2F5]">
              {monthBuckets.map((bucket) => (
                <div key={bucket.label}>
                  <div className="bg-bg px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-3">
                    {bucket.label}
                  </div>
                  {bucket.items.map((g) => {
                    const key = `${g.activityId}:${g.weekId}`;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setSelectedKey(key);
                          setSelectedDay(null);
                        }}
                        className={`block w-full px-4 py-3 text-left text-sm transition-colors ${
                          selectedKey === key ? "bg-partner-light font-semibold text-partner" : "text-ink"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {g.activityName}
                          {g.isCurrentWeek && (
                            <span className="rounded-full bg-partner-light px-1.5 py-0.5 text-[9px] font-bold uppercase text-partner">
                              Oggi
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-ink-2">
                          {g.weekLabel} · {g.kids.length} bambini
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 rounded-lg border border-[#E8EBF0] bg-white p-4">
            {selectedGroup && (
              <>
                {/* Mese leggibile sopra le tab dei giorni (segnalazione di
                    Fabrizio) — quasi sempre uno solo, ma una settimana può
                    a cavallo di due mesi (es. 29 giu - 3 lug). */}
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
                  {Array.from(new Set(days.map(monthLabel))).join(" – ")}
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  {days.map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelectedDay(d)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        activeDay === d
                          ? "border-partner bg-partner text-white"
                          : "border-[#E8EBF0] bg-bg text-ink-2"
                      }`}
                    >
                      {formatDayLabel(d)}
                    </button>
                  ))}
                </div>

                {/* Riepilogo arrivati/prenotati del giorno attivo. */}
                <div className="mb-3 flex items-center justify-between rounded-md bg-bg px-3.5 py-2.5">
                  <div className="text-sm font-semibold text-ink">
                    <span className="text-partner">{presentKids.length}</span> presenti su {bookedCount}{" "}
                    prenotati
                    {lateKids.length > 0 && (
                      <span className="ml-2 font-normal text-orange">· {lateKids.length} in ritardo</span>
                    )}
                  </div>
                  {absentKids.length > 0 && (
                    <div className="max-w-[60%] truncate text-right text-xs text-ink-2">
                      Assenti: {absentKids.map((k) => k.kidName).join(", ")}
                    </div>
                  )}
                </div>

                <div className="divide-y divide-[#F0F2F5]">
                  {selectedGroup.kids.map((kid) => {
                    const key = `${kid.kidId}:${activeDay}`;
                    const status = attendance[key] ?? "assente";
                    const fromParent = parentReport[key] ?? false;
                    return (
                      <div key={kid.kidId} className="flex flex-col gap-2 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-ink">
                              {kid.kidName}
                              {kid.groupName && (
                                <span className="ml-1.5 rounded-full bg-bg px-2 py-0.5 text-[10px] font-medium text-ink-2">
                                  {kid.groupName}
                                </span>
                              )}
                              {/* Segnala che l'ULTIMO stato arriva dal check-in del genitore
                                  (Home), non da una spunta del gestore — utile soprattutto per
                                  "in ritardo", che il gestore può poi confermare/correggere. */}
                              {fromParent && (
                                <span className="ml-1.5 rounded-full bg-sky-light px-2 py-0.5 text-[10px] font-medium text-sky">
                                  Segnalato dal genitore
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-ink-2">
                              {kid.parentName || "Genitore"}
                              {kid.parentPhone && ` · ${kid.parentPhone}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {(["presente", "in_ritardo", "assente"] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => setStatus(kid.kidId, activeDay, s)}
                              disabled={savingKey === key}
                              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
                                status === s
                                  ? s === "presente"
                                    ? "bg-partner text-white"
                                    : s === "in_ritardo"
                                      ? "bg-orange text-white"
                                      : "bg-ink text-white"
                                  : "border border-[#E8EBF0] text-ink-2"
                              }`}
                            >
                              {STATUS_LABEL[s]}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {selectedGroup.kids.length === 0 && (
                    <p className="py-6 text-center text-sm text-ink-2">
                      Nessun bambino iscritto per questa settimana.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
