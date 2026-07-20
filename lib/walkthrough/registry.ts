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
};

export function isKnownTutorial(tutorialKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(WALKTHROUGH_REGISTRY, tutorialKey);
}

export function getTutorialDefinition(tutorialKey: string): WalkthroughDefinition | undefined {
  return WALKTHROUGH_REGISTRY[tutorialKey];
}
