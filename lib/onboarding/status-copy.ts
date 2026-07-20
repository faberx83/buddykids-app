// TRAMA ONE — Sprint 1 Audit Remediation: registry centralizzato delle
// etichette italiane della macchina a stati di onboarding Centro.
//
// I valori tecnici persistiti in Supabase (LEAD, CLAIMED, SUBMITTED,
// CHANGES_REQUESTED, APPROVED, SUSPENDED) restano INVARIATI — sono usati da
// database, funzioni SECURITY DEFINER, audit tecnico, test di dominio,
// analytics. Questo file è l'UNICO punto di verità per come quei valori
// tecnici vengono mostrati a Partner e Admin: nessun componente deve
// definire etichette proprie o duplicare traduzioni.
//
// Mappatura approvata da Fabrizio (luglio 2026, audit remediation Sprint 1):
// il processo viene raccontato come ATTIVAZIONE e VERIFICA del centro, mai
// come possesso o rivendicazione. Il termine "Reclama"/"Rivendica"/"Prendi
// possesso"/"Claim" non deve mai comparire nell'interfaccia.
//
// Nessun modulo che importa questo file deve avere "server-only": è dato
// puro, importabile sia da Server Component sia da "use client" (stesso
// principio già applicato a lib/onboarding/types.ts).

import type { CenterOnboardingStatus } from "./types";

export type BadgeTone = "neutral" | "warning" | "info" | "danger" | "success";

export const BADGE_TONE_CLASSNAMES: Record<BadgeTone, string> = {
  neutral: "bg-[#F0F2F5] text-ink-2",
  warning: "bg-orange-light text-trama-orange",
  info: "bg-sky/10 text-sky",
  danger: "bg-[#FBEAEA] text-[#C0392B]",
  success: "bg-green-light text-[#2d8f52]",
};

interface AudienceCopy {
  /** Etichetta breve mostrata come badge di stato. */
  label: string;
  /** Testo descrittivo esteso mostrato nel corpo della pagina. */
  description: string;
  /** Testo del bottone/azione primaria per questo stato, se presente in questa fase. */
  primaryAction?: string;
  /** Testo di uno stato di attesa (es. "In attesa di verifica"), se applicabile. */
  waitingState?: string;
}

export interface OnboardingStatusCopy {
  status: CenterOnboardingStatus;
  /** Ordine della macchina a stati, per timeline/storico. */
  order: number;
  tone: BadgeTone;
  partner: AudienceCopy;
  admin: AudienceCopy;
}

export const ONBOARDING_STATUS_REGISTRY: Record<CenterOnboardingStatus, OnboardingStatusCopy> = {
  LEAD: {
    status: "LEAD",
    order: 0,
    tone: "neutral",
    partner: {
      label: "Centro da attivare",
      description:
        "Conferma di rappresentare il centro e completa le informazioni necessarie per avviare la verifica.",
      primaryAction: "Avvia l'attivazione del centro",
    },
    admin: {
      label: "Da attivare",
      description: "Il centro non ha ancora avviato il percorso di attivazione.",
    },
  },
  CLAIMED: {
    status: "CLAIMED",
    order: 1,
    tone: "warning",
    partner: {
      label: "Attivazione avviata",
      description: "Hai avviato l'attivazione del centro. Completa la checklist e le informazioni richieste.",
      primaryAction: "Completa i dati richiesti",
      // CTA del bottone di invio quando lo stato corrente è CLAIMED (prima
      // sottomissione, non un rinvio dopo CHANGES_REQUESTED).
      waitingState: "Invia per verifica",
    },
    admin: {
      label: "Attivazione richiesta",
      description: "Il Partner ha richiesto l'attivazione del centro e sta completando le informazioni.",
    },
  },
  SUBMITTED: {
    status: "SUBMITTED",
    order: 2,
    tone: "info",
    partner: {
      label: "In verifica",
      description: "Le informazioni sono state inviate e sono in fase di verifica.",
      waitingState: "In attesa di verifica",
    },
    admin: {
      label: "Da verificare",
      description: "Il Partner ha completato e inviato la richiesta di attivazione.",
      primaryAction: "Esamina la richiesta",
    },
  },
  CHANGES_REQUESTED: {
    status: "CHANGES_REQUESTED",
    order: 3,
    tone: "danger",
    partner: {
      label: "Integrazioni richieste",
      description: "Sono necessarie alcune integrazioni prima di completare la verifica.",
      primaryAction: "Completa le integrazioni",
      // CTA del bottone di invio quando lo stato corrente è CHANGES_REQUESTED
      // (rinvio dopo una richiesta di integrazione, testo diverso da CLAIMED).
      waitingState: "Invia nuovamente per verifica",
    },
    admin: {
      label: "Modifiche richieste",
      description: "È stato richiesto al Partner di integrare o correggere alcune informazioni.",
    },
  },
  APPROVED: {
    status: "APPROVED",
    order: 4,
    tone: "success",
    partner: {
      label: "Centro attivo",
      description: "Il centro è stato verificato ed è attivo su TRAMA.",
    },
    admin: {
      label: "Approvato",
      description: "Il centro ha completato con successo il percorso di attivazione.",
      primaryAction: "Sospendi",
    },
  },
  SUSPENDED: {
    status: "SUSPENDED",
    order: 5,
    tone: "danger",
    partner: {
      label: "Attivazione sospesa",
      description: "L'attivazione del centro è temporaneamente sospesa. Controlla le indicazioni ricevute.",
    },
    admin: {
      label: "Sospeso",
      description: "Il centro è stato sospeso e non può utilizzare le funzionalità riservate ai centri attivi.",
    },
  },
};

/** CTA del bottone "Invia per verifica" / "Invia nuovamente per verifica" a
 * seconda dello stato corrente — solo CLAIMED e CHANGES_REQUESTED mostrano
 * questo bottone nella pagina Partner. */
export function getSubmitCta(status: CenterOnboardingStatus): string {
  if (status === "CHANGES_REQUESTED") return ONBOARDING_STATUS_REGISTRY.CHANGES_REQUESTED.partner.waitingState!;
  return ONBOARDING_STATUS_REGISTRY.CLAIMED.partner.waitingState!;
}

export function getOnboardingStatusLabel(
  status: CenterOnboardingStatus,
  audience: "partner" | "admin"
): string {
  return ONBOARDING_STATUS_REGISTRY[status][audience].label;
}

export function getOnboardingStatusBadgeClassName(status: CenterOnboardingStatus): string {
  return BADGE_TONE_CLASSNAMES[ONBOARDING_STATUS_REGISTRY[status].tone];
}

/** Traduce una transizione (from -> to) in una riga di storico leggibile in
 * italiano per l'audience indicata, es. "Centro da attivare → Attivazione
 * avviata". Se from è nullo (prima riga di storico), mostra solo il nome
 * dello stato di arrivo. I codici tecnici (LEAD, CLAIMED, ...) non vengono
 * mai mostrati in questa funzione — restano disponibili solo nei campi
 * tecnici (fromStatus/toStatus) per debug/audit/log. */
export function formatOnboardingTransition(
  fromStatus: string | null,
  toStatus: string,
  audience: "partner" | "admin"
): string {
  const toLabel = isKnownOnboardingStatus(toStatus)
    ? getOnboardingStatusLabel(toStatus, audience)
    : toStatus;
  if (!fromStatus) return toLabel;
  const fromLabel = isKnownOnboardingStatus(fromStatus)
    ? getOnboardingStatusLabel(fromStatus, audience)
    : fromStatus;
  return `${fromLabel} → ${toLabel}`;
}

function isKnownOnboardingStatus(value: string): value is CenterOnboardingStatus {
  return value in ONBOARDING_STATUS_REGISTRY;
}
