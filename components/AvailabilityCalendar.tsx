"use client";

import { useMemo, useState, type ReactNode } from "react";
import { DayAvailability } from "@/lib/types";
import { saveActivityDaysAction } from "@/app/actions/center";
import { DemoBadge } from "@/components/StatusBadge";
import {
  applyBulkPatch,
  bulkDraftHasChanges,
  defaultBulkDraft,
  summarizeSpecialDay,
  type BulkDraft,
} from "@/lib/availability-bulk";

const SPECIAL_DAY_EMOJIS = ["🏊", "💦", "🎉", "🎨", "🌳", "🏆"];

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
//
// OD-02 / PT-MVP-08 (fix "FIX BEFORE BETA", 06/08): il `BulkDraft` originale
// applicava SEMPRE isOpen/capacity/discountPercent/lastMinute a tutti i
// giorni selezionati, sovrascrivendoli incondizionatamente, e non includeva
// affatto la "Giornata particolare" (specialEmoji/specialLabel — colonne
// special_emoji/special_label già esistenti su activity_days, nessuna
// migrazione necessaria). Tipo e logica di applicazione ora vivono in
// lib/availability-bulk.ts (testabile senza browser) con una semantica a 3
// stati per OGNI campo — campo non modificato / valore impostato / valore
// esplicitamente rimosso — per evitare sia l'ambiguità del valore vuoto sia
// la sovrascrittura accidentale di capacità/sconto/last-minute quando il
// Partner vuole cambiare solo la Giornata particolare (richiesta esplicita
// di Fabrizio).

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
  const [bulkDraft, setBulkDraft] = useState<BulkDraft>(defaultBulkDraft());

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
    if (!bulkDraftHasChanges(bulkDraft)) return;
    const updated = applyBulkPatch(localDays, bulkSelected, bulkDraft);
    setLocalDays(updated);
    setDirty(true);
    setSavedOk(false);
    onChange?.(updated);
    clearBulkSelection();
    // Reset per evitare che i campi spuntati in questa applicazione
    // vengano riapplicati per errore a una selezione successiva diversa.
    setBulkDraft(defaultBulkDraft());
  }

  function toggleBulkMode() {
    setBulkMode((prev) => !prev);
    setBulkSelected(new Set());
    setBulkDraft(defaultBulkDraft());
    setSelected(null);
  }

  const specialDaySummary = useMemo(
    () => summarizeSpecialDay(localDays, bulkSelected),
    [localDays, bulkSelected]
  );

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
                Spunta solo i campi che vuoi modificare: quelli non spuntati restano invariati sui
                giorni selezionati (nessun campo viene applicato per default).
              </p>

              <div className="grid grid-cols-2 gap-3">
                <BulkToggleField
                  label="Giorno aperto"
                  included={bulkDraft.isOpen.include}
                  onIncludedChange={(v) =>
                    setBulkDraft((prev) => ({ ...prev, isOpen: { ...prev.isOpen, include: v } }))
                  }
                >
                  <label className="flex items-center justify-between text-sm">
                    <span className="text-xs text-ink-2">Valore da applicare</span>
                    <input
                      type="checkbox"
                      checked={bulkDraft.isOpen.value}
                      disabled={!bulkDraft.isOpen.include}
                      onChange={(e) =>
                        setBulkDraft((prev) => ({
                          ...prev,
                          isOpen: { ...prev.isOpen, value: e.target.checked },
                        }))
                      }
                      className="h-4 w-4 accent-sky disabled:opacity-40"
                    />
                  </label>
                </BulkToggleField>

                <BulkToggleField
                  label="Promo last-minute"
                  included={bulkDraft.lastMinute.include}
                  onIncludedChange={(v) =>
                    setBulkDraft((prev) => ({ ...prev, lastMinute: { ...prev.lastMinute, include: v } }))
                  }
                >
                  <label className="flex items-center justify-between text-sm">
                    <span className="text-xs text-ink-2">Valore da applicare</span>
                    <input
                      type="checkbox"
                      checked={bulkDraft.lastMinute.value}
                      disabled={!bulkDraft.lastMinute.include}
                      onChange={(e) =>
                        setBulkDraft((prev) => ({
                          ...prev,
                          lastMinute: { ...prev.lastMinute, value: e.target.checked },
                        }))
                      }
                      className="h-4 w-4 accent-purple disabled:opacity-40"
                    />
                  </label>
                </BulkToggleField>

                <BulkToggleField
                  label="Posti totali"
                  included={bulkDraft.capacity.include}
                  onIncludedChange={(v) =>
                    setBulkDraft((prev) => ({ ...prev, capacity: { ...prev.capacity, include: v } }))
                  }
                >
                  <input
                    type="number"
                    min={0}
                    value={bulkDraft.capacity.value}
                    disabled={!bulkDraft.capacity.include}
                    onChange={(e) =>
                      setBulkDraft((prev) => ({
                        ...prev,
                        capacity: { ...prev.capacity, value: Number(e.target.value) },
                      }))
                    }
                    aria-label="Posti totali da applicare ai giorni selezionati"
                    className="w-full bg-transparent text-sm font-semibold text-ink outline-none disabled:opacity-40"
                  />
                </BulkToggleField>

                <BulkToggleField
                  label="Sconto sul giorno (%)"
                  included={bulkDraft.discountPercent.include}
                  onIncludedChange={(v) =>
                    setBulkDraft((prev) => ({
                      ...prev,
                      discountPercent: { ...prev.discountPercent, include: v },
                    }))
                  }
                >
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={bulkDraft.discountPercent.value}
                    disabled={!bulkDraft.discountPercent.include}
                    onChange={(e) =>
                      setBulkDraft((prev) => ({
                        ...prev,
                        discountPercent: { ...prev.discountPercent, value: Number(e.target.value) },
                      }))
                    }
                    aria-label="Sconto percentuale da applicare ai giorni selezionati"
                    className="w-full bg-transparent text-sm font-semibold text-ink outline-none disabled:opacity-40"
                  />
                </BulkToggleField>
              </div>

              {/* OD-02 / PT-MVP-08: pannello "Giornata particolare" bulk —
                  stesso set di emoji/etichetta del pannello a giorno
                  singolo sotto, 3 azioni esplicite (non modificare/imposta/
                  rimuovi), nessun valore vuoto ambiguo. */}
              <div className="mt-3 rounded-md border border-[#E8EBF0] bg-white px-3 py-2.5">
                <div className="mb-1.5 text-xs font-semibold text-ink-2">
                  Giornata particolare (giorni selezionati)
                </div>
                {specialDaySummary && (
                  <p className="mb-2 text-[11px] text-ink-3">
                    {specialDaySummary.mixed
                      ? "Valori attuali: misti tra i giorni selezionati"
                      : specialDaySummary.emoji
                      ? `Valore attuale su tutti i giorni selezionati: ${specialDaySummary.emoji}${
                          specialDaySummary.label ? ` ${specialDaySummary.label}` : ""
                        }`
                      : "Nessuna Giornata particolare impostata sui giorni selezionati"}
                  </p>
                )}
                <div
                  className="mb-2 flex flex-wrap gap-1.5"
                  role="group"
                  aria-label="Azione Giornata particolare per i giorni selezionati"
                >
                  {(
                    [
                      { value: "unchanged", label: "Non modificare" },
                      { value: "set", label: "Imposta" },
                      { value: "remove", label: "Rimuovi dai giorni selezionati" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={bulkDraft.specialDayAction === opt.value}
                      onClick={() => setBulkDraft((prev) => ({ ...prev, specialDayAction: opt.value }))}
                      className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        bulkDraft.specialDayAction === opt.value
                          ? "border-sky bg-sky-light text-sky"
                          : "border-[#E8EBF0] bg-white text-ink hover:bg-bg"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {bulkDraft.specialDayAction === "set" && (
                  <>
                    <input
                      value={bulkDraft.specialLabel ?? ""}
                      onChange={(e) =>
                        setBulkDraft((prev) => ({ ...prev, specialLabel: e.target.value || undefined }))
                      }
                      placeholder="Es. Giornata in piscina"
                      aria-label="Descrizione Giornata particolare da applicare ai giorni selezionati"
                      className="mb-2 w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
                    />
                    <div
                      className="flex flex-wrap gap-1.5"
                      role="group"
                      aria-label="Emoji Giornata particolare da applicare"
                    >
                      {SPECIAL_DAY_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          aria-pressed={bulkDraft.specialEmoji === emoji}
                          onClick={() => setBulkDraft((prev) => ({ ...prev, specialEmoji: emoji }))}
                          className={`flex h-8 w-8 items-center justify-center rounded-md border text-sm ${
                            bulkDraft.specialEmoji === emoji
                              ? "border-sky bg-sky-light"
                              : "border-[#E8EBF0] bg-white"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={applyBulkDraft}
                  disabled={!bulkDraftHasChanges(bulkDraft)}
                  className="rounded-md bg-sky px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#3A9FDC] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Applica a {bulkSelected.size} giorni
                </button>
                <span className="text-[11px] text-ink-3">
                  {bulkDraftHasChanges(bulkDraft)
                    ? 'Dopo aver applicato, ricorda di premere "Salva calendario" per scrivere le modifiche.'
                    : "Spunta almeno un campo (o scegli Imposta/Rimuovi per la Giornata particolare) prima di applicare."}
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

// OD-02 / PT-MVP-08: wrapper riusato da ognuno dei 4 campi bulk esistenti
// (Giorno aperto/Promo last-minute/Posti totali/Sconto) per dare a ciascuno
// la stessa semantica esplicita "non modificato di default" della
// Giornata particolare — una casella "Includi" separata dal controllo del
// valore, mai un valore vuoto ambiguo. Il controllo del valore è
// visivamente disattivato (non solo tramite colore: anche via
// `disabled`/opacità e il testo di stato sopra) finché non è incluso.
function BulkToggleField({
  label,
  included,
  onIncludedChange,
  children,
}: {
  label: string;
  included: boolean;
  onIncludedChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2.5 text-sm transition-colors ${
        included ? "border-sky bg-white" : "border-[#E8EBF0] bg-white/60"
      }`}
    >
      <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-ink-2">
        <input
          type="checkbox"
          checked={included}
          onChange={(e) => onIncludedChange(e.target.checked)}
          className="h-3.5 w-3.5 accent-sky"
        />
        {label}
        <span className="ml-auto text-[10px] font-normal text-ink-3">
          {included ? "Verrà applicato" : "Non modificato"}
        </span>
      </label>
      {children}
    </div>
  );
}
