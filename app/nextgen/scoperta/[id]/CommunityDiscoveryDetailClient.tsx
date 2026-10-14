"use client";

// TRAMA — RADAR / COMMUNITY DISCOVERY (13/10/2026), patch 2: scheda.
// Mostra solo quello che la segnalazione contiene (mai dati inventati),
// con il badge "Segnalato dalla community" e la nota di provenienza.
// Azioni: preferito ("community:<uuid>" in curated_favorites) e "Da
// organizzare" nel Planner (source_type community_discovery), con bambini e
// date confermati dal genitore — le date sono obbligatorie se la
// segnalazione non le indica con certezza.

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import { toggleCuratedFavoriteAction } from "@/app/actions/curated-favorites";
import { addCommunityDiscoveryToPlannerAction } from "@/app/actions/external-planner-items";
import { logRadarEventAction } from "@/app/actions/radar";
import {
  COMMUNITY_BADGE_LABEL,
  communityCategoryEmoji,
  communityCategoryLabel,
  communityExternalUrl,
  communityFavoriteId,
  formatCommunityAge,
  formatCommunityDates,
  formatCommunityPlace,
  formatCommunityPrice,
  type CommunityDiscoveryRecord,
} from "@/lib/radar/community";
import type { Kid } from "@/lib/types";
import { markFirstUsefulAction } from "@/lib/nextgen/first-action";

function Row({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-[#F0F2F5] py-2.5 last:border-b-0">
      <i className={`ti ${icon} mt-0.5 text-[16px] text-ink-3`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{label}</div>
        <div className="break-words text-[13.5px] text-ink">{children}</div>
      </div>
    </div>
  );
}

export default function CommunityDiscoveryDetailClient({
  discovery,
  kids,
  initialFavorite,
  plannerEnabled,
  initialInPlanner,
  fromRadar,
}: {
  discovery: CommunityDiscoveryRecord;
  kids: Kid[];
  initialFavorite: boolean;
  plannerEnabled: boolean;
  initialInPlanner: boolean;
  fromRadar: boolean;
}) {
  const showToast = useNextgenToast();
  const [fav, setFav] = useState(initialFavorite);

  type PlanState = "idle" | "confirm" | "submitting" | "done";
  const [planState, setPlanState] = useState<PlanState>(initialInPlanner ? "done" : "idle");
  const [planKidIds, setPlanKidIds] = useState<string[]>(kids.length === 1 ? [kids[0].id] : []);
  const [planStart, setPlanStart] = useState(discovery.startDate ?? "");
  const [planEnd, setPlanEnd] = useState(discovery.endDate ?? discovery.startDate ?? "");
  const [planError, setPlanError] = useState<string | null>(null);

  const place = formatCommunityPlace(discovery);
  const age = formatCommunityAge(discovery.ageMin, discovery.ageMax);
  const dates = formatCommunityDates(discovery);
  const price = formatCommunityPrice(discovery.price, discovery.priceUnit);
  const externalUrl = communityExternalUrl(discovery);
  const hasCertainDates = Boolean(discovery.startDate);
  const userConfirmed = Object.values(discovery.fieldProvenance ?? {}).includes("user_confirmed");

  function handleToggleFavorite() {
    const next = !fav;
    setFav(next);
    toggleCuratedFavoriteAction(communityFavoriteId(discovery.id), next).then((result) => {
      if (result.error) {
        setFav(!next);
        return;
      }
      if (next) {
        showToast("Salvata nei preferiti.");
        if (fromRadar) void logRadarEventAction("radar_favorite_after_import", discovery.id);
      }
    });
  }

  async function handleConfirmPlanner() {
    if (planKidIds.length === 0) return setPlanError("Seleziona almeno un bambino.");
    if (!planStart || !planEnd) return setPlanError("Indica quando si svolge.");
    if (planEnd < planStart) return setPlanError("La data di fine non può precedere quella di inizio.");
    setPlanError(null);
    setPlanState("submitting");
    const result = await addCommunityDiscoveryToPlannerAction(
      discovery.id,
      planKidIds,
      { startDate: planStart, endDate: planEnd },
      fromRadar
    );
    if (result.error) {
      setPlanState("confirm");
      setPlanError(result.error);
      return;
    }
    setPlanState("done");
    showToast("Aggiunta al Planner, tra le cose da organizzare.");
    markFirstUsefulAction("nel_planner");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFBFC]">
      <PageHeader title="Scoperta" backHref="/nextgen/search" showBrandIcon />
      <div className="px-5 py-4">
        <div className="relative mb-4 flex h-[150px] items-center justify-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#FFF4E8,#FFE9D6)]">
          <span className="text-7xl opacity-40" aria-hidden>
            {communityCategoryEmoji(discovery.category)}
          </span>
          <div className="absolute left-3 top-3 rounded-full bg-trama-orange px-2.5 py-1 text-[11px] font-bold text-white">
            {communityCategoryLabel(discovery.category)}
          </div>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink-2">
            <i className="ti ti-users-group text-[12px] text-trama-orange" aria-hidden />
            {COMMUNITY_BADGE_LABEL}
          </div>
          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-label={fav ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg"
          >
            {fav ? "❤️" : "🤍"}
          </button>
        </div>

        <h1 className="mb-1 text-lg font-bold text-ink">{discovery.title}</h1>
        {discovery.organizerName && <div className="mb-3 text-[13px] font-medium text-ink-2">{discovery.organizerName}</div>}
        {discovery.shortDescription && <p className="mb-4 text-[13.5px] leading-relaxed text-ink-2">{discovery.shortDescription}</p>}

        <div className="mb-4 rounded-xl border border-[#F0F2F5] bg-white px-4">
          {place && (
            <Row icon="ti-map-pin" label="Dove">
              {place}
              {discovery.address && <div className="text-[12px] text-ink-2">{discovery.address}</div>}
            </Row>
          )}
          {dates && (
            <Row icon="ti-calendar" label="Quando">
              {dates}
              {!hasCertainDates && discovery.dateTextRaw && (
                <div className="text-[11.5px] text-ink-3">Anno non indicato nella segnalazione</div>
              )}
            </Row>
          )}
          {discovery.scheduleText && (
            <Row icon="ti-clock" label="Orari">
              {discovery.scheduleText}
            </Row>
          )}
          {age && (
            <Row icon="ti-users" label="Età">
              {age}
            </Row>
          )}
          <Row icon="ti-coin-euro" label="Prezzo">
            {price ?? <span className="text-ink-3">Non indicato nella segnalazione</span>}
          </Row>
          {discovery.registrationInfo && (
            <Row icon="ti-clipboard-text" label="Iscrizioni">
              {discovery.registrationInfo}
            </Row>
          )}
          {discovery.contactPhone && (
            <Row icon="ti-phone" label="Telefono">
              <a href={`tel:${discovery.contactPhone.replace(/\s+/g, "")}`} className="text-trama-violet">
                {discovery.contactPhone}
              </a>
            </Row>
          )}
          {discovery.contactEmail && (
            <Row icon="ti-mail" label="Email">
              <a href={`mailto:${discovery.contactEmail}`} className="text-trama-violet">
                {discovery.contactEmail}
              </a>
            </Row>
          )}
        </div>

        <div className="mb-4 flex flex-col gap-2">
          {plannerEnabled && kids.length > 0 && planState === "idle" && (
            <button
              type="button"
              onClick={() => setPlanState("confirm")}
              className="w-full rounded-lg bg-trama-violet px-4 py-3 text-sm font-bold text-white"
            >
              Da organizzare: aggiungi al Planner
            </button>
          )}
          {planState === "done" && (
            <div className="rounded-lg bg-green-light px-4 py-3 text-center text-sm font-semibold text-[#2d8f52]">✓ Nel Planner</div>
          )}
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="w-full rounded-lg border border-[#D8DEE8] bg-white px-4 py-3 text-center text-sm font-semibold text-ink"
            >
              Vai al sito o alla pagina dell&apos;organizzatore ↗
            </a>
          )}
        </div>

        {(planState === "confirm" || planState === "submitting") && (
          <div className="mb-4 rounded-xl border border-[#E4E0FA] bg-white p-4">
            <div className="mb-2 text-sm font-bold text-ink">Per chi?</div>
            <div className="mb-3 flex flex-wrap gap-2">
              {kids.map((k) => {
                const on = planKidIds.includes(k.id);
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setPlanKidIds((ids) => (on ? ids.filter((x) => x !== k.id) : [...ids, k.id]))}
                    className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
                      on ? "border-trama-violet bg-trama-violet/10 text-trama-violet" : "border-[#D8DEE8] text-ink-2"
                    }`}
                  >
                    {k.emoji} {k.name}
                  </button>
                );
              })}
            </div>
            <div className="mb-1 text-sm font-bold text-ink">Quando?</div>
            {!hasCertainDates && (
              <p className="mb-2 text-[12px] text-ink-3">
                {discovery.dateTextRaw
                  ? `La segnalazione dice "${discovery.dateTextRaw}" senza l'anno: indica tu le date.`
                  : "La segnalazione non indica le date: indicale tu."}
              </p>
            )}
            <div className="mb-3 grid grid-cols-2 gap-2">
              <label className="text-[12px] text-ink-2">
                Dal
                <input
                  type="date"
                  value={planStart}
                  onChange={(e) => setPlanStart(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#D8DEE8] px-2 py-2 text-[13px]"
                />
              </label>
              <label className="text-[12px] text-ink-2">
                Al
                <input
                  type="date"
                  value={planEnd}
                  onChange={(e) => setPlanEnd(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#D8DEE8] px-2 py-2 text-[13px]"
                />
              </label>
            </div>
            {planError && <p className="mb-2 text-[12px] font-semibold text-[#C0392B]">{planError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPlanState("idle")}
                className="flex-1 rounded-lg border border-[#D8DEE8] px-3 py-2.5 text-sm font-semibold text-ink-2"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={planState === "submitting"}
                onClick={handleConfirmPlanner}
                className="flex-1 rounded-lg bg-trama-violet px-3 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {planState === "submitting" ? "Aggiungo…" : "Aggiungi"}
              </button>
            </div>
          </div>
        )}

        <p className="rounded-lg bg-white p-3 text-[11.5px] leading-snug text-ink-3">
          Questa scoperta è stata segnalata da un genitore della community TRAMA
          {userConfirmed ? " e alcuni dati sono stati corretti a mano da chi l'ha inviata" : ""}. TRAMA non la gestisce e non ha
          verificato le informazioni: controlla sempre date, prezzi e iscrizioni con l&apos;organizzatore.
        </p>
      </div>
    </div>
  );
}
