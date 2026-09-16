// TRAMA ONE — Feature Flag Registry (Build Sprint 0)
//
// Registry versionato nel codice (Alternativa A del disegno approvato in
// docs/trama-one/analysis/TRAMA_ONE_Impact_Assessment_v1.0.md §6): solo le
// DEFINIZIONI dei flag vivono qui; gli override runtime (per ambiente,
// utente, ruolo, tenant, coorte, con scadenza opzionale) sono persistiti in
// Supabase nella tabella feature_flag_overrides (vedi
// supabase/migration_07_feature_flags_foundation.sql) e letti solo da
// lib/feature-flags/resolve.ts (server-only).
//
// Un flag NON presente in questo registry viene sempre risolto a `false`
// (comportamento sicuro di default) da lib/feature-flags/evaluate.ts,
// indipendentemente da eventuali righe orfane in tabella.

export type FeatureFlagScope =
  | "global"
  | "environment"
  | "user"
  | "role"
  | "tenant"
  | "cohort";

export interface FeatureFlagDefinition {
  /** Deve coincidere con la chiave dell'oggetto FEATURE_FLAG_REGISTRY. */
  name: string;
  description: string;
  /** Comportamento se nessun override applicabile viene trovato. */
  defaultValue: boolean;
  /** Scope ammessi per gli override di questo flag. */
  allowedScopes: FeatureFlagScope[];
}

export const FEATURE_FLAG_REGISTRY = {
  TRAMA_ONE_ENABLED: {
    name: "TRAMA_ONE_ENABLED",
    description:
      "Abilita le route /one (TRAMA ONE Build Sprint 0 — foundation) per Parent, Partner e Admin. " +
      "Default sicuro: disattivato. Mai esposto come variabile NEXT_PUBLIC_: risolto esclusivamente " +
      "server-side da lib/feature-flags/resolve.ts nei layout app/one/layout.tsx, " +
      "app/center/one/layout.tsx, app/admin/one/layout.tsx.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "tenant", "cohort"],
  },
  // PRE-MICRO-PILOT CLOSURE GATE (task #566, 25/08/2026) — Legal Gate per
  // Termini/Privacy Notice/dichiarazione genitoriale su migration_27 v2
  // (LIVE in produzione, applicata da Fabrizio il 25/08/2026). Questo flag
  // NON deve MAI essere abilitato globalmente prima che il testo legale
  // reale (Termini, Privacy Notice) sia stato scritto/validato e i relativi
  // legal_documents siano PUBLISHED (published_at valorizzato) — vedi
  // docs/trama-one/analysis/PRIVACY_TERMS_TECHNICAL_DESIGN.md. Con
  // defaultValue=false e nessun override "global" mai scritto da questo
  // programma, resolveFeatureFlag() restituisce sempre false in produzione
  // finché Fabrizio non crea esplicitamente un override "user"/"cohort" per
  // un account di test/coorte interna in feature_flag_overrides. Scope
  // "environment" incluso solo per poter testare in preview; "global" incluso
  // nel registry (necessario per poterlo attivare in futuro) ma NON deve
  // essere scritto come override abilitato finché il contenuto legale non è
  // pronto — è una decisione operativa di Fabrizio, non tecnica.
  LEGAL_TERMS_GATE: {
    name: "LEGAL_TERMS_GATE",
    description:
      "Abilita il flusso di accettazione Termini/Privacy Notice/Marketing in fase di " +
      "registrazione (checkbox in LoginForm.tsx) e la richiesta di dichiarazione " +
      "genitoriale alla creazione di un bambino. Default sicuro: disattivato. " +
      "PENDING EXTERNAL REVIEW sul testo legale: non abilitare globalmente finché " +
      "legal_documents non contiene almeno una riga PUBLISHED reale per 'terms' e " +
      "'privacy_notice'. Attivabile oggi solo per singoli account di test tramite " +
      "override scope=\"user\" o scope=\"cohort\" in feature_flag_overrides.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  // TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (approvato 10/09/2026) —
  // 3 flag PLACEHOLDER, registrati SOLO per dare al Release Catalog
  // (lib/releases/catalog.ts) e alla sezione "Release" di /admin/feature-flags
  // qualcosa di reale su cui esercitare l'intero meccanismo promotion/kill
  // switch (INTERNAL → PILOT → GLOBAL → INTERNAL) end-to-end, incluso lo
  // stato "RILASCIO PARZIALE" quando le 3 feature non sono tutte allo stesso
  // stadio. NESSUN codice applicativo (page/layout/Server Action/cron/
  // route) risolve mai questi 3 flag: sono inerti per costruzione, zero
  // superficie raggiungibile — coerente con l'istruzione esplicita "NON
  // creare feature fake raggiungibili". Vedi le 3 voci corrispondenti in
  // lib/feature-registry/catalog.ts (status INTERNAL_PREVIEW, nota
  // "PLACEHOLDER") e la release "TRAMA — Planner Intelligence" in
  // lib/releases/catalog.ts. Da sostituire con i flag reali quando le
  // relative capability (School Calendar Intelligence, External Planner
  // Items, Calendar Export) verranno effettivamente costruite — non prima,
  // per esplicita istruzione di Fabrizio in questa stessa sessione.
  SCHOOL_CALENDAR_INTELLIGENCE_ENABLED: {
    name: "SCHOOL_CALENDAR_INTELLIGENCE_ENABLED",
    // TRAMA — School Calendar Intelligence (14/09/2026): implementato per
    // davvero — vedi app/nextgen/planner/page.tsx (risolve questo flag
    // server-side, stesso pattern di CALENDAR_EXPORT_ENABLED),
    // SchoolCalendarOnboardingCallout.tsx/SchoolWeekBadge.tsx (UI Planner),
    // lib/school-calendar/need-core.ts + lib/data/school-calendar.ts (dati).
    // Descrizione aggiornata: non più "nessun codice applicativo la risolve
    // ancora".
    description:
      "Deriva dal calendario scolastico regionale (school_calendars/school_calendar_events) quali " +
      "settimane della stagione la scuola dei figli è chiusa, e le incrocia con la copertura Planner " +
      "esistente per distinguere 'già coperta' da 'da organizzare' (mai una fonte di copertura " +
      "alternativa). Default false: prima del rilascio nessun override GLOBAL/PILOT, solo " +
      "cohort:internal-preview attivata manualmente da Admin → Feature Flags → Release.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  EXTERNAL_PLANNER_ITEMS_ENABLED: {
    name: "EXTERNAL_PLANNER_ITEMS_ENABLED",
    description:
      "PLACEHOLDER (nessun codice applicativo la risolve ancora) — governerà in futuro la visibilità " +
      "di External Planner Items. Registrato ora solo per testare l'infrastruttura Release/Promotion.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  // TRAMA — FINAL PRE-DEPLOY FIX (14/09/2026, richiesta esplicita di
  // Fabrizio dopo il report della sessione precedente: "la Global Action
  // Progress Bar NON deve andare subito a tutti gli utenti [...] non è
  // ancora stata verificata visivamente live"). Stesso identico pattern
  // Dark Release già usato per SCHOOL_CALENDAR_INTELLIGENCE_ENABLED/
  // CALENDAR_EXPORT_ENABLED: defaultValue false, NESSUN override globale/
  // pilot scritto da questo programma — visibile SOLO quando Fabrizio
  // attiva manualmente cohort:internal-preview da Admin → Feature Flags →
  // Release. A differenza degli altri due flag di questa release, questo
  // NON governa una capability di prodotto (dati/logica): governa
  // solo la VISIBILITÀ di un componente puramente di feedback visivo
  // (nessun dato, nessuna scrittura, nessun cambio di flusso) — vedi
  // components/GlobalActionProgress.tsx.
  GLOBAL_ACTION_PROGRESS_ENABLED: {
    name: "GLOBAL_ACTION_PROGRESS_ENABLED",
    description:
      "Mostra la Global CTA Progress Bar (barra sottile brandizzata TRAMA che segnala navigazione/Server " +
      "Action in corso) nell'area genitore NEXTGEN. Default false: la barra non è mai montata per un utente " +
      "normale (nessuna differenza di comportamento/rendering rispetto a prima), visibile SOLO per la coorte " +
      "cohort:internal-preview finché non è stata verificata visivamente live. Non governa alcun dato o " +
      "flusso applicativo: puramente un indicatore di attività.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  CALENDAR_EXPORT_ENABLED: {
    name: "CALENDAR_EXPORT_ENABLED",
    // TRAMA — Calendar Export V1 (11/09/2026): implementato per davvero —
    // vedi app/nextgen/planner/page.tsx (risolve questo flag server-side),
    // components/nextgen/PlannerCalendarExportCard.tsx (CTA "Esporta
    // calendario"), lib/planner/calendar-items.ts (dati). Descrizione
    // aggiornata: non più "nessun codice applicativo la risolve ancora".
    description:
      "Export .ics degli impegni TRAMA confermati del Planner (settimane intere accettate + giorni Giorni " +
      "Spot accettati singolarmente) — V1 client-side, un file per download, nessuna sync/OAuth. Default " +
      "false: prima del rilascio nessun override GLOBAL/PILOT, solo cohort:internal-preview attivata " +
      "manualmente da Admin → Feature Flags → Release.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  // TRAMA — REAL DISCOVERY PILOT (16/09/2026). Governa la visibilità della
  // sezione "Scoperte TRAMA" in Scopri/Ricerca NEXTGEN — attività estive
  // REALI trovate sul web da TRAMA ma NON gestite da un Partner TRAMA (vedi
  // lib/discovery/real-dataset.ts per il dataset code-based e il
  // ragionamento completo sul perché non vive in "activities"). Stesso
  // identico pattern Dark Release delle altre voci di questo registry:
  // defaultValue false, nessun override GLOBAL/PILOT mai scritto da questo
  // programma — visibile SOLO per cohort:internal-preview attivata
  // manualmente da Admin → Feature Flags → Release.
  REAL_DISCOVERY_DATASET_ENABLED: {
    name: "REAL_DISCOVERY_DATASET_ENABLED",
    description:
      "Mostra in Scopri/Ricerca NEXTGEN una sezione separata 'Scoperte TRAMA' con attività estive reali " +
      "raccolte da fonti pubbliche (lib/discovery/real-dataset.ts, dataset code-based, zero righe in " +
      "'activities'/'centers'). Ogni card usa un componente dedicato (DiscoveryLeadCard, mai ActivityCard) " +
      "senza CTA 'Prenota' e con disclaimer di provenienza sempre visibile. Default false: nessun override " +
      "GLOBAL/PILOT scritto da questo programma, solo cohort:internal-preview attivata manualmente da Admin.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  // TRAMA — FINAL BETA CHROME CLEANUP (15/09/2026, PART C — "Torna alla
  // versione classica" Admin-controlled). Governa SOLO la VISIBILITÀ della
  // riga di fallback operativo in Profilo → "Esperienza TRAMA" — non
  // introduce alcun nuovo meccanismo di switch versione: riusa
  // esattamente lib/version-preference.ts (writeVersionPreference) + router,
  // lo stesso meccanismo già usato da components/VersionToggle.tsx (che
  // resta, invariato, il toggle bidirezionale riservato alle utenze di test
  // di Fabrizio — vedi lib/dev/test-accounts.ts). Stesso pattern Dark
  // Release delle altre voci di questo registry: defaultValue false,
  // nessun override GLOBAL/PILOT mai scritto da questo programma — visibile
  // SOLO quando Fabrizio attiva manualmente uno scope da Admin → Feature
  // Flags → Release (Anteprima interna → Pilot → Global, stessa scaletta a
  // 4 stadi). Quando OFF: nessun link/azione compare da nessuna parte
  // (nessun codice diverso da un semplice `{classicFallbackEnabled && ...}`
  // in ProfileNextgenClient.tsx).
  NEXTGEN_CLASSIC_FALLBACK_ENABLED: {
    name: "NEXTGEN_CLASSIC_FALLBACK_ENABLED",
    description:
      "Mostra in Profilo → 'Esperienza TRAMA' una riga utility (non un bottone/badge/CTA persistente) che " +
      "permette di passare temporaneamente alla precedente esperienza TRAMA (versione Legacy). Riusa il " +
      "meccanismo GIÀ ESISTENTE di lib/version-preference.ts (stesso cookie bk_version scritto da " +
      "VersionToggle.tsx), nessuna nuova logica di routing. Default false: la riga non è mai visibile per un " +
      "utente normale finché Fabrizio non attiva l'override per una coorte/utente/globalmente.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
} as const satisfies Record<string, FeatureFlagDefinition>;

export type KnownFeatureFlagName = keyof typeof FEATURE_FLAG_REGISTRY;

export function isKnownFlag(name: string): name is KnownFeatureFlagName {
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAG_REGISTRY, name);
}

export function getFlagDefinition(name: string): FeatureFlagDefinition | undefined {
  return isKnownFlag(name) ? FEATURE_FLAG_REGISTRY[name] : undefined;
}
