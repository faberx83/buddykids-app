import "server-only";

// TRAMA ONE Build Sprint 6 — Command Center Admin (E08, ACR-001 "Admin
// command center", ACR-008 "Code domanda e supply", ACR-015 "Unified
// support queue" — SPRINT_GOVERNANCE.md, DEC-51).
//
// Handbook Admin 1.1 (§1 Executive Summary): "L'Admin non è un pannello
// CRUD: è la Control Room... La capacità Admin deve crescere per code e
// SLA, senza trasformare l'esperienza Partner in un controllo burocratico."
// Classificazione ADAPT (FEATURE_PARITY_MATRIX.md riga 21): questo modulo
// NON introduce nuove tabelle né sostituisce le pagine Admin per dominio
// esistenti (onboarding, prenotazioni, richieste, centri-lead,
// certificazioni, segnalazioni BETA, feature flag) — le AGGREGA in
// un'unica vista prioritizzata, riusando esclusivamente le funzioni di
// lettura già esistenti di ciascun dominio (reuse-first, CLAUDE.md §2).
// Le pagine per dominio restano raggiungibili e complete in parallelo
// (rollback gate esplicito di SPRINT_GOVERNANCE.md): il Command Center è
// solo un punto di ingresso più rapido con priorità calcolata.
//
// Ogni coda qui sotto corrisponde a un dominio già costruito in uno sprint
// precedente:
//  - Onboarding centri (Sprint 1)      -> lib/onboarding/data.ts
//  - Prenotazioni non gestite (Sprint 4) -> lib/data/admin-bookings.ts
//  - Richieste genitore aperte (Sprint 4) -> lib/data/admin-inquiries.ts
//  - Segnalazioni centro non iscritto (Sprint 5) -> lib/data/center-leads.ts
//  - Certificazioni da approvare (pre-TRAMA ONE) -> lib/data/certifications.ts
//  - Feedback BETA nuovi (Sprint 5 NextGen) -> lib/data/beta-feedback.ts
//  - Allarmi feature flag (Sprint 6 P1)  -> lib/data/feature-flag-overrides.ts
//
// Nessuna nuova query SQL: ogni conteggio deriva da dati già letti da questi
// moduli, solo riaggregati qui. Nessuna migrazione richiesta per questo file.

import { listCentersForAdminReview } from "@/lib/onboarding/data";
import { getBookingsSlaOverview } from "./admin-bookings";
import { getInquiriesSlaOverview } from "./admin-inquiries";
import { getAllCenterLeadsForAdmin } from "./center-leads";
import { getAllCertificationsForAdmin } from "./certifications";
import { getAllBetaFeedbackForAdmin } from "./beta-feedback";
import { getFeatureFlagOverridesForAdmin } from "./feature-flag-overrides";
import { computeQueuePriority, compareQueuesByPriority, QueuePriority } from "@/lib/command-center/priority";

export interface CommandCenterQueue {
  key: string;
  label: string;
  count: number;
  priority: QueuePriority;
  /** Dettaglio breve in linguaggio naturale (es. "più vecchia: 5 giorni") — null se la coda è vuota o non ha un concetto di età. */
  detail: string | null;
  href: string;
}

function formatOldestDetail(oldestDays: number | null, noun: string): string | null {
  if (oldestDays === null) return null;
  const rounded = Math.floor(oldestDays);
  if (rounded <= 0) return `${noun} più vecchia: oggi`;
  return `${noun} più vecchia: ${rounded} giorn${rounded === 1 ? "o" : "i"} fa`;
}

/**
 * Aggrega tutte le code operative Admin già esistenti in un'unica lista
 * prioritizzata (alta -> media -> bassa, poi per conteggio decrescente).
 * Read-only per costruzione: nessuna azione qui, solo link verso le pagine
 * per dominio già esistenti dove l'Admin agisce davvero (coerente con
 * "Separation of duties", Handbook Admin 1.1 §1.2).
 */
export async function getCommandCenterQueues(): Promise<CommandCenterQueue[]> {
  const [onboardingCenters, bookingsSla, inquiriesSla, centerLeads, certifications, betaFeedback, featureFlags] =
    await Promise.all([
      listCentersForAdminReview(),
      getBookingsSlaOverview(),
      getInquiriesSlaOverview(),
      getAllCenterLeadsForAdmin(),
      getAllCertificationsForAdmin(),
      getAllBetaFeedbackForAdmin(),
      getFeatureFlagOverridesForAdmin(),
    ]);

  const onboardingPending = onboardingCenters.filter((c) => c.status === "SUBMITTED");
  const onboardingOldestDays =
    onboardingPending.length > 0
      ? Math.max(
          ...onboardingPending.map((c) =>
            c.updatedAt ? (Date.now() - new Date(c.updatedAt).getTime()) / (1000 * 60 * 60 * 24) : 0
          )
        )
      : null;

  const bookingOldestDays =
    bookingsSla.centers.length > 0
      ? Math.max(0, ...bookingsSla.centers.map((c) => c.oldestPendingDays ?? 0))
      : null;

  const inquiryOldestDays =
    inquiriesSla.centers.length > 0 ? Math.max(0, ...inquiriesSla.centers.map((c) => c.oldestOpenDays ?? 0)) : null;

  const leadsPending = centerLeads.filter((l) => l.status === "suggested" || l.status === "qualified");
  const certsPending = certifications.filter((c) => c.status === "pending");
  const feedbackNew = betaFeedback.filter((f) => f.status === "nuovo");
  const flagAlerts = featureFlags.filter((f) => f.hasAlert);

  const queues: CommandCenterQueue[] = [
    {
      key: "onboarding",
      label: "Onboarding centri in revisione",
      count: onboardingPending.length,
      priority: computeQueuePriority(onboardingPending.length, onboardingOldestDays),
      detail: formatOldestDetail(onboardingOldestDays, "Candidatura"),
      href: "/admin/one/onboarding",
    },
    {
      key: "bookings",
      label: "Prenotazioni in attesa di risposta Partner",
      count: bookingsSla.platformPendingCount,
      priority: computeQueuePriority(bookingsSla.platformPendingCount, bookingOldestDays),
      detail: formatOldestDetail(bookingOldestDays, "Prenotazione"),
      href: "/admin/bookings",
    },
    {
      key: "inquiries",
      label: "Richieste genitore aperte",
      count: inquiriesSla.platformOpenCount,
      priority: computeQueuePriority(inquiriesSla.platformOpenCount, inquiryOldestDays),
      detail: formatOldestDetail(inquiryOldestDays, "Richiesta"),
      href: "/admin/richieste",
    },
    {
      key: "center-leads",
      label: "Segnalazioni centro non iscritto da qualificare",
      count: leadsPending.length,
      // Nessun campo di età per i CenterLead ad oggi (fuori scope Sprint 5) —
      // priorità basata solo sul conteggio (mai "alta" per età, al più "media").
      priority: leadsPending.length > 0 ? "media" : "bassa",
      detail: null,
      href: "/admin/center-leads",
    },
    {
      key: "certifications",
      label: "Certificazioni servizio da approvare",
      count: certsPending.length,
      priority: certsPending.length > 0 ? "media" : "bassa",
      detail: null,
      href: "/admin/certifications",
    },
    {
      key: "beta-feedback",
      label: "Segnalazioni BETA nuove",
      count: feedbackNew.length,
      priority: feedbackNew.length > 0 ? "media" : "bassa",
      detail: null,
      href: "/admin/segnalazioni-beta",
    },
    {
      key: "feature-flags",
      label: "Allarmi feature flag (override scaduti/in scadenza)",
      count: flagAlerts.length,
      // Un override enabled=true scaduto è per definizione un incidente
      // silenzioso già in corso (DEC-48, TC-N409) — sempre "alta" se > 0,
      // mai declassato a "media" solo perché è un conteggio piccolo.
      priority: flagAlerts.length > 0 ? "alta" : "bassa",
      detail: null,
      href: "/admin/feature-flags",
    },
  ];

  return [...queues].sort(compareQueuesByPriority);
}

export interface CommandCenterSummary {
  totalOpen: number;
  criticalQueueCount: number;
}

export function summarizeCommandCenterQueues(queues: CommandCenterQueue[]): CommandCenterSummary {
  return {
    totalOpen: queues.reduce((sum, q) => sum + q.count, 0),
    criticalQueueCount: queues.filter((q) => q.priority === "alta" && q.count > 0).length,
  };
}
