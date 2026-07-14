"use client";

import { useRouter } from "next/navigation";
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

  const title = initial.kind === "altro" ? saved.label || "Altro" : ADDRESS_KIND_LABELS[initial.kind];

  async function handleSave() {
    setBusy(true);
    setError(null);
    const res = await setAddressAction(initial.kind, address, initial.kind === "altro" ? label : undefined);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSaved({ kind: initial.kind, label: initial.kind === "altro" ? label.trim() : null, address: address.trim() });
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

  return (
    <div className="rounded-2xl bg-white p-4">
      <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-3">{title}</div>

      {editing ? (
        <div className="flex flex-col gap-2.5">
          {initial.kind === "altro" && (
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nome (es. Casa dei nonni)"
              className="rounded-xl border border-[#E8EBF0] px-3 py-2 text-[13.5px] font-semibold text-ink"
            />
          )}
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Via, città..."
            className="rounded-xl border border-[#E8EBF0] px-3 py-2 text-[13.5px] text-ink"
          />
          {error && <div className="text-[12px] font-medium text-red-500">{error}</div>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleSave}
              className="rounded-full bg-trama-violet px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
            >
              {busy ? "Salvo…" : "Salva"}
            </button>
            {saved.address && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setAddress(saved.address);
                  setLabel(saved.label ?? "");
                  setError(null);
                }}
                className="rounded-full bg-bg px-4 py-2 text-[12.5px] font-semibold text-ink-2"
              >
                Annulla
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{saved.address}</span>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <a
              href={mapsUrl(saved.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-trama-lilac/20 text-trama-violet"
              aria-label="Apri in Maps"
            >
              <i className="ti ti-map-pin text-[15px]" />
            </a>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-2"
              aria-label="Modifica"
            >
              <i className="ti ti-pencil text-[14px]" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-2 disabled:opacity-50"
              aria-label="Rimuovi"
            >
              <i className="ti ti-trash text-[14px]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IndirizziClient({ addresses }: { addresses: ParentAddress[] }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Indirizzi" onBack={() => router.push("/nextgen/planner")} showBrandIcon />
      <div className="flex flex-col gap-3 px-5 py-4">
        <p className="text-xs text-ink-2">
          Salva gli indirizzi di famiglia per aprirli velocemente in Maps. La distanza e il tempo di percorrenza dai
          centri arriveranno con la vista Mappa.
        </p>
        {addresses.map((a) => (
          <AddressCard key={a.kind} initial={a} />
        ))}
      </div>
    </div>
  );
}
