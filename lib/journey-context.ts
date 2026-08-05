// TRAMA ONE — Sezione 8 (Chiusura P0 Parent, Context Object).
//
// Requisito P0 originale (P-MVP-02 / CR-006 / DDL-014, docs/trama-one/
// derived/*): "conservare source, period/week, child, filtri e
// correlationId" in un unico oggetto che sopravviva ai passaggi di route
// (ricerca → dettaglio → prenotazione → Planner).
//
// Stato PRIMA di questo file (DEC-41, scope volutamente minimo): esisteva
// solo lib/telemetry/correlation.ts (generazione/log del correlationId),
// mentre week/kid/source restavano parametri separati scritti a mano con
// `new URLSearchParams()` in 3 punti diversi (ActivityCardHorizontal.tsx,
// ActivityCard.tsx, DetailClient.tsx) — nessun oggetto unico, nessun helper
// condiviso, nessuna validazione comune.
//
// Questo file introduce SOLO l'oggetto e le funzioni di (de)serializzazione
// — infrastruttura additiva, senza ancora sostituire i call site esistenti
// (che restano invariati e funzionanti: week/kid/source/cid continuano a
// essere letti come oggi). La sostituzione dei call site è deliberatamente
// rimandata a un secondo passo verificabile con un run Playwright reale sul
// percorso completo (Golden Journey, Sezione 10) prima di toccare il
// percorso di prenotazione in produzione — vedi nota in
// MVP_SEPTEMBER_READINESS_MATRIX.md.
export interface JourneyContext {
  /** Dove è iniziato il percorso (es. "home_mission", "nextgen_search", "planner"). */
  source?: string;
  /** correlationId esistente — vedi lib/telemetry/correlation.ts. */
  correlationId?: string;
  /** Settimana selezionata (YYYY-MM-DD, inizio settimana), se applicabile. */
  week?: string;
  /** Bambino selezionato, se applicabile. */
  childId?: string;
  /** Filtri di ricerca liberi (categoria, prezzo, ecc.) — solo stringhe, serializzabili in query string. */
  filters?: Record<string, string>;
}

const JOURNEY_CONTEXT_PARAM = "ctx";

/**
 * Serializza un JourneyContext in un singolo valore di query string
 * (JSON + encodeURIComponent). Omette le chiavi vuote/undefined per
 * restare compatto nell'URL.
 */
export function encodeJourneyContext(ctx: JourneyContext): string {
  const compact: JourneyContext = {};
  if (ctx.source) compact.source = ctx.source;
  if (ctx.correlationId) compact.correlationId = ctx.correlationId;
  if (ctx.week) compact.week = ctx.week;
  if (ctx.childId) compact.childId = ctx.childId;
  if (ctx.filters && Object.keys(ctx.filters).length > 0) compact.filters = ctx.filters;
  return encodeURIComponent(JSON.stringify(compact));
}

/**
 * Decodifica il parametro `ctx` prodotto da encodeJourneyContext(). Non
 * lancia mai: un valore assente/malformato torna un oggetto vuoto, così un
 * link vecchio o modificato a mano non rompe la pagina di destinazione.
 */
export function decodeJourneyContext(raw: string | null | undefined): JourneyContext {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as JourneyContext;
  } catch {
    return {};
  }
}

/** Nome del query param condiviso, per chi vuole leggerlo/scriverlo direttamente. */
export { JOURNEY_CONTEXT_PARAM };

/**
 * Costruisce una query string a partire da un JourneyContext, includendo
 * ANCHE i parametri "piatti" legacy (`week`, `kid`, `source`, `cid`) accanto
 * al nuovo `ctx` unificato — compatibilità totale con i lettori esistenti
 * (DetailClient.tsx, BookingClient.tsx) che oggi leggono i parametri piatti,
 * finché non vengono migrati a leggere `ctx`.
 */
export function journeyContextToSearchParams(ctx: JourneyContext): URLSearchParams {
  const params = new URLSearchParams();
  if (ctx.week) params.set("week", ctx.week);
  if (ctx.childId) params.set("kid", ctx.childId);
  if (ctx.source) params.set("source", ctx.source);
  if (ctx.correlationId) params.set("cid", ctx.correlationId);
  params.set(JOURNEY_CONTEXT_PARAM, encodeJourneyContext(ctx));
  return params;
}
