"use client";

// TRAMA — DISCOVERY LIVE UX BUGFIX (22/09/2026), §6 "PROPONI INVITO FROM
// MAP — BUG". Dialog di conferma "Proponi invito" per i marker Curated
// invitabili, ESTRATTO da DiscoveryMapPopupCard.tsx e reso indipendente dal
// ciclo di vita del <Popup> di Leaflet (root cause del bug live: il dialog
// viveva dentro il popup e Leaflet lo richiudeva al primo tap, prima che
// l'utente potesse vederlo — vedi commento in DiscoveryMapPopupCard.tsx).
// Montato UNA sola volta a livello SearchDiscoveryClient, come un normale
// dialog fisso a schermo intero — stesso pattern visivo già in uso da
// BetaFeedbackButton.tsx/NotificationCenter.tsx (`fixed inset-0 z-[80]`).
//
// Riusa la STESSA Server Action già verificata live (nessuna duplicazione):
// proposeDiscoveryLeadInviteAction, identica a quella chiamata da
// DiscoveryLeadCard.tsx (FREEZE, non toccata da questo pass) — stessa firma,
// stesso comportamento server-side, stesso dedupe.

import { useState } from "react";
import type { DiscoveryLeadRecord } from "@/lib/discovery/real-dataset";
import { proposeDiscoveryLeadInviteAction } from "@/app/actions/discovery";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";

export default function DiscoveryProposeInviteDialog({
  lead,
  onClose,
  onProposed,
}: {
  lead: DiscoveryLeadRecord;
  onClose: () => void;
  // Chiamato con esito "done" o "already" (mai su errore) — SearchDiscoveryClient
  // lo usa per marcare `lead.id` come già proposto, cosi il popup Mappa (se
  // riaperto) mostra subito "Hai già proposto questo centro" invece del
  // bottone, senza dover richiamare il server di nuovo.
  onProposed: (leadId: string) => void;
}) {
  const showToast = useNextgenToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    const result = await proposeDiscoveryLeadInviteAction(lead.id, lead.organizerName, lead.comune);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onProposed(lead.id);
    onClose();
    if (result.alreadyProposed) {
      showToast("Hai già proposto questo centro.");
    } else {
      showToast("Proposta inviata — abbiamo registrato il tuo interesse.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Proponi invito"
      // TRAMA — DISCOVERY LIVE UX BUGFIX, fix post-live-test (23/09/2026).
      // BUG SEGNALATO DA FABRIZIO: dopo il fix del doppio-tap, il tap su
      // "Proponi invito" mostrava lo sfondo scurito ma NESSUN dialog visibile
      // sopra — il popup Leaflet restava a schermo, invariato. ROOT CAUSE:
      // z-[80] è INFERIORE allo z-index nativo dei pannelli Leaflet
      // (.leaflet-popup-pane è 700, vedi leaflet/dist/leaflet.css) — questo
      // overlay (sfondo + card) veniva impilato SOTTO il popup ancora aperto,
      // quindi lo sfondo scuro si vedeva (dietro/attorno al popup) ma la card
      // del dialog era coperta dal popup stesso. FIX: z-index ben sopra il
      // massimo di Leaflet (700 = popupPane, il più alto).
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-4">
        <p className="mb-1 text-[15px] font-bold text-ink">Vuoi trovare questo centro su TRAMA?</p>
        <p className="mb-3 text-[12.5px] text-ink-2">{lead.activityTitle}</p>
        {error && <p className="mb-2 text-[12px] font-medium text-trama-orange">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="flex-1 rounded-full border border-[#E8EBF0] px-3 py-2.5 text-[13px] font-semibold text-ink-2 active:scale-[0.98] disabled:opacity-60"
          >
            Annulla
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirm}
            className="flex-1 rounded-full bg-trama-violet px-3 py-2.5 text-[13px] font-semibold text-white active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? "Invio…" : "Sì, proponilo"}
          </button>
        </div>
      </div>
    </div>
  );
}
