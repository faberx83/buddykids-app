"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createActivityFromTemplateAction } from "@/app/actions/center-activities-v2";
import type { ActivityTemplate } from "@/lib/centers/activity-templates";
import PartnerPageHeader from "@/components/center/PartnerPageHeader";

// TRAMA — PORTALE CENTRI V2, "CREA DA MODELLO" (28/10/2026, tavola 6).
// Il modello porta nome, orari, giorni della stagione e modalità a giorni
// singoli; il centro sceglie età, prezzo al giorno e posti. Dopo la
// creazione si apre la scheda di modifica di sempre (foto, servizi, luogo).

const inputCls =
  "w-full rounded-xl border border-partner-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-partner-primary";

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && <span className="text-[12.5px] text-ink-2">{hint}</span>}
    </div>
  );
}

export default function TemplateActivityForm({
  template,
  datesCount,
  datesLabel,
}: {
  template: ActivityTemplate;
  datesCount: number;
  datesLabel: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: template.name,
    ageMin: 6,
    ageMax: 11,
    pricePerDay: 30,
    capacity: 15,
    hours: template.hours,
    description: template.description,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await createActivityFromTemplateAction({ templateKey: template.key, ...form }).catch(
      () => ({ error: "Non siamo riusciti a creare l'attività, riprovate." }) as { error: string; activitySlug?: string }
    );
    setSaving(false);
    if (res.error || !res.activitySlug) return setError(res.error ?? "Non siamo riusciti a creare l'attività, riprovate.");
    router.push(`/center/activities/${res.activitySlug}`);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 animate-fade-in">
      {/* "‹" in alto lo mette il guscio (29/10/2026). */}

      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-partner-soft text-[26px]" aria-hidden="true">
          {template.emoji}
        </span>
        <div className="flex flex-col gap-0.5">
          <PartnerPageHeader title={template.title} subtitle="Pronta in un minuto: controllate i dati e create l'attività." />
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-partner-soft px-4 py-3">
        <i className="ti ti-calendar-check mt-0.5 text-[20px] text-partner-primary" aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-semibold text-partner-primary">
            {datesCount > 0
              ? `${datesCount} ${datesCount === 1 ? "giorno aperto" : "giorni aperti"}: ${datesLabel}`
              : "Per questo modello non ci sono più giorni in questa stagione"}
          </span>
          <span className="text-[12.5px] text-ink">
            Le famiglie si iscrivono anche a un giorno solo. Date, posti e giornate speciali si cambiano dopo, da &quot;Date e posti&quot;.
          </span>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4 rounded-[20px] border border-partner-line bg-white p-5">
        <Field label="Nome dell'attività" htmlFor="tpl-name">
          <input id="tpl-name" required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Età da" htmlFor="tpl-agemin">
            <input
              id="tpl-agemin"
              type="number"
              inputMode="numeric"
              min={0}
              max={18}
              value={form.ageMin}
              onChange={(e) => set("ageMin", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Età a" htmlFor="tpl-agemax">
            <input
              id="tpl-agemax"
              type="number"
              inputMode="numeric"
              min={0}
              max={18}
              value={form.ageMax}
              onChange={(e) => set("ageMax", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Prezzo al giorno (€)" htmlFor="tpl-price" hint="Nel pilota si paga al centro">
            <input
              id="tpl-price"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              value={form.pricePerDay}
              onChange={(e) => set("pricePerDay", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Posti al giorno" htmlFor="tpl-capacity">
            <input
              id="tpl-capacity"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={form.capacity}
              onChange={(e) => set("capacity", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Orari" htmlFor="tpl-hours">
          <input id="tpl-hours" value={form.hours} onChange={(e) => set("hours", e.target.value)} className={inputCls} />
        </Field>

        <Field label="Descrizione per le famiglie" htmlFor="tpl-desc">
          <textarea id="tpl-desc" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} className={inputCls} />
        </Field>

        {error && (
          <p role="alert" className="text-[13.5px] font-medium text-[#B4361F]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || datesCount === 0}
          className="min-h-[50px] rounded-xl bg-partner-primary px-5 text-[15px] font-semibold text-white hover:bg-partner-primary-press disabled:bg-[#B9C6C2]"
        >
          {saving ? "Creo l'attività…" : "Crea l'attività"}
        </button>
        <span className="text-center text-[12.5px] text-ink-2">Dopo potete aggiungere foto, servizi extra e il luogo esatto.</span>
      </form>
    </div>
  );
}
