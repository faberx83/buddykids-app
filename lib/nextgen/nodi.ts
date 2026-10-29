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
//
// 29/10/2026, Fabrizio sugli screenshot: "c'è una piccola ombra sulla base
// [...] anche sul secondo è tagliato male [...] io lo metterei un pelino più
// grande e visibile". I PNG del pacchetto, ritagliati dalla tavola, si
// portano dietro pezzi dei vicini (frammenti delle etichette sotto, il
// fumetto tagliato di state-03, lettere ai bordi). I file restano identici:
// si mostra solo la parte con Nodi (NODI_CROP, calcolata sui pixel opachi
// del PNG @2x: il nodo, più gli accenti interi che non toccano i bordi) e
// le misure salgono di 4–8 px.

import manifest from "./nodi-manifest.json";

export const NODI_FLAG = "NODI_ENABLED";

export const NODI_STATES = ["idle", "welcome", "empty", "problem", "connect", "success", "group", "focus", "discover-empty"] as const;
export type NodiState = (typeof NODI_STATES)[number];

export const NODI_ASSET_DIR = "/assets/nodi";
export const NODI_FULL_MIN_PX = 32;
export const NODI_MAX_PX = 88;

/**
 * Misure per posto: max_px del manifest, alzate di poco il 29/10 su
 * richiesta di Fabrizio ("un pelino più grande e visibile"). Il riquadro
 * "Chi fa cosa" resta 34: prende il posto di un'icona da 34 px. L'avviso
 * (fondo scuro) non mostra Nodi. Mai sopra 88.
 */
export const NODI_SIZE = {
  onboarding: 80, // manifest 72
  plannerEmpty: 64, // manifest 56
  groupsEmpty: 64, // manifest 56
  homeHint: 48, // manifest 44
  problem: manifest.placement.who_does_what.max_px, // 34
  discoverEmpty: 56, // manifest 48
  toast: manifest.placement.assignment_success.max_px, // 32 (non usato: avviso scuro)
  /** "Chi è Nodi" nella pagina Cos'è TRAMA. */
  about: 64,
  /** Card che escono dal telefono nella terza schermata dell'onboarding (29/10: "nelle slide mettilo più grande"). */
  onboardingPop: 48,
  /** Riquadro del gruppo in testa al suo dettaglio, al posto del monogramma da 56 px (29/10). */
  groupHeader: 56,
} as const;

/** Parte del PNG da mostrare (frazioni di larghezza e altezza): solo Nodi, senza i pezzi dei vicini. */
export interface NodiCrop {
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Angolo in alto a destra da nascondere (frazioni del PNG: da `x` a destra,
   * fino a `y` in basso), quando un frammento sta dentro il riquadro. Solo
   * state-03: il fumetto tagliato dalla tavola (nel suo angolo c'è 1 pixel
   * del nodo su 18.829).
   */
  hideTopRight?: { x: number; y: number };
}

export const NODI_CROP: Record<string, NodiCrop> = {
  "nodi-thread-primary": { x: 0.0151, y: 0.085, w: 0.9096, h: 0.915 },
  "nodi-thread-state-01": { x: 0.1392, y: 0.114, w: 0.8608, h: 0.7982 },
  "nodi-thread-state-02": { x: 0.0185, y: 0.0, w: 0.9815, h: 0.8636 },
  "nodi-thread-state-03": { x: 0.0103, y: 0.1215, w: 0.8763, h: 0.7664, hideTopRight: { x: 0.6856, y: 0.285 } },
  "nodi-thread-state-04": { x: 0.1059, y: 0.1261, w: 0.7797, h: 0.7658 },
  "nodi-thread-state-05": { x: 0.0, y: 0.0, w: 1.0, h: 0.8523 },
  "nodi-thread-state-06": { x: 0.0206, y: 0.0, w: 0.8351, h: 0.8605 },
  "nodi-thread-state-07": { x: 0.0195, y: 0.0, w: 0.9805, h: 0.8824 },
  "nodi-thread-state-08": { x: 0.0, y: 0.0, w: 0.9868, h: 0.8736 },
};

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
  /** Parte del PNG da mostrare (NODI_CROP); tutto il PNG se manca. */
  crop: NodiCrop;
}

/**
 * Posizione del PNG dentro il quadrato del posto perché si veda solo la parte
 * `crop`, centrata e senza deformazioni (stesso fattore in orizzontale e in
 * verticale). Valori in px, arrotondati al decimo.
 */
export function nodiCropLayout(asset: Pick<NodiAsset, "size" | "width" | "height" | "crop">): {
  width: number;
  height: number;
  left: number;
  top: number;
  /** clip-path CSS per hideTopRight, null se non serve. */
  clipPath: string | null;
} {
  const { size, width, height, crop } = asset;
  const cw = crop.w * width;
  const ch = crop.h * height;
  const scale = size / Math.max(cw, ch);
  const r = (n: number) => Math.round(n * 10) / 10;
  const cut = crop.hideTopRight;
  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
  return {
    width: r(width * scale),
    height: r(height * scale),
    left: r(-crop.x * width * scale + (size - cw * scale) / 2),
    top: r(-crop.y * height * scale + (size - ch * scale) / 2),
    clipPath: cut
      ? `polygon(0 0, ${pct(cut.x)} 0, ${pct(cut.x)} ${pct(cut.y)}, 100% ${pct(cut.y)}, 100% 100%, 0 100%)`
      : null,
  };
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
    crop: NODI_CROP[key] ?? { x: 0, y: 0, w: 1, h: 1 },
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

/** "Chi è Nodi" (29/10/2026) nella pagina Cos'è TRAMA: testo adulto e breve, senza "io". */
export const CHI_E_NODI_COPY = {
  title: "Chi è Nodi",
  intro: "Nodi è il segno di TRAMA che prende vita: fili che si intrecciano, come le persone e gli impegni di una famiglia.",
  when: "Compare solo quando serve: una settimana ancora vuota, un passaggio senza nessuno che accompagna, un gruppo da far nascere.",
  what: "Non è un assistente e non decide niente: vi segnala dove c'è un piccolo nodo da sciogliere.",
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
