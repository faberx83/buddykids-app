"use client";

import { useMemo, useState } from "react";
// "import type" per SeasonWeek/PlanShare: sono usati SOLO come tipo in
// questo componente client — con "import type" il compilatore li elimina
// sempre dal bundle, cosi lib/data/planner.ts e lib/data/plan-shares.ts (che
// importano lib/supabase/server) non finiscono mai nel bundle client per
// errore (stesso bug di build risolto per ADDRESS_KIND_LABELS/
// RESPONSIBLE_OPTIONS, vedi lib/nextgen/address-kinds.ts).
import type { SeasonWeek } from "@/lib/data/planner";
import type { KidOverlap } from "@/lib/nextgen/planner-insights";
import { buildCalendarMonths, defaultMonthKey, CalendarDay } from "@/lib/nextgen/calendar-weeks";
import {
  WeekResponsibility,
  ResponsibleValue,
  RESPONSIBLE_OPTIONS,
} from "@/lib/nextgen/responsibility-options";
import { setResponsibilityAction, clearResponsibilityAction } from "@/app/actions/responsibilities";
import type { PlanShare } from "@/lib/data/plan-shares";
import { createPlanShareAction, revokePlanShareAction } from "@/app/actions/plan-shares";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import type { Kid } from "@/lib/types";

// SPRINT 5.2 (NEXTGEN) — Planner, modalità Calendario: "Giorno, settimana e
// mese, con colori per figlio e conflitti evidenziati" (PRD Family Planner).
// Vedi lib/nextgen/calendar-weeks.ts per il limite di dati dichiarato: niente
// vista Giorno con presenza reale (il modello dati copre solo intere
// settimane, non singoli giorni di frequenza) — qui offriamo Mese e
// Settimana, entrambe derivate dalle stesse SeasonWeek già usate in
// Organizzazione, senza nuove query.
//
// SPRINT 5.3 (NEXTGEN) — "Chi fa cosa?" (idea di Fabrizio): integrata nel
// riepilogo settimana già costruito in 5.2, invece di una sesta scheda del
// Planner o di una nuova pagina — il riepilogo mostra già "quale bambino,
// quale settimana", il passo naturale è aggiungere "chi lo accompagna".
// Versione leggera (etichetta libera, non il sistema multi-genitore vero).

type ViewMode = "mese" | "settimana";

const WEEKDAY_SHORT_IT = ["L", "M", "M", "G", "V", "S", "D"];

const DOT_BG: Record<string, string> = {
  sky: "bg-sky",
  aqua: "bg-aqua",
  orange: "bg-orange",
  purple: "bg-purple",
  green: "bg-green",
};

function respKey(kidId: string, weekStartDate: string): string {
  return `${kidId}__${weekStartDate}`;
}

export default function PlannerCalendarView({
  weeks,
  kids,
  overlaps,
  responsibilities,
  existingShares,
}: {
  weeks: SeasonWeek[];
  kids: Kid[];
  overlaps: KidOverlap[];
  responsibilities: WeekResponsibility[];
  existingShares: PlanShare[];
}) {
  const showToast = useNextgenToast();
  const [viewMode, setViewMode] = useState<ViewMode>("mese");
  const months = useMemo(() => buildCalendarMonths(weeks, kids, overlaps), [weeks, kids, overlaps]);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [monthKey, setMonthKey] = useState<string>(() => defaultMonthKey(months, todayIso));
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  // Stato locale delle assegnazioni "Chi fa cosa?", inizializzato dal prop e
  // aggiornato in modo ottimistico dopo ogni salvataggio — evita di dover
  // ricaricare la pagina per vedere subito il risultato.
  const [localResp, setLocalResp] = useState<Record<string, WeekResponsibility>>(() => {
    const map: Record<string, WeekResponsibility> = {};
    for (const r of responsibilities) map[respKey(r.kidId, r.weekStartDate)] = r;
    return map;
  });
  const [assigningKey, setAssigningKey] = useState<string | null>(null);
  const [altroText, setAltroText] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function handleAssign(kidId: string, weekStartDate: string, value: ResponsibleValue, label?: string) {
    const key = respKey(kidId, weekStartDate);
    setSavingKey(key);
    const res = await setResponsibilityAction(kidId, weekStartDate, value, label);
    setSavingKey(null);
    if (res.error) {
      showToast(res.error);
      return;
    }
    setLocalResp((prev) => ({
      ...prev,
      [key]: { kidId, weekStartDate, responsible: value, responsibleLabel: value === "altro" ? label ?? null : null },
    }));
    setAssigningKey(null);
    setAltroText("");
    showToast("Assegnato!");
  }

  async function handleClear(kidId: string, weekStartDate: string) {
    const key = respKey(kidId, weekStartDate);
    setSavingKey(key);
    const res = await clearResponsibilityAction(kidId, weekStartDate);
    setSavingKey(null);
    if (res.error) {
      showToast(res.error);
      return;
    }
    setLocalResp((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setAssigningKey(null);
  }

  // SPRINT 5.3 — "Condivisione Piano": link pubblico di sola lettura per il
  // mese visualizzato o per una singola settimana (dal riepilogo). Niente
  // periodo personalizzato in questa fase (nessun date-picker): due scope
  // ben definiti, coerenti con "logistica leggera" — un intervallo libero è
  // un buon candidato per un prossimo sprint.
  const [shares, setShares] = useState<PlanShare[]>(existingShares);
  const [sharingScope, setSharingScope] = useState<{ start: string; end: string; defaultLabel: string } | null>(
    null
  );
  const [shareLabel, setShareLabel] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareResultUrl, setShareResultUrl] = useState<string | null>(null);

  function openShare(start: string, end: string, defaultLabel: string) {
    setSharingScope({ start, end, defaultLabel });
    setShareLabel(defaultLabel);
    setShareResultUrl(null);
  }

  async function handleCreateShare() {
    if (!sharingScope) return;
    setShareBusy(true);
    const res = await createPlanShareAction(sharingScope.start, sharingScope.end, shareLabel);
    setShareBusy(false);
    if (res.error || !res.url || !res.id) {
      showToast(res.error ?? "Errore nella creazione del link");
      return;
    }
    setShareResultUrl(res.url);
    setShares((prev) => [
      {
        id: res.id!,
        token: "",
        label: shareLabel.trim() || null,
        scopeStart: sharingScope.start,
        scopeEnd: sharingScope.end,
        createdAt: new Date().toISOString(),
        revokedAt: null,
      },
      ...prev,
    ]);
  }

  async function handleRevokeShare(id: string) {
    const res = await revokePlanShareAction(id);
    if (res.error) {
      showToast(res.error);
      return;
    }
    setShares((prev) => prev.filter((s) => s.id !== id));
    showToast("Link revocato");
  }

  async function copyToClipboard(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copiato!");
    } catch {
      showToast("Non sono riuscito a copiare — seleziona e copia il link manualmente");
    }
  }

  const monthIndex = months.findIndex((m) => m.key === monthKey);
  const activeMonth = months[monthIndex] ?? months[0] ?? null;

  // Scope di condivisione per il mese visualizzato: primo/ultimo giorno IN
  // STAGIONE del mese (non 1/fine mese solare, per non includere giorni fuori
  // dalla stagione nei mesi di confine).
  const monthShareScope = useMemo(() => {
    if (!activeMonth) return null;
    const inSeasonCells = activeMonth.cells.filter((c): c is CalendarDay => Boolean(c && c.inSeason));
    if (inSeasonCells.length === 0) return null;
    return { start: inSeasonCells[0].dateIso, end: inSeasonCells[inSeasonCells.length - 1].dateIso };
  }, [activeMonth]);

  const conflictWeekIndexes = useMemo(() => {
    function weekIndexFromLabel(label: string): number | null {
      const m = label.match(/\d+/);
      return m ? Number(m[0]) : null;
    }
    return new Set(overlaps.map((o) => weekIndexFromLabel(o.weekLabel)).filter((i): i is number => i !== null));
  }, [overlaps]);

  if (weeks.length === 0 || !activeMonth) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D8DEE8] bg-white p-6 text-center">
        <i className="ti ti-calendar mb-2 text-2xl text-ink-3" />
        <p className="text-xs text-ink-2">Nessuna settimana stagionale disponibile.</p>
      </div>
    );
  }

  // Legenda colori per bambino — stessa tecnica del chip selettore bambino
  // già usato altrove nel Planner (kid.accentColor), qui mostrata come
  // legenda fissa (non richiede alcuna selezione).
  const kidLegend = kids.map((k) => {
    const dot = months
      .flatMap((m) => m.cells)
      .find((c) => c?.kids.some((ck) => ck.kidId === k.id))
      ?.kids.find((ck) => ck.kidId === k.id);
    return { kidId: k.id, kidName: k.name, accentColor: dot?.accentColor };
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Selettore Mese/Settimana */}
      <div className="flex gap-2">
        {(
          [
            { key: "mese", label: "Mese" },
            { key: "settimana", label: "Settimana" },
          ] as { key: ViewMode; label: string }[]
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => {
              setViewMode(opt.key);
              setSelectedDay(null);
            }}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${
              viewMode === opt.key ? "bg-ink text-white" : "bg-bg text-ink-2"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Legenda per bambino */}
      {kids.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5">
          {kidLegend.map((k) => (
            <div key={k.kidId} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${DOT_BG[k.accentColor ?? "sky"]}`} />
              <span className="text-[11.5px] font-semibold text-ink-2">{k.kidName}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <i className="ti ti-alert-triangle text-[13px] text-[#9a6b00]" />
            <span className="text-[11px] text-ink-3">Sovrapposizione</span>
          </div>
        </div>
      )}

      {viewMode === "mese" ? (
        <div className="rounded-2xl bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              disabled={monthIndex <= 0}
              onClick={() => setMonthKey(months[Math.max(0, monthIndex - 1)].key)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-2 disabled:opacity-30"
              aria-label="Mese precedente"
            >
              <i className="ti ti-chevron-left text-[15px]" />
            </button>
            <div className="text-sm font-bold text-ink">{activeMonth.label}</div>
            <button
              type="button"
              disabled={monthIndex >= months.length - 1}
              onClick={() => setMonthKey(months[Math.min(months.length - 1, monthIndex + 1)].key)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-2 disabled:opacity-30"
              aria-label="Mese successivo"
            >
              <i className="ti ti-chevron-right text-[15px]" />
            </button>
          </div>

          <div className="mb-1.5 grid grid-cols-7 gap-1">
            {WEEKDAY_SHORT_IT.map((d, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-ink-3">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {activeMonth.cells.map((cell, i) => {
              if (!cell) return <div key={i} className="aspect-square" />;
              const isToday = cell.dateIso === todayIso;
              const isSelected = selectedDay?.dateIso === cell.dateIso;
              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  disabled={!cell.inSeason}
                  onClick={() => setSelectedDay(isSelected ? null : cell)}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] ${
                    isSelected
                      ? "bg-[#EFECFD] font-bold text-ink"
                      : isToday
                        ? "border border-[#5B4FE9] font-semibold text-ink"
                        : cell.inSeason
                          ? "text-ink"
                          : "text-ink-3/50"
                  }`}
                >
                  <span>{cell.dayOfMonth}</span>
                  {cell.kids.length > 0 && (
                    <span className="mt-0.5 flex gap-0.5">
                      {cell.kids.slice(0, 3).map((k) => (
                        <span key={k.kidId} className={`h-1.5 w-1.5 rounded-full ${DOT_BG[k.accentColor]}`} />
                      ))}
                    </span>
                  )}
                  {cell.hasConflict && (
                    <i className="ti ti-alert-triangle absolute -right-0.5 -top-0.5 text-[10px] text-[#9a6b00]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* SPRINT 5.3 — Condivisione Piano: link pubblico di sola lettura
              per il mese visualizzato. */}
          {monthShareScope && (
            <button
              type="button"
              onClick={() => openShare(monthShareScope.start, monthShareScope.end, activeMonth.label)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#EFECFD] py-2 text-[12px] font-bold text-[#5B4FE9]"
            >
              <i className="ti ti-share text-[14px]" />
              Condividi {activeMonth.label}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {weeks.map((w) => {
            const hasConflict = conflictWeekIndexes.has(w.index);
            const isSelected = selectedDay?.weekIndex === w.index;
            return (
              <button
                key={w.index}
                type="button"
                onClick={() =>
                  setSelectedDay(
                    isSelected
                      ? null
                      : {
                          dateIso: w.startDate,
                          dayOfMonth: 0,
                          weekIndex: w.index,
                          weekLabel: w.label,
                          weekStartDate: w.startDate,
                          weekEndDate: w.endDate,
                          inSeason: true,
                          covered: w.covered,
                          dismissed: w.dismissed,
                          activityName: w.activityName,
                          kids: w.coveredKids
                            .map((ck) => kids.find((k) => k.id === ck.kidId))
                            .filter((k): k is Kid => Boolean(k))
                            .map((k) => ({
                              kidId: k.id,
                              kidName: k.name,
                              accentColor: k.accentColor ?? "sky",
                            })),
                          hasConflict,
                        }
                  )
                }
                className={`flex items-center gap-3 rounded-xl p-3 text-left ${
                  isSelected ? "bg-[#EFECFD]" : w.dismissed ? "bg-bg" : "bg-white"
                }`}
              >
                <div className="w-16 flex-shrink-0 whitespace-nowrap text-[11.5px] font-bold text-ink">
                  Sett. {w.index}
                </div>
                <div className="flex flex-1 items-center gap-1">
                  {w.dismissed ? (
                    <span className="text-[11.5px] text-ink-3">Non ti serve</span>
                  ) : w.coveredKids.length > 0 ? (
                    w.coveredKids.map((ck) => {
                      const kid = kids.find((k) => k.id === ck.kidId);
                      if (!kid) return null;
                      return (
                        <span
                          key={ck.kidId}
                          className={`h-2.5 w-2.5 rounded-full ${DOT_BG[kid.accentColor ?? "sky"]}`}
                          title={kid.name}
                        />
                      );
                    })
                  ) : (
                    <span className="text-[11.5px] text-ink-3">Scoperta</span>
                  )}
                </div>
                {hasConflict && <i className="ti ti-alert-triangle flex-shrink-0 text-[15px] text-[#9a6b00]" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Riepilogo del giorno/settimana selezionata */}
      {selectedDay && (
        <div className="rounded-2xl border border-[#E8EBF0] bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[13px] font-bold text-ink">
              {selectedDay.weekLabel ?? "Settimana"}
            </div>
            <div className="flex items-center gap-2">
              {selectedDay.hasConflict && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-[#9a6b00]">
                  <i className="ti ti-alert-triangle text-[13px]" />
                  Sovrapposizione
                </span>
              )}
              {/* SPRINT 5.3 — Condivisione Piano: link pubblico per questa
                  singola settimana. */}
              {!selectedDay.dismissed && selectedDay.weekStartDate && selectedDay.weekEndDate && (
                <button
                  type="button"
                  onClick={() =>
                    openShare(
                      selectedDay.weekStartDate!,
                      selectedDay.weekEndDate!,
                      selectedDay.weekLabel ?? "Settimana"
                    )
                  }
                  className="flex items-center gap-1 rounded-full bg-[#EFECFD] px-2.5 py-1 text-[11px] font-bold text-[#5B4FE9]"
                >
                  <i className="ti ti-share text-[12px]" />
                  Condividi
                </button>
              )}
            </div>
          </div>
          {selectedDay.dismissed ? (
            <p className="text-[12.5px] text-ink-2">Segnata come &quot;non ti serve&quot;.</p>
          ) : selectedDay.kids.length > 0 ? (
            <div className="flex flex-col gap-3">
              {selectedDay.kids.map((k) => {
                const weekStartDate = selectedDay.weekStartDate;
                const key = weekStartDate ? respKey(k.kidId, weekStartDate) : null;
                const current = key ? localResp[key] : undefined;
                const isAssigning = assigningKey === key;
                const currentOption = current
                  ? RESPONSIBLE_OPTIONS.find((o) => o.value === current.responsible)
                  : null;

                return (
                  <div key={k.kidId} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-[12.5px]">
                      <span className={`h-2.5 w-2.5 rounded-full ${DOT_BG[k.accentColor]}`} />
                      <span className="font-semibold text-ink">{k.kidName}</span>
                      <span className="text-ink-2">{selectedDay.activityName ?? "attività prenotata"}</span>
                    </div>

                    {/* SPRINT 5.3 — "Chi fa cosa?": chi accompagna/ritira questo
                        bambino questa settimana, versione leggera con
                        etichetta libera. */}
                    {weekStartDate && key && (
                      <div className="ml-4 pl-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAssigningKey(isAssigning ? null : key);
                            setAltroText(current?.responsible === "altro" ? current.responsibleLabel ?? "" : "");
                          }}
                          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            current ? "bg-[#E8F9EE] text-[#2d8f52]" : "bg-[#FFF3E0] text-[#9a6b00]"
                          }`}
                        >
                          {current ? (
                            <>
                              {currentOption?.emoji}{" "}
                              {current.responsible === "altro" ? current.responsibleLabel : currentOption?.label}
                            </>
                          ) : (
                            <>
                              <i className="ti ti-alert-triangle text-[11px]" />
                              Nessuno assegnato
                            </>
                          )}
                          <i className={`ti ti-chevron-${isAssigning ? "up" : "down"} text-[10px]`} />
                        </button>

                        {isAssigning && (
                          <div className="mt-2 flex flex-col gap-2 rounded-xl bg-bg p-2.5">
                            <div className="flex flex-wrap gap-1.5">
                              {RESPONSIBLE_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  disabled={savingKey === key}
                                  onClick={() => {
                                    if (opt.value === "altro") return; // richiede il testo sotto
                                    handleAssign(k.kidId, weekStartDate, opt.value);
                                  }}
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    current?.responsible === opt.value
                                      ? "bg-ink text-white"
                                      : "bg-white text-ink-2"
                                  }`}
                                >
                                  {opt.emoji} {opt.label}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={altroText}
                                onChange={(e) => setAltroText(e.target.value)}
                                placeholder="Altro: scrivi chi (es. Zia Carla)"
                                className="min-w-0 flex-1 rounded-lg border border-[#E8EBF0] bg-white px-2.5 py-1.5 text-[11.5px] text-ink"
                              />
                              <button
                                type="button"
                                disabled={savingKey === key || !altroText.trim()}
                                onClick={() => handleAssign(k.kidId, weekStartDate, "altro", altroText)}
                                className="flex-shrink-0 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
                              >
                                OK
                              </button>
                            </div>
                            {current && (
                              <button
                                type="button"
                                disabled={savingKey === key}
                                onClick={() => handleClear(k.kidId, weekStartDate)}
                                className="self-start text-[11px] font-semibold text-ink-3"
                              >
                                Rimuovi assegnazione
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {selectedDay.hasConflict && (
                <p className="mt-1 text-[11.5px] text-[#7a5400]">
                  Controlla il dettaglio in Organizzazione: uno o più bambini risultano prenotati due volte questa
                  settimana.
                </p>
              )}
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-2">Nessuna prenotazione per questa settimana.</p>
          )}
        </div>
      )}

      {/* SPRINT 5.3 — Condivisione Piano: pannello di creazione link, aperto
          da "Condividi" (mese o settimana). Nessun periodo personalizzato in
          questa fase — vedi commento su monthShareScope. */}
      {sharingScope && (
        <div className="rounded-2xl border border-[#E8EBF0] bg-white p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="text-[13px] font-bold text-ink">Condividi piano</div>
            <button type="button" onClick={() => setSharingScope(null)} className="text-ink-3" aria-label="Chiudi">
              <i className="ti ti-x text-[16px]" />
            </button>
          </div>

          {shareResultUrl ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-[12.5px] text-ink-2">
                Link pronto — chi lo apre vede solo bambino, attività e date di questo periodo, senza login.
              </p>
              <div className="flex items-center gap-2 rounded-xl bg-bg px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-2">{shareResultUrl}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(shareResultUrl)}
                  className="flex-shrink-0 rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold text-white"
                >
                  Copia
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSharingScope(null)}
                className="self-start text-[11.5px] font-semibold text-[#5B4FE9]"
              >
                Fatto
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <p className="text-[12.5px] text-ink-2">
                Chi lo apre vede solo bambino, attività e date — mai importi, indirizzi o contatti.
              </p>
              <input
                type="text"
                value={shareLabel}
                onChange={(e) => setShareLabel(e.target.value)}
                placeholder="Nome del link (es. Luglio 2026)"
                className="rounded-xl border border-[#E8EBF0] px-3 py-2 text-[13px] text-ink"
              />
              <button
                type="button"
                disabled={shareBusy}
                onClick={handleCreateShare}
                className="rounded-full bg-ink px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
              >
                {shareBusy ? "Creo il link…" : "Crea link"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Elenco dei link creati — gestione/revoca. */}
      {shares.filter((s) => !s.revokedAt).length > 0 && (
        <div className="rounded-2xl bg-white p-4">
          <div className="mb-2.5 text-[13px] font-bold text-ink">I tuoi link condivisi</div>
          <div className="flex flex-col gap-2">
            {shares
              .filter((s) => !s.revokedAt)
              .map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-semibold text-ink">{s.label || "Piano condiviso"}</div>
                    <div className="text-[10.5px] text-ink-3">
                      {s.scopeStart} – {s.scopeEnd}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokeShare(s.id)}
                    className="flex-shrink-0 text-[11px] font-semibold text-red-500"
                  >
                    Revoca
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
