"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, MealOption, ServiceOption } from "@/lib/types";
import { categories } from "@/lib/mock-data";
import { DemoBadge } from "@/components/StatusBadge";

const scheduleColors = ["#4DAFEF", "#3ECFB2", "#FF8C5A", "#8B7CF8", "#52C87A", "#9CA3AF"];

const mealLabels: Record<MealOption, string> = {
  included: "🍽️ Pasto incluso",
  packed: "🎒 Pranzo al sacco",
  none: "— Non fornito",
};

export default function ActivityEditForm({ activity }: { activity: Activity }) {
  const [form, setForm] = useState({
    name: activity.name,
    ageRange: activity.ageRange,
    pricePerWeek: activity.pricePerWeek,
    shuttlePrice: activity.shuttlePrice,
    description: activity.description,
    spotsLeft: activity.spotsLeft ?? 0,
    tagIds: activity.tagIds,
    address: activity.address,
    lat: activity.lat ?? 45.4642,
    lng: activity.lng ?? 9.19,
    mealOption: (activity.mealOption ?? "none") as MealOption,
    preService: activity.preService ?? { available: false, time: "07:30", priceExtra: 0 },
    postService: activity.postService ?? { available: false, time: "18:00", priceExtra: 0 },
    schedule: activity.schedule,
  });
  const [saved, setSaved] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function toggleTag(tagId: string) {
    update(
      "tagIds",
      form.tagIds.includes(tagId)
        ? form.tagIds.filter((t) => t !== tagId)
        : [...form.tagIds, tagId]
    );
  }

  function updateService(key: "preService" | "postService", patch: Partial<ServiceOption>) {
    update(key, { ...form[key], ...patch });
  }

  function updateScheduleRow(i: number, patch: Partial<(typeof form.schedule)[number]>) {
    update(
      "schedule",
      form.schedule.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
  }

  function addScheduleRow() {
    update("schedule", [
      ...form.schedule,
      { time: "12:00", label: "Nuova attività", color: scheduleColors[form.schedule.length % scheduleColors.length] },
    ]);
  }

  function removeScheduleRow(i: number) {
    update(
      "schedule",
      form.schedule.filter((_, idx) => idx !== i)
    );
  }

  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${form.lng - 0.01}%2C${
    form.lat - 0.01
  }%2C${form.lng + 0.01}%2C${form.lat + 0.01}&layer=mapnik&marker=${form.lat}%2C${form.lng}`;

  return (
    <div className="max-w-2xl">
      <Link
        href="/center/activities"
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-sky"
      >
        <i className="ti ti-arrow-left" /> Le tue attività
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <span className="text-2xl">{activity.emoji}</span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-ink">{activity.name}</h1>
            <DemoBadge />
          </div>
          <p className="text-sm text-ink-2">Modifica le informazioni pubblicate nell&apos;app</p>
        </div>
        <Link
          href={`/center/activities/${activity.id}/calendar`}
          className="ml-auto rounded-md bg-sky-light px-3.5 py-2 text-xs font-semibold text-sky"
        >
          Calendario disponibilità →
        </Link>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(true);
        }}
        className="space-y-6"
      >
        <div className="space-y-4 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <div className="text-sm font-bold text-ink">Informazioni generali</div>

          <Field label="Nome attività">
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fascia d'età">
              <input
                value={form.ageRange}
                onChange={(e) => update("ageRange", e.target.value)}
                className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
              />
            </Field>
            <Field label="Posti rimasti (in evidenza)">
              <input
                type="number"
                min={0}
                value={form.spotsLeft}
                onChange={(e) => update("spotsLeft", Number(e.target.value))}
                className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Prezzo a settimana (€)">
              <input
                type="number"
                min={0}
                value={form.pricePerWeek}
                onChange={(e) => update("pricePerWeek", Number(e.target.value))}
                className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
              />
            </Field>
            <Field label="Navetta (€/sett., 0 = non disponibile)">
              <input
                type="number"
                min={0}
                value={form.shuttlePrice}
                onChange={(e) => update("shuttlePrice", Number(e.target.value))}
                className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
              />
            </Field>
          </div>

          <Field label="Descrizione">
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={4}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </Field>
        </div>

        <div className="space-y-3 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <div className="text-sm font-bold text-ink">Tag</div>
          <p className="text-xs text-ink-2">
            Seleziona uno o più tag: aiutano i genitori a trovare la tua attività nella ricerca.
            La lista dei tag disponibili è gestita dall&apos;Admin piattaforma.
          </p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = form.tagIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleTag(c.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-sky bg-sky-light text-sky"
                      : "border-[#E8EBF0] bg-bg text-ink-2"
                  }`}
                >
                  <span>{c.emoji}</span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <div className="text-sm font-bold text-ink">Servizi extra e pasto</div>

          <div className="grid grid-cols-2 gap-4">
            <ServiceField
              title="Ingresso anticipato (pre-servizio)"
              value={form.preService}
              onChange={(patch) => updateService("preService", patch)}
              timeLabel="Disponibile da"
            />
            <ServiceField
              title="Uscita posticipata (post-servizio)"
              value={form.postService}
              onChange={(patch) => updateService("postService", patch)}
              timeLabel="Disponibile fino a"
            />
          </div>

          <Field label="Pasto">
            <select
              value={form.mealOption}
              onChange={(e) => update("mealOption", e.target.value as MealOption)}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            >
              {(Object.entries(mealLabels) as [MealOption, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="space-y-3 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-ink">Agenda della giornata</div>
            <button
              type="button"
              onClick={addScheduleRow}
              className="rounded-md bg-sky-light px-2.5 py-1.5 text-xs font-semibold text-sky"
            >
              + Aggiungi
            </button>
          </div>
          <div className="space-y-2">
            {form.schedule.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: s.color }} />
                <input
                  value={s.time}
                  onChange={(e) => updateScheduleRow(i, { time: e.target.value })}
                  placeholder="08:00"
                  className="w-20 flex-shrink-0 rounded-md border border-[#E8EBF0] bg-bg px-2 py-1.5 text-xs outline-none focus:border-sky"
                />
                <input
                  value={s.label}
                  onChange={(e) => updateScheduleRow(i, { label: e.target.value })}
                  placeholder="Attività"
                  className="flex-1 rounded-md border border-[#E8EBF0] bg-bg px-2 py-1.5 text-xs outline-none focus:border-sky"
                />
                <button
                  type="button"
                  onClick={() => removeScheduleRow(i)}
                  className="flex-shrink-0 text-ink-3 hover:text-orange"
                >
                  <i className="ti ti-trash text-base" />
                </button>
              </div>
            ))}
            {form.schedule.length === 0 && (
              <p className="text-xs text-ink-2">Nessuna voce in agenda — aggiungine una.</p>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <div className="text-sm font-bold text-ink">Posizione</div>
          <Field label="Indirizzo">
            <input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Latitudine">
              <input
                type="number"
                step="0.0001"
                value={form.lat}
                onChange={(e) => update("lat", Number(e.target.value))}
                className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
              />
            </Field>
            <Field label="Longitudine">
              <input
                type="number"
                step="0.0001"
                value={form.lng}
                onChange={(e) => update("lng", Number(e.target.value))}
                className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
              />
            </Field>
          </div>
          <div className="overflow-hidden rounded-md border border-[#E8EBF0]">
            <iframe
              key={mapSrc}
              title="Anteprima mappa"
              src={mapSrc}
              className="h-48 w-full"
              loading="lazy"
            />
          </div>
          <p className="text-[11px] text-ink-3">
            Anteprima con OpenStreetMap (nessuna chiave API richiesta). Aggiornabile in futuro con
            Google Maps o Mapbox se preferisci.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-[#E8EBF0] bg-white p-5">
          <button
            type="submit"
            className="rounded-md bg-sky px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC]"
          >
            Salva modifiche
          </button>
          {saved && (
            <span className="text-xs font-medium text-green">
              Salvato (demo) — verrà scritto su Supabase quando collegato.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-ink-2">{label}</label>
      {children}
    </div>
  );
}

function ServiceField({
  title,
  value,
  onChange,
  timeLabel,
}: {
  title: string;
  value: ServiceOption;
  onChange: (patch: Partial<ServiceOption>) => void;
  timeLabel: string;
}) {
  return (
    <div className="rounded-md bg-bg p-3">
      <label className="mb-2 flex items-center justify-between text-xs font-semibold text-ink">
        {title}
        <input
          type="checkbox"
          checked={value.available}
          onChange={(e) => onChange({ available: e.target.checked })}
          className="h-4 w-4 accent-sky"
        />
      </label>
      {value.available && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 text-[11px] text-ink-2">{timeLabel}</div>
            <input
              type="time"
              value={value.time}
              onChange={(e) => onChange({ time: e.target.value })}
              className="w-full rounded-md border border-[#E8EBF0] bg-white px-2 py-1.5 text-xs outline-none focus:border-sky"
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] text-ink-2">Sovrapprezzo (€/sett.)</div>
            <input
              type="number"
              min={0}
              value={value.priceExtra}
              onChange={(e) => onChange({ priceExtra: Number(e.target.value) })}
              className="w-full rounded-md border border-[#E8EBF0] bg-white px-2 py-1.5 text-xs outline-none focus:border-sky"
            />
          </div>
        </div>
      )}
    </div>
  );
}
