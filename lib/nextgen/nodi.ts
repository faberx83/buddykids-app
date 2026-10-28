// TRAMA — NODI THREAD (28/10/2026). Richiesta di Fabrizio: "Apri
// CLAUDE_START_HERE.txt e segui le istruzioni senza ridisegnare né
// reinterpretare gli asset" (pacchetto TRAMA_NODI_THREAD_FINAL v1.0, asset
// definitivi e approvati). Iniziativa: claude/INIZIATIVA_nodi_thread.md.
//
// Logica pura (nessun I/O, testabile): quale file usare per stato, misura e
// fondo, e quando un momento del Planner merita Nodi. Gli SVG stanno in
// public/assets/nodi/ così come sono arrivati (non vanno modificati).
//
// Regole del pacchetto (docs/INTEGRATION_GUIDE.md), aggiornate dal
// ritocco del 28/10/2026 pomeriggio ("Nodi è una presenza, non il
// protagonista"):
// - sotto 32 px solo nodi-micro.svg (senza volto); sotto 16 px niente;
// - mai sopra 88 px nell'app (le misure grandi sono per marketing e social);
// - su fondo navy #172A4D la variante -navy.svg, mai filtri CSS;
// - al massimo un Nodi per schermata; la UI senza Nodi ha la stessa struttura.

export const NODI_FLAG = "NODI_ENABLED";

export const NODI_STATES = ["idle", "welcome", "empty", "problem", "connect", "success", "group", "focus"] as const;
export type NodiState = (typeof NODI_STATES)[number];

export const NODI_ASSET_DIR = "/assets/nodi";
/** Misure: micro fino a 31 px (pacchetto), stati con il volto da 32 a 88 px (ritocco del 28/10). */
export const NODI_FULL_MIN_PX = 32;
export const NODI_MAX_PX = 88;
export const NODI_MICRO_MAX_PX = 31;
export const NODI_MIN_PX = 16;

/**
 * Misure usate nell'app famiglie (che vive in una cornice telefono, quindi
 * valgono i valori "mobile" del ritocco): un solo posto da cui cambiarle.
 */
export const NODI_SIZE = {
  /** Onboarding: max 72 su mobile. */
  onboarding: 72,
  /** Planner vuoto: empty state 56–64 su mobile. */
  plannerEmpty: 56,
  /** Gruppi vuoti: empty state 56–64. */
  groupsEmpty: 56,
  /** Home con informazioni: piccolo, 40–48. */
  homeHint: 44,
  /** Problema: 32–48; occupa lo stesso posto dell'icona da 34 px che sostituisce. */
  problem: 34,
  /** Scopri senza risultati: elemento contestuale, 32–48. */
  discoverEmpty: 48,
  /** Avviso: 24–32 su mobile (sotto 32 diventerebbe il micro, senza volto). */
  toast: 32,
} as const;

export interface NodiAsset {
  src: string;
  /** Lato effettivo in px (gli stati pieni non scendono sotto 48). */
  size: number;
  micro: boolean;
}

/**
 * File e misura per uno stato. null sotto 16 px (lì Nodi non si usa).
 * Sotto 32 px diventa il micro (che non ha variante navy); sopra 88 px viene
 * riportato a 88.
 */
export function nodiAsset(state: NodiState, size: number, navy = false): NodiAsset | null {
  const px = Math.round(size);
  if (!Number.isFinite(px) || px < NODI_MIN_PX) return null;
  if (px <= NODI_MICRO_MAX_PX) return { src: `${NODI_ASSET_DIR}/nodi-micro.svg`, size: px, micro: true };
  const full = Math.min(Math.max(px, NODI_FULL_MIN_PX), NODI_MAX_PX);
  return { src: `${NODI_ASSET_DIR}/nodi-${state}${navy ? "-navy" : ""}.svg`, size: full, micro: false };
}

// ─── Planner ──────────────────────────────────────────────────────────────

/**
 * Planner vuoto: nessun impegno nella settimana (scuola compresa) e nessuna
 * chiusura da segnalare. Con la scuola impostata la settimana non è mai vuota.
 */
export function isPlannerWeekEmpty(week: { entryCount: number; days: { closureLabels: string[] }[] }): boolean {
  return week.entryCount === 0 && week.days.every((d) => d.closureLabels.length === 0);
}

export interface AssignSnapshot {
  /** Passaggi da decidere nel giorno aperto (null = foglio della settimana). */
  dayMissing: number | null;
  /** Passaggi da decidere nella settimana, da oggi in poi. */
  weekMissing: number;
}

export type AssignMoment = { state: "success" | "connect"; text: string } | null;

/** Testi del pacchetto (docs/COPY_GUIDE.md) e dell'app (stato della settimana). */
export const NODI_COPY = {
  emptyPlannerTitle: "Qui prenderà forma la vostra settimana.",
  /** Titolo della riga "Chi fa cosa" quando ci sono passaggi da decidere (stessa tipografia). */
  problemTitle: "Piccolo nodo da sciogliere",
  connect: "Fatto. Ora lo sanno tutti.",
  // Stesso testo già usato nel Planner quando la settimana è a posto
  // (WeekView, "Chi fa cosa"): niente testo nuovo se esiste quello buono.
  weekDone: "Accompagnamenti della settimana decisi",
  groupsEmptyTitle: "Un filo da solo è solo un filo.",
} as const;

/**
 * Alla chiusura del foglio "Chi accompagna" (o "Chi fa cosa"): quale momento
 * mostrare, confrontando prima e dopo.
 * - la settimana era da completare e ora è tutta decisa → successo (milestone);
 * - il giorno aperto era da completare e ora è deciso → connessione;
 * - altrimenti niente (nessun Nodi a ogni salvataggio).
 */
export function nodiAfterAssign(before: AssignSnapshot, after: AssignSnapshot): AssignMoment {
  if (before.weekMissing > 0 && after.weekMissing === 0) return { state: "success", text: NODI_COPY.weekDone };
  if (before.dayMissing !== null && after.dayMissing !== null && before.dayMissing > 0 && after.dayMissing === 0) {
    return { state: "connect", text: NODI_COPY.connect };
  }
  return null;
}
