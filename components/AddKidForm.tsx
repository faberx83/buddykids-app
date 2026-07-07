"use client";

import { useState } from "react";
import { addKidAction } from "@/app/actions/kids";
import { Kid, KidGender } from "@/lib/types";

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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError(null);
    setSaving(true);
    const result = await addKidAction(name, birthDate, gender || undefined);
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
