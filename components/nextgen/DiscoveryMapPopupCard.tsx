"use client";

// TRAMA — DISCOVERY MAP + POLISH (21/09/2026), §12 del prompt "MAP CARD /
// POPUP". Contenuto del popup Leaflet per un marker Curated ("Da invitare" /
// "Fonte pubblica") — componente NUOVO e ADDITIVO, non un refactor di
// DiscoveryLeadCard.tsx (che resta FREEZE, §18: "non rifattorizzarlo se non
// strettamente necessario"). Riusa la STESSA server action già verificata
// live (proposeDiscoveryLeadInviteAction) e lo stesso toast — nessun nuovo
// modello dati, nessuna nuova Server Action.
//
// Deliberatamente più compatto della card di lista (spazio del popup
// limitato): stessa gerarchia informativa, stesso divieto assoluto di
// Match/rating/availability/posti finti (§12: "NON mostrare fake: Match;
// rating; availability; posti") — nessuno di questi campi esiste qui, come
// nella card di lista.

import { useState } from "react";
import type { DiscoveryLeadRecord } from "@/lib/discovery/real-dataset";
import { isDiscoveryLeadInvitable, secondaryLinkLabelForLead } from "@/lib/discovery/real-dataset";
import { logDiscoveryLeadEventAction, proposeDiscoveryLeadInviteAction } from "@/app/actions/discovery";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";

const CATEGORY_LABELS: Record<DiscoveryLeadRecord["category"], string> = {
  educativo: "Educativo",
  sportivo: "Sportivo",
  multisport: "Multisport",
  artistico: "Artistico",
};

function formatAge(ageMin: number | null, ageMax: number | null): string | null {
  if (ageMin != null && ageMax != null) return `${ageMin}-${ageMax} anni`;
  if (ageMax != null) return `fino a ${ageMax} anni`;
  if (ageMin != null) return `da ${ageMin} anni`;
  return null;
}

function formatDateRange(startDate: string | null, endDate: string | null): string | null {
  if (!startDate || !endDate) return null;
  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

export default function DiscoveryMapPopupCard({
  lead,
  locationLabel,
}: {
  lead: DiscoveryLeadRecord;
  // TRAMA — DISCOVERY MAP FINALIZATION (22/09/2026), §4-5 "MULTI-SEDE".
  // Opzionale, additivo, MAI un refactor della card (§1 FREEZE): quando un
  // singolo lead genera più marker (vedi buildDiscoveryMapItems), ogni
  // marker passa la propria etichetta di sede per evitare popup identici e
  // indistinguibili su pin diversi. Assente per ogni lead a sede singola —
  // comportamento del componente invariato in quel caso (unico caso
  // esistente prima di questo pass).
  locationLabel?: string;
}) {
  const showToast = useNextgenToast();
  const invitable = isDiscoveryLeadInvitable(lead);
  const secondaryLabel = secondaryLinkLabelForLead(lead);
  const ctaHref = lead.registrationUrl || lead.officialUrl;
  const age = formatAge(lead.ageMin, lead.ageMax);
  const dateRange = formatDateRange(lead.startDate, lead.endDate);

  // Stessa macchina a stati (ridotta) di DiscoveryLeadCard — stessa Server
  // Action, stesso toast, stessa copy Flow B (§14 test "Proponi invito da
  // popup funziona se previsto").
  type ProposeState = "idle" | "confirm" | "submitting" | "done" | "already" | "error";
  const [proposeState, setProposeState] = useState<ProposeState>("idle");
  const [proposeError, setProposeError] = useState<string | null>(null);

  function handleExternalClick() {
    void logDiscoveryLeadEventAction("curated_listing_external_clicked", lead.id);
  }

  async function handleConfirmPropose() {
    setProposeState("submitting");
    setProposeError(null);
    const result = await proposeDiscoveryLeadInviteAction(lead.id, lead.organizerName, lead.comune);
    if (result.error) {
      setProposeState("error");
      setProposeError(result.error);
      return;
    }
    if (result.alreadyProposed) {
      setProposeState("already");
      return;
    }
    setProposeState("done");
    showToast("Proposta inviata — abbiamo registrato il tuo interesse.");
  }

  return (
    <div style={{ fontSize: 13, lineHeight: 1.5, minWidth: 200, maxWidth: 240 }}>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="rounded-full bg-[#F3F0FF] px-2 py-0.5 text-[9.5px] font-semibold text-trama-violet">
          Scoperta TRAMA
        </span>
        <span className="rounded-full bg-[#F4F6FA] px-2 py-0.5 text-[9.5px] font-semibold text-ink-2">
          {CATEGORY_LABELS[lead.category]}
        </span>
      </div>
      <strong className="block text-[13px] text-ink">{lead.activityTitle}</strong>
      {locationLabel && <div className="mt-0.5 text-[10.5px] font-semibold text-ink-3">📍 {locationLabel}</div>}
      {invitable && <div className="mt-0.5 text-[11px] text-ink-2">{lead.organizerName}</div>}
      {!invitable && (
        <div className="mt-0.5 text-[11px] text-ink-2">
          {lead.locationName ? `${lead.locationName}, ${lead.comune}` : lead.comune}
        </div>
      )}
      {(age || dateRange) && (
        <div className="mt-1 text-[10.5px] text-ink-3">{[age, dateRange].filter(Boolean).join(" · ")}</div>
      )}

      {!invitable && (
        <p className="mt-1.5 text-[10px] leading-snug text-ink-3">Gestore non ancora identificato da TRAMA.</p>
      )}

      <div className="mt-2 flex flex-col gap-1.5">
        {invitable && proposeState !== "confirm" && proposeState !== "submitting" && (
          <>
            {proposeState === "done" ? (
              <span className="rounded-full bg-green-light px-2.5 py-1.5 text-center text-[11px] font-semibold text-[#2d8f52]">
                Proposta inviata
              </span>
            ) : proposeState === "already" ? (
              <span className="rounded-full bg-[#F4F6FA] px-2.5 py-1.5 text-center text-[11px] font-semibold text-ink-2">
                Hai già proposto questo centro
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setProposeState("confirm")}
                className="rounded-full bg-trama-violet px-2.5 py-1.5 text-center text-[11px] font-semibold text-white active:scale-[0.98]"
              >
                Proponi invito
              </button>
            )}
          </>
        )}
        {invitable && (proposeState === "confirm" || proposeState === "submitting" || proposeState === "error") && (
          <div className="rounded-lg border border-[#E8EBF0] bg-bg p-2">
            <p className="mb-1 text-[11px] font-semibold text-ink">Vuoi trovare questo centro su TRAMA?</p>
            {proposeError && <p className="mb-1 text-[10px] font-medium text-trama-orange">{proposeError}</p>}
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={proposeState === "submitting"}
                onClick={() => {
                  setProposeState("idle");
                  setProposeError(null);
                }}
                className="flex-1 rounded-full border border-[#E8EBF0] px-2 py-1 text-[10.5px] font-semibold text-ink-2 disabled:opacity-60"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={proposeState === "submitting"}
                onClick={handleConfirmPropose}
                className="flex-1 rounded-full bg-trama-violet px-2 py-1 text-[10.5px] font-semibold text-white disabled:opacity-60"
              >
                {proposeState === "submitting" ? "Invio…" : "Sì, proponilo"}
              </button>
            </div>
          </div>
        )}
        <a
          href={ctaHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleExternalClick}
          className="text-center text-[11px] font-semibold text-trama-violet underline underline-offset-2"
        >
          {secondaryLabel} ↗
        </a>
      </div>
    </div>
  );
}
