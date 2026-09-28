// TRAMA — EXTERNAL PLANNER ITEMS · logica pura (nessun I/O, nessun "server-only").
//
// Estratta da lib/data/external-planner-items.ts per lo stesso motivo già
// documentato in lib/telemetry/known-events.ts/lib/school-calendar/need-core.ts:
// quel file ha "import server-only" (necessario perché fa query Supabase) ed
// è quindi non importabile in Node puro fuori dal bundler di Next.js — la
// validazione/costruzione input, che non fa alcun I/O, vive qui così
// tests/one/external-planner-items.spec.ts può importarla direttamente,
// senza errori di risoluzione modulo.

import type { DiscoveryLeadRecord } from "@/lib/discovery/real-dataset";

export type ExternalPlannerItemKind = "activity" | "commitment";
export type ExternalPlannerItemSourceType = "manual" | "curated_discovery";

export interface ExternalPlannerItemInput {
  kind: ExternalPlannerItemKind;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  externalUrl: string | null;
  kidIds: string[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Campi MVP volutamente minimi (sezione 3 del task: "Non rendere
// obbligatori campi inutili"): SOLO title/startDate/endDate/kidIds sono
// obbligatori, tutto il resto è opzionale.
export function validateExternalPlannerItemInput(input: ExternalPlannerItemInput): ValidationResult {
  if (!input.title || !input.title.trim()) return { valid: false, error: "Il titolo è obbligatorio." };
  if (input.title.length > 200) return { valid: false, error: "Il titolo è troppo lungo." };
  if (!input.startDate || !input.endDate) return { valid: false, error: "Le date sono obbligatorie." };
  if (input.endDate < input.startDate) return { valid: false, error: "La data di fine non può precedere quella di inizio." };
  if (!input.kidIds || input.kidIds.length === 0) return { valid: false, error: "Seleziona almeno un bambino." };
  if (!input.allDay) {
    if (input.startTime && input.endTime && input.endTime < input.startTime && input.startDate === input.endDate) {
      return { valid: false, error: "L'ora di fine non può precedere quella di inizio." };
    }
  }
  return { valid: true };
}

// SNAPSHOT PRINCIPLE (sezione 8 del task) — costruisce l'input "Aggiungi al
// Planner" a partire da un DiscoveryLeadRecord code-based, SENZA mai
// mantenere un riferimento runtime al dataset: da questo punto in poi
// l'item è dato della famiglia, non più legato all'esistenza/aggiornamento
// del lead.
export function buildExternalPlannerItemInputFromCuratedLead(
  lead: DiscoveryLeadRecord,
  kidIds: string[]
): ExternalPlannerItemInput {
  const hasDateRange = Boolean(lead.startDate && lead.endDate);
  const today = new Date().toISOString().slice(0, 10);
  return {
    kind: "activity",
    title: lead.activityTitle,
    // Una Scoperta TRAMA senza date note (frequente per i record
    // "source-only", sezione 7 del task: "deve funzionare sia per
    // INVITABLE sia per SOURCE-ONLY") non deve bloccare l'aggiunta al
    // Planner: fallback a "oggi", il genitore può poi correggerlo in
    // modifica (sezione 10) — mai un dato inventato più specifico di
    // "oggi", mai un blocco silenzioso dell'azione.
    startDate: lead.startDate ?? today,
    endDate: lead.endDate ?? lead.startDate ?? today,
    allDay: true,
    startTime: null,
    endTime: null,
    location: lead.locationName ? `${lead.locationName}, ${lead.comune}` : lead.comune,
    notes: hasDateRange ? null : "Date non indicate dalla fonte al momento dell'aggiunta — verifica sul sito dell'organizzatore.",
    externalUrl: lead.registrationUrl || lead.officialUrl || null,
    kidIds,
  };
}
