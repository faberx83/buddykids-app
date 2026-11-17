import "server-only";

// TRAMA ONE Build Sprint 6 — Command Center Admin (E08, ACR-001 "Admin
// command center", ACR-008 "Code domanda e supply", ACR-015 "Unified
// support queue" — SPRINT_GOVERNANCE.md, DEC-51).
//
// TRAMA — ADMIN OPERATIVO (12/11/2026): il Command Center diventa la home
// Admin "Oggi" (app/admin/page.tsx). Richiesta di Fabrizio: "Ogni contatore
// apre la coda già filtrata e il conteggio deve corrispondere alle righe
// risultanti, a parità di filtri. Per ogni coda mostra chi deve agire,
// anzianità, eventuale scadenza e prossimo passo."
//
// Cosa è cambiato rispetto allo Sprint 6 (stesse code, stesse etichette):
//   - ogni coda riceve le RIGHE con la stessa regola e la stessa fonte della
//     pagina di destinazione, e il numero è items.length (lib/admin-ops/
//     queues.ts). Prima "Prenotazioni in attesa" contava bookings.
//     partner_decision = 'pending', che per le prenotazioni a giorni resta
//     'pending' dopo le risposte: in produzione il 12/11 la card diceva 11,
//     l'elenco ne aveva 4 da decidere (tutte di prova);
//   - nuova coda in cima: date imminenti senza risposta;
//   - onboarding centri → "Centri da attivare" (?f=trama), che è la stessa
//     macchina a stati (center_onboarding_state) di /admin/one/onboarding;
//   - candidature dei centri separate dalle segnalazioni delle famiglie, con
//     la stessa regola "attive" della pagina (suggested, qualified, contacted);
//   - lista d'attesa da invitare;
//   - i centri e le attività di prova sono esclusi di default (nota sulla card).
//   - retest del 12/11/2026: lo stesso vale per centri da attivare,
//     candidature, segnalazioni di centri e certificazioni (prima entravano
//     nei conteggi e nelle anteprime record "[TEST]"); ogni card ha il link
//     alla stessa coda con le prove (?demo=1), che la pagina applica uguale.
//     Segnalazioni BETA, lista d'attesa e flag non hanno un concetto di prova
//     e sono contati tutti (la home lo dice).
// Sola lettura: le azioni restano nelle pagine per dominio.

import { getCentersForActivation } from "@/lib/data/center-activation";
import { adminBucket } from "@/lib/centers/activation";
import { getAllCenterLeadsForAdmin } from "./center-leads";
import { getAllCertificationsForAdmin } from "./certifications";
import { getAllBetaFeedbackForAdmin } from "./beta-feedback";
import { getFeatureFlagOverridesForAdmin } from "./feature-flag-overrides";
import { getWaitlistForAdmin } from "./waitlist";
import { registeredNotMarkedNote, waitlistQueue } from "@/lib/admin-ops/invitations";
import { getAdminBookings, getAdminInquiries, getTestAccountIds } from "./admin-ops";
import {
  DEFAULT_BOOKING_FILTERS,
  bookingsHref,
  filterAdminBookings,
  romeTodayIso,
  viewAdminBooking,
  type AdminBookingView,
} from "@/lib/admin-ops/bookings";
import { filterInquiries, inquiriesHref, viewInquiry } from "@/lib/admin-ops/inquiries";
import { buildOggiQueues, type OggiQueue, type QueueInput } from "@/lib/admin-ops/queues";
import { isDemoCenter, isDemoCertification, isDemoLead, withDemo } from "@/lib/admin-ops/demo";
import { withoutTestAccounts } from "@/lib/admin-ops/test-accounts";

export type CommandCenterQueue = OggiQueue;

/** Righe "attive" della pagina Candidature e segnalazioni centri (stessa regola del client). */
export const ACTIVE_LEAD_STATUSES = ["suggested", "qualified", "contacted"] as const;

function bookingItem(v: AdminBookingView) {
  return {
    id: v.row.id,
    title: `${v.ref} · ${v.row.activityName}`,
    sub: `${v.row.centerName}${v.nextDate ? ` · ${new Date(v.nextDate + "T00:00:00Z").toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" })}` : ""}`,
    createdAt: v.row.createdAt,
    dueDate: v.nextDate,
    href: `/admin/bookings/${v.row.id}`,
  };
}

export async function getCommandCenterQueues(): Promise<CommandCenterQueue[]> {
  const today = romeTodayIso();
  // 17/11/2026: + lista "Account di prova" (Beta Famiglie): i loro record contano come prova.
  const [activations, centerLeads, certifications, betaFeedback, featureFlags, waitlist, bookings, inquiries, testAccounts] = await Promise.all([
    getCentersForActivation(),
    getAllCenterLeadsForAdmin(),
    getAllCertificationsForAdmin(),
    getAllBetaFeedbackForAdmin(),
    getFeatureFlagOverridesForAdmin(),
    getWaitlistForAdmin(),
    getAdminBookings(),
    getAdminInquiries(),
    getTestAccountIds(),
  ]);

  const bookingViews = bookings.map((b) => viewAdminBooking(b, today, testAccounts));
  const pendingFilter = { ...DEFAULT_BOOKING_FILTERS, stato: "da_rispondere" as const };
  const imminentFilter = { ...pendingFilter, imminenti: true };
  const pending = filterAdminBookings(bookingViews, pendingFilter);
  const pendingAll = filterAdminBookings(bookingViews, { ...pendingFilter, demo: true });
  const imminent = filterAdminBookings(bookingViews, imminentFilter);
  const imminentAll = filterAdminBookings(bookingViews, { ...imminentFilter, demo: true });

  const inquiryViews = inquiries.map((r) => viewInquiry(r, today, testAccounts));
  const openInq = filterInquiries(inquiryViews, { centro: "", stato: "aperta", demo: false });
  const openInqAll = filterInquiries(inquiryViews, { centro: "", stato: "aperta", demo: true });

  const toVerifyAll = activations.filter((c) => adminBucket(c.facts.status) === "trama");
  const toVerify = toVerifyAll.filter((c) => !isDemoCenter({ name: c.name, isTestFixture: c.isTestFixture }));
  const activeLead = (s: string) => (ACTIVE_LEAD_STATUSES as readonly string[]).includes(s);
  const candidaciesAll = centerLeads.filter((l) => l.leadType === "self_candidacy" && activeLead(l.status));
  const candidacies = candidaciesAll.filter((l) => !isDemoLead(l));
  const referralsAll = centerLeads.filter((l) => l.leadType !== "self_candidacy" && activeLead(l.status));
  const referrals = referralsAll.filter((l) => !isDemoLead(l));
  const certsPendingAll = certifications.filter((c) => c.status === "pending");
  const certsPending = certsPendingAll.filter((c) => !isDemoCertification(c));
  const feedbackNewAll = betaFeedback.filter((f) => f.status === "nuovo");
  const feedbackNew = withoutTestAccounts(feedbackNewAll, (f) => f.parentId, testAccounts);
  const flagAlerts = featureFlags.filter((f) => f.hasAlert);
  // LOTTO 2 (16/11/2026): stessa regola di Lista d'attesa e Famiglie. Una
  // richiesta con l'account già creato esce dalla coda (resta nello storico).
  const { queue: waitlistNew, registeredNotMarked } = waitlistQueue(waitlist.items);

  const inputs: QueueInput[] = [
    {
      key: "bookings-imminent",
      label: "Date imminenti senza risposta del centro",
      actor: "centro",
      href: bookingsHref(imminentFilter),
      nextStep: "Sentire il centro oggi: la data è entro 7 giorni",
      items: imminent.map(bookingItem),
      hiddenDemo: imminentAll.length - imminent.length,
      demoHref: bookingsHref({ ...imminentFilter, demo: true }),
    },
    {
      key: "bookings",
      label: "Prenotazioni in attesa di risposta Partner",
      actor: "centro",
      href: bookingsHref(pendingFilter),
      nextStep: "Il centro accetta o rifiuta; dopo 2 giorni, sollecitarlo",
      items: pending.map(bookingItem),
      hiddenDemo: pendingAll.length - pending.length,
      demoHref: bookingsHref({ ...pendingFilter, demo: true }),
    },
    {
      key: "inquiries",
      label: "Richieste genitore aperte",
      actor: "centro",
      href: inquiriesHref({ stato: "aperta" }),
      nextStep: "Il centro risponde al messaggio; dopo 2 giorni, sollecitarlo",
      items: openInq.map((v) => ({
        id: v.row.id,
        title: `${v.row.activityName}`,
        sub: `${v.row.centerName} · ${v.row.parentName}`,
        createdAt: v.row.createdAt,
        href: `/admin/richieste?caso=${v.row.id}#caso-${v.row.id}`,
      })),
      hiddenDemo: openInqAll.length - openInq.length,
      demoHref: inquiriesHref({ stato: "aperta", demo: true }),
    },
    {
      key: "onboarding",
      label: "Onboarding centri in revisione",
      actor: "trama",
      href: "/admin/centri-attivazione?f=trama",
      nextStep: "Confermare referente e attività, poi Approva o Chiedi una modifica",
      items: toVerify.map((c) => ({
        id: c.centerId,
        title: c.name,
        sub: c.city,
        createdAt: c.facts.submittedAt ?? c.createdAt,
        href: `/admin/centri-attivazione?f=trama&c=${c.centerId}`,
      })),
      hiddenDemo: toVerifyAll.length - toVerify.length,
      demoHref: withDemo("/admin/centri-attivazione?f=trama"),
    },
    {
      key: "candidacies",
      label: "Candidature dei centri da valutare",
      actor: "trama",
      href: "/admin/center-leads?tipo=candidature",
      nextStep: "Telefonare al centro, poi Approva e crea centro o Rifiuta",
      items: candidacies.map((l) => ({ id: l.id, title: l.suggestedName, sub: l.suggestedLocality ?? null, createdAt: l.createdAt, href: "/admin/center-leads?tipo=candidature" })),
      hiddenDemo: candidaciesAll.length - candidacies.length,
      demoHref: withDemo("/admin/center-leads?tipo=candidature"),
    },
    {
      key: "center-leads",
      label: "Segnalazioni centro non iscritto da qualificare",
      actor: "trama",
      href: "/admin/center-leads?tipo=segnalazioni",
      nextStep: "Valutare la segnalazione: qualificare, unire a un doppione o scartare",
      items: referrals.map((l) => ({ id: l.id, title: l.suggestedName, sub: l.suggestedLocality ?? null, createdAt: l.createdAt, href: "/admin/center-leads?tipo=segnalazioni" })),
      hiddenDemo: referralsAll.length - referrals.length,
      demoHref: withDemo("/admin/center-leads?tipo=segnalazioni"),
    },
    {
      key: "certifications",
      label: "Certificazioni servizio da approvare",
      actor: "trama",
      href: "/admin/certifications",
      nextStep: "Controllare il documento e approvare o rifiutare",
      items: certsPending.map((c) => ({ id: c.id, title: c.label, sub: `${c.centerName} · ${c.activityName}`, createdAt: c.createdAt, href: "/admin/certifications" })),
      hiddenDemo: certsPendingAll.length - certsPending.length,
      demoHref: withDemo("/admin/certifications"),
    },
    {
      key: "beta-feedback",
      label: "Segnalazioni BETA nuove",
      actor: "trama",
      href: "/admin/segnalazioni-beta?stato=nuovo",
      nextStep: "Leggere e smistare: in gestione, risolta o pipeline",
      items: feedbackNew.map((f) => ({ id: f.id, title: f.message.slice(0, 70), sub: f.area, createdAt: f.createdAt, href: "/admin/segnalazioni-beta?stato=nuovo" })),
      hiddenDemo: feedbackNewAll.length - feedbackNew.length,
      demoHref: "/admin/segnalazioni-beta?stato=nuovo&demo=1",
    },
    {
      key: "waitlist",
      label: "Famiglie in lista d'attesa da invitare",
      actor: "trama",
      href: "/admin/lista-attesa",
      nextStep: "Scrivere l'invito, poi segnarlo come inviato",
      items: waitlistNew.map((w) => ({ id: w.id, title: w.email, sub: w.comune, createdAt: w.createdAt, href: "/admin/lista-attesa" })),
      note: registeredNotMarked.length > 0 ? registeredNotMarkedNote(registeredNotMarked.length) : undefined,
    },
    {
      key: "feature-flags",
      label: "Allarmi feature flag (override scaduti/in scadenza)",
      actor: "trama",
      href: "/admin/feature-flags",
      nextStep: "Rinnovare o chiudere l'override",
      // Un override enabled=true scaduto è per definizione un incidente
      // silenzioso già in corso (DEC-48, TC-N409): sempre "alta" se > 0.
      alwaysHigh: true,
      items: flagAlerts.map((f) => ({ id: f.flagName, title: f.flagName, createdAt: null, href: "/admin/feature-flags" })),
    },
  ];

  return buildOggiQueues(inputs, today);
}

export interface CommandCenterSummary {
  totalOpen: number;
  criticalQueueCount: number;
}

/**
 * Totale degli elementi in sospeso. La coda delle date imminenti è un
 * sottoinsieme delle prenotazioni in attesa: non si somma due volte.
 */
export function summarizeCommandCenterQueues(queues: CommandCenterQueue[]): CommandCenterSummary {
  return {
    totalOpen: queues.filter((q) => q.key !== "bookings-imminent").reduce((sum, q) => sum + q.count, 0),
    criticalQueueCount: queues.filter((q) => q.priority === "alta" && q.count > 0).length,
  };
}
