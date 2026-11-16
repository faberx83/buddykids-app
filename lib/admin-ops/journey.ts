// TRAMA — LOTTO 2, primo incremento (16/11/2026). Richiesta di Fabrizio: "Da
// Inviti e registrazioni rendi raggiungibile il record corrispondente in
// Pilota. Mostra, se disponibili, data di richiesta, invio segnato,
// registrazione, prima azione utile e ritorno. Distingui il walkthrough
// dall'attivazione: una persona può saltarlo e usare davvero l'app."
// Iniziativa: claude/INIZIATIVA_admin_operativo.md (Lotto 2).
//
// Puro. Riusa le definizioni del Pilota (lib/data/pilot-users.ts e
// lib/pilot/status.ts), non ne inventa di nuove:
//   - prima azione utile = primo bambino aggiunto, prenotazione o gruppo;
//   - ritorno = un accesso registrato almeno 1 giorno dopo la prima azione
//     (dato di login: chi resta collegato senza rifare login non risulta);
//   - benvenuto (walkthrough) = schermate iniziali; completarle o saltarle
//     NON è un'attivazione e non la blocca.

import type { InvitePipelineRow } from "./invitations";
import { computePilotStatus, type PilotOnboardingStatus } from "@/lib/pilot/status";

export interface PilotFacts {
  onboardingStatus: PilotOnboardingStatus;
  firstActionAt: string | null;
  firstActionLabel: string | null;
  lastSignInAt: string | null;
}

export const WALKTHROUGH_LABEL: Record<PilotOnboardingStatus, string> = {
  not_started: "Non aperto",
  in_progress: "In corso",
  completed: "Completato",
  skipped: "Saltato",
};

export interface JourneyCell {
  /** Testo principale ("12 nov", "Non segnato", ...). */
  value: string;
  /** Dettaglio facoltativo. */
  detail?: string;
  /** true se il dato non esiste perché non tracciato o non misurabile. */
  unknown?: boolean;
}

export interface Journey {
  requested: JourneyCell;
  inviteMarked: JourneyCell;
  registered: JourneyCell;
  walkthrough: JourneyCell;
  firstAction: JourneyCell;
  returned: JourneyCell;
  pilotHref: string | null;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" });
}

export function buildJourney(row: InvitePipelineRow, pilot: PilotFacts | null, lastSignInMeasurable: boolean): Journey {
  const registered = Boolean(row.registeredAt);
  const inviteMarked: JourneyCell = row.invitedAt
    ? { value: day(row.invitedAt), detail: "segnato a mano" }
    : registered
    ? { value: "Non segnato", detail: "registrata comunque: nessuna data d'invio" }
    : { value: "Non segnato" };

  let walkthrough: JourneyCell;
  let firstAction: JourneyCell;
  let returned: JourneyCell;
  if (!registered) {
    walkthrough = { value: "—" };
    firstAction = { value: "—" };
    returned = { value: "—" };
  } else if (!pilot) {
    const why = "non è nella coorte Pilota: non misurato";
    walkthrough = { value: "Non misurato", detail: why, unknown: true };
    firstAction = { value: "Non misurata", detail: why, unknown: true };
    returned = { value: "Non misurato", detail: why, unknown: true };
  } else {
    walkthrough = {
      value: WALKTHROUGH_LABEL[pilot.onboardingStatus],
      detail: "schermate di benvenuto, non conta come attivazione",
    };
    firstAction = pilot.firstActionAt
      ? { value: day(pilot.firstActionAt), detail: pilot.firstActionLabel ?? undefined }
      : {
          value: "Nessuna ancora",
          detail: pilot.onboardingStatus === "completed" || pilot.onboardingStatus === "skipped" ? "benvenuto fatto, uso non ancora iniziato" : undefined,
        };
    if (!pilot.firstActionAt) returned = { value: "—", detail: "serve prima un'azione utile" };
    else if (!lastSignInMeasurable) returned = { value: "Non misurabile", detail: "ultimo accesso non leggibile qui", unknown: true };
    else if (computePilotStatus(pilot.onboardingStatus, pilot.firstActionAt, pilot.lastSignInAt) === "returning")
      returned = { value: "Sì", detail: `accesso il ${day(pilot.lastSignInAt as string)}` };
    else returned = { value: "Non ancora", detail: "nessun nuovo accesso dopo il primo giorno d'uso" };
  }

  return {
    requested: { value: day(row.requestedAt) },
    inviteMarked,
    registered: registered
      ? { value: day(row.registeredAt as string), detail: row.usedCode ? `codice ${row.usedCode}` : undefined }
      : { value: "—" },
    walkthrough,
    firstAction,
    returned,
    pilotHref: row.accountId && row.inPilot ? `/admin/one/pilot/${row.accountId}` : null,
  };
}
