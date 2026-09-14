// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026)
//
// Release Catalog — source of truth CODE-BASED (nessuna nuova tabella, come
// richiesto esplicitamente) di CHE COSA contiene ciascuna release. Non
// contiene MAI uno stato INTERNAL/PILOT/GLOBAL: quello è sempre DERIVATO a
// runtime da feature_flag_overrides (vedi lib/releases/visibility.ts +
// lib/data/releases.ts), mai hardcoded qui — se questo file dicesse
// "status: PILOT" e un Admin disattivasse l'override, il file mentirebbe
// finché qualcuno non lo aggiornasse a mano. Stesso principio già seguito da
// lib/feature-registry/catalog.ts ("popolato SOLO con voci verificate",
// mai assunte) applicato qui alla dimensione "release" invece che
// "capability singola".
//
// featureKeys fa riferimento a `key` di lib/feature-registry/catalog.ts
// (FEATURE_CATALOG) — riuso deliberato invece di duplicare label/flagName
// qui: "il release catalog descrive CHE COSA contiene la release, i flag
// descrivono CHI LA VEDE" (istruzione esplicita di Fabrizio) si traduce in
// "il Feature Catalog resta l'unico posto che sa QUALE flag governa cosa".

export type ReleaseTargetAudience = "parent" | "partner" | "admin" | "cross_tenant";

export interface ReleaseCatalogEntry {
  /** Identificatore stabile, kebab-case — usato come chiave nelle Server Action di promotion. */
  id: string;
  label: string;
  shortDescription: string;
  /** Una o più aree — la maggior parte delle release avrà un solo target, ma non è un vincolo strutturale. */
  targetAudience: ReleaseTargetAudience[];
  /** Chiavi in lib/feature-registry/catalog.ts (FEATURE_CATALOG) — MAI duplicare qui label/flagName/status. */
  featureKeys: string[];
  knownLimitations?: string[];
  notes?: string;
}

export const RELEASE_CATALOG: ReleaseCatalogEntry[] = [
  // TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026) — RELEASE
  // PLACEHOLDER creata esplicitamente per testare l'infrastruttura
  // Release/Promotion end-to-end (autorizzato da Fabrizio: "Puoi
  // eventualmente creare una RELEASE PLACEHOLDER [...] con feature future
  // non attive SOLO se questo è utile per testare la UI"). Le 3 feature
  // elencate sotto sono PLACEHOLDER in FEATURE_CATALOG (status
  // INTERNAL_PREVIEW, note "PLACEHOLDER", zero codice applicativo dietro) —
  // vedi lib/feature-registry/catalog.ts. Da sostituire con la release reale
  // quando le capability verranno effettivamente costruite (fuori scope di
  // questa sessione).
  {
    id: "planner-intelligence",
    label: "TRAMA — Planner Intelligence",
    shortDescription:
      "Il Planner parte dalle settimane realmente da organizzare, anche quando le attività sono fuori da TRAMA.",
    targetAudience: ["parent"],
    featureKeys: ["school_calendar_intelligence", "external_planner_items", "calendar_export"],
    // TRAMA — School Calendar Intelligence (14/09/2026): "school_calendar_intelligence"
    // diventa la SECONDA delle 3 feature ad avere implementazione reale
    // (dopo calendar_export, 11/09/2026) — SOLO "external_planner_items"
    // resta placeholder. Limitazioni aggiornate di conseguenza (§B13: questo
    // cambio non tocca in alcun modo lo stato/gli override di
    // calendar_export, riga separata sotto, invariata).
    knownLimitations: [
      "calendar_export (V1): export .ics client-side, un file per download. NIENTE integrazione Google Calendar/Outlook/CalDAV, NIENTE feed ICS sottoscrivibile, NIENTE sync bidirezionale — solo impegni con provenienza TRAMA (bookings), external_planner_items non ancora implementato quindi nessuna Attività Esterna nel file esportato.",
      "school_calendar_intelligence (V1): 0 calendari/eventi reali in produzione — il dataset è vuoto finché Fabrizio non decide quale Regione/Comune popolare per il pilota (Admin → gestione calendari scolastici). Chiusure modellate a livello di REGIONE, non di singolo comune (school_calendar_events non ha una colonna comune). Una settimana con un solo giorno festivo/ponte isolato (1-4 giorni su 5) non genera un segnale 'da organizzare' per l'intera settimana — solo una settimana interamente senza scuola lo fa (decisione V1 documentata in lib/school-calendar/need-core.ts).",
      "external_planner_items: PLACEHOLDER — nessuna implementazione applicativa esiste ancora per questa funzionalità.",
    ],
    notes:
      "Creata durante l'implementazione dell'infrastruttura Release/Promotion (10/09/2026) per avere un caso reale, non ipotetico, su cui esercitare l'Admin UI — incluso lo stato \"Rilascio parziale\" quando le 3 feature non sono allo stesso stadio. Calendar Export V1 (11/09/2026) e School Calendar Intelligence V1 (14/09/2026) sono le prime 2 capability reali di questa release: entrambe implementate, entrambe gated (default off, nessun override GLOBAL/PILOT), attivabili in ANTEPRIMA INTERNA indipendentemente l'una dall'altra solo da Fabrizio via Admin → Feature Flags → Release.",
  },
];

export function getReleaseCatalog(): ReleaseCatalogEntry[] {
  return RELEASE_CATALOG;
}

export function getReleaseById(id: string): ReleaseCatalogEntry | undefined {
  return RELEASE_CATALOG.find((r) => r.id === id);
}
