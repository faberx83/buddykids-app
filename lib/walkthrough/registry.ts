// TRAMA ONE Build Sprint 1 — motore Walkthrough generico, registry.
//
// Generico per costruzione: tutorial_key non è vincolato a un solo dominio
// (onboarding Center, benvenuto Parent, futuro onboarding Admin...) — ogni
// voce di questo registry è un percorso indipendente, identificato da una
// chiave libera, con i propri step ordinati. Lo stato di avanzamento per
// utente vive in Supabase (tabella public.tutorial_progress, vedi
// supabase/migration_09_center_onboarding.sql), le DEFINIZIONI qui, stesso
// pattern già usato per lib/feature-flags/registry.ts e
// lib/onboarding/checklist-registry.ts.
//
// V4 di ASSUMPTION_LOG.md ("il pattern TutorialProgress è sufficiente come
// base schema, senza colonne aggiuntive non ancora previste") verificata
// qui: ogni step ha solo key/title/description, nessun campo extra richiesto
// dal motore generico per la demo di Sprint 1 (benvenuto/completamento
// profilo Parent).

export interface WalkthroughStepDefinition {
  key: string;
  title: string;
  description: string;
}

export interface WalkthroughDefinition {
  key: string;
  title: string;
  steps: WalkthroughStepDefinition[];
}

export const WALKTHROUGH_REGISTRY: Record<string, WalkthroughDefinition> = {
  welcome_parent: {
    key: "welcome_parent",
    title: "Benvenuto in TRAMA ONE",
    steps: [
      {
        key: "welcome",
        title: "Benvenuto",
        description: "TRAMA ONE è la nuova esperienza in costruzione — qui trovi le novità in anteprima.",
      },
      {
        key: "profile_check",
        title: "Completa il profilo",
        description: "Verifica che il profilo di famiglia e dei bambini sia aggiornato.",
      },
      {
        key: "done",
        title: "Tutto pronto",
        description: "Hai completato il percorso di benvenuto.",
      },
    ],
  },
  // TRAMA ONE Build Sprint 2 — percorso Partner per la creazione di
  // un'attività, come richiesto dallo scope Sprint 2 (SPRINT_GOVERNANCE.md:
  // "step Walkthrough attività: crea attività/configura settimane/prezzi/
  // Giorni spot/pubblica/dashboard"). Riusa lo stesso motore generico di
  // welcome_parent, nessuna modifica al motore stesso — solo una nuova
  // definizione di percorso e la sua pagina di collegamento (/center/one).
  // Ogni step linka la pagina reale AS-IS dove l'azione va fatta (nessuna
  // logica di business duplicata qui: il percorso è solo una checklist
  // guidata, la scrittura reale resta in ActivityEditForm.tsx/
  // saveActivityDaysAction, invariati da questo sprint).
  activity_creation_partner: {
    key: "activity_creation_partner",
    title: "Pubblica la tua prima attività",
    steps: [
      {
        key: "create_activity",
        title: "Crea l'attività",
        description: "Vai su \"Le tue attività\" e crea una nuova scheda: nome, fascia d'età, descrizione.",
      },
      {
        key: "configure_weeks",
        title: "Configura le settimane",
        description: "Imposta le settimane disponibili, la capacità e il prezzo a settimana.",
      },
      {
        key: "configure_pricing",
        title: "Rivedi prezzi e servizi",
        description: "Controlla prezzo, navetta, pasto e servizi extra (ingresso anticipato/uscita posticipata).",
      },
      {
        key: "configure_spot_days",
        title: "Configura i Giorni spot",
        description: "Apri il Calendario disponibilità e scegli quali giorni sono prenotabili singolarmente, con eventuale sconto o minimo giorni.",
      },
      {
        key: "publish",
        title: "Pubblica",
        description: "Salva la scheda: da questo momento è visibile ai genitori in ricerca.",
      },
      {
        key: "dashboard",
        title: "Monitora dalla dashboard",
        description: "Segui prenotazioni, presenze e richieste ricevute dal pannello Gestore.",
      },
    ],
  },
};

export function isKnownTutorial(tutorialKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(WALKTHROUGH_REGISTRY, tutorialKey);
}

export function getTutorialDefinition(tutorialKey: string): WalkthroughDefinition | undefined {
  return WALKTHROUGH_REGISTRY[tutorialKey];
}
