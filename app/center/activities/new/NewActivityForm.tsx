"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createActivityAction } from "@/app/actions/center";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function NewActivityForm({ centerReady }: { centerReady: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    emoji: "⭐",
    ageRange: "6-12",
    pricePerWeek: 150,
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  const canSubmit = centerReady && isSupabaseConfigured;

  return (
    <div className="max-w-xl">
      <Link
        href="/center/activities"
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-sky"
      >
        <i className="ti ti-arrow-left" /> Le tue attività
      </Link>

      <h1 className="mb-1 text-xl font-bold text-ink">Nuova attività</h1>
      <p className="mb-6 text-sm text-ink-2">
        Crea la scheda base: tag, agenda della giornata, servizi extra e calendario disponibilità
        si aggiungono subito dopo, dalla pagina di modifica.
      </p>

      {!isSupabaseConfigured && (
        <div className="mb-4 rounded-lg border border-orange-mid bg-orange-light p-4 text-sm text-ink">
          <p className="font-semibold">Supabase non è collegato in questo ambiente.</p>
          <p className="mt-1 text-ink-2">
            In modalità demo non è possibile creare attività reali — collega Supabase per
            attivare questa funzione.
          </p>
        </div>
      )}

      {isSupabaseConfigured && !centerReady && (
        <div className="mb-4 rounded-lg border border-orange-mid bg-orange-light p-4 text-sm text-ink">
          <p className="font-semibold">Il tuo account non è ancora collegato a un centro.</p>
          <p className="mt-1 text-ink-2">
            Vedi il messaggio nella pagina &quot;Le tue attività&quot; per il comando SQL da
            eseguire prima di poter creare un&apos;attività.
          </p>
        </div>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (!canSubmit) return;
          setSaving(true);
          const result = await createActivityAction(form);
          setSaving(false);
          if (result.error) {
            setError(result.error);
            return;
          }
          if (result.activitySlug) {
            router.push(`/center/activities/${result.activitySlug}`);
          }
        }}
        className="space-y-4 rounded-lg border border-[#E8EBF0] bg-white p-5"
      >
        <div className="flex gap-4">
          <div className="w-24 flex-shrink-0">
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Emoji</label>
            <input
              value={form.emoji}
              onChange={(e) => update("emoji", e.target.value)}
              maxLength={4}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-center text-lg outline-none focus:border-sky"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Nome attività</label>
            <input
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Es. Laboratorio Arti Creative"
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Fascia d&apos;età</label>
            <input
              value={form.ageRange}
              onChange={(e) => update("ageRange", e.target.value)}
              placeholder="6-12"
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">
              Prezzo a settimana (€)
            </label>
            <input
              type="number"
              min={0}
              required
              value={form.pricePerWeek}
              onChange={(e) => update("pricePerWeek", Number(e.target.value))}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-2">Descrizione</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Racconta ai genitori cosa faranno i bambini durante questa attività…"
            className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
          />
        </div>

        <div className="flex items-center gap-3 border-t border-[#E8EBF0] pt-4">
          <button
            type="submit"
            disabled={saving || !canSubmit}
            className="rounded-md bg-sky px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Creo…" : "Crea attività"}
          </button>
          {error && <span className="text-xs font-medium text-orange">{error}</span>}
        </div>
      </form>
    </div>
  );
}
