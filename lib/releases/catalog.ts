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
  // TRAMA — FINAL PRE-DEPLOY FIX (14/09/2026, richiesta esplicita di
  // Fabrizio: "non inserirla nella release Planner Intelligence se
  // concettualmente non appartiene lì [...] usa eventualmente una piccola
  // release/catalog entry: TRAMA — UX Foundations"). Release separata,
  // dedicata a capability trasversali di esperienza (non dati/dominio Planner
  // specifici) — oggi una sola voce, pensata per accoglierne altre future
  // dello stesso tipo (indicatori, feedback, micro-interazioni) senza
  // continuare a gonfiare "Planner Intelligence" con cose che non ne fanno
  // concettualmente parte.
  {
    id: "ux-foundations",
    label: "TRAMA — UX Foundations",
    shortDescription: "Componenti di esperienza trasversali (feedback visivo, indicatori di attività) non legati a una singola area di dominio.",
    targetAudience: ["parent"],
    featureKeys: ["global_action_progress", "nextgen_classic_fallback"],
    knownLimitations: [
      "global_action_progress (V1): copertura automatica solo per la navigazione interna e per le 4 CTA esplicitamente istrumentate in questa sessione (vedi PROGRESS COVERAGE nel report di implementazione) — booking/admin/promotion NON sono ancora coperte, deliberatamente (nessun layer condiviso affidabile individuato per quelle superfici senza modificare manualmente decine di componenti).",
      "Non ancora verificata visivamente live: resta dietro flag (cohort:internal-preview) finché Fabrizio non la abilita e la controlla di persona su un dispositivo reale.",
      "nextgen_classic_fallback (V1): copre solo il verso NextGen → Legacy. Il ritorno da Legacy a NextGen per un utente normale non ha oggi un percorso in UI (VersionToggle.tsx, l'unico meccanismo bidirezionale esistente, resta riservato alle utenze di test di Fabrizio) — limite esistente riportato, non introdotto da questa feature.",
    ],
    notes:
      "Creata il 14/09/2026 per ospitare Global CTA Progress Bar separatamente da \"TRAMA — Planner Intelligence\" (che resta scope Planner/School Calendar/Calendar Export). Nessuna nuova tabella, nessun nuovo meccanismo di promotion: stessa infrastruttura Release Catalog/Feature Registry esistente. Estesa il 15/09/2026 con nextgen_classic_fallback (PART C, TRAMA Beta Chrome Cleanup): stesso principio, stessa release — capability trasversale di esperienza, non specifica del Planner.",
  },
  // TRAMA — REAL DISCOVERY PILOT (16/09/2026). Release separata da "Planner
  // Intelligence" e da "UX Foundations": dominio Scopri/Ricerca, non
  // Planner. Dataset code-based (lib/discovery/real-dataset.ts), nessuna
  // nuova tabella, nessuna riga in "activities"/"centers"/"bookings".
  {
    id: "real-discovery-pilot",
    label: "TRAMA — Real Discovery Pilot",
    shortDescription: "Sezione 'Scoperte TRAMA' in Scopri: attività estive reali, non Partner, raccolte da fonti pubbliche.",
    targetAudience: ["parent"],
    featureKeys: ["real_discovery_dataset"],
    knownLimitations: [
      "real_discovery_dataset (V1): 6 record reali verificati manualmente (3 Milano/Milano Ovest, 2 Puglia Conversano/Noicattaro, 1 Milano centro per varietà categoria) — non un motore di ingestion, non copre ancora Rutigliano con un operatore specifico (il Comune regola i centri estivi tramite bando pubblico annuale, nessun operatore con sito stabile trovato in questa sessione).",
      "Non integrato con i filtri esistenti di Scopri (età/prezzo/zona/tag/servizi) — la sezione mostra tutti i record del dataset compatibili con la settimana eventualmente selezionata, non ancora filtrabili per categoria/età/prezzo come le attività Partner.",
      "Nessuna immagine: ogni card usa un visual neutro TRAMA (vedi §9 Image/Copyright Audit del report) finché non viene presa una decisione di prodotto/legal sulla gestione immagini.",
    ],
    notes:
      "Creata il 16/09/2026. Non ancora verificata visivamente live: resta dietro flag (cohort:internal-preview) finché Fabrizio non la abilita e la controlla di persona.",
  },
];

export function getReleaseCatalog(): ReleaseCatalogEntry[] {
  return RELEASE_CATALOG;
}

export function getReleaseById(id: string): ReleaseCatalogEntry | undefined {
  return RELEASE_CATALOG.find((r) => r.id === id);
}
