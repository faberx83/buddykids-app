// TRAMA — NODI THREAD (28/10/2026). Richiesta di Fabrizio: "Apri
// CLAUDE_START_HERE.txt e segui le istruzioni senza ridisegnare né
// reinterpretare gli asset" (pacchetto TRAMA_NODI_THREAD_FINAL v1.0, asset
// definitivi e approvati). Iniziativa: claude/INIZIATIVA_nodi_thread.md.
//
// Logica pura (nessun I/O, testabile): quale file usare per stato, misura e
// fondo, e quando un momento del Planner merita Nodi. Gli SVG stanno in
// public/assets/nodi/ così come sono arrivati (non vanno modificati).
//
// Regole del pacchetto (docs/INTEGRATION_GUIDE.md):
// - sotto 32 px solo nodi-micro.svg (senza volto); sotto 16 px niente;
// - gli stati con il volto non scendono sotto 48 px;
// - su fondo navy #172A4D la variante -navy.svg, mai filtri CSS;
// - al massimo un Nodi principale per schermata.

export const NODI_FLAG = "NODI_ENABLED";

export const NODI_STATES = ["idle", "welcome", "empty", "problem", "connect", "success", "group", "focus"] as const;
export type NodiState = (typeof NODI_STATES)[number];

export const NODI_ASSET_DIR = "/assets/nodi";
/** Misure del pacchetto (manifest.json, "rules"). */
export const NODI_FULL_MIN_PX = 48;
export const NODI_MICRO_MAX_PX = 31;
export const NODI_MIN_PX = 16;

export interface NodiAsset {
  src: string;
  /** Lato effettivo in px (gli stati pieni non scendono sotto 48). */
  size: number;
  micro: boolean;
}

/**
 * File e misura per uno stato. null sotto 16 px (lì Nodi non si usa).
 * Fra 32 e 47 px uno stato pieno viene portato a 48 (regola del pacchetto),
 * sotto 32 diventa il micro (che non ha variante navy).
 */
export function nodiAsset(state: NodiState, size: number, navy = false): NodiAsset | null {
  const px = Math.round(size);
  if (!Number.isFinite(px) || px < NODI_MIN_PX) return null;
  if (px <= NODI_MICRO_MAX_PX) return { src: `${NODI_ASSET_DIR}/nodi-micro.svg`, size: px, micro: true };
  const full = Math.max(px, NODI_FULL_MIN_PX);
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
  problemTitle: "Piccolo nodo da sciogliere: chi accompagna?",
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
