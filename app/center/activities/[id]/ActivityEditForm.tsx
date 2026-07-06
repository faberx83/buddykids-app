"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity } from "@/lib/types";

export default function ActivityEditForm({ activity }: { activity: Activity }) {
  const [form, setForm] = useState({
    name: activity.name,
    ageRange: activity.ageRange,
    pricePerWeek: activity.pricePerWeek,
    shuttlePrice: activity.shuttlePrice,
    description: activity.description,
    spotsLeft: activity.spotsLeft ?? 0,
  });
  const [saved, setSaved] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

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
          <h1 className="text-xl font-bold text-ink">{activity.name}</h1>
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
        className="space-y-4 rounded-lg border border-[#E8EBF0] bg-white p-5"
      >
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

        <div className="flex items-center gap-3 pt-2">
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
