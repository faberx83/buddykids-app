"use client";

import { useMemo, useState } from "react";
import type { AttendanceWeekGroup } from "@/lib/data/attendance";
import { setAttendanceAction } from "@/app/actions/attendance";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type AttendanceStatus = "presente" | "assente";
type AttendanceMap = Record<string, AttendanceStatus>; // key: `${kidId}:${date}`

const DAY_LABELS_IT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

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
  attendanceByWeek: Record<string, { kidId: string; date: string; status: AttendanceStatus }[]>;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(
    weekGroups.length > 0 ? `${weekGroups[0].activityId}:${weekGroups[0].weekId}` : null
  );

  const initialAttendance = useMemo(() => {
    const map: AttendanceMap = {};
    for (const records of Object.values(attendanceByWeek)) {
      for (const r of records) map[`${r.kidId}:${r.date}`] = r.status;
    }
    return map;
  }, [attendanceByWeek]);

  const [attendance, setAttendance] = useState<AttendanceMap>(initialAttendance);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const selectedGroup = weekGroups.find((g) => `${g.activityId}:${g.weekId}` === selectedKey) ?? null;
  const days = selectedGroup ? daysInWeekClient(selectedGroup.startDate, selectedGroup.endDate) : [];
  const activeDay = selectedDay && days.includes(selectedDay) ? selectedDay : days[0];

  async function toggleAttendance(kidId: string, date: string) {
    if (!selectedGroup) return;
    const key = `${kidId}:${date}`;
    const current = attendance[key] ?? "assente";
    const next: AttendanceStatus = current === "presente" ? "assente" : "presente";

    setAttendance((prev) => ({ ...prev, [key]: next }));

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
              {weekGroups.map((g) => {
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
                    <div>{g.activityName}</div>
                    <div className="text-xs text-ink-2">
                      {g.weekLabel} · {g.kids.length} bambini
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 rounded-lg border border-[#E8EBF0] bg-white p-4">
            {selectedGroup && (
              <>
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

                <div className="divide-y divide-[#F0F2F5]">
                  {selectedGroup.kids.map((kid) => {
                    const key = `${kid.kidId}:${activeDay}`;
                    const status = attendance[key] ?? "assente";
                    const present = status === "presente";
                    return (
                      <div key={kid.kidId} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-ink">
                            {kid.kidName}
                            {kid.groupName && (
                              <span className="ml-1.5 rounded-full bg-bg px-2 py-0.5 text-[10px] font-medium text-ink-2">
                                {kid.groupName}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-ink-2">
                            {kid.parentName || "Genitore"}
                            {kid.parentPhone && ` · ${kid.parentPhone}`}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleAttendance(kid.kidId, activeDay)}
                          disabled={savingKey === key}
                          className={`flex-shrink-0 rounded-md px-3.5 py-2 text-xs font-bold transition-colors disabled:opacity-60 ${
                            present ? "bg-partner text-white" : "border border-[#E8EBF0] text-ink-2"
                          }`}
                        >
                          {present ? "Presente" : "Assente"}
                        </button>
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
