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
