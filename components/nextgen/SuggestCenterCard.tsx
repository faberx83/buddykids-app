"use client";

import { useState } from "react";
import { suggestCenterLeadAction } from "@/app/actions/center-leads";
import { CenterLeadDemandContext } from "@/lib/types";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";

// TRAMA ONE Build Sprint 5 — J11 "Suggerisci un centro non iscritto".
// Punto di ingresso Genitore: card leggera nello stato zero-risultati di
// Scopri/Ricerca (§B.2.1 della fonte di design: "Opzione A - Suggerimento
// gestito da TRAMA", raccomandata come base del pilot). Crea SOLO una riga
// center_leads — mai un'attività pubblica o prenotabile (DDL-023).
export default function SuggestCenterCard({ demandContext }: { demandContext: CenterLeadDemandContext }) {
  const toast = useNextgenToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [locality, setLocality] = useState(demandContext.locality ?? "");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <div className="rounded-lg border border-[#D8DEE8] bg-white p-4 text-center text-sm text-ink-2">
        <i className="ti ti-circle-check-filled mr-1 text-green" />
        Grazie! Abbiamo ricevuto la tua segnalazione — la trovi in{" "}
        <a href="/nextgen/center-leads" className="font-semibold text-trama-violet underline">
          I tuoi suggerimenti
        </a>
        .
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#D8DEE8] bg-white p-4 text-center">
        <p className="text-sm text-ink-2">Non trovi il centro che cerchi?</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-trama-violet px-4 py-2 text-[13px] font-semibold text-white active:scale-95"
        >
          Suggerisci un centro
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#D8DEE8] bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-ink">Suggerisci un centro non ancora su TRAMA</p>
      <div className="flex flex-col gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome del centro *"
          className="rounded-lg border border-[#D8DEE8] px-3 py-2 text-sm"
        />
        <input
          value={locality}
          onChange={(e) => setLocality(e.target.value)}
          placeholder="Città / zona (indicativo)"
          className="rounded-lg border border-[#D8DEE8] px-3 py-2 text-sm"
        />
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Sito, email o telefono (solo se lo conosci già)"
          className="rounded-lg border border-[#D8DEE8] px-3 py-2 text-sm"
        />
        <p className="text-[11px] text-ink-2">
          Non creiamo subito una scheda pubblica: verifichiamo prima il centro. Nessuna promessa di sconto prima
          dell&apos;eleggibilità.
        </p>
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-full border border-[#D8DEE8] px-4 py-2 text-[13px] font-semibold text-ink-2"
          >
            Annulla
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setError(null);
              setSubmitting(true);
              const res = await suggestCenterLeadAction(
                name,
                locality || undefined,
                contact || undefined,
                demandContext
              );
              setSubmitting(false);
              if (res.error) {
                setError(res.error);
                return;
              }
              setDone(true);
              toast("Segnalazione inviata, grazie!");
            }}
            className="flex-1 rounded-full bg-trama-violet px-4 py-2 text-[13px] font-semibold text-white active:scale-95 disabled:opacity-60"
          >
            {submitting ? "Invio…" : "Invia segnalazione"}
          </button>
        </div>
      </div>
    </div>
  );
}
