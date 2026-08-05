"use client";

import { useMemo, useState } from "react";
import { DayAvailability } from "@/lib/types";
import { saveActivityDaysAction } from "@/app/actions/center";
import { DemoBadge } from "@/components/StatusBadge";

const weekdayLabels = ["Lun", "Mar", "Mer", "Gio", "Ven"];

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

function cellTone(day: DayAvailability) {
  if (!day.isOpen) return "bg-[#F4F6FA] text-ink-3 border-[#E8EBF0]";
  if (day.spotsLeft === 0) return "bg-orange-light text-trama-orange border-orange-mid";
  if (day.spotsLeft <= 3) return "bg-yellow-light text-[#9a6b00] border-yellow";
  return "bg-green-light text-[#2d8f52] border-green";
}

// BUGFIX/FEATURE (Fabrizio, 05/08: "deve essere possibile selezionare più
// giorni o settimana intera o piu' settimana a cui applicare le modifiche,
// non solo i singoli giorni"): prima di questa modifica l'unico modo di
// editare il calendario era un giorno alla volta (click -> pannello
// "Modifica <data>"). Aggiunta una modalità di selezione multipla opzionale
// (bottone "Seleziona più giorni"), che NON cambia il comportamento di
// default: a modalità spenta (default) un click su un giorno apre ancora il
// pannello singolo di prima, identico. Solo attivando la modalità multipla i
// click sui giorni/sull'intestazione di settimana aggiungono/tolgono date
// da un insieme, e un pannello dedicato applica lo stesso patch a TUTTE le
// date selezionate in un colpo solo — riusa handleSaveAll esistente (che
// salva l'intero array localDays), nessuna nuova azione server necessaria.
type BulkDraft = {
  isOpen: boolean;
  capacity: number;
  discountPercent: number;
  lastMinute: boolean;
};

export default function AvailabilityCalendar({
  days,
  mode,
  highlightDates,
  onChange,
  activityDbId,
}: {
  days: DayAvailability[];
  mode: "edit" | "view";
  highlightDates?: string[];
  onChange?: (updated: DayAvailability[]) => void;
  activityDbId?: string;
}) {
  const [localDays, setLocalDays] = useState(days);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkDraft, setBulkDraft] = useState<BulkDraft>({
    isOpen: true,
    capacity: 15,
    discountPercent: 0,
    lastMinute: false,
  });

  async function handleSaveAll() {
    if (!activityDbId) return;
    setSaving(true);
    setSaveError(null);
    setSavedOk(false);
    const result = await saveActivityDaysAction(activityDbId, localDays);
    setSaving(false);
    if (result.error) {
      setSaveError(result.error);
      return;
    }
    setDirty(false);
    setSavedOk(true);
  }

  const weeks = useMemo(() => {
    const chunks: DayAvailability[][] = [];
    for (let i = 0; i < localDays.length; i += 5) chunks.push(localDays.slice(i, i + 5));
    return chunks;
  }, [localDays]);

  const selectedDay = localDays.find((d) => d.date === selected) ?? null;

  function updateSelectedDay(patch: Partial<DayAvailability>) {
    if (!selected) return;
    const updated = localDays.map((d) => (d.date === selected ? { ...d, ...patch } : d));
    setLocalDays(updated);
    setDirty(true);
    setSavedOk(false);
    onChange?.(updated);
  }

  function toggleBulkDate(date: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function toggleBulkWeek(week: DayAvailability[]) {
    const weekDates = week.map((d) => d.date);
    const allSelected = weekDates.every((d) => bulkSelected.has(d));
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) weekDates.forEach((d) => next.delete(d));
      else weekDates.forEach((d) => next.add(d));
      return next;
    });
  }

  function selectAllVisible() {
    setBulkSelected(new Set(localDays.map((d) => d.date)));
  }

  function clearBulkSelection() {
    setBulkSelected(new Set());
  }

  function applyBulkDraft() {
    if (bulkSelected.size === 0) return;
    const updated = localDays.map((d) =>
      bulkSelected.has(d.date)
        ? {
            ...d,
            isOpen: bulkDraft.isOpen,
            capacity: bulkDraft.capacity,
            // Stesso comportamento del pannello singolo giorno: cambiare la
            // capienza resetta i posti liberi al nuovo totale (qui sempre,
            // non un min() con l'esistente, perché l'azione bulk più comune
            // è "apri/riapri N giorni con X posti ciascuno da zero").
            spotsLeft: bulkDraft.capacity,
            discountPercent: bulkDraft.discountPercent || undefined,
            lastMinute: bulkDraft.lastMinute,
          }
        : d
    );
    setLocalDays(updated);
    setDirty(true);
    setSavedOk(false);
    onChange?.(updated);
    clearBulkSelection();
  }

  function toggleBulkMode() {
    setBulkMode((prev) => !prev);
    setBulkSelected(new Set());
    setSelected(null);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-ink-2">
        <Legend swatch="bg-green-light border-green" label="Disponibile" />
        <Legend swatch="bg-yellow-light border-yellow" label="Ultimi posti" />
        <Legend swatch="bg-orange-light border-orange-mid" label="Pieno" />
        <Legend swatch="bg-[#F4F6FA] border-[#E8EBF0]" label="Chiuso" />
        <span className="flex items-center gap-1.5">🏊 Giornata particolare</span>
      </div>

      {mode === "edit" && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleBulkMode}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
              bulkMode
                ? "border-sky bg-sky-light text-sky"
                : "border-[#E8EBF0] bg-white text-ink hover:bg-bg"
            }`}
          >
            {bulkMode ? "Esci da selezione multipla" : "Seleziona più giorni"}
          </button>
          {bulkMode && (
            <>
              <button
                type="button"
                onClick={selectAllVisible}
                className="rounded-md border border-[#E8EBF0] bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-bg"
              >
                Seleziona tutte le settimane
              </button>
              {bulkSelected.size > 0 && (
                <button
                  type="button"
                  onClick={clearBulkSelection}
                  className="rounded-md border border-[#E8EBF0] bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-bg"
                >
                  Deseleziona tutto
                </button>
              )}
              <span className="text-xs text-ink-2">
                {bulkSelected.size === 0
                  ? "Clicca sui giorni o su una settimana per selezionarli"
                  : `${bulkSelected.size} giorni selezionati`}
              </span>
            </>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th className="w-24 text-left text-[11px] font-semibold text-ink-3">Settimana</th>
              {weekdayLabels.map((w) => (
                <th key={w} className="text-center text-[11px] font-semibold text-ink-3">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, i) => {
              const weekDates = week.map((d) => d.date);
              const weekFullySelected = bulkMode && weekDates.every((d) => bulkSelected.has(d));
              return (
              <tr key={i}>
                <td className="pr-2 text-xs font-medium text-ink-2">
                  {bulkMode ? (
                    <button
                      type="button"
                      onClick={() => toggleBulkWeek(week)}
                      className={`w-full rounded-md border px-1.5 py-1 text-left text-xs font-semibold transition-colors ${
                        weekFullySelected
                          ? "border-sky bg-sky-light text-sky"
                          : "border-transparent text-ink-2 hover:bg-bg"
                      }`}
                      title="Seleziona/deseleziona tutta la settimana"
                    >
                      {formatDate(week[0].date)} – {formatDate(week[week.length - 1].date)}
                    </button>
                  ) : (
                    <>
                      {formatDate(week[0].date)} – {formatDate(week[week.length - 1].date)}
                    </>
                  )}
                </td>
                {week.map((day) => {
                  const isHighlighted = highlightDates?.includes(day.date);
                  const isSelected = bulkMode ? bulkSelected.has(day.date) : selected === day.date;
                  return (
                    <td key={day.date}>
                      <button
                        type="button"
                        onClick={() => {
                          if (mode !== "edit") return;
                          if (bulkMode) toggleBulkDate(day.date);
                          else setSelected(day.date);
                        }}
                        className={`relative flex h-16 w-full flex-col items-center justify-center gap-0.5 rounded-md border text-[11px] font-semibold transition-all ${cellTone(
                          day
                        )} ${mode === "edit" ? "cursor-pointer hover:brightness-95" : "cursor-default"} ${
                          isSelected ? "ring-2 ring-sky" : ""
                        } ${isHighlighted ? "outline outline-2 outline-offset-1 outline-sky" : ""}`}
                      >
                        <span>{formatDate(day.date)}</span>
                        <span className="text-[10px] font-normal">
                          {!day.isOpen
                            ? "Chiuso"
                            : day.spotsLeft === 0
                            ? "Pieno"
                            : `${day.spotsLeft} posti`}
                        </span>
                        {(day.discountPercent || day.lastMinute) && (
                          <span className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 rounded-full bg-purple px-1.5 py-0.5 text-[9px] font-bold text-white">
                            {day.lastMinute ? "⚡" : `-${day.discountPercent}%`}
                          </span>
                        )}
                        {day.specialEmoji && (
                          <span
                            title={day.specialLabel}
                            className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs shadow-sm ring-1 ring-[#E8EBF0]"
                          >
                            {day.specialEmoji}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mode === "edit" && bulkMode && (
        <div className="mt-4 rounded-lg border border-sky bg-sky-light/40 p-4">
          {bulkSelected.size === 0 ? (
            <p className="text-sm text-ink-2">
              Seleziona uno o più giorni (o un&apos;intera settimana dall&apos;etichetta a sinistra) per
              applicare le stesse modifiche a tutti in un colpo solo.
            </p>
          ) : (
            <>
              <div className="mb-3 text-sm font-bold text-ink">
                Modifica {bulkSelected.size} giorni selezionati
              </div>
              <p className="mb-3 text-xs text-ink-2">
                I valori sotto verranno applicati a TUTTI i giorni selezionati, sostituendo quelli attuali.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center justify-between rounded-md bg-white px-3 py-2.5 text-sm">
                  Giorno aperto
                  <input
                    type="checkbox"
                    checked={bulkDraft.isOpen}
                    onChange={(e) => setBulkDraft((prev) => ({ ...prev, isOpen: e.target.checked }))}
                    className="h-4 w-4 accent-sky"
                  />
                </label>
                <label className="flex items-center justify-between rounded-md bg-white px-3 py-2.5 text-sm">
                  Promo last-minute
                  <input
                    type="checkbox"
                    checked={bulkDraft.lastMinute}
                    onChange={(e) => setBulkDraft((prev) => ({ ...prev, lastMinute: e.target.checked }))}
                    className="h-4 w-4 accent-purple"
                  />
                </label>
                <label className="rounded-md bg-white px-3 py-2.5 text-sm">
                  <div className="mb-1 text-xs text-ink-2">Posti totali (per ogni giorno selezionato)</div>
                  <input
                    type="number"
                    min={0}
                    value={bulkDraft.capacity}
                    onChange={(e) =>
                      setBulkDraft((prev) => ({ ...prev, capacity: Number(e.target.value) }))
                    }
                    className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
                  />
                </label>
                <label className="rounded-md bg-white px-3 py-2.5 text-sm">
                  <div className="mb-1 text-xs text-ink-2">Sconto sul giorno (%)</div>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={bulkDraft.discountPercent}
                    onChange={(e) =>
                      setBulkDraft((prev) => ({ ...prev, discountPercent: Number(e.target.value) }))
                    }
                    className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
                  />
                </label>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={applyBulkDraft}
                  className="rounded-md bg-sky px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#3A9FDC]"
                >
                  Applica a {bulkSelected.size} giorni
                </button>
                <span className="text-[11px] text-ink-3">
                  Dopo aver applicato, ricorda di premere &quot;Salva calendario&quot; per scrivere le modifiche.
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {mode === "edit" && !bulkMode && selectedDay && (
        <div className="mt-4 rounded-lg border border-[#E8EBF0] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold text-ink">
              Modifica {formatDate(selectedDay.date)}
            </div>
            <button onClick={() => setSelected(null)} className="text-ink-3">
              <i className="ti ti-x text-lg" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between rounded-md bg-bg px-3 py-2.5 text-sm">
              Giorno aperto
              <input
                type="checkbox"
                checked={selectedDay.isOpen}
                onChange={(e) => updateSelectedDay({ isOpen: e.target.checked })}
                className="h-4 w-4 accent-sky"
              />
            </label>
            <label className="flex items-center justify-between rounded-md bg-bg px-3 py-2.5 text-sm">
              Promo last-minute
              <input
                type="checkbox"
                checked={Boolean(selectedDay.lastMinute)}
                onChange={(e) => updateSelectedDay({ lastMinute: e.target.checked })}
                className="h-4 w-4 accent-purple"
              />
            </label>
            <label className="rounded-md bg-bg px-3 py-2.5 text-sm">
              <div className="mb-1 text-xs text-ink-2">Posti totali</div>
              <input
                type="number"
                min={0}
                value={selectedDay.capacity}
                onChange={(e) => {
                  const capacity = Number(e.target.value);
                  updateSelectedDay({
                    capacity,
                    spotsLeft: Math.min(selectedDay.spotsLeft, capacity),
                  });
                }}
                className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
              />
            </label>
            <label className="rounded-md bg-bg px-3 py-2.5 text-sm">
              <div className="mb-1 text-xs text-ink-2">Posti liberi</div>
              <input
                type="number"
                min={0}
                max={selectedDay.capacity}
                value={selectedDay.spotsLeft}
                onChange={(e) => updateSelectedDay({ spotsLeft: Number(e.target.value) })}
                className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
              />
            </label>
            <label className="col-span-2 rounded-md bg-bg px-3 py-2.5 text-sm">
              <div className="mb-1 text-xs text-ink-2">Sconto sul giorno (%)</div>
              <input
                type="number"
                min={0}
                max={90}
                value={selectedDay.discountPercent ?? 0}
                onChange={(e) =>
                  updateSelectedDay({
                    discountPercent: Number(e.target.value) || undefined,
                  })
                }
                className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
              />
            </label>
          </div>

          <div className="mt-3 rounded-md bg-bg px-3 py-2.5">
            <div className="mb-1.5 text-xs text-ink-2">
              Giornata particolare (es. piscina, giochi d&apos;acqua)
            </div>
            <input
              value={selectedDay.specialLabel ?? ""}
              onChange={(e) =>
                updateSelectedDay({ specialLabel: e.target.value || undefined })
              }
              placeholder="Es. Giornata in piscina"
              className="mb-2 w-full rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-sky"
            />
            <div className="flex flex-wrap gap-1.5">
              {["", "🏊", "💦", "🎉", "🎨", "🌳", "🏆"].map((emoji) => (
                <button
                  key={emoji || "none"}
                  type="button"
                  onClick={() =>
                    updateSelectedDay({
                      specialEmoji: emoji || undefined,
                      specialLabel: emoji ? selectedDay.specialLabel : undefined,
                    })
                  }
                  className={`flex h-8 w-8 items-center justify-center rounded-md border text-sm ${
                    (selectedDay.specialEmoji ?? "") === emoji
                      ? "border-sky bg-sky-light"
                      : "border-[#E8EBF0] bg-white"
                  }`}
                >
                  {emoji || "—"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BUGFIX (Fabrizio, 05/08): questo controllo Salva era prima annidato
          solo dentro il pannello "giorno singolo" — con bulkMode attivo
          quel pannello non è mai montato, quindi applyBulkDraft() aggiornava
          lo stato locale ma non c'era alcun modo di raggiungere il pulsante
          Salva per scriverlo su Supabase. Estratto qui come blocco condiviso,
          visibile sia in modalità giorno singolo sia in modalità multipla. */}
      {mode === "edit" && (bulkMode || selectedDay) && (
        <div className="mt-4 rounded-lg border border-[#E8EBF0] bg-white p-4">
          {activityDbId ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={saving || !dirty}
                className="rounded-md bg-sky px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#3A9FDC] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Salvo…" : "Salva calendario"}
              </button>
              {saveError && <span className="text-xs font-medium text-orange">{saveError}</span>}
              {savedOk && !dirty && (
                <span className="text-xs font-medium text-green">Salvato su Supabase ✓</span>
              )}
              {dirty && !saving && (
                <span className="text-xs text-ink-3">Modifiche non ancora salvate</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <DemoBadge />
              <p className="text-[11px] text-ink-3">
                Questa attività non è ancora collegata a Supabase — le modifiche restano solo in
                questa sessione.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm border ${swatch}`} />
      {label}
    </div>
  );
}
