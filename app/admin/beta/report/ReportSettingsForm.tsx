"use client";

// TRAMA — ADMIN BETA COCKPIT · Impostazioni: frequenza del report, inizio
// beta, soglie leggibili, survey, account esclusi. Salvate in
// beta_cockpit_settings (migration 46).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { THRESHOLD_LABEL, type CockpitThresholds } from "@/lib/beta-cockpit/definitions";
import type { SurveyConfig } from "@/lib/beta-cockpit/survey";
import { saveCockpitSettingsAction, setCockpitUserExcludedAction } from "@/app/actions/beta-cockpit";

const WEEKDAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

export default function ReportSettingsForm({
  initial,
  excluded,
  available,
}: {
  initial: { frequency: "manual" | "daily" | "weekly"; weekday: number; time: string; betaStart: string; thresholds: CockpitThresholds; surveyConfig: SurveyConfig };
  excluded: { userId: string; label: string }[];
  available: boolean;
}) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await saveCockpitSettingsAction(s);
    setBusy(false);
    setMsg(r.error ?? "Salvato.");
    if (!r.error) router.refresh();
  }

  const input = "rounded border border-[#E8EBF0] px-2 py-1 text-sm text-ink";
  return (
    <form onSubmit={save} className="flex flex-col gap-4 text-sm text-ink">
      {!available && <p className="text-xs text-ink-2">Valori di default: si possono cambiare dopo la migration 46.</p>}
      <fieldset className="flex flex-wrap items-end gap-3" disabled={!available}>
        <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-2">Frequenza report</legend>
        <div className="flex overflow-hidden rounded border border-[#E8EBF0]">
          {(["manual", "daily", "weekly"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setS({ ...s, frequency: f })}
              className={`px-3 py-1 text-xs font-semibold ${s.frequency === f ? "bg-trama-violet text-white" : "bg-white text-ink"}`}
            >
              {f === "manual" ? "Manuale" : f === "daily" ? "Giornaliero" : "Settimanale"}
            </button>
          ))}
        </div>
        {s.frequency === "weekly" && (
          <label className="flex flex-col text-xs font-semibold">
            Giorno
            <select value={s.weekday} onChange={(e) => setS({ ...s, weekday: Number(e.target.value) })} className={input}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        )}
        {s.frequency !== "manual" && (
          <label className="flex flex-col text-xs font-semibold">
            Ora
            <input type="time" value={s.time} onChange={(e) => setS({ ...s, time: e.target.value })} className={input} />
          </label>
        )}
        <span className="pb-1 text-xs text-ink-2">Timezone Europe/Rome</span>
        <label className="flex flex-col text-xs font-semibold">
          Inizio beta
          <input type="date" value={s.betaStart} onChange={(e) => setS({ ...s, betaStart: e.target.value })} className={input} />
        </label>
      </fieldset>
      <p className="-mt-2 text-xs text-ink-2">
        Il report di ogni finestra si ricalcola dai dati (niente copie nel database). Quando una finestra si chiude, il founder riceve un&apos;email col giro
        del mattino delle 8 (stesso cron del Buongiorno): con un&apos;ora successiva alle 8, l&apos;email arriva il giorno dopo.
      </p>

      <fieldset className="grid gap-2 sm:grid-cols-2" disabled={!available}>
        <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-2">Soglie</legend>
        {(Object.keys(THRESHOLD_LABEL) as (keyof CockpitThresholds)[]).map((k) => (
          <label key={k} className="flex items-center justify-between gap-2 text-xs">
            {THRESHOLD_LABEL[k]}
            <input
              type="number"
              min={1}
              max={720}
              value={s.thresholds[k]}
              onChange={(e) => setS({ ...s, thresholds: { ...s.thresholds, [k]: Number(e.target.value) } })}
              className={`${input} w-20`}
            />
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2" disabled={!available}>
        <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-2">Survey</legend>
        {(["survey_1", "survey_2"] as const).map((id) => (
          <label key={id} className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={s.surveyConfig[id].enabled}
              onChange={(e) => setS({ ...s, surveyConfig: { ...s.surveyConfig, [id]: { ...s.surveyConfig[id], enabled: e.target.checked } } })}
            />
            {id === "survey_1" ? "Survey 1" : "Survey 2"} dopo
            <input
              type="number"
              min={1}
              max={60}
              value={s.surveyConfig[id].afterDays}
              onChange={(e) => setS({ ...s, surveyConfig: { ...s.surveyConfig, [id]: { ...s.surveyConfig[id], afterDays: Number(e.target.value) } } })}
              className={`${input} w-16`}
            />
            giorni dalla registrazione
          </label>
        ))}
        <p className="text-xs text-ink-2">La survey compare alle famiglie solo con la release &quot;Survey della beta&quot; accesa.</p>
      </fieldset>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy || !available} className="rounded bg-trama-violet px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          Salva impostazioni
        </button>
        {msg && <span className="text-xs text-ink-2">{msg}</span>}
      </div>

      <div>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-2">Account esclusi dai conteggi</h3>
        <p className="mb-1 text-xs text-ink-2">
          Esclusi sempre: Admin, gestori, coorte &quot;internal-preview&quot;. Altri si escludono dal dettaglio della famiglia.
        </p>
        {excluded.length === 0 ? (
          <p className="text-xs text-ink-2">Nessuno.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {excluded.map((x) => (
              <li key={x.userId} className="flex items-center gap-2 text-xs">
                <b>{x.label}</b>
                <button
                  type="button"
                  onClick={async () => {
                    const r = await setCockpitUserExcludedAction(x.userId, false);
                    if (r.error) setMsg(r.error);
                    else router.refresh();
                  }}
                  className="rounded border border-[#E8EBF0] px-2 py-0.5 font-semibold"
                >
                  Riammetti
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </form>
  );
}
