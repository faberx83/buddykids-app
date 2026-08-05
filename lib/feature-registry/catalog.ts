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

export type FeatureStatus =
  // Raggiungibile e funzionante per l'utente reale a cui è destinata.
  | "live"
  // Esiste e funziona, ma dietro TRAMA_ONE_ENABLED (Controlled Beta Cohort) —
  // invisibile per un utente reale fuori dalla coorte.
  | "beta_gated"
  // Visibile in UI con badge esplicito ("Non ancora attivo"/"in arrivo"),
  // nessuna logica reale dietro.
  | "coming_soon"
  // Pagina/route esistente ma raggiungibile solo per URL diretto o dietro un
  // flag, mai da un link/voce di menu per l'utente a cui sarebbe destinata.
  | "hidden_no_nav"
  // Restituisce dati finti (lib/mock-data.ts) invece di leggere da Supabase,
  // in modo condizionato (vedi note per capire quando).
  | "mock_fallback";

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
  /** Nota libera su condizioni/rischio, quando rilevante (es. mock_fallback). */
  note?: string;
}

export const FEATURE_CATALOG: FeatureCatalogEntry[] = [
  // ── TRAMA ONE (beta_gated) ──────────────────────────────────────────
  {
    key: "trama_one_parent_shell",
    label: "TRAMA ONE — shell Parent (/one)",
    area: "parent",
    status: "beta_gated",
    flagName: "TRAMA_ONE_ENABLED",
    description: "Shell Parent della nuova esperienza TRAMA ONE, dietro Controlled Beta Cohort.",
    sourceFiles: ["app/one/layout.tsx", "app/one/page.tsx"],
  },
  {
    key: "trama_one_partner_shell",
    label: "TRAMA ONE — shell Partner (/center/one)",
    area: "partner",
    status: "beta_gated",
    flagName: "TRAMA_ONE_ENABLED",
    description: "Shell Partner, incluso l'onboarding centro (/center/one/onboarding).",
    sourceFiles: ["app/center/one/layout.tsx", "app/center/one/page.tsx", "app/center/one/onboarding/page.tsx"],
  },
  {
    key: "trama_one_admin_shell",
    label: "TRAMA ONE — shell Admin (/admin/one, Command Center)",
    area: "admin",
    status: "beta_gated",
    flagName: "TRAMA_ONE_ENABLED",
    description: "Command Center Admin: 7 code operative aggregate. Voce di menu 'Command Center' compare solo col flag attivo.",
    sourceFiles: ["app/admin/one/layout.tsx", "app/admin/layout.tsx", "lib/data/command-center.ts"],
  },
  {
    key: "partner_spotlight_tour",
    label: "Tour guidato Spotlight (Partner — creazione attività)",
    area: "partner",
    status: "beta_gated",
    flagName: "TRAMA_ONE_ENABLED",
    description: "Overlay ancorato al DOM reale che guida il Partner nella creazione della prima attività (6 step).",
    sourceFiles: ["components/spotlight/PartnerSpotlight.tsx", "lib/walkthrough/registry.ts", "app/center/layout.tsx"],
  },
  {
    key: "partner_spotlight_restart",
    label: "Bottone 'Riavvia tour guidato' (Partner, Preferenze)",
    area: "partner",
    status: "hidden_no_nav",
    flagName: "TRAMA_ONE_ENABLED",
    description: "Visibile solo se il flag risolve true per l'utente — coerente, nessun senso mostrarlo altrimenti.",
    sourceFiles: ["app/center/account/preferenze/page.tsx"],
  },

  // ── Coming soon / disattivate deliberatamente ──────────────────────
  {
    key: "profile_language_theme",
    label: "Preferenze: Lingua e Tema",
    area: "parent",
    status: "coming_soon",
    description: "Selettori presenti in UI, badge 'Non ancora attivo', nessuna persistenza reale.",
    sourceFiles: ["components/ProfilePreferencesSection.tsx"],
  },
  {
    key: "payment_methods",
    label: "Metodi di pagamento",
    area: "parent",
    status: "coming_soon",
    description: "Voce menu Profilo con badge 'in arrivo' — nessun gateway pagamenti integrato nell'MVP.",
    sourceFiles: ["components/ProfileSettingsSection.tsx", "app/(main)/profile/page.tsx"],
  },
  {
    key: "receipts_invoices",
    label: "Ricevute e fatture",
    area: "parent",
    status: "coming_soon",
    description: "Voce menu Profilo con badge 'in arrivo'.",
    sourceFiles: ["app/(main)/profile/page.tsx"],
  },
  {
    key: "nextgen_settings_comingsoon",
    label: "Impostazioni NEXTGEN (varie voci comingSoon)",
    area: "parent",
    status: "coming_soon",
    description: "Stesse voci Lingua/Tema/Pagamenti/Ricevute replicate nell'hub Impostazioni NEXTGEN.",
    sourceFiles: ["app/nextgen/profile/impostazioni/ImpostazioniHubClient.tsx", "app/nextgen/profile/ProfileNextgenClient.tsx"],
  },
  {
    key: "prenotazioni_calendar_view",
    label: "Le mie prenotazioni — Vista calendario",
    area: "parent",
    status: "coming_soon",
    description: "Tab presente con badge 'in arrivo', nessuna vista calendario implementata.",
    sourceFiles: ["app/(main)/prenotazioni/PrenotazioniClient.tsx"],
  },
  {
    key: "reminders_calendar_maps_integration",
    label: "Promemoria: integrazione Google Calendar / Maps",
    area: "parent",
    status: "coming_soon",
    description: "Toggle presenti in UI, 'in arrivo' — non collegati a nessuna API esterna.",
    sourceFiles: ["app/nextgen/planner/promemoria/PromemoriaClient.tsx"],
  },
  {
    key: "groups_discover_invites",
    label: "Gruppi: 'Scopri gruppi pubblici' / 'Inviti ricevuti'",
    area: "parent",
    status: "coming_soon",
    description: "Testo statico 'funzionalità in arrivo', nessuna azione dietro.",
    sourceFiles: ["components/GroupsClient.tsx"],
  },
  {
    key: "booking_payment_option_comingsoon",
    label: "Prenotazione: opzione di pagamento non attiva",
    area: "parent",
    status: "coming_soon",
    description: "Badge 'in arrivo' su un metodo/opzione booking non ancora attivo.",
    sourceFiles: ["app/booking/[id]/BookingClient.tsx"],
  },
  {
    key: "role_switcher_demo",
    label: "RoleSwitcher (login demo senza Supabase)",
    area: "cross_tenant",
    status: "hidden_no_nav",
    description: "Selettore di ruolo per demo locale — nascosto per design quando Supabase è configurato (`if (isSupabaseConfigured) return null`).",
    sourceFiles: ["components/RoleSwitcher.tsx"],
  },
  {
    key: "logistica_hub_redirect_shim",
    label: "Hub Logistica (route storica, redirect shim)",
    area: "parent",
    status: "hidden_no_nav",
    description: "Nessun link in nessuna nav — esiste solo come redirect a Famiglia per non rompere bookmark salvati pre-Sprint 7.",
    sourceFiles: ["app/nextgen/planner/logistica/page.tsx"],
  },

  // ── Mock fallback (dati finti condizionati) ────────────────────────
  {
    key: "activities_mock_fallback",
    label: "Elenco attività — fallback a dati demo",
    area: "cross_tenant",
    status: "mock_fallback",
    description: "getActivities() ricade su mockActivities anche con Supabase CONFIGURATO, se la query ritorna 0 righe o errore.",
    sourceFiles: ["lib/data/activities.ts"],
    note: "RISCHIO ALTO — un centro/attività reale ma vuota mostrerebbe dati finti senza avviso. Da chiudere prima di settembre (vedi FEATURE_INVENTORY_COMPLETE.md).",
  },
  {
    key: "groups_calendar_tags_kids_mock_fallback",
    label: "Gruppi / Calendario / Tag / Bambini — fallback demo (solo senza Supabase)",
    area: "cross_tenant",
    status: "mock_fallback",
    description: "Stesso pattern di activities.ts, ma condizionato SOLO a !isSupabaseConfigured (non attivo se le chiavi Vercel sono impostate).",
    sourceFiles: ["lib/data/groups.ts", "lib/data/calendar.ts", "lib/data/tags.ts", "lib/data/kids.ts"],
    note: "Rischio basso — irrilevante se le env var Vercel sono corrette (verifica indipendente, non eseguibile da questo sandbox).",
  },
  {
    key: "profile_mock_fallback",
    label: "Profilo utente/gestore — dati demo (solo senza Supabase)",
    area: "cross_tenant",
    status: "mock_fallback",
    description: "DEMO_PROFILE/demoGestore restituiti se !isSupabaseConfigured.",
    sourceFiles: ["lib/data/profile.ts"],
    note: "Rischio basso, stesso motivo del punto precedente.",
  },
  {
    key: "partner_offers_mock_fallback",
    label: "Offerte Partner — dati demo (solo senza Supabase)",
    area: "partner",
    status: "mock_fallback",
    description: "mockOffers (tutti active:true forzato) se !isSupabaseConfigured.",
    sourceFiles: ["lib/data/partner-offers.ts"],
    note: "Rischio basso, stesso motivo.",
  },
];

export function getFeatureCatalog(): FeatureCatalogEntry[] {
  return FEATURE_CATALOG;
}

export function groupCatalogByStatus(): Record<FeatureStatus, FeatureCatalogEntry[]> {
  const groups: Record<FeatureStatus, FeatureCatalogEntry[]> = {
    live: [],
    beta_gated: [],
    coming_soon: [],
    hidden_no_nav: [],
    mock_fallback: [],
  };
  for (const entry of FEATURE_CATALOG) {
    groups[entry.status].push(entry);
  }
  return groups;
}

export function getFeatureCatalogByArea(area: FeatureArea): FeatureCatalogEntry[] {
  return FEATURE_CATALOG.filter((e) => e.area === area || e.area === "cross_tenant");
}
