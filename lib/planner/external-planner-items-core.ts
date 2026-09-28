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

// TRAMA — DATELESS DISCOVERY · CASE A/B/C (28/09/2026, live UX fix, sezione
// 5 del task "DISCOVERY → ADD TO PLANNER WITHOUT DATES").
//
// ROOT CAUSE ANALYSIS del problema live segnalato da Fabrizio ("'Aggiungi al
// Planner' sembra apparire solo sulle Scoperte con date") — verificata
// leggendo per intero DiscoveryLeadCard.tsx e SearchDiscoveryClient.tsx
// PRIMA di scrivere questo fix: la CTA "Aggiungi al Planner" NON è mai stata
// gated da lead.startDate/endDate in nessuno dei due file — è condizionata
// SOLO da `plannerEnabled && kids.length > 0` (stesso gate sia per lead
// invitable che source-only, sia con che senza date). La percezione "solo
// con date" non è quindi un bug di visibilità della CTA. Il problema REALE
// trovato: questa funzione (chiamata da addCuratedLeadToPlannerAction)
// faceva SEMPRE un fallback silenzioso a "oggi" quando il lead non aveva
// date — mai un prompt "Quando si svolge?", mai un campo lasciato vuoto da
// completare (comportamento diverso da quello richiesto ora dalla sezione 5:
// CASE B "le date sono vuote e vanno richieste all'utente"). Un genitore che
// aggiungeva una Scoperta source-only otteneva quindi silenziosamente un
// impegno datato "oggi", con una nota nelle Note a spiegarlo — funzionale ma
// non conforme al target CASE A/B/C.
//
// FIX: `dateOverride` opzionale, sempre fornito ora dal form lato client
// (DiscoveryLeadCard.tsx — sezione 5/6 del task) con le date scelte
// dall'utente nel dialog "Aggiungi al Planner": precompilate con
// lead.startDate/endDate quando note (CASE A, l'utente può modificarle),
// vuote quando il lead non le ha (CASE B, l'utente deve compilarle — il
// bottone "Aggiungi" del dialog resta disabilitato finché non lo fa, vedi
// DiscoveryLeadCard.tsx). Quando fornito, dateOverride ha SEMPRE la
// precedenza sulle date del lead: sia perché l'utente potrebbe averle
// corrette (CASE A "può... modificare"), sia perché per un lead senza date
// è l'unica fonte possibile (CASE B). Il vecchio fallback "oggi" resta INVARIATO
// come rete di sicurezza per qualunque altro chiamante che non passi ancora
// un override (retrocompatibilità piena con EPI-11, che verifica esattamente
// questo comportamità di fallback con la chiamata a due argomenti).
export interface CuratedLeadDateOverride {
  startDate: string;
  endDate: string;
}

// SNAPSHOT PRINCIPLE (sezione 8 del task) — costruisce l'input "Aggiungi al
// Planner" a partire da un DiscoveryLeadRecord code-based, SENZA mai
// mantenere un riferimento runtime al dataset: da questo punto in poi
// l'item è dato della famiglia, non più legato all'esistenza/aggiornamento
// del lead.
export function buildExternalPlannerItemInputFromCuratedLead(
  lead: DiscoveryLeadRecord,
  kidIds: string[],
  dateOverride?: CuratedLeadDateOverride
): ExternalPlannerItemInput {
  const hasDateRange = Boolean(lead.startDate && lead.endDate);
  const today = new Date().toISOString().slice(0, 10);
  // CASE C "PARTIAL/AMBIGUOUS": in questo dataset startDate/endDate sono
  // sempre entrambe note o entrambe assenti (mai una sola) — se in futuro
  // comparisse un lead parziale, dateOverride resta comunque l'unica fonte
  // per il campo mancante (mai un'invenzione più specifica di quanto
  // fornito dall'utente).
  const resolvedStartDate = dateOverride?.startDate || lead.startDate || today;
  const resolvedEndDate = dateOverride?.endDate || lead.endDate || lead.startDate || today;
  return {
    kind: "activity",
    title: lead.activityTitle,
    startDate: resolvedStartDate,
    endDate: resolvedEndDate,
    allDay: true,
    startTime: null,
    endTime: null,
    location: lead.locationName ? `${lead.locationName}, ${lead.comune}` : lead.comune,
    // La nota "date non indicate dalla fonte" ha senso solo quando NESSUNA
    // data certa esiste (né dal lead né da un override utente) — se
    // l'utente ha compilato il form (CASE B) le date sono ormai certe (sono
    // sue), non serve più avvisarlo che mancavano alla fonte.
    notes:
      hasDateRange || dateOverride
        ? null
        : "Date non indicate dalla fonte al momento dell'aggiunta — verifica sul sito dell'organizzatore.",
    externalUrl: lead.registrationUrl || lead.officialUrl || null,
    kidIds,
  };
}
