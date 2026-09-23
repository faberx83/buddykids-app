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
    shortDescription:
      "Scopri unificato: risultati Partner e Scoperte TRAMA (attività estive reali, non Partner, raccolte da fonti pubbliche) nello stesso result set, stesso count, stessi filtri.",
    targetAudience: ["parent"],
    featureKeys: ["real_discovery_dataset"],
    // CORRETTO 21/09/2026 (DISCOVERY UNIFICATION + PROPONI INVITO, §4 del
    // prompt: "Correggi la documentazione stale... che dichiara ancora
    // erroneamente che Real Discovery non è integrato con i filtri"). Le due
    // voci sotto erano vere il 16/09 e sono rimaste FALSE dopo il
    // COMPLETION PASS del 17/09 (adapter filtro) e dopo l'unificazione del
    // 21/09 (result set unico) — nessuno le aveva più aggiornate: la scheda
    // Admin → Feature Flags → Release comunicava un limite non più esistente.
    knownLimitations: [
      "real_discovery_dataset (V1): 13 record reali verificati manualmente (11 Milano/Milano Ovest incl. Bareggio, 2 Puglia Conversano/Noicattaro) — non un motore di ingestion. Rutigliano stesso non ha ancora un operatore estivo specifico confermato (il Comune regola i centri estivi tramite bando pubblico annuale, nessun operatore con sito stabile trovato finora) — documentato come RUTIGLIANO SEARCH TRACE nel report, non trattato come fallimento del dataset.",
      "Filtri (settimana/età/prezzo/zona testuale/categoria/ricerca) SONO applicati ai lead curati con la stessa semantica null-safe dei filtri Partner (un dato mancante non esclude mai un record) — vedi gli adapter puri in lib/discovery/real-dataset.ts. NON applicati: zona a raggio geografico (nessun lead ha coordinate verificate) e Servizi/Copertura (campi che non esistono nel Target Data Contract) — limitazioni deliberate, non un gap di implementazione.",
      "Result set unificato (21/09/2026): Partner e Scoperte TRAMA convivono nello stesso elenco con un unico count, intercalati con un ordinamento deterministico (2 Partner : 1 Curated, nessun Match/punteggio inventato per il Curated) — nessuna sezione separata 'Scoperte TRAMA' più in cima alla pagina.",
      "'Proponi invito' (manifestazione d'interesse verso public.center_leads, infrastruttura esistente) mostrato SOLO sui 7/13 record con un'entità organizzatrice reale e nominata — i 6 record che descrivono un servizio comunale con gestore non nominato/rotante restano visibili ma senza questa CTA (mostrano solo il link alla fonte).",
      "Nessuna immagine: ogni card usa un visual neutro TRAMA (vedi §9 Image/Copyright Audit del report) finché non viene presa una decisione di prodotto/legal sulla gestione immagini.",
      // AGGIORNATO 23/09/2026 (POST-DISCOVERY CONSOLIDATION): non più un gap
      // — Favorites ora disponibile anche per i lead curati, su una
      // tabella NUOVA e separata (public.curated_favorites, migration 38 —
      // NON ANCORA APPLICATA), senza alcuno schema change su
      // public.favorites/activities. Vedi lib/data/curated-favorites.ts +
      // lib/discovery/unified-favorites.ts (meccanismo di merge/promotion
      // Curated → Partner nei Preferiti unificati).
    ],
    notes:
      "Creata il 16/09/2026, estesa il 17/09 (COMPLETION PASS: dataset 6→13, filtri, analytics), il 21/09/2026 (DISCOVERY UNIFICATION + PROPONI INVITO: result set unico, CTA 'Proponi invito' su riuso di center_leads) e il 23/09/2026 (POST-DISCOVERY CONSOLIDATION: Curated Favorites, tabella curated_favorites NON ANCORA APPLICATA — migration 38). Non ancora verificata visivamente live in nessuna delle iterazioni (nessun accesso a browser/dev-server nell'ambiente di sviluppo): resta dietro flag (cohort:internal-preview) finché Fabrizio non la abilita e la controlla di persona.",
  },
];

export function getReleaseCatalog(): ReleaseCatalogEntry[] {
  return RELEASE_CATALOG;
}

export function getReleaseById(id: string): ReleaseCatalogEntry | undefined {
  return RELEASE_CATALOG.find((r) => r.id === id);
}
