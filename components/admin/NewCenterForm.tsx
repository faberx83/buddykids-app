"use client";

import { useState } from "react";
import { createCenterAndAssignAction } from "@/app/actions/admin";

export default function NewCenterForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("Milano");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [gestoreEmail, setGestoreEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    const result = await createCenterAndAssignAction({
      name,
      city,
      address,
      description,
      contactEmail,
      contactPhone,
      gestoreEmail: gestoreEmail || undefined,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(
      result.warning
        ? `Centro "${result.centerName}" creato. ${result.warning}`
        : result.assigned
        ? `Centro "${result.centerName}" creato e gestore assegnato con successo.`
        : `Centro "${result.centerName}" creato.`
    );
    setName("");
    setCity("Milano");
    setAddress("");
    setDescription("");
    setContactEmail("");
    setContactPhone("");
    setGestoreEmail("");
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 flex-shrink-0 rounded-md bg-sky px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC]"
      >
        + Nuovo centro
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid gap-4 rounded-lg border border-[#E8EBF0] bg-white p-5 md:grid-cols-2"
    >
      <div className="md:col-span-2 text-sm font-bold text-ink">Nuovo centro</div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-ink-2">Nome del centro</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-ink-2">Città</label>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-ink-2">Indirizzo</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-ink-2">Email di contatto</label>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-ink-2">Telefono</label>
        <input
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
        />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1.5 block text-xs font-semibold text-ink-2">Descrizione</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
        />
      </div>

      <div className="my-1 h-px bg-[#F0F2F5] md:col-span-2" />

      <div className="md:col-span-2">
        <label className="mb-1.5 block text-xs font-semibold text-ink-2">
          Email del gestore da assegnare (opzionale)
        </label>
        <input
          type="email"
          value={gestoreEmail}
          onChange={(e) => setGestoreEmail(e.target.value)}
          placeholder="La persona deve essersi già registrata nell'app"
          className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
        />
        <p className="mt-1 text-[11px] text-ink-3">
          Se la persona non si è ancora registrata, crea comunque il centro: potrai assegnare il
          gestore in un secondo momento.
        </p>
      </div>

      {error && <p className="text-xs font-medium text-orange md:col-span-2">{error}</p>}
      {success && <p className="text-xs font-medium text-green md:col-span-2">{success}</p>}

      <div className="flex gap-2 md:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-sky px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC] disabled:opacity-60"
        >
          {saving ? "Creo…" : "Crea centro"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-[#E8EBF0] px-5 py-2.5 text-sm font-semibold text-ink"
        >
          Chiudi
        </button>
      </div>
    </form>
  );
}
