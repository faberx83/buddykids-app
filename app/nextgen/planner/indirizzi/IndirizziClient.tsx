"use client";

import { useState } from "react";
import { ParentAddress, ADDRESS_KIND_LABELS } from "@/lib/nextgen/address-kinds";
import { setAddressAction, deleteAddressAction } from "@/app/actions/addresses";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import PageHeader from "@/components/PageHeader";

// SPRINT 5.3 (NEXTGEN) — Family Planner, "Logistica leggera": 4 indirizzi
// fissi (Casa, Lavoro Genitore 1, Lavoro Genitore 2, Altro con nome libero),
// solo testo — nessuna geocodifica. "Apri in Maps" costruisce un link
// diretto (funziona sia per Google Maps che per Apple Maps, a seconda di
// cosa il telefono apre di default): non serve alcuna API a pagamento. La
// vera distanza/tempo stimato dal centro arriva nella fase 5.4 (dato
// stubbato) insieme alla vista Mappa.
function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function AddressCard({ initial }: { initial: ParentAddress }) {
  const showToast = useNextgenToast();
  const [editing, setEditing] = useState(!initial.address);
  const [address, setAddress] = useState(initial.address);
  const [label, setLabel] = useState(initial.label ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(initial);

  // SPRINT 4 correttivo (feedback Fabrizio: "label indirizzo
  // personalizzabili") — anche i 3 kind fissi ora mostrano il nome
  // personalizzato se presente, non solo "Altro".
  const title = saved.label || ADDRESS_KIND_LABELS[initial.kind];

  async function handleSave() {
    setBusy(true);
    setError(null);
    const res = await setAddressAction(initial.kind, address, label);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSaved({ kind: initial.kind, label: label.trim() || null, address: address.trim() });
    setEditing(false);
    showToast("Indirizzo salvato!");
  }

  async function handleDelete() {
    setBusy(true);
    const res = await deleteAddressAction(initial.kind);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSaved({ kind: initial.kind, label: null, address: "" });
    setAddress("");
    setLabel("");
    setEditing(true);
    showToast("Indirizzo rimosso");
  }

  // 20/10/2026 — INDIRIZZI V2 (Fabrizio: "layout vecchio"): card con bordo,
  // campi da 48, pulsanti a raggio 12, azioni da 44px. Il titolo resta figlio
  // diretto della card (i test dal vivo cercano i campi partendo da lì).
  const field =
    "min-h-[48px] w-full rounded-[12px] border border-trama-line bg-white px-3.5 text-[16px] text-ink outline-none focus:border-trama-primary";
  const iconBtn = "flex h-11 w-11 items-center justify-center rounded-full text-[18px] text-ink-2 active:bg-black/[0.04] disabled:opacity-50";
  return (
    <div className="rounded-2xl border border-trama-line bg-white px-4 py-3.5">
      <div className="text-[15px] font-semibold text-ink">{title}</div>

      {editing ? (
        <div className="mt-2.5 flex flex-col gap-2.5">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-label="Nome del luogo"
            placeholder={initial.kind === "altro" ? "Nome (es. Casa dei nonni)" : "Nome personalizzato (facoltativo)"}
            className={field}
          />
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            aria-label="Indirizzo"
            placeholder="Via, città..."
            autoComplete="street-address"
            className={field}
          />
          {error && (
            <p role="alert" className="text-[13px] font-medium text-[#B3261E]">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            {saved.address && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setAddress(saved.address);
                  setLabel(saved.label ?? "");
                  setError(null);
                }}
                className="min-h-[44px] flex-1 rounded-[12px] border border-[#D9DDE5] bg-white px-4 text-[14px] font-semibold text-trama-primary"
              >
                Annulla
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={handleSave}
              className="min-h-[44px] flex-1 rounded-[12px] bg-trama-primary px-4 text-[14px] font-semibold text-white active:bg-trama-primary-press disabled:opacity-60"
            >
              {busy ? "Salvo…" : "Salva"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px] text-ink-2">{saved.address}</span>
          <div className="-mr-2 flex flex-shrink-0 items-center">
            <a href={mapsUrl(saved.address)} target="_blank" rel="noopener noreferrer" className={iconBtn} aria-label="Apri in Maps">
              <i className="ti ti-map-pin" aria-hidden="true" />
            </a>
            <button type="button" onClick={() => setEditing(true)} className={iconBtn} aria-label="Modifica">
              <i className="ti ti-pencil" aria-hidden="true" />
            </button>
            <button type="button" disabled={busy} onClick={handleDelete} className={iconBtn} aria-label="Rimuovi">
              <i className="ti ti-trash" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IndirizziClient({ addresses }: { addresses: ParentAddress[] }) {
  return (
    <div className="flex flex-col pb-10">
      {/* SPRINT 7 — l'hub "Logistica & Famiglia" e' stato eliminato (feedback
          Fabrizio: "Logistica e Famiglia non devono diventare una sezione ad
          hoc?"): Indirizzi e' raggiungibile da Profilo (vera sezione
          Famiglia, non piu' link separato dal Planner).
          SPRINT CORRETTIVO — da qui Indirizzi vive un livello più in
          profondità, dietro l'hub "Famiglia e logistica"
          (app/nextgen/profile/famiglia/): "indietro" torna lì. */}
      {/* TRAMA — BACK NAVIGATION PROGRESS FIX (15/09/2026): backHref invece
          di onBack — vedi ProfileNextgenClient.tsx per la spiegazione
          completa. */}
      <PageHeader title="Indirizzi" backHref="/nextgen/profile/famiglia" showBrandIcon />
      <div className="flex flex-col gap-2.5 px-5 pt-3">
        <p className="mb-2 text-[14px] leading-snug text-ink-2">
          I luoghi da cui partite di solito. Li ritrovi nei Promemoria e li apri in Maps con un tocco.
        </p>
        {addresses.map((a) => (
          <AddressCard key={a.kind} initial={a} />
        ))}
      </div>
    </div>
  );
}
