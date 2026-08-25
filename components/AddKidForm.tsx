"use client";

import { useEffect, useState } from "react";
import { addKidAction } from "@/app/actions/kids";
import { isParentalDeclarationGateEnabledAction } from "@/app/actions/legal";
import { Kid, KidGender } from "@/lib/types";
import { categories as interestOptions } from "@/lib/mock-data";

export default function AddKidForm({
  onAdded,
  onCancel,
}: {
  onAdded: (kid: Kid) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<KidGender | "">("");
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // PRE-MICRO-PILOT CLOSURE GATE (task #570, 25/08/2026) — visibile SOLO se
  // LEGAL_TERMS_GATE risolve true per l'utente corrente (mai in produzione
  // oggi: default false, nessun override "global" mai scritto). Risolto
  // server-side (questo componente non legge mai feature_flag_overrides
  // direttamente) — vedi app/actions/legal.ts#isParentalDeclarationGateEnabledAction.
  const [declarationRequired, setDeclarationRequired] = useState(false);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  useEffect(() => {
    isParentalDeclarationGateEnabledAction().then(setDeclarationRequired);
  }, []);

  function toggleInterest(value: string) {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value]
    );
  }

  async function handleSave() {
    setError(null);
    if (declarationRequired && !declarationAccepted) {
      setError("Devi confermare la dichiarazione di responsabilità genitoriale");
      return;
    }
    setSaving(true);
    const result = await addKidAction(name, birthDate, gender || undefined, interests, declarationAccepted);
    setSaving(false);
    if (result.error || !result.kid) {
      setError(result.error || "Errore nel salvataggio");
      return;
    }
    onAdded(result.kid);
  }

  return (
    <div className="rounded-md border-[1.5px] border-[#E3F0FB] bg-sky-light/40 p-3">
      <div className="mb-2 grid grid-cols-2 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
          className="col-span-2 rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-sky"
        />
        <label className="text-[11px] text-ink-2">
          Data di nascita
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-sky"
          />
        </label>
        <label className="text-[11px] text-ink-2">
          Genere (opzionale)
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as KidGender | "")}
            className="mt-1 w-full rounded-md border border-[#E8EBF0] bg-white px-3 py-2 text-sm outline-none focus:border-sky"
          >
            <option value="">Preferisco non dire</option>
            <option value="F">Femmina</option>
            <option value="M">Maschio</option>
            <option value="altro">Altro</option>
          </select>
        </label>
      </div>

      <div className="mb-2.5">
        <div className="mb-1.5 text-[11px] text-ink-2">
          Interessi (opzionale) — usati per suggerire le attività più adatte in Home
        </div>
        <div className="flex flex-wrap gap-1.5">
          {interestOptions.map((c) => {
            const value = `${c.emoji} ${c.label}`;
            const active = interests.includes(value);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleInterest(value)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active ? "border-sky bg-sky text-white" : "border-[#E8EBF0] bg-white text-ink-2"
                }`}
              >
                {c.emoji} {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* PRE-MICRO-PILOT CLOSURE GATE (task #570) — mai visibile in
          produzione oggi (declarationRequired sempre false finché
          Fabrizio non attiva LEGAL_TERMS_GATE per un account di
          test/coorte). Testo segnaposto (CURRENT_PARENTAL_DECLARATION_VERSION
          in lib/legal/consent.ts): non ancora validato legalmente, non da
          mostrare a utenti reali. */}
      {declarationRequired && (
        <label className="mb-2.5 flex items-start gap-2 text-[11px] leading-snug text-ink-2">
          <input
            type="checkbox"
            checked={declarationAccepted}
            onChange={(e) => setDeclarationAccepted(e.target.checked)}
            className="mt-0.5"
            required
          />
          <span>
            Dichiaro di essere titolare della responsabilità genitoriale su {name.trim() || "questo bambino"} e
            autorizzo il trattamento dei suoi dati per l&apos;uso del servizio.
          </span>
        </label>
      )}

      {error && <p className="mb-2 text-xs font-medium text-orange">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-sky px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {saving ? "Salvo…" : "Salva bambino"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-[#E8EBF0] px-4 py-2 text-xs font-semibold text-ink"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
