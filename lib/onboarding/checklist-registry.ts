// TRAMA ONE Build Sprint 1 — Checklist onboarding Centro.
// Stesso pattern di lib/feature-flags/registry.ts: le DEFINIZIONI vivono nel
// codice (sorgente di verità versionata), lo STATO di completamento per
// centro vive in Supabase (center_onboarding_checklist_completions).

export interface ChecklistItemDefinition {
  key: string;
  label: string;
  description: string;
  required: boolean;
}

export const ONBOARDING_CHECKLIST_REGISTRY: ChecklistItemDefinition[] = [
  {
    key: "profile_complete",
    label: "Profilo centro completo",
    description: "Nome, città, indirizzo, contatti e descrizione compilati in \"Profilo centro\".",
    required: true,
  },
  {
    key: "identity_verified",
    label: "Identità verificata",
    description: "Nota di verifica identità del referente inviata e confermata dall'Admin.",
    required: true,
  },
  {
    key: "first_activity_draft",
    label: "Prima attività in bozza",
    description: "Almeno un'attività creata (anche non pubblicata) in \"Le mie attività\".",
    required: false,
  },
  {
    key: "cancellation_policy_set",
    label: "Policy di cancellazione confermata",
    description: "Numero di giorni per la cancellazione senza penale confermato o personalizzato nel profilo.",
    required: false,
  },
];

export function isKnownChecklistItem(key: string): boolean {
  return ONBOARDING_CHECKLIST_REGISTRY.some((item) => item.key === key);
}

/** Vero se tutti gli item "required" del registry risultano completati. */
export function isRequiredChecklistComplete(
  completions: { itemKey: string; completed: boolean }[]
): boolean {
  const completedKeys = new Set(completions.filter((c) => c.completed).map((c) => c.itemKey));
  return ONBOARDING_CHECKLIST_REGISTRY.filter((item) => item.required).every((item) =>
    completedKeys.has(item.key)
  );
}
