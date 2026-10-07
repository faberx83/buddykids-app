// SPRINT 5 (NEXTGEN) — tipi/funzione pura di "Segnalazioni BETA" estratti da
// lib/data/beta-feedback.ts in un modulo SENZA alcun import server-only
// (niente lib/supabase/server, quindi niente next/headers): stesso motivo di
// lib/nextgen/address-kinds.ts — SegnalazioniBetaAdminClient.tsx ("use
// client") deve poter importare BetaFeedbackItem/computeBetaFeedbackCounts
// senza trascinarsi dietro l'intero modulo server (che farebbe fallire la
// build Next.js). lib/data/beta-feedback.ts importa da qui e ri-esporta,
// cosi il codice server-side resta invariato.

export type BetaFeedbackStatus = "nuovo" | "in_gestione" | "risolto";
export type BetaFeedbackSource = "genitori" | "gestore";
// SPRINT 8 — stato della pipeline di lavorazione automatica, SEPARATO da
// BetaFeedbackStatus sopra (quello resta il dialogo Admin<->genitore).
// "none" = non ancora confermata per la pipeline; "confirmed" = l'admin ha
// deciso che va lavorata (in attesa che l'automazione la prenda in carico);
// "in_progress"/"done" = aggiornati dall'automazione stessa.
export type BetaFeedbackPipelineStatus = "none" | "confirmed" | "in_progress" | "done";

// TRAMA — FAMILY-FIRST BETA PASS (07/10/2026). Tipo di feedback scelto
// (facoltativamente) dall'utente: colonna beta_feedback.category, migration 40.
export type BetaFeedbackCategory = "idea" | "problema" | "manca" | "altro";

export const BETA_FEEDBACK_CATEGORIES: { value: BetaFeedbackCategory; label: string; icon: string }[] = [
  { value: "idea", label: "Idea", icon: "ti-bulb" },
  { value: "problema", label: "Problema", icon: "ti-bug" },
  { value: "manca", label: "Cosa manca", icon: "ti-puzzle" },
  { value: "altro", label: "Altro", icon: "ti-dots" },
];

export function isBetaFeedbackCategory(value: unknown): value is BetaFeedbackCategory {
  return value === "idea" || value === "problema" || value === "manca" || value === "altro";
}

export function betaFeedbackCategoryLabel(value: BetaFeedbackCategory | null | undefined): string | null {
  return BETA_FEEDBACK_CATEGORIES.find((c) => c.value === value)?.label ?? null;
}

// Contesto raccolto AUTOMATICAMENTE (mai compilato dall'utente) e salvato in
// beta_feedback.client_context. Solo diagnostica: niente posizione, niente
// contatti, niente contenuti di altre pagine. Il server aggiunge ruolo e
// versione build (vedi app/actions/beta-feedback.ts).
export interface BetaFeedbackClientContext {
  route?: string;
  source?: "floating" | "profilo" | "novita";
  viewport?: string;
  standalone?: boolean;
  language?: string;
  userAgent?: string;
}

const CONTEXT_STRING_LIMITS: Record<string, number> = { route: 200, viewport: 20, language: 20, userAgent: 200 };

/** Tiene solo le chiavi note, con lunghezze limitate: input client mai fidato così com'è. */
export function sanitizeBetaFeedbackClientContext(input: unknown): BetaFeedbackClientContext {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const out: BetaFeedbackClientContext = {};
  for (const key of ["route", "viewport", "language", "userAgent"] as const) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, CONTEXT_STRING_LIMITS[key]);
  }
  if (raw.source === "floating" || raw.source === "profilo" || raw.source === "novita") out.source = raw.source;
  if (typeof raw.standalone === "boolean") out.standalone = raw.standalone;
  return out;
}

/** Errore PostgREST/Postgres "colonna inesistente": migration 40 non ancora applicata. */
export function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST204" || error.code === "42703" || /column .* does not exist|Could not find the '.*' column/i.test(error.message ?? "");
}

export interface BetaFeedbackItem {
  id: string;
  appSource: BetaFeedbackSource;
  area: string;
  pagePath: string;
  message: string;
  status: BetaFeedbackStatus;
  adminNote?: string;
  createdAt: string;
  parentName?: string; // solo per la vista Admin (join su profiles)
  pipelineStatus: BetaFeedbackPipelineStatus;
  /** null per i feedback storici o finché la migration 40 non è applicata. */
  category?: BetaFeedbackCategory | null;
  clientContext?: (BetaFeedbackClientContext & { role?: string; build?: string }) | null;
}

export interface BetaFeedbackCounts {
  total: number;
  byStatus: Record<BetaFeedbackStatus, number>;
  byArea: { area: string; total: number; nuovo: number; inGestione: number; risolto: number }[];
}

// Riepilogo per il report Admin (richiesta di Fabrizio: "conteggio per
// sezione/area/sottosezione, se i fix sono in gestione o risolti") —
// calcolato in memoria sulle righe già lette, nessuna query aggregata
// separata: il volume atteso durante una BETA è basso.
export function computeBetaFeedbackCounts(items: BetaFeedbackItem[]): BetaFeedbackCounts {
  const byStatus: Record<BetaFeedbackStatus, number> = { nuovo: 0, in_gestione: 0, risolto: 0 };
  const byAreaMap = new Map<string, { area: string; total: number; nuovo: number; inGestione: number; risolto: number }>();

  for (const item of items) {
    byStatus[item.status] += 1;
    const entry = byAreaMap.get(item.area) ?? { area: item.area, total: 0, nuovo: 0, inGestione: 0, risolto: 0 };
    entry.total += 1;
    if (item.status === "nuovo") entry.nuovo += 1;
    else if (item.status === "in_gestione") entry.inGestione += 1;
    else entry.risolto += 1;
    byAreaMap.set(item.area, entry);
  }

  return {
    total: items.length,
    byStatus,
    byArea: Array.from(byAreaMap.values()).sort((a, b) => b.total - a.total),
  };
}
