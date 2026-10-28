// TRAMA — NODI THREAD (28/10/2026). Iniziativa: claude/INIZIATIVA_nodi_thread.md.
//
// 28/10/2026 sera, Fabrizio: "Questa è la versione APPROVATA di Nodi Thread.
// Usa esclusivamente gli asset forniti; non ridisegnare, non vettorializzare,
// non reinterpretare [...] Sostituisci gli asset Nodi attualmente presenti
// nell'app seguendo nodi-manifest.json." (TRAMA_NODI_THREAD_REFERENCE_PACK_v2).
// Gli asset del pacchetto v1.0 sono stati tolti.
//
// Logica pura (nessun I/O, testabile): quale file usare per stato e misura,
// e quando un momento del Planner merita Nodi. I PNG del pacchetto (1x e @2x)
// stanno in public/assets/nodi/ così come sono arrivati; la mappa stato →
// file è lib/nextgen/nodi-manifest.json, copia esatta di quella del pacchetto.
//
// Regole (pacchetto v2 + ritocco del 28/10 pomeriggio):
// - al massimo un Nodi per schermata; nessuna card o spazio nuovo per Nodi;
// - misure massime per posto dal manifest (NODI_SIZE), mai sopra 88 px;
// - il pacchetto v2 non ha varianti navy né micro: su fondo scuro e sotto
//   32 px Nodi non compare ("se non ci sta, nascondilo, non modificarlo").

import manifest from "./nodi-manifest.json";

export const NODI_FLAG = "NODI_ENABLED";

export const NODI_STATES = ["idle", "welcome", "empty", "problem", "connect", "success", "group", "focus", "discover-empty"] as const;
export type NodiState = (typeof NODI_STATES)[number];

export const NODI_ASSET_DIR = "/assets/nodi";
export const NODI_FULL_MIN_PX = 32;
export const NODI_MAX_PX = 88;

/**
 * Misure massime per posto, da nodi-manifest.json ("placement", max_px).
 * L'immagine sta dentro un quadrato di questo lato, senza deformarsi.
 */
export const NODI_SIZE = {
  onboarding: manifest.placement.onboarding_children.max_px, // 72
  plannerEmpty: manifest.placement.planner_empty_day.max_px, // 56
  groupsEmpty: manifest.placement.groups_empty.max_px, // 56
  homeHint: manifest.placement.home_get_started.max_px, // 44
  problem: manifest.placement.who_does_what.max_px, // 34
  discoverEmpty: manifest.placement.discover_no_results.max_px, // 48
  toast: manifest.placement.assignment_success.max_px, // 32
} as const;

export interface NodiAsset {
  /** PNG 1x del pacchetto. */
  src: string;
  /** PNG @2x del pacchetto (schermi ad alta densità). */
  src2x: string;
  /** Lato del quadrato in cui sta l'immagine (px). */
  size: number;
  /** Proporzioni originali (larghezza, altezza) dal manifest. */
  width: number;
  height: number;
}

/**
 * File e misura per uno stato. null quando Nodi non deve comparire: sotto
 * 32 px (il pacchetto non ha una versione senza volto) o su fondo navy (il
 * pacchetto non ha varianti scure). Sopra 88 px viene riportato a 88.
 */
export function nodiAsset(state: NodiState, size: number, navy = false): NodiAsset | null {
  const px = Math.round(size);
  if (navy) return null;
  if (!Number.isFinite(px) || px < NODI_FULL_MIN_PX) return null;
  const key = manifest.states[state] as keyof typeof manifest.assets;
  const meta = manifest.assets[key];
  if (!meta) return null;
  const file = meta.png.replace(/^png\//, "");
  return {
    src: `${NODI_ASSET_DIR}/${file}`,
    src2x: `${NODI_ASSET_DIR}/${file.replace(/\.png$/, "@2x.png")}`,
    size: Math.min(px, NODI_MAX_PX),
    width: meta.width,
    height: meta.height,
  };
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

export type AssignMoment = { state: "success"; text: string } | null;

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
 * Alla chiusura del foglio "Chi accompagna" (o "Chi fa cosa"): quale conferma
 * mostrare, confrontando prima e dopo (manifest v2: assignment_success =
 * stato "success").
 * - la settimana era da completare e ora è tutta decisa → "Accompagnamenti della settimana decisi";
 * - il giorno aperto era da completare e ora è deciso → "Fatto. Ora lo sanno tutti.";
 * - altrimenti niente (mai a ogni salvataggio).
 */
export function nodiAfterAssign(before: AssignSnapshot, after: AssignSnapshot): AssignMoment {
  if (before.weekMissing > 0 && after.weekMissing === 0) return { state: "success", text: NODI_COPY.weekDone };
  if (before.dayMissing !== null && after.dayMissing !== null && before.dayMissing > 0 && after.dayMissing === 0) {
    return { state: "success", text: NODI_COPY.connect };
  }
  return null;
}
