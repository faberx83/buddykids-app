"use client";

import { useState } from "react";
import { DemoBadge } from "@/components/StatusBadge";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AdminPartnerOffer } from "@/lib/data/partner-offers";
import AvatarUploadButton from "@/components/AvatarUploadButton";
import {
  createPartnerOfferAction,
  deletePartnerOfferAction,
  togglePartnerOfferAction,
  updatePartnerOfferAction,
} from "@/app/actions/partner-offers";

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

// Deriva l'etichetta del pulsante di contatto dal tipo di link, invece di
// chiedere all'admin di scriverla a mano (era un campo ridondante e poco
// chiaro nel form).
function deriveContactLabel(href: string): string {
  if (href.startsWith("mailto:")) return "Scrivi";
  if (href.startsWith("tel:")) return "Chiama";
  return "Visita sito";
}

const emptyForm = {
  category: "Catering",
  emoji: "🍽️",
  name: "",
  description: "",
  contactHref: "",
  imageUrl: null as string | null,
};

export default function PartnerOffersAdminClient({
  initialOffers,
}: {
  initialOffers: AdminPartnerOffer[];
}) {
  const [items, setItems] = useState(initialOffers);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(offer: AdminPartnerOffer) {
    setEditingId(offer.id);
    setForm({
      category: offer.category,
      emoji: offer.emoji,
      name: offer.name,
      description: offer.description,
      contactHref: offer.contactHref,
      imageUrl: offer.imageUrl ?? null,
    });
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.contactHref.trim()) return;

    const payload = {
      ...form,
      contactLabel: deriveContactLabel(form.contactHref.trim()),
      imageUrl: form.imageUrl ?? undefined,
    };

    if (!isSupabaseConfigured) {
      // Demo senza Supabase: aggiorna solo lo stato locale.
      if (editingId) {
        setItems((prev) => prev.map((o) => (o.id === editingId ? { ...o, ...payload } : o)));
      } else {
        setItems((prev) => [{ id: `demo-${Date.now()}`, ...payload, active: true }, ...prev]);
      }
      setShowForm(false);
      return;
    }

    setSaving(true);
    if (editingId) {
      const result = await updatePartnerOfferAction(editingId, payload);
      setSaving(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setItems((prev) => prev.map((o) => (o.id === editingId ? { ...o, ...payload } : o)));
    } else {
      const result = await createPartnerOfferAction(payload);
      setSaving(false);
      if (result.error || !result.offer) {
        setError(result.error || "Errore nella creazione del fornitore");
        return;
      }
      setItems((prev) => [result.offer!, ...prev]);
    }
    setShowForm(false);
  }

  async function toggleActive(id: string) {
    const current = items.find((o) => o.id === id);
    if (!current) return;
    setItems((prev) => prev.map((o) => (o.id === id ? { ...o, active: !o.active } : o)));
    if (isUuid(id)) {
      const result = await togglePartnerOfferAction(id, !current.active);
      if (result.error) setError(result.error);
    }
  }

  async function removeOffer(id: string) {
    setItems((prev) => prev.filter((o) => o.id !== id));
    if (isUuid(id)) {
      const result = await deletePartnerOfferAction(id);
      if (result.error) setError(result.error);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {/* FIX CONTRASTO ADMIN: text-ink==bg-navy, vedi analytics/page.tsx */}
            <h1 className="text-xl font-bold text-white">Fornitori consigliati</h1>
            {!isSupabaseConfigured && <DemoBadge />}
          </div>
          <p className="text-sm text-navy-text2">
            Lista curata a mano (non un marketplace self-service) mostrata ai gestori nella
            sezione &quot;Servizi consigliati per il tuo centro&quot;.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="flex-shrink-0 rounded-md bg-sky px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC]"
        >
          + Nuovo fornitore
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="mb-6 grid gap-4 rounded-lg border border-[#E8EBF0] bg-white p-5 md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Foto/logo</label>
            <AvatarUploadButton
              folder="partner-offers"
              currentUrl={form.imageUrl}
              onUploaded={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
              size={56}
              fallback={
                <div className="flex h-full w-full items-center justify-center text-2xl">
                  {form.emoji}
                </div>
              }
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Categoria</label>
            <input
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Es. Catering, Assicurazione, Materiali…"
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Emoji</label>
            <input
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">
              Nome fornitore
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Es. Catering Buon Appetito"
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Descrizione</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Breve descrizione del servizio offerto"
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">
              Link contatto
            </label>
            <input
              value={form.contactHref}
              onChange={(e) => setForm((f) => ({ ...f, contactHref: e.target.value }))}
              placeholder="mailto:..., tel:... oppure https://..."
              className="w-full rounded-md border border-[#E8EBF0] bg-bg px-3 py-2 text-sm outline-none focus:border-sky"
            />
            <p className="mt-1 text-[11px] text-ink-3">
              L&apos;etichetta del pulsante ({"Scrivi"}/{"Chiama"}/{"Visita sito"}) viene decisa
              automaticamente in base al link (mailto:, tel: o https://).
            </p>
          </div>

          {error && <p className="text-xs font-medium text-orange md:col-span-2">{error}</p>}

          <div className="flex gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-sky px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC] disabled:opacity-60"
            >
              {saving ? "Salvo…" : editingId ? "Salva modifiche" : "Crea fornitore"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-[#E8EBF0] px-5 py-2.5 text-sm font-semibold text-ink"
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-[#E8EBF0] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
              <th className="px-4 py-3 font-medium">Fornitore</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Contatto</th>
              <th className="px-4 py-3 font-medium">Stato</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-b border-[#F0F2F5] last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {o.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage, non ottimizzabile senza config extra
                      <img src={o.imageUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="text-lg">{o.emoji}</span>
                    )}
                    <div>
                      <div className="font-medium text-ink">{o.name}</div>
                      {o.description && <div className="text-xs text-ink-2">{o.description}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-2">{o.category}</td>
                <td className="px-4 py-3 text-ink-2">{o.contactLabel}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(o.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      o.active ? "bg-green-light text-[#2d8f52]" : "bg-[#F4F6FA] text-ink-3"
                    }`}
                  >
                    {o.active ? "Pubblicato" : "Nascosto"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => startEdit(o)}
                    className="mr-3 text-xs font-medium text-sky"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => removeOffer(o.id)}
                    className="text-xs font-medium text-orange"
                  >
                    Elimina
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-ink-2">
                  Nessun fornitore pubblicato — creane uno con il pulsante qui sopra.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-5 text-[11px] text-ink-3">
        {isSupabaseConfigured
          ? "Le modifiche vengono salvate su Supabase e sono visibili subito ai gestori (solo quelle Pubblicate)."
          : "Modifiche demo salvate solo in questa sessione — quando colleghi Supabase aggiorneranno la tabella partner_offers."}
      </p>
    </div>
  );
}
