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

import { useState } from "react";
import type { Kid } from "@/lib/types";
import type { ExternalPlannerItem, ExternalPlannerItemInput, ExternalPlannerItemKind } from "@/lib/data/external-planner-items";
import {
  createExternalPlannerItemAction,
  updateExternalPlannerItemAction,
  deleteExternalPlannerItemAction,
} from "@/app/actions/external-planner-items";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";

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

function emptyInput(): ExternalPlannerItemInput {
  const today = new Date().toISOString().slice(0, 10);
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
  };
}

function ItemForm({
  kids,
  initial,
  onCancel,
  onSaved,
}: {
  kids: Kid[];
  initial: ExternalPlannerItemInput;
  onCancel: () => void;
  onSaved: (input: ExternalPlannerItemInput) => Promise<{ error?: string }>;
}) {
  const [form, setForm] = useState<ExternalPlannerItemInput>(initial);
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
              {kid.emoji} {kid.name}
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

export default function ExternalPlannerItemsSection({ items, kids }: { items: ExternalPlannerItem[]; kids: Kid[] }) {
  const showToast = useNextgenToast();
  const [mode, setMode] = useState<"idle" | "creating" | { editing: string }>("idle");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  if (kids.length === 0) return null;

  const sorted = [...items].sort((a, b) => a.startDate.localeCompare(b.startDate));

  async function handleCreate(input: ExternalPlannerItemInput) {
    const result = await createExternalPlannerItemAction(input);
    if (!result.error) {
      setMode("idle");
      showToast("Impegno aggiunto al Planner.");
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
    const result = await deleteExternalPlannerItemAction(itemId);
    setPendingDeleteId(null);
    if (!result.error) showToast("Impegno rimosso dal Planner.");
  }

  return (
    <div className="mb-4">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="font-poppins text-sm font-bold text-ink">I tuoi impegni</div>
        {mode === "idle" && (
          <button
            type="button"
            onClick={() => setMode("creating")}
            className="flex items-center gap-1 rounded-full bg-trama-violet px-3 py-1.5 text-[12px] font-semibold text-white active:scale-[0.98]"
          >
            <i className="ti ti-plus text-[13px]" />
            Aggiungi impegno
          </button>
        )}
      </div>

      {mode === "creating" && <ItemForm kids={kids} initial={emptyInput()} onCancel={() => setMode("idle")} onSaved={handleCreate} />}

      {sorted.length === 0 && mode === "idle" && (
        <p className="rounded-xl border border-dashed border-[#E8EBF0] p-3 text-[12px] text-ink-3">
          Nessun impegno esterno ancora — aggiungi qui ciò che organizzi fuori da TRAMA (calcio, danza, dentista, un centro estivo trovato altrove…).
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
              />
            );
          }
          const itemKids = kids.filter((k) => item.kidIds.includes(k.id));
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
                          {k.emoji} {k.name}
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
