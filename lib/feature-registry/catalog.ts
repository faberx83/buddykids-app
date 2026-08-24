// TRAMA ONE — Feature Registry canonico (Sezione 5 del programma "Final MVP
// September Readiness e Admin Feature Control Center").
//
// DISTINTO da lib/feature-flags/registry.ts (che cataloga solo i flag
// RISOLVIBILI a runtime via override in Supabase, oggi un solo flag:
// TRAMA_ONE_ENABLED). Questo file cataloga invece OGNI funzionalità
// rilevante del prodotto — gated da flag o no — con uno stato dichiarato
// esplicitamente, così che l'Admin Feature Control Center (Sezione 4) possa
// mostrare in un unico posto "cosa esiste, dove vive, in che stato è",
// invece di richiedere un grep manuale nel codice ogni volta (esattamente
// il lavoro fatto a mano in FEATURE_INVENTORY_COMPLETE.md, Sezione 3 — qui
// reso una struttura dati tipizzata e riusabile, non solo un documento).
//
// Popolato SOLO con voci verificate leggendo il codice reale (Sezione 3),
// non assunte. Aggiungere una voce qui non attiva/disattiva nulla da solo —
// è un registro descrittivo, sola lettura per l'Admin Control Center.

export type FeatureArea = "parent" | "partner" | "admin" | "cross_tenant";

// TRAMA ONE — Addendum Sezione B (REALIGNMENT ADDENDUM, "Admin Feature
// Control Center", 05/08): tassonomia tipizzata a 9 stati, sostituisce la
// precedente a 5 valori (live/beta_gated/coming_soon/hidden_no_nav/
// mock_fallback, Sezione 4/5 originali). Ogni valore vecchio è stato
// rimappato UNO A UNO sul nuovo, con la motivazione scritta accanto a ogni
// singola voce sotto (FEATURE_CATALOG) — nessuna voce persa, nessuna
// riclassificazione silenziosa. Vedi anche
// docs/trama-one/analysis/FEATURE_CONTROL_CENTER_SPEC.md per il
// ragionamento completo dietro ogni scelta di mapping.
export type FeatureStatus =
  // Raggiungibile e funzionante per QUALSIASI utente reale a cui è
  // destinata, nessun flag/coorte di mezzo.
  | "LIVE"
  // Esiste e funziona, attualmente raggiungibile per la Controlled Beta
  // Cohort tramite un override attivo del flag che la governa (oggi solo
  // TRAMA_ONE_ENABLED). ASSUNZIONE ESPLICITA (nessuna feature ha oggi più
  // di un flag, quindi non c'è ambiguità in pratica): per un utente FUORI
  // dalla coorte la stessa funzionalità risolverebbe a "off" — qui si
  // descrive lo stato dal punto di vista del programma (c'è una coorte
  // reale che la sta usando), non per singolo utente.
  | "BETA_ENABLED"
  // Costruita e funzionante, ma il flag/override che la governa è
  // attualmente OFF per chiunque (nessuna coorte attiva la vede). Nessuna
  // voce del catalogo usa oggi questo stato (TRAMA_ONE_ENABLED ha sempre
  // almeno la Controlled Beta Cohort attiva) — tipizzato per il momento in
  // cui una funzionalità Beta verrà disattivata senza essere rimossa.
  | "READY_OFF"
  // Restituisce dati finti (lib/mock-data.ts) invece di leggere da
  // Supabase, in modo condizionato (vedi note per il quando/rischio) —
  // richiede il banner "modalità demo" lato UI quando il rischio è alto
  // (vedi demoBannerRequired sotto).
  | "MOCK_DEMO"
  // Visibile in UI con badge esplicito ("Non ancora attivo"/"in arrivo") o
  // route raggiungibile solo per URL diretto/nascosta dalla nav: costruita
  // solo in parte, nessuna logica reale completa dietro.
  | "INCOMPLETE"
  // Intenzionalmente impedita in produzione per una ragione strutturale
  // permanente (non un blocco temporaneo in attesa di sblocco) — es. un
  // utility di sviluppo che deve restare invisibile quando Supabase è
  // configurato.
  | "BLOCKED"
  // Un override che la abilitava è scaduto (expires_at nel passato) e
  // nessuno lo ha rinnovato: torna silenziosamente al default sicuro.
  // Nessuna voce del catalogo usa oggi questo stato in modo permanente
  // (è per costruzione uno stato transitorio, rilevabile dai badge
  // "Scaduto"/"⚠ Verificare scadenza" già presenti nella sezione Override
  // qui sotto, non nel catalogo statico) — tipizzato per completezza dello
  // schema, coerente con la richiesta esplicita dell'Addendum.
  | "EXPIRED"
  // Era Beta, ora promossa a comportamento standard per tutti (il flag
  // resta nel registry per rollback ma non è più il criterio di accesso).
  // Nessuna voce del catalogo usa oggi questo stato: nessuna funzionalità
  // TRAMA ONE è ancora uscita dalla fase Beta.
  | "POST_BETA"
  // Superata, mantenuta solo per compatibilità (bookmark/link vecchi),
  // candidata alla rimozione.
  | "DEPRECATED";

export interface FeatureCatalogEntry {
  /** Identificatore stabile, kebab-case — usato come chiave in UI/audit log. */
  key: string;
  label: string;
  area: FeatureArea;
  status: FeatureStatus;
  description: string;
  /** Nome del flag in lib/feature-flags/registry.ts, se lo stato dipende da un flag risolvibile. */
  flagName?: string;
  /** File sorgente principali, per traceability — non esaustivo, i più rappresentativi. */
  sourceFiles: string[];
  /** Nota libera su condizioni/rischio, quando rilevante (es. MOCK_DEMO). */
  note?: string;
  /**
   * Addendum Sezione B — livello di rischio dichiarato per questa voce
   * (quanto danno farebbe se nessuno se ne accorgesse). "low" di default se
   * omesso: solo le voci con un rischio non ovvio lo dichiarano
   * esplicitamente qui invece di lasciarlo solo nella prosa di `note`.
   */
  riskLevel?: "low" | "medium" | "high";
  /**
   * Addendum Sezione B — vero SOLO per le voci MOCK_DEMO il cui fallback può
   * attivarsi anche con Supabase CONFIGURATO (quindi un utente reale in
   * produzione potrebbe vederlo senza saperlo) — richiede un banner "stai
   * vedendo dati demo" lato UI, non solo la nota qui nel catalogo. Le voci
   * MOCK_DEMO il cui fallback scatta SOLO senza Supabase configurato non lo
   * impostano: in quel caso l'intera app è già coerentemente in modalità
   * demo, un banner locale sarebbe rumore.
   */
  demoBannerRequired?: boolean;
}

export const FEATURE_CATALOG: FeatureCatalogEntry[] = [
  // ── TRAMA ONE (era "beta_gated") — MAPPING: la Controlled Beta Cohort è
  // oggi attivamente abilitata (override globale + coorte, vedi
  // MVP_PRODUCTION_TRUTH_V2.md §6), quindi lo stato corrente per il
  // programma è BETA_ENABLED, non READY_OFF (che descrive invece un flag
  // spento per chiunque) ─────────────────────────────────────────────
  {
    key: "trama_one_parent_shell",
    label: "TRAMA ONE — shell Parent (/one)",
    area: "parent",
    status: "BETA_ENABLED",
    flagName: "TRAMA_ONE_ENABLED",
    description: "Shell Parent della nuova esperienza TRAMA ONE, dietro Controlled Beta Cohort.",
    sourceFiles: ["app/one/layout.tsx", "app/one/page.tsx"],
  },
  {
    key: "trama_one_partner_shell",
    label: "TRAMA ONE — shell Partner (/center/one)",
    area: "partner",
    status: "BETA_ENABLED",
    flagName: "TRAMA_ONE_ENABLED",
    description: "Shell Partner, incluso l'onboarding centro (/center/one/onboarding).",
    sourceFiles: ["app/center/one/layout.tsx", "app/center/one/page.tsx", "app/center/one/onboarding/page.tsx"],
  },
  {
    key: "trama_one_admin_shell",
    label: "TRAMA ONE — shell Admin (/admin/one, Command Center)",
    area: "admin",
    status: "BETA_ENABLED",
    flagName: "TRAMA_ONE_ENABLED",
    description: "Command Center Admin: 7 code operative aggregate. Voce di menu 'Command Center' compare solo col flag attivo.",
    sourceFiles: ["app/admin/one/layout.tsx", "app/admin/layout.tsx", "lib/data/command-center.ts"],
  },
  {
    key: "partner_spotlight_tour",
    label: "Tour guidato Spotlight (Partner — creazione attività)",
    area: "partner",
    status: "BETA_ENABLED",
    flagName: "TRAMA_ONE_ENABLED",
    description: "Overlay ancorato al DOM reale che guida il Partner nella creazione della prima attività (6 step).",
    sourceFiles: ["components/spotlight/PartnerSpotlight.tsx", "lib/walkthrough/registry.ts", "app/center/layout.tsx"],
  },
  {
    // MAPPING: era "hidden_no_nav" — in realtà è funzionale e coerente con
    // lo stesso flag/coorte del tour che riavvia, non "nascosta senza una
    // ragione": rimappata su BETA_ENABLED come il resto della famiglia
    // Spotlight invece di lasciarla in una categoria residuale.
    key: "partner_spotlight_restart",
    label: "Bottone 'Riavvia tour guidato' (Partner, Preferenze)",
    area: "partner",
    status: "BETA_ENABLED",
    flagName: "TRAMA_ONE_ENABLED",
    description: "Visibile solo se il flag risolve true per l'utente — coerente, nessun senso mostrarlo altrimenti.",
    sourceFiles: ["app/center/account/preferenze/page.tsx"],
  },

  // ── Costruite solo in parte (era "coming_soon") — MAPPING: badge "in
  // arrivo" = nessuna logica reale completa dietro, non solo un
  // interruttore spento su una feature altrimenti pronta -> INCOMPLETE ──
  {
    key: "profile_language_theme",
    label: "Preferenze: Lingua e Tema",
    area: "parent",
    status: "INCOMPLETE",
    description: "Selettori presenti in UI, badge 'Non ancora attivo', nessuna persistenza reale.",
    sourceFiles: ["components/ProfilePreferencesSection.tsx"],
  },
  {
    key: "payment_methods",
    label: "Metodi di pagamento",
    area: "parent",
    status: "INCOMPLETE",
    description: "Voce menu Profilo con badge 'in arrivo' — nessun gateway pagamenti integrato nell'MVP.",
    sourceFiles: ["components/ProfileSettingsSection.tsx", "app/(main)/profile/page.tsx"],
  },
  {
    key: "receipts_invoices",
    label: "Ricevute e fatture",
    area: "parent",
    status: "INCOMPLETE",
    description: "Voce menu Profilo con badge 'in arrivo'.",
    sourceFiles: ["app/(main)/profile/page.tsx"],
  },
  {
    key: "nextgen_settings_comingsoon",
    label: "Impostazioni NEXTGEN (varie voci comingSoon)",
    area: "parent",
    status: "INCOMPLETE",
    description: "Stesse voci Lingua/Tema/Pagamenti/Ricevute replicate nell'hub Impostazioni NEXTGEN.",
    sourceFiles: ["app/nextgen/profile/impostazioni/ImpostazioniHubClient.tsx", "app/nextgen/profile/ProfileNextgenClient.tsx"],
  },
  {
    key: "prenotazioni_calendar_view",
    label: "Le mie prenotazioni — Vista calendario",
    area: "parent",
    status: "INCOMPLETE",
    description: "Tab presente con badge 'in arrivo', nessuna vista calendario implementata.",
    sourceFiles: ["app/(main)/prenotazioni/PrenotazioniClient.tsx"],
  },
  {
    key: "reminders_calendar_maps_integration",
    label: "Promemoria: integrazione Google Calendar / Maps",
    area: "parent",
    status: "INCOMPLETE",
    description: "Toggle presenti in UI, 'in arrivo' — non collegati a nessuna API esterna.",
    sourceFiles: ["app/nextgen/planner/promemoria/PromemoriaClient.tsx"],
  },
  {
    key: "groups_discover_invites",
    label: "Gruppi: 'Scopri gruppi pubblici' / 'Inviti ricevuti'",
    area: "parent",
    status: "INCOMPLETE",
    description: "Testo statico 'funzionalità in arrivo', nessuna azione dietro.",
    sourceFiles: ["components/GroupsClient.tsx"],
  },
  {
    key: "booking_payment_option_comingsoon",
    label: "Prenotazione: opzione di pagamento non attiva",
    area: "parent",
    status: "INCOMPLETE",
    description: "Badge 'in arrivo' su un metodo/opzione booking non ancora attivo.",
    sourceFiles: ["app/booking/[id]/BookingClient.tsx"],
  },
  {
    // MAPPING: non è "in attesa di essere sbloccata" né una feature a metà
    // — è un utility di sviluppo con un blocco STRUTTURALE e permanente
    // (si nasconde da sola quando Supabase è configurato, per design, non
    // per una svista da correggere) -> BLOCKED, con nota esplicita che non
    // è temporaneo.
    key: "role_switcher_demo",
    label: "RoleSwitcher (login demo senza Supabase)",
    area: "cross_tenant",
    status: "BLOCKED",
    description: "Selettore di ruolo per demo locale — nascosto per design quando Supabase è configurato (`if (isSupabaseConfigured) return null`).",
    sourceFiles: ["components/RoleSwitcher.tsx"],
    note: "Blocco permanente e intenzionale (non un blocco temporaneo in attesa di sblocco): è un utility di sviluppo, non una funzionalità verso l'utente finale.",
  },
  {
    // MAPPING: superata da Famiglia (Sprint 7), mantenuta solo per non
    // rompere bookmark vecchi -> DEPRECATED, il fit più diretto dei 9 stati.
    key: "logistica_hub_redirect_shim",
    label: "Hub Logistica (route storica, redirect shim)",
    area: "parent",
    status: "DEPRECATED",
    description: "Nessun link in nessuna nav — esiste solo come redirect a Famiglia per non rompere bookmark salvati pre-Sprint 7.",
    sourceFiles: ["app/nextgen/planner/logistica/page.tsx"],
  },

  // ── Dati finti condizionati (era "mock_fallback") -> MOCK_DEMO ─────
  {
    key: "activities_mock_fallback",
    label: "Elenco attività — fallback a dati demo",
    area: "cross_tenant",
    status: "MOCK_DEMO",
    description: "getActivities() ricade su mockActivities anche con Supabase CONFIGURATO, se la query ritorna 0 righe o errore.",
    sourceFiles: ["lib/data/activities.ts"],
    note: "RISCHIO ALTO — un centro/attività reale ma vuota mostrerebbe dati finti senza avviso. Banner 'modalità demo' cablato su Home Legacy/NEXTGEN (Addendum Sezione B, isMockActivitiesArray) — rollout ai restanti punti di lettura (Ricerca/Planner/Community/Preferiti) ancora da fare, vedi FEATURE_CONTROL_CENTER_SPEC.md.",
    riskLevel: "high",
    demoBannerRequired: true,
  },
  {
    key: "groups_calendar_tags_kids_mock_fallback",
    label: "Gruppi / Calendario / Tag / Bambini — fallback demo (solo senza Supabase)",
    area: "cross_tenant",
    status: "MOCK_DEMO",
    description: "Stesso pattern di activities.ts, ma condizionato SOLO a !isSupabaseConfigured (non attivo se le chiavi Vercel sono impostate).",
    sourceFiles: ["lib/data/groups.ts", "lib/data/calendar.ts", "lib/data/tags.ts", "lib/data/kids.ts"],
    note: "Rischio basso — irrilevante se le env var Vercel sono corrette (verifica indipendente, non eseguibile da questo sandbox). Nessun banner: scatta solo se l'intera app è già in modalità demo.",
    riskLevel: "low",
  },
  {
    key: "profile_mock_fallback",
    label: "Profilo utente/gestore — dati demo (solo senza Supabase)",
    area: "cross_tenant",
    status: "MOCK_DEMO",
    description: "DEMO_PROFILE/demoGestore restituiti se !isSupabaseConfigured.",
    sourceFiles: ["lib/data/profile.ts"],
    note: "Rischio basso, stesso motivo del punto precedente.",
    riskLevel: "low",
  },
  {
    key: "partner_offers_mock_fallback",
    label: "Offerte Partner — dati demo (solo senza Supabase)",
    area: "partner",
    status: "MOCK_DEMO",
    description: "mockOffers (tutti active:true forzato) se !isSupabaseConfigured.",
    sourceFiles: ["lib/data/partner-offers.ts"],
    note: "Rischio basso, stesso motivo.",
    riskLevel: "low",
  },

  // ── PRE-LAUNCH REMEDIATION WAVE 1, R-01 (24/08/2026) — pagine Admin
  // "classiche" che leggono lib/mock-data.ts in modo INCONDIZIONATO (non un
  // fallback: nessuna di queste query legge mai Supabase). Diverse dalle 4
  // voci sopra proprio per questo: qui il rischio è "alto" perché un Admin
  // reale potrebbe scambiare questi numeri per dati di produzione anche a
  // Supabase pienamente configurato — per questo richiedono
  // AdminMockDataBanner (componente dedicato, non i badge di StatusBadge.tsx,
  // giudicati insufficientemente visibili) invece di restare senza avviso
  // come le voci MOCK_DEMO storiche qui sopra. Nessun codice rimosso in
  // questa fase (decisione esplicita di Fabrizio) — solo banner + questa
  // classificazione. ────────────────────────────────────────────────
  {
    key: "admin_dashboard_root_mock",
    label: "Admin — Dashboard root (/admin)",
    area: "admin",
    status: "MOCK_DEMO",
    description: "StatCard (centri/attività/prenotazioni/fatturato), grafico occupazione e liste 'Prenotazioni recenti'/'Centri' leggono SEMPRE bookingsMock/activities/centers, mai Supabase.",
    sourceFiles: ["app/admin/page.tsx"],
    note: "Superficie operativa canonica della Beta è /admin/one (Command Center, dati reali) — questa pagina resta raggiungibile per compatibilità storica con AdminMockDataBanner permanente.",
    riskLevel: "high",
    demoBannerRequired: true,
  },
  {
    key: "admin_activities_list_mock",
    label: "Admin — Attività (/admin/activities)",
    area: "admin",
    status: "MOCK_DEMO",
    description: "Elenco attività letto SOLO da lib/mock-data.ts, mai Supabase.",
    sourceFiles: ["app/admin/activities/page.tsx"],
    riskLevel: "high",
    demoBannerRequired: true,
  },
  {
    key: "admin_analytics_mixed_mock",
    label: "Admin — Analisi (/admin/analytics)",
    area: "admin",
    status: "MOCK_DEMO",
    description: "Pagina a contenuto MISTO: la tabella 'Attività dei Gestori centro' è reale (getGestoriActivitySummary, legge activity_log); grafico occupazione, ripartizione tag/età e suggerimenti cross-selling leggono lib/mock-data.ts.",
    sourceFiles: ["app/admin/analytics/page.tsx", "lib/data/gestori-activity.ts"],
    note: "Classificata MOCK_DEMO per la porzione prevalente della pagina — la tabella reale è marcata con pill 'Dato reale' distinta, non con lo status di questa voce.",
    riskLevel: "high",
    demoBannerRequired: true,
  },
  {
    key: "admin_centers_list_mock",
    label: "Admin — Centri (/admin/centers)",
    area: "admin",
    status: "MOCK_DEMO",
    description: "Elenco centri sotto il form 'Nuovo centro' è SEMPRE lib/mock-data.ts: un centro reale appena creato dal form (che scrive su Supabase) non compare in questa lista.",
    sourceFiles: ["app/admin/centers/page.tsx"],
    note: "Nessuna vista che elenchi i centri reali esiste oggi nell'app (verificato: /admin/one aggrega solo code operative, non un elenco centri) — gap dichiarato nel banner, nessuna CTA verso una vista inesistente.",
    riskLevel: "high",
    demoBannerRequired: true,
  },
];

export function getFeatureCatalog(): FeatureCatalogEntry[] {
  return FEATURE_CATALOG;
}

export function groupCatalogByStatus(): Record<FeatureStatus, FeatureCatalogEntry[]> {
  const groups: Record<FeatureStatus, FeatureCatalogEntry[]> = {
    LIVE: [],
    BETA_ENABLED: [],
    READY_OFF: [],
    MOCK_DEMO: [],
    INCOMPLETE: [],
    BLOCKED: [],
    EXPIRED: [],
    POST_BETA: [],
    DEPRECATED: [],
  };
  for (const entry of FEATURE_CATALOG) {
    groups[entry.status].push(entry);
  }
  return groups;
}

export function getFeatureCatalogByArea(area: FeatureArea): FeatureCatalogEntry[] {
  return FEATURE_CATALOG.filter((e) => e.area === area || e.area === "cross_tenant");
}

/**
 * Addendum Sezione B — chiavi dei flag distinti tra le voci di catalogo in
 * stato BETA_ENABLED (dedup su flagName). Oggi risolve sempre a un solo
 * elemento (["TRAMA_ONE_ENABLED"]) perché ogni voce Beta del catalogo è
 * governata dallo stesso flag — usata dalle azioni batch
 * (app/actions/feature-flag-overrides.ts, batchActivateBetaFeaturesAction/
 * batchDeactivateBetaFeaturesAction) per restare corrette anche se in
 * futuro una seconda funzionalità Beta userà un flag diverso, senza dover
 * riscrivere l'azione.
 */
export function getBetaEnabledFlagNames(): string[] {
  const names = new Set<string>();
  for (const entry of FEATURE_CATALOG) {
    if (entry.status === "BETA_ENABLED" && entry.flagName) names.add(entry.flagName);
  }
  return Array.from(names);
}
