"use client";

// TRAMA — SCHOOL CALENDAR UX REFINEMENT (14/09/2026, §4 "SCHOOL CALENDAR
// CALLOUT — DESIGN PRECISO" + §13 "MULTI-CHILD"). Sostituisce il box grande
// della versione precedente (§B10, 14/09/2026 mattina) con una card
// COMPATTA, coerente con "School Calendar NON deve sembrare una feature
// amministrativa aggiunta sopra al Planner" (§1). Mostrata SOLO quando: (a)
// SCHOOL_CALENDAR_INTELLIGENCE_ENABLED risolve true per questo utente (già
// verificato dal chiamante, page.tsx), e (b) almeno un figlio NON ha ancora
// un profilo scolastico — §13: la copy cambia in base a QUANTI mancano
// (0 configurati -> "Attiva…" / 1+ ma non tutti -> "Completa…" col
// conteggio / tutti configurati -> nessun callout, mai più mostrato come
// "configurazione persistente").
//
// §3 "PLANNER — STRUTTURA FINALE": posizione ESATTA nel PlannerClient è
// DOPO "Vedi tutte le settimane" e PRIMA di "Calendario e Chi fa cosa?" —
// questo componente non decide la propria posizione, si limita a
// renderizzare (o nulla) dove il chiamante lo monta.
//
// §B3 (invariato): "Dove va a scuola? Regione / Comune, possibilmente 'Usa
// il mio Comune' come scorciatoia" — MAI un auto-completamento silenzioso:
// il pulsante "Usa il mio Comune" pre-compila SOLO il campo Comune con
// l'indirizzo di residenza già noto (profiles.city, se esiste) — la Regione
// resta sempre una scelta esplicita del genitore.

import { useState } from "react";
import { setSchoolContextForFamilyAction } from "@/app/actions/school-calendar";
import { ITALIAN_REGIONS } from "@/lib/school-calendar/regions";

function missingChildrenCopy(count: number): string {
  return count === 1 ? "Manca il contesto scolastico per 1 bambino." : `Manca il contesto scolastico per ${count} bambini.`;
}

export default function SchoolCalendarOnboardingCallout({
  enabled,
  kidsWithoutProfileCount,
  kidsTotalCount,
  residenceCity,
  onConfigured,
}: {
  enabled: boolean;
  // §13 multi-child: quanti figli mancano/quanti totali — decide la copy
  // ("Attiva" vs "Completa") e quando nascondere del tutto il callout
  // (kidsWithoutProfileCount === 0: tutti configurati, o kidsTotalCount ===
  // 0: nessun figlio ancora inserito, nulla da proporre qui).
  kidsWithoutProfileCount: number;
  kidsTotalCount: number;
  // profiles.city — testo libero, MAI interpretato come Regione (solo
  // proposto come default per il campo Comune).
  residenceCity: string | null;
  onConfigured?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState("");
  const [comune, setComune] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!enabled || kidsTotalCount === 0 || kidsWithoutProfileCount === 0) return null;

  const isPartial = kidsWithoutProfileCount < kidsTotalCount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!region) {
      setError("Seleziona una regione");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await setSchoolContextForFamilyAction(region, comune);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDone(true);
    onConfigured?.();
  }

  if (done) {
    return (
      <div className="mb-3.5 flex items-start gap-2.5 rounded-2xl border border-[rgba(111,99,197,0.18)] bg-[rgba(111,99,197,0.06)] p-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(111,99,197,0.12)]">
          <i className="ti ti-check text-[16px] text-trama-violet" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-poppins text-[13px] font-semibold text-ink">Calendario scolastico impostato</p>
          <p className="mt-0.5 text-[12px] text-ink-2">
            Ricarica la pagina per vedere subito quali settimane senza scuola sono ancora da organizzare.
          </p>
        </div>
      </div>
    );
  }

  // §4: card compatta, NO shadow evidente, NO bottone pieno a piena
  // larghezza — struttura "[icona] Titolo / testo breve / CTA".
  if (!open) {
    return (
      <div className="mb-3.5 flex items-start gap-2.5 rounded-2xl border border-[rgba(111,99,197,0.18)] bg-[rgba(111,99,197,0.06)] p-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(111,99,197,0.12)]">
          <i className="ti ti-school text-[16px] text-trama-violet" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-poppins text-[13px] font-semibold text-ink">
            {isPartial ? "Completa il calendario scolastico" : "Attiva il calendario scolastico"}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-2">
            {isPartial ? missingChildrenCopy(kidsWithoutProfileCount) : "Individua automaticamente vacanze e settimane da organizzare."}
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-1.5 inline-flex h-8 items-center gap-0.5 text-[12.5px] font-semibold text-trama-violet active:opacity-70"
          >
            {isPartial ? "Completa" : "Imposta scuola"}
            <i className="ti ti-chevron-right text-[13px]" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3.5 rounded-2xl border border-[rgba(111,99,197,0.18)] bg-[rgba(111,99,197,0.06)] p-3.5">
      <p className="mb-2.5 flex items-center gap-1.5 font-poppins text-[13px] font-semibold text-ink">
        <i className="ti ti-school text-[15px] text-trama-violet" />
        {isPartial ? "Completa il calendario scolastico" : "Attiva il calendario scolastico"}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-ink-2">Regione della scuola</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="h-11 rounded-lg border border-[#E8EBF0] bg-white px-3 text-[13px] text-ink"
          >
            <option value="">Seleziona…</option>
            {ITALIAN_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-ink-2">Comune della scuola (opzionale)</span>
          <div className="flex gap-1.5">
            <input
              value={comune}
              onChange={(e) => setComune(e.target.value)}
              placeholder="Es. Milano"
              className="h-11 min-w-0 flex-1 rounded-lg border border-[#E8EBF0] bg-white px-3 text-[13px] text-ink"
            />
            {residenceCity && (
              <button
                type="button"
                onClick={() => setComune(residenceCity)}
                className="whitespace-nowrap rounded-lg border border-[#E8EBF0] px-2.5 text-[11px] font-semibold text-trama-violet"
              >
                Usa il mio Comune
              </button>
            )}
          </div>
        </label>
        {error && <p className="text-[11px] text-[#C0392B]">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-trama-violet py-2.5 text-xs font-bold text-white disabled:opacity-60"
          >
            {saving ? "Salvataggio…" : "Salva"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={saving}
            className="rounded-lg border border-[#E8EBF0] px-3 text-xs font-semibold text-ink-2"
          >
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}
