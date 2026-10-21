"use client";

// TRAMA — EXTERNAL PLANNER ITEMS (sezioni 3/10/11/17 del task).
//
// Sezione additiva e autonoma del Planner: "I tuoi impegni" — impegni che
// la famiglia organizza fuori da una prenotazione TRAMA (creati a mano, o
// aggiunti da una Scoperta TRAMA in Scopri). Inserita come componente
// separato (non dentro le 1400+ righe di PlannerClient.tsx) per restare
// puramente additiva: nessuna riga esistente di PlannerClient tocca questo
// componente, che riceve solo dati già letti server-side (page.tsx) e non
// altera in alcun modo Coverage/WeekStatus/School Calendar (sezione 13/14
// del task — questo componente non legge né scrive SeasonWeek.covered).
//
// COPY (sezione 17): "External Planner Item" non compare mai in UI — solo
// "impegno"/"I tuoi impegni"/"Aggiungi impegno", coerente con il resto del
// Planner (Timeline, Missioni, Promemoria — stesso registro linguistico).

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "next/navigation";
import { wantsNewExternalItem } from "@/lib/planner/new-external-item-link";
import type { Kid } from "@/lib/types";
import type { ExternalPlannerItem, ExternalPlannerItemInput, ExternalPlannerItemKind } from "@/lib/data/external-planner-items";
import {
  createExternalPlannerItemAction,
  updateExternalPlannerItemAction,
  deleteExternalPlannerItemAction,
} from "@/app/actions/external-planner-items";
import { markFirstUsefulAction } from "@/lib/nextgen/first-action";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import KidName from "@/components/nextgen/KidName";
import { useCloseOnBack } from "@/lib/nextgen/use-close-on-back";
import { isoWeekday, mondayOfIso, recurrenceLabel, schoolYearRange, WEEKDAY_LABELS_IT } from "@/lib/planner/recurrence";
import PlaceAutocomplete from "@/components/nextgen/PlaceAutocomplete";

const KIND_LABEL: Record<ExternalPlannerItemKind, string> = {
  activity: "Attività organizzata",
  commitment: "Impegno",
};

const KIND_ICON: Record<ExternalPlannerItemKind, string> = {
  activity: "ti-ball-football",
  commitment: "ti-calendar-event",
};

function formatDateRangeIt(startDate: string, endDate: string): string {
  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}

function emptyInput(defaultDate?: string): ExternalPlannerItemInput {
  const today = defaultDate && /^\d{4}-\d{2}-\d{2}$/.test(defaultDate) ? defaultDate : new Date().toISOString().slice(0, 10);
  return {
    kind: "commitment",
    title: "",
    startDate: today,
    endDate: today,
    allDay: true,
    startTime: null,
    endTime: null,
    location: null,
    notes: null,
    externalUrl: null,
    kidIds: [],
    recurrence: null,
  };
}

function itemToInput(item: ExternalPlannerItem): ExternalPlannerItemInput {
  return {
    kind: item.kind,
    title: item.title,
    startDate: item.startDate,
    endDate: item.endDate,
    allDay: item.allDay,
    startTime: item.startTime,
    endTime: item.endTime,
    location: item.location,
    notes: item.notes,
    externalUrl: item.externalUrl,
    kidIds: item.kidIds,
    recurrence: item.recurrence ?? null,
  };
}

function ItemForm({
  kids,
  initial,
  onCancel,
  onSaved,
  v2 = false,
  editing = false,
  routineEnabled = false,
  placeSearchEnabled = false,
}: {
  kids: Kid[];
  initial: ExternalPlannerItemInput;
  onCancel: () => void;
  onSaved: (input: ExternalPlannerItemInput) => Promise<{ error?: string }>;
  /** 20/10/2026 — "Un impegno" V2: foglio dal basso (vedi ItemFormSheetV2). */
  v2?: boolean;
  editing?: boolean;
  /** 21/10/2026 — release "settimana-tipo": "Si ripete ogni settimana". */
  routineEnabled?: boolean;
  /** 21/10/2026 — release "ricerca-luoghi": suggerimenti nel campo "Dove". */
  placeSearchEnabled?: boolean;
}) {
  // 20/10/2026 (V2): con un solo figlio è già scelto.
  const [form, setForm] = useState<ExternalPlannerItemInput>(() =>
    v2 && !editing && initial.kidIds.length === 0 && kids.length === 1 ? { ...initial, kidIds: [kids[0].id] } : initial
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleKid(kidId: string) {
    setForm((f) => ({
      ...f,
      kidIds: f.kidIds.includes(kidId) ? f.kidIds.filter((id) => id !== kidId) : [...f.kidIds, kidId],
    }));
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const result = await onSaved(form);
    setSaving(false);
    if (result.error) setError(result.error);
  }

  if (v2) {
    return (
      <ItemFormSheetV2
        kids={kids}
        form={form}
        setForm={setForm}
        toggleKid={toggleKid}
        saving={saving}
        error={error}
        editing={editing}
        routineEnabled={routineEnabled}
        placeSearchEnabled={placeSearchEnabled}
        onCancel={onCancel}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <div className="rounded-xl border border-[#E8EBF0] bg-white p-3.5">
      <div className="mb-3 flex gap-2">
        {(["commitment", "activity"] as ExternalPlannerItemKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setForm((f) => ({ ...f, kind: k }))}
            className={`flex-1 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              form.kind === k ? "bg-trama-violet text-white" : "border border-[#E8EBF0] text-ink-2"
            }`}
          >
            <i className={`ti ${KIND_ICON[k]} mr-1 text-[13px]`} />
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <label className="mb-2.5 block">
        <span className="mb-1 block text-[11px] font-semibold text-ink-2">Titolo *</span>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Es. Calcio, Dentista, Centro estivo…"
          className="w-full rounded-lg border border-[#E8EBF0] px-3 py-2 text-[13px]"
        />
      </label>

      <div className="mb-2.5 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-ink-2">Dal</span>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate }))}
            className="w-full rounded-lg border border-[#E8EBF0] px-3 py-2 text-[13px]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-ink-2">Al</span>
          <input
            type="date"
            value={form.endDate}
            min={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            className="w-full rounded-lg border border-[#E8EBF0] px-3 py-2 text-[13px]"
          />
        </label>
      </div>

      <label className="mb-2.5 flex items-center gap-2 text-[12px] font-medium text-ink-2">
        <input
          type="checkbox"
          checked={form.allDay}
          onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
        />
        Tutto il giorno
      </label>

      {!form.allDay && (
        <div className="mb-2.5 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-ink-2">Ora inizio</span>
            <input
              type="time"
              value={form.startTime ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value || null }))}
              className="w-full rounded-lg border border-[#E8EBF0] px-3 py-2 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-ink-2">Ora fine</span>
            <input
              type="time"
              value={form.endTime ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value || null }))}
              className="w-full rounded-lg border border-[#E8EBF0] px-3 py-2 text-[13px]"
            />
          </label>
        </div>
      )}

      <label className="mb-2.5 block">
        <span className="mb-1 block text-[11px] font-semibold text-ink-2">Luogo</span>
        <input
          type="text"
          value={form.location ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value || null }))}
          placeholder="Facoltativo"
          className="w-full rounded-lg border border-[#E8EBF0] px-3 py-2 text-[13px]"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-[11px] font-semibold text-ink-2">Note</span>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
          placeholder="Facoltativo"
          rows={2}
          className="w-full rounded-lg border border-[#E8EBF0] px-3 py-2 text-[13px]"
        />
      </label>

      <div className="mb-3">
        <span className="mb-1.5 block text-[11px] font-semibold text-ink-2">Per chi *</span>
        <div className="flex flex-wrap gap-1.5">
          {kids.map((kid) => (
            <button
              key={kid.id}
              type="button"
              onClick={() => toggleKid(kid.id)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                form.kidIds.includes(kid.id) ? "bg-trama-violet text-white" : "border border-[#E8EBF0] text-ink-2"
              }`}
            >
              <KidName kid={kid} />
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-2 text-[12px] font-medium text-trama-orange">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 rounded-full border border-[#E8EBF0] px-3 py-2 text-[12.5px] font-semibold text-ink-2 disabled:opacity-60"
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 rounded-full bg-trama-violet px-3 py-2 text-[12.5px] font-semibold text-white active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </div>
  );
}

// ─── "Un impegno" V2 (20/10/2026) ──────────────────────────────────────
// Fabrizio: "ha ancora layout vecchio". Stessi campi e stesso salvataggio
// di ItemForm, ma in un foglio dal basso come i Filtri di Scopri
// (DiscoverFiltersSheet): campi alti 48, figli come pillole blu notte,
// "Tutto il giorno" come interruttore, Salva sempre visibile in fondo.
// Indietro chiude il foglio (useCloseOnBack), come gli altri fogli V2.
const V2_INPUT =
  "min-h-[48px] w-full min-w-0 rounded-[12px] border border-trama-line bg-white px-3.5 text-[16px] text-ink outline-none focus:border-trama-primary";
const V2_LABEL = "mb-1.5 block text-[13.5px] font-semibold text-ink";

function ItemFormSheetV2({
  kids,
  form,
  setForm,
  toggleKid,
  saving,
  error,
  editing,
  routineEnabled = false,
  placeSearchEnabled = false,
  onCancel,
  onSubmit,
}: {
  kids: Kid[];
  form: ExternalPlannerItemInput;
  setForm: Dispatch<SetStateAction<ExternalPlannerItemInput>>;
  toggleKid: (kidId: string) => void;
  saving: boolean;
  error: string | null;
  editing: boolean;
  routineEnabled?: boolean;
  placeSearchEnabled?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  useCloseOnBack(true, onCancel);
  // 21/10/2026 — settimana tipo: si ripete nei giorni scelti, dentro il periodo Dal–Fino al.
  const repeating = Boolean(form.recurrence);
  function setRepeating(on: boolean) {
    setForm((f) => {
      if (!on) return { ...f, recurrence: null };
      const endDate = f.endDate > f.startDate ? f.endDate : schoolYearRange(f.startDate).endDate;
      return { ...f, endDate, recurrence: { freq: "weekly", weekdays: [isoWeekday(f.startDate)], interval: 1, anchor: mondayOfIso(f.startDate) } };
    });
  }
  function toggleWeekday(d: number) {
    setForm((f) => {
      if (!f.recurrence) return f;
      const has = f.recurrence.weekdays.includes(d);
      const weekdays = has ? f.recurrence.weekdays.filter((x) => x !== d) : [...f.recurrence.weekdays, d].sort((a, b) => a - b);
      return { ...f, recurrence: { ...f.recurrence, weekdays } };
    });
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const heading = editing ? "Modifica impegno" : "Nuovo impegno";
  const canSave = form.title.trim().length > 0 && form.kidIds.length > 0 && (!form.recurrence || form.recurrence.weekdays.length > 0);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" role="presentation" data-testid="impegno-sheet">
      <button type="button" aria-label="Chiudi" onClick={onCancel} className="absolute inset-0 bg-[rgba(23,42,77,0.45)]" />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="impegno-sheet-h"
        onSubmit={(e) => {
          e.preventDefault();
          if (!saving) onSubmit();
        }}
        className="relative mx-auto flex max-h-[92dvh] w-full max-w-[430px] flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(23,42,77,0.18)]"
      >
        <div className="flex flex-col px-5 pt-2.5">
          <span aria-hidden="true" className="mb-2 h-1 w-10 self-center rounded-full bg-[#D6DAE3]" />
          <div className="flex items-center justify-between pb-2">
            <h2 id="impegno-sheet-h" className="font-poppins text-[18px] font-semibold text-ink">
              {heading}
            </h2>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Chiudi"
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-[20px] text-ink-2 active:bg-black/[0.04]"
            >
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="no-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto px-5 pb-4">
          <div>
            <label htmlFor="impegno-titolo" className={V2_LABEL}>
              Cosa
            </label>
            <input
              id="impegno-titolo"
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Es. Calcio, Dentista, Centro estivo…"
              className={V2_INPUT}
              ref={(el) => {
                // Fuoco sul titolo senza far scorrere niente sotto il foglio.
                if (el && !editing && !el.dataset.focused) {
                  el.dataset.focused = "1";
                  el.focus({ preventScroll: true });
                }
              }}
            />
            <div className="mt-2 flex gap-2" role="group" aria-label="Tipo">
              {(["commitment", "activity"] as ExternalPlannerItemKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={form.kind === k}
                  onClick={() => setForm((f) => ({ ...f, kind: k }))}
                  className={`flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-semibold ${
                    form.kind === k ? "border-trama-primary bg-trama-primary-soft text-trama-primary" : "border-[#E3E6EC] bg-white text-ink-2"
                  }`}
                >
                  <i className={`ti ${KIND_ICON[k]} text-[15px]`} aria-hidden="true" />
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={V2_LABEL}>Per chi</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Per chi">
              {kids.map((kid) => {
                const on = form.kidIds.includes(kid.id);
                return (
                  <button
                    key={kid.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleKid(kid.id)}
                    className={`flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-[15px] font-semibold ${
                      on ? "border-trama-primary bg-trama-primary text-white" : "border-[#E3E6EC] bg-white text-ink"
                    }`}
                  >
                    {on && <i className="ti ti-check text-[15px]" aria-hidden="true" />}
                    <KidName kid={kid} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[13.5px] font-semibold text-ink">Quando</span>
            {routineEnabled && (
              <button
                type="button"
                role="switch"
                aria-checked={repeating}
                onClick={() => setRepeating(!repeating)}
                className="flex min-h-[48px] items-center justify-between gap-3 rounded-[12px] border border-trama-line bg-white px-3.5 text-left"
              >
                <span className="flex flex-col">
                  <span className="text-[15px] text-ink">Si ripete ogni settimana</span>
                  <span className="text-[12.5px] text-ink-2">Es. ritmica il mercoledì, nuoto il sabato</span>
                </span>
                <span aria-hidden="true" className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${repeating ? "bg-trama-primary" : "bg-[#D6DAE3]"}`}>
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${repeating ? "left-[22px]" : "left-0.5"}`} />
                </span>
              </button>
            )}
            {form.recurrence && (
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between gap-1" role="group" aria-label="Giorni della settimana">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                    const on = form.recurrence!.weekdays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        aria-label={WEEKDAY_LABELS_IT[d].long}
                        onClick={() => toggleWeekday(d)}
                        className={`flex h-11 w-11 items-center justify-center rounded-full border text-[14px] font-semibold ${
                          on ? "border-trama-primary bg-trama-primary text-white" : "border-[#E3E6EC] bg-white text-ink"
                        }`}
                      >
                        {WEEKDAY_LABELS_IT[d].letter}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.recurrence.interval === 2}
                  onClick={() =>
                    setForm((f) =>
                      f.recurrence ? { ...f, recurrence: { ...f.recurrence, interval: f.recurrence.interval === 2 ? 1 : 2, anchor: mondayOfIso(f.startDate) } } : f
                    )
                  }
                  className="flex min-h-[44px] items-center justify-between gap-3 px-1 text-left"
                >
                  <span className="text-[14px] text-ink">A settimane alterne</span>
                  <span aria-hidden="true" className={`relative h-6 w-10 flex-shrink-0 rounded-full transition-colors ${form.recurrence.interval === 2 ? "bg-trama-primary" : "bg-[#D6DAE3]"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.recurrence.interval === 2 ? "left-[18px]" : "left-0.5"}`} />
                  </span>
                </button>
                <p className="text-[12.5px] leading-snug text-ink-2">
                  {form.recurrence.weekdays.length === 0
                    ? "Scegli almeno un giorno."
                    : `${(recurrenceLabel(form.recurrence) ?? "").replace(/^./, (c) => c.toUpperCase())}. Il periodo lo scegli qui sotto: per "da gennaio", metti l'inizio a gennaio.`}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[12.5px] text-ink-2">Dal</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate }))}
                  className={V2_INPUT}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12.5px] text-ink-2">{form.recurrence ? "Fino al" : "Al"}</span>
                <input
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className={V2_INPUT}
                />
              </label>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.allDay}
              onClick={() => setForm((f) => ({ ...f, allDay: !f.allDay }))}
              className="flex min-h-[48px] items-center justify-between gap-3 rounded-[12px] border border-trama-line bg-white px-3.5 text-left"
            >
              <span className="text-[15px] text-ink">Tutto il giorno</span>
              <span aria-hidden="true" className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${form.allDay ? "bg-trama-primary" : "bg-[#D6DAE3]"}`}>
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${form.allDay ? "left-[22px]" : "left-0.5"}`} />
              </span>
            </button>
            {!form.allDay && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[12.5px] text-ink-2">Dalle</span>
                  <input
                    type="time"
                    value={form.startTime ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value || null }))}
                    className={V2_INPUT}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12.5px] text-ink-2">Alle</span>
                  <input
                    type="time"
                    value={form.endTime ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value || null }))}
                    className={V2_INPUT}
                  />
                </label>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="impegno-luogo" className={V2_LABEL}>
              Dove <span className="font-normal text-ink-2">(facoltativo)</span>
            </label>
            {/* 21/10/2026 — ricerca luoghi: scrivi il nome del posto e scegli il suggerimento (nome + indirizzo). */}
            <PlaceAutocomplete
              id="impegno-luogo"
              enabled={placeSearchEnabled}
              value={form.location ?? ""}
              onChange={(text) => setForm((f) => ({ ...f, location: text || null, ...(f.place ? { place: null } : {}) }))}
              onPick={(p) => setForm((f) => ({ ...f, place: { lat: p.lat, lng: p.lng } }))}
              placeholder={placeSearchEnabled ? "Es. Palestra Lamennais, Milano" : "Es. Palestra di via Rossi"}
              className={V2_INPUT}
            />
          </div>

          <div>
            <label htmlFor="impegno-note" className={V2_LABEL}>
              Note <span className="font-normal text-ink-2">(facoltativo)</span>
            </label>
            <textarea
              id="impegno-note"
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
              placeholder="Es. portare il costume"
              rows={2}
              className={`${V2_INPUT} min-h-[80px] py-3`}
            />
          </div>

          {error && (
            <p role="alert" className="text-[13.5px] font-medium text-[#B3261E]">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-[#F0F2F5] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="min-h-[52px] flex-1 rounded-[12px] border border-[#D9DDE5] bg-white px-4 text-[15px] font-semibold text-trama-primary disabled:opacity-60"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={saving || !canSave}
            className="min-h-[52px] flex-[2] rounded-[12px] bg-trama-primary px-4 text-[15px] font-semibold text-white active:bg-trama-primary-press disabled:bg-[#B9C0CC]"
          >
            {saving ? "Salvataggio…" : editing ? "Salva" : "Aggiungi al Planner"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ExternalPlannerItemsSection({
  items,
  kids,
  title = "I tuoi impegni",
  emptyText,
  v2 = false,
  defaultDate,
  routineEnabled = false,
  placeSearchEnabled = false,
  collapsible = false,
}: {
  items: ExternalPlannerItem[];
  kids: Kid[];
  /** 15/10/2026: data proposta per un nuovo impegno (la settimana aperta nel Planner). */
  defaultDate?: string;
  /** POLISH V2 (14/10/2026): titolo e testo vuoto della vista Settimana; default invariati. */
  title?: string;
  emptyText?: string;
  v2?: boolean;
  /** 21/10/2026 — release "settimana-tipo". */
  routineEnabled?: boolean;
  /** 21/10/2026 — release "ricerca-luoghi". */
  placeSearchEnabled?: boolean;
  /** 21/10/2026 — release "planner-giorno": una scheda "I tuoi impegni · Gestisci" che si apre; il foglio "Nuovo impegno" funziona comunque. */
  collapsible?: boolean;
}) {
  const showToast = useNextgenToast();
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"idle" | "creating" | { editing: string }>("idle");
  // FAMILY-FIRST BETA PASS (07/10/2026): arrivando da "Aggiungilo al tuo
  // Planner" (Scopri senza risultati / Home) il modulo è già aperto.
  // window.location (non useSearchParams): nessun Suspense boundary da
  // aggiungere alla pagina Planner.
  // 15/10/2026: reagisce anche quando "?nuovo=impegno" arriva mentre si è già
  // nel Planner (dal + della barra), non solo al primo caricamento.
  const searchParams = useSearchParams();
  const wantsNew = wantsNewExternalItem(`?${searchParams?.toString() ?? ""}`);
  useEffect(() => {
    if (!wantsNew) return;
    setMode("creating");
    // 21/10/2026 — con il foglio V2 non si scorre: il foglio copre già lo
    // schermo, e scorrere verso una sezione in fondo spostava l'intera app in
    // su (bianco sotto la barra, segnalato da Fabrizio dopo un impegno).
    if (!v2) document.getElementById("impegni")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [wantsNew, v2]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // TRAMA — DELETE UX · OPTIMISTIC REMOVAL (28/09/2026, live UX fix).
  //
  // PROBLEMA LIVE (segnalato da Fabrizio): tap "Rimuovi" → alcuni secondi di
  // attesa → poi la card sparisce.
  //
  // ROOT CAUSE (verificata leggendo per intero questo componente prima del
  // fix): `sorted` era derivato DIRETTAMENTE dalla prop `items`, senza alcuno
  // stato locale — nessun aggiornamento ottimistico esisteva. handleDelete
  // chiamava `await deleteExternalPlannerItemAction(itemId)` (soft-delete +
  // `revalidatePath("/nextgen/planner")`, vedi app/actions/
  // external-planner-items.ts) e SOLO dopo quel round-trip completo il
  // Server Action risolveva — a quel punto Next.js App Router rifà il fetch
  // del payload RSC della route (perché il path è stato invalidato) e
  // ri-renderizza PlannerClient.tsx con la nuova lista `externalPlannerItems`
  // da cui questo componente riceve `items` da capo. La card quindi restava
  // visibile per l'intera durata del round-trip (rete + query Supabase +
  // rifetch RSC), percepita come "delay di alcuni secondi" — non un bug di
  // rete lento, ma la totale assenza di un aggiornamento locale immediato.
  //
  // FIX: `removedIds` è un override locale puramente ottimistico (stesso
  // pattern già in uso da dismissedOverrides in PlannerClient.tsx) — al tap
  // su "Rimuovi" l'id entra SUBITO in questo set (la card sparisce
  // all'istante, prima di qualunque chiamata di rete), poi il soft-delete
  // reale parte in background. Se il server restituisce un errore, l'id
  // esce dal set (rollback: la card ricompare) e un toast spiega l'errore —
  // mai un "flash"/ricomparsa incoerente durante una revalidation riuscita,
  // perché in quel caso l'item non è più nemmeno nella prop `items` quando
  // arriva il nuovo render (resta comunque anche in removedIds, innocuo).
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  // Doppio tap protetto: un id "in volo" (già inviato al server, risposta
  // non ancora arrivata) non può essere reinviato — mostreremmo comunque la
  // card sparita (removedIds la nasconde già), ma senza questa guardia un
  // secondo tap veloce prima della prima risposta lancerebbe una seconda
  // softDelete concorrente sullo stesso id (innocua lato DB — idempotente —
  // ma uno spreco di rete evitabile).
  const [inFlightIds, setInFlightIds] = useState<Set<string>>(new Set());

  if (kids.length === 0) return null;

  const sorted = [...items]
    .filter((item) => !removedIds.has(item.id))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  async function handleCreate(input: ExternalPlannerItemInput) {
    const result = await createExternalPlannerItemAction(input);
    if (!result.error) {
      setMode("idle");
      showToast("Impegno aggiunto al Planner.");
      markFirstUsefulAction("impegno");
    }
    return result;
  }

  async function handleUpdate(itemId: string, input: ExternalPlannerItemInput) {
    const result = await updateExternalPlannerItemAction(itemId, input);
    if (!result.error) {
      setMode("idle");
      showToast("Impegno aggiornato.");
    }
    return result;
  }

  async function handleDelete(itemId: string) {
    // Doppio tap protetto — vedi commento su inFlightIds sopra.
    if (inFlightIds.has(itemId)) return;
    // Optimistic removal: la card sparisce ORA, non dopo il round-trip.
    setRemovedIds((cur) => new Set(cur).add(itemId));
    setInFlightIds((cur) => new Set(cur).add(itemId));
    setPendingDeleteId(null);
    const result = await deleteExternalPlannerItemAction(itemId);
    setInFlightIds((cur) => {
      const next = new Set(cur);
      next.delete(itemId);
      return next;
    });
    if (result.error) {
      // Rollback visuale: il soft-delete server è fallito, la card
      // ricompare — l'errore reale (rete, RLS, ecc.) resta comunque
      // visibile solo via toast, mai un fallimento silenzioso.
      setRemovedIds((cur) => {
        const next = new Set(cur);
        next.delete(itemId);
        return next;
      });
      showToast(result.error);
      return;
    }
    showToast("Impegno rimosso dal Planner.");
  }

  if (collapsible && !expanded && (mode === "idle" || mode === "creating")) {
    const names = Array.from(new Set(sorted.map((i) => i.title)));
    const detail =
      names.length === 0
        ? "Ancora nessuno: aggiungi sport, musica, feste e visite"
        : names.length <= 2
          ? names.join(" e ")
          : `${names.slice(0, 2).join(", ")} e altri ${names.length - 2}`;
    return (
      <div id="impegni" className="scroll-mt-20">
        <button
          type="button"
          onClick={() => (names.length === 0 ? setMode("creating") : setExpanded(true))}
          className="flex w-full items-center gap-3 rounded-2xl border border-trama-line bg-white px-4 py-3.5 text-left active:scale-[0.99]"
          data-testid="impegni-card"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-[15px] font-semibold text-ink">{title}</span>
            <span className="truncate text-[12.5px] text-ink-2">{detail}</span>
          </span>
          <span className="flex-shrink-0 text-[13.5px] font-semibold text-trama-accent-ink">{names.length === 0 ? "Aggiungi" : "Gestisci"} ›</span>
        </button>
        {mode === "creating" && (
          <ItemForm
            key={defaultDate ?? "oggi"}
            kids={kids}
            initial={emptyInput(defaultDate)}
            onCancel={() => setMode("idle")}
            onSaved={handleCreate}
            v2={v2}
            routineEnabled={routineEnabled}
            placeSearchEnabled={placeSearchEnabled}
          />
        )}
      </div>
    );
  }

  return (
    <div id="impegni" className="mb-4 scroll-mt-20">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <div className={v2 ? "font-poppins text-[17px] font-semibold text-ink" : "font-poppins text-sm font-bold text-ink"}>{title}</div>
          {collapsible && (
            <button type="button" onClick={() => setExpanded(false)} className="min-h-[36px] px-1 text-[13px] font-semibold text-trama-accent-ink">
              Riduci
            </button>
          )}
        </div>
        {mode === "idle" && (
          <button
            type="button"
            onClick={() => setMode("creating")}
            className={
              v2
                ? "flex min-h-[44px] flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-[12px] border border-[#D9DDE5] bg-white px-3 text-[13px] font-semibold text-trama-primary active:bg-black/[0.03]"
                : "flex items-center gap-1 rounded-full bg-trama-violet px-3 py-1.5 text-[12px] font-semibold text-white active:scale-[0.98]"
            }
          >
            <i className="ti ti-plus text-[13px]" />
            Aggiungi impegno
          </button>
        )}
      </div>

      {mode === "creating" && (
        <ItemForm
          key={defaultDate ?? "oggi"}
          kids={kids}
          initial={emptyInput(defaultDate)}
          onCancel={() => setMode("idle")}
          onSaved={handleCreate}
          v2={v2}
          routineEnabled={routineEnabled}
          placeSearchEnabled={placeSearchEnabled}
        />
      )}

      {sorted.length === 0 && mode === "idle" && (
        <p
          className={
            v2 ? "rounded-2xl border border-trama-line bg-white px-4 py-3.5 text-[14px] leading-snug text-ink-2" : "rounded-xl border border-dashed border-[#E8EBF0] p-3 text-[12px] text-ink-3"
          }
        >
          {emptyText ??
            "Aggiungi tutto quello che riguarda i tuoi figli, anche se non è su TRAMA: sport, musica, scuola, una festa, una visita, un impegno di famiglia."}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {sorted.map((item) => {
          const isEditing = typeof mode === "object" && mode.editing === item.id;
          if (isEditing) {
            return (
              <ItemForm
                key={item.id}
                kids={kids}
                initial={itemToInput(item)}
                onCancel={() => setMode("idle")}
                onSaved={(input) => handleUpdate(item.id, input)}
                v2={v2}
                editing
                routineEnabled={routineEnabled || Boolean(item.recurrence)}
                placeSearchEnabled={placeSearchEnabled}
              />
            );
          }
          const itemKids = kids.filter((k) => item.kidIds.includes(k.id));
          if (v2) {
            // 20/10/2026 — card V2: bordo sottile, raggio 16, azioni da 44px.
            const rec = recurrenceLabel(item.recurrence);
            const when = [
              rec ? `${rec.replace(/^./, (c) => c.toUpperCase())}` : formatDateRangeIt(item.startDate, item.endDate),
              !item.allDay && item.startTime ? `${item.startTime.slice(0, 5)}${item.endTime ? `–${item.endTime.slice(0, 5)}` : ""}` : null,
              rec ? `fino al ${formatDateRangeIt(item.endDate, item.endDate)}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div key={item.id} className="rounded-2xl border border-trama-line bg-white">
                <div className="flex items-start gap-3 py-3 pl-4 pr-1.5">
                  <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-trama-primary-soft text-[19px] text-trama-primary">
                    <i className={`ti ${KIND_ICON[item.kind]}`} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug text-ink">{item.title}</p>
                    <p className="mt-0.5 text-[13px] text-ink-2">{when}</p>
                    {item.location && <p className="text-[13px] text-ink-2">{item.location}</p>}
                    {itemKids.length > 0 && (
                      <p className="mt-0.5 text-[13px] font-semibold text-ink">
                        {itemKids.map((k) => k.name).join(", ")}
                      </p>
                    )}
                    {item.notes && <p className="mt-1 text-[13px] text-ink-3">{item.notes}</p>}
                    {(item.sourceType === "curated_discovery" || item.sourceType === "community_discovery" || item.externalUrl) && (
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-3">
                        {item.sourceType === "curated_discovery" && <span>Da Scoperta TRAMA</span>}
                        {item.sourceType === "community_discovery" && <span>Segnalato dalla community</span>}
                        {item.externalUrl && (
                          <a href={item.externalUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-trama-accent-ink">
                            Vedi la fonte
                          </a>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0">
                    <button
                      type="button"
                      aria-label="Modifica"
                      onClick={() => setMode({ editing: item.id })}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-[18px] text-ink-2 active:bg-black/[0.04]"
                    >
                      <i className="ti ti-pencil" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Elimina"
                      onClick={() => setPendingDeleteId(item.id)}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-[18px] text-ink-2 active:bg-black/[0.04]"
                    >
                      <i className="ti ti-trash" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {pendingDeleteId === item.id && (
                  <div className="flex flex-col gap-2.5 border-t border-[#F0F2F5] px-4 py-3">
                    <p className="text-[14px] text-ink">Togliere questo impegno dal Planner?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        className="min-h-[44px] flex-1 rounded-[12px] border border-[#D9DDE5] bg-white text-[14px] font-semibold text-trama-primary"
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="min-h-[44px] flex-1 rounded-[12px] bg-[#B3261E] text-[14px] font-semibold text-white"
                      >
                        Togli
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          }
          return (
            <div key={item.id} className="rounded-xl border border-[#F0F2F5] bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-1.5">
                    {/* Sezione 11 del task: grammatica visuale "Esterno" —
                        distingue sempre da un booking TRAMA (che vive nella
                        Timeline sopra, mai qui). Provenienza secondaria "Da
                        Scoperta TRAMA" solo quando pertinente. */}
                    <span className="rounded-full bg-[#F4F6FA] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-3">
                      Esterno
                    </span>
                    {item.sourceType === "curated_discovery" && (
                      <span className="text-[10px] font-medium text-ink-3">Da Scoperta TRAMA</span>
                    )}
                    {item.sourceType === "community_discovery" && (
                      <span className="text-[10px] font-medium text-ink-3">Segnalato dalla community</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink">
                    <i className={`ti ${KIND_ICON[item.kind]} text-[14px] text-trama-violet`} />
                    {item.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-2">
                    <span className="flex items-center gap-1">
                      <i className="ti ti-calendar text-[12px] text-ink-3" />
                      {formatDateRangeIt(item.startDate, item.endDate)}
                    </span>
                    {!item.allDay && item.startTime && (
                      <span className="flex items-center gap-1">
                        <i className="ti ti-clock text-[12px] text-ink-3" />
                        {item.startTime}
                        {item.endTime ? `–${item.endTime}` : ""}
                      </span>
                    )}
                    {item.location && (
                      <span className="flex items-center gap-1">
                        <i className="ti ti-map-pin text-[12px] text-ink-3" />
                        {item.location}
                      </span>
                    )}
                  </div>
                  {itemKids.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {itemKids.map((k) => (
                        <span key={k.id} className="rounded-full bg-[#F4F6FA] px-2 py-0.5 text-[10.5px] font-semibold text-ink-2">
                          <KidName kid={k} />
                        </span>
                      ))}
                    </div>
                  )}
                  {item.notes && <p className="mt-1.5 text-[11.5px] text-ink-3">{item.notes}</p>}
                  {item.externalUrl && (
                    <a
                      href={item.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-[11px] font-semibold text-trama-violet underline underline-offset-2"
                    >
                      Vedi la fonte ↗
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label="Modifica"
                    onClick={() => setMode({ editing: item.id })}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-ink-3 hover:bg-[#F4F6FA]"
                  >
                    <i className="ti ti-pencil text-[14px]" />
                  </button>
                  <button
                    type="button"
                    aria-label="Elimina"
                    onClick={() => setPendingDeleteId(item.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-ink-3 hover:bg-[#F4F6FA]"
                  >
                    <i className="ti ti-trash text-[14px]" />
                  </button>
                </div>
              </div>

              {pendingDeleteId === item.id && (
                <div className="mt-2.5 rounded-lg border border-[#E8EBF0] bg-bg p-2.5">
                  <p className="mb-2 text-[12px] text-ink-2">Rimuovere questo impegno dal Planner?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(null)}
                      className="flex-1 rounded-full border border-[#E8EBF0] px-3 py-1.5 text-[12px] font-semibold text-ink-2"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="flex-1 rounded-full bg-[#E8543E] px-3 py-1.5 text-[12px] font-semibold text-white"
                    >
                      Rimuovi
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
