"use client";

// TRAMA — SCHOOL CALENDAR INTELLIGENCE (14/09/2026, §B10 "prima configurazione").
// Callout LEGGERO — mai bloccante (§B10: "NON bloccare il Planner se
// l'utente non lo configura... funzionalità assistiva, non obbligatoria") —
// mostrato SOLO quando: (a) SCHOOL_CALENDAR_INTELLIGENCE_ENABLED risolve
// true per questo utente (già verificato dal chiamante, page.tsx — questo
// componente non rifà alcuna verifica flag, stesso principio di
// PlannerCalendarExportCard), e (b) nessun figlio ha ancora un profilo
// scolastico (hasAnySchoolProfile=false).
//
// §B3: "Dove va a scuola? Regione / Comune, possibilmente 'Usa il mio
// Comune' come scorciatoia" — MAI un auto-completamento silenzioso: il
// pulsante "Usa il mio Comune" pre-compila SOLO il campo Comune con
// l'indirizzo di residenza già noto (profiles.city, se esiste) — la Regione
// resta sempre una scelta esplicita del genitore (residenza != regione
// scolastica per costruzione, §B3: "la residenza può essere usata, se
// esiste, come DEFAULT PROPOSTO... mai come verità definitiva").

import { useState } from "react";
import { setSchoolContextForFamilyAction } from "@/app/actions/school-calendar";
import { ITALIAN_REGIONS } from "@/lib/school-calendar/regions";

export default function SchoolCalendarOnboardingCallout({
  enabled,
  hasAnySchoolProfile,
  residenceCity,
  onConfigured,
}: {
  enabled: boolean;
  hasAnySchoolProfile: boolean;
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

  if (!enabled || hasAnySchoolProfile) return null;

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
      <div className="mb-4 rounded-xl border-[1.5px] border-[#E8EBF0] bg-white p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <i className="ti ti-check text-trama-violet" />
          Calendario scolastico impostato
        </p>
        <p className="mt-1 text-xs text-ink-2">
          Ricarica la pagina per vedere subito quali settimane senza scuola sono ancora da organizzare.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border-[1.5px] border-[#E8EBF0] bg-white p-4">
      <p className="mb-1 text-sm font-bold text-ink">Vuoi che TRAMA individui automaticamente le settimane senza scuola?</p>
      <p className="mb-3 text-xs text-ink-2">
        Ti mostriamo quando la scuola dei tuoi figli è chiusa, cosi&apos; puoi vedere subito quali settimane vanno organizzate.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-trama-violet px-4 py-3 text-center text-xs font-bold text-white transition-opacity active:opacity-80"
        >
          <i className="ti ti-school text-sm" />
          Imposta calendario scolastico
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-2">Regione della scuola</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="rounded-lg border border-[#E8EBF0] bg-white px-3 py-2 text-[13px] text-ink"
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
                className="min-w-0 flex-1 rounded-lg border border-[#E8EBF0] bg-white px-3 py-2 text-[13px] text-ink"
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
      )}
    </div>
  );
}
