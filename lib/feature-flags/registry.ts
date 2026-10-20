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
  RADAR_ENABLED: {
    name: "RADAR_ENABLED",
    // TRAMA — RADAR / COMMUNITY DISCOVERY (12/10/2026), patch 1 (motore):
    // risolto server-side da app/api/radar/analyze/route.ts e
    // app/actions/radar.ts. ASSUME supabase/migration_42 applicata.
    description:
      "Abilita Radar: foto di un volantino, screenshot, link o testo → controllo di pertinenza, " +
      "estrazione dati, deduplica e Community Discovery (visibile a tutti con badge 'Segnalato dalla " +
      "community'). Default false: prima solo cohort:internal-preview, attivata da Fabrizio. Analisi " +
      "in simulazione finché non c'è ANTHROPIC_API_KEY su Vercel.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  EXTERNAL_PLANNER_ITEMS_ENABLED: {
    name: "EXTERNAL_PLANNER_ITEMS_ENABLED",
    // TRAMA — EXTERNAL PLANNER ITEMS (implementato per davvero — vedi
    // app/nextgen/planner/page.tsx, risolve questo flag server-side, stesso
    // pattern di CALENDAR_EXPORT_ENABLED/SCHOOL_CALENDAR_INTELLIGENCE_ENABLED
    // — components/nextgen/ExternalPlannerItemsSection.tsx (UI Planner),
    // lib/data/external-planner-items.ts + app/actions/external-planner-items.ts
    // (dati/scritture), components/nextgen/DiscoveryLeadCard.tsx (CTA
    // "Aggiungi al Planner" da una Scoperta TRAMA). Descrizione aggiornata:
    // non più "nessun codice applicativo la risolve ancora". ASSUME che
    // supabase/migration_39_external_planner_items.sql sia già applicata —
    // finché non lo è, ogni query fallisce con 42P01 anche a flag attivo
    // (stesso comportamento "atteso" già documentato per Curated Favorites/
    // Novità TRAMA prima dell'applicazione di migration_38).
    description:
      "Governa la visibilità della sezione 'I tuoi impegni' nel Planner: impegni familiari creati " +
      "manualmente o aggiunti da una Scoperta TRAMA (snapshot, mai un fake booking/Partner). Default " +
      "false: prima del rilascio nessun override GLOBAL/PILOT, solo cohort:internal-preview attivata " +
      "manualmente da Admin → Feature Flags → Release, dopo l'applicazione della migration 39.",
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
  // TRAMA — TEST PIPELINE NUOVO ACCOUNT (30/09/2026, richiesta di Fabrizio).
  // Flag TEMPORANEO: governa solo la bolla "Test nuovo Claude · build <sha>"
  // (components/BuildInfoBubble.tsx) nei layout Genitori/Gestori/Admin.
  // Nessun dato, nessuna scrittura. Da rimuovere a test concluso (vedi
  // lib/build-info-bubble.ts per l'elenco completo dei file).
  BUILD_INFO_BUBBLE_ENABLED: {
    name: "BUILD_INFO_BUBBLE_ENABLED",
    description:
      "TEMPORANEO (test pipeline nuovo account, 30/09/2026). Mostra in alto al centro, nelle aree Genitori, " +
      "Gestori e Admin, una bolla 'Test nuovo Claude · build <commit> · <data ora>' con il commit e l'ora " +
      "della build in produzione. Non intercetta tap/click. Default false: attivare solo con override " +
      "user sul proprio account, poi spegnere e rimuovere il codice.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  // TRAMA — HOME V2 (Fase 1, 13/10/2026, iniziativa "Home e Planner v2",
  // baseline visuale V2.1). Risolto server-side in app/nextgen/page.tsx:
  // acceso → HomeDashboardV2Client, spento o errore di lettura → Home
  // attuale (HomeDashboardClient) invariata. Nessuna migration, nessun dato
  // nuovo: rollback immediato spegnendo il flag dalla card Release.
  HOME_V2_ENABLED: {
    name: "HOME_V2_ENABLED",
    description:
      "Abilita la nuova Home famiglie (V2): Oggi come timeline unica (prenotazioni TRAMA, Scoperte nel " +
      "Planner, impegni aggiunti a mano), Da fare in una sola lista (max 3), riepilogo del periodo, " +
      "prossima chiusura scolastica, suggerimenti e azioni rapide. Default false: la Home attuale resta " +
      "il ripiego per chiunque non sia nella coorte attivata dalla card Release.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  // TRAMA — PLANNER V2 + NUOVA BARRA (14/10/2026). Due flag separati, due
  // release separate nella card Release (si accendono indipendentemente).
  PLANNER_V2_ENABLED: {
    name: "PLANNER_V2_ENABLED",
    description:
      "Abilita il Planner V2: viste Settimana (qualunque settimana, giorno per giorno, con chi accompagna) e " +
      "Stagione (riepilogo, settimane per mese, filtro Da sistemare, budget compatto); Mappa, Gruppi e Mese " +
      "come strumenti secondari. Default false: il Planner attuale resta il ripiego.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  NAV_V2_ENABLED: {
    name: "NAV_V2_ENABLED",
    description:
      "Abilita la nuova barra in basso: Home, Planner, pulsante + (Aggiungi) al centro, Scopri, Prenotazioni. " +
      "Il Profilo si apre dall'avatar in Home, dove vive anche 'Cos'è TRAMA'. Default false: barra attuale.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  // TRAMA — GRUPPI V2 (14/10/2026), release "planner-v2" (la scheda Gruppi sta nel Planner).
  GROUPS_V2_ENABLED: {
    name: "GROUPS_V2_ENABLED",
    description:
      "Abilita Gruppi V2: elenco gruppi e dettaglio gruppo nello stile V2 (intestazione con segno TRAMA, schede a " +
      "pillola, card bianche, bottoni alti). Default false: pagine attuali.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  // TRAMA — PROFILO V2 (14/10/2026), release "nav-v2" (il Profilo si apre dall'avatar).
  PROFILE_V2_ENABLED: {
    name: "PROFILE_V2_ENABLED",
    description:
      "Abilita il Profilo V2: avatar e figli in alto, voci raggruppate in Famiglia / Le tue attività / App, " +
      "segno TRAMA sotto il titolo. Default false: Profilo attuale.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  // TRAMA — ONBOARDING V2 (14/10/2026), release "onboarding-v2".
  ONBOARDING_V2_ENABLED: {
    name: "ONBOARDING_V2_ENABLED",
    description:
      "Abilita l'onboarding V2 delle famiglie: tre schermate animate (tutto in un posto, anche fuori da TRAMA, chi " +
      "porta e chi riprende), poi figli e scuola, poi la Home. Si vede una volta (chiave family_onboarding_v2). " +
      "Default false: onboarding attuale.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  // TRAMA — RITORNO ALLA HOME DOPO UNA PAUSA (20/10/2026), release "home-dopo-pausa".
  RETURN_HOME_AFTER_IDLE_ENABLED: {
    name: "RETURN_HOME_AFTER_IDLE_ENABLED",
    description:
      "App installata: se si riapre o torna in primo piano dopo più di 30 minuti sulla stessa pagina lasciata, riparte " +
      "dalla Home. Link e notifiche aperti dopo la pausa si rispettano. Default false: resta sull'ultima pagina.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  // TRAMA — PAGINA DI BENVENUTO (20/10/2026), release "pagina-benvenuto".
  LANDING_PUBLIC_ENABLED: {
    name: "LANDING_PUBLIC_ENABLED",
    description:
      "Chi apre tramapp.it senza account arriva sulla pagina di benvenuto (/benvenuto: cos'è TRAMA e 'Chiedi un invito') " +
      "invece che sulla pagina di accesso; nell'accesso 'Registrati' diventa 'Chiedi un invito' (beta solo su invito). " +
      "Default false: tutto come prima. /benvenuto resta comunque raggiungibile col suo link.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort", "tenant"],
  },
  // TRAMA — TRASLOCO SU tramapp.it (16/10/2026), release "trasloco-tramapp".
  DOMAIN_MOVE_TRAMAPP_ENABLED: {
    name: "DOMAIN_MOVE_TRAMAPP_ENABLED",
    description:
      "Chi apre i vecchi indirizzi *.vercel.app viene portato su tramapp.it (partner. e admin. per i portali) " +
      "restando collegato, senza rifare il login. Default false: i vecchi indirizzi funzionano come prima.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  // TRAMA — PROMEMORIA PER LE FAMIGLIE (15/10/2026), release "promemoria-famiglie".
  FAMILY_REMINDERS_PUSH_ENABLED: {
    name: "FAMILY_REMINDERS_PUSH_ENABLED",
    description:
      "Abilita tre notifiche per le famiglie: la sera prima 'Domani: chi accompagna?' se manca chi porta o ritira; " +
      "'Scuola chiusa tra una settimana / dopodomani' se una chiusura non è organizzata; 'Nuova proposta' quando " +
      "qualcuno propone un'attività in Classe e scuola. Default false: nessuna di queste notifiche.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  // TRAMA — SCOPRI E PRENOTAZIONI V2 (14/10/2026), stessa release.
  BOOKINGS_V2_ENABLED: {
    name: "BOOKINGS_V2_ENABLED",
    description:
      "Abilita la pagina Prenotazioni V2: In arrivo / Passate, Da sistemare, prenotazioni per mese, prenotazione " +
      "aperta con stato spiegato e azioni (Scrivi al centro, Modifica, Annulla). Default false: pagina attuale.",
    defaultValue: false,
    allowedScopes: ["global", "environment", "user", "role", "cohort"],
  },
  DISCOVER_V2_ENABLED: {
    name: "DISCOVER_V2_ENABLED",
    description:
      "Abilita Scopri V2: 'Per quando' (prossima chiusura, vacanze, dopo scuola, estate), filtri ridotti, " +
      "card con motivi chiari, Elenco/Mappa. Default false: Scopri attuale.",
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
