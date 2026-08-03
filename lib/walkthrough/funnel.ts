// TRAMA ONE Build Sprint 6 — hardening walkthrough (analytics funnel,
// drop-off). Logica PURA (nessuna I/O, nessun import "server-only"):
// stesso principio già stabilito in questo sprint per
// lib/command-center/priority.ts — testabile senza browser, importabile
// direttamente da tests/one/*.spec.ts.
//
// Perché da `tutorial_progress` (Sprint 1) e non da `product_events`
// (Sprint 6, E11, migration_20 non ancora applicata): ogni riga di
// tutorial_progress rappresenta lo stato ATTUALE (not_started/in_progress/
// completed/skipped) di un singolo step per un singolo utente — un utente
// che ha raggiunto lo step N ha per costruzione una riga con status
// completed/in_progress/skipped su quello step (le righe vengono create
// solo da startWalkthroughStepAction/ecc., mai per uno step non ancora
// raggiunto). "Raggiunto" (reached) è quindi calcolabile SUBITO, con dati
// già esistenti dal 2026-07 (Build Sprint 1), senza dipendere da una
// migrazione non ancora eseguita da Fabrizio. product_events resta
// comunque utile per una metrica complementare che tutorial_progress non
// può dare: il conteggio dei RIAVVII (walkthrough_restarted), perché
// restartWalkthroughAction CANCELLA le righe tutorial_progress dell'utente
// (vedi app/actions/walkthrough.ts) — un riavvio è quindi invisibile allo
// snapshot corrente, ma resta come evento storico in product_events (vedi
// lib/data/walkthrough-funnel.ts::getWalkthroughRestartCount).

import type { WalkthroughAdminStepSummary } from "./data";

export interface WalkthroughFunnelStep extends WalkthroughAdminStepSummary {
  /** Utenti che hanno raggiunto questo step (completed + inProgress + skipped). */
  reached: number;
  /**
   * Utenti persi tra lo step precedente e questo: null per il primo step
   * (nessun drop-off "prima di iniziare" osservabile con questi dati — non
   * sappiamo quanti utenti abbiano mai visto la pagina /one senza avviare
   * il percorso). Sempre >= 0 per costruzione: reached è monotona
   * decrescente step dopo step (un utente non può raggiungere lo step N+1
   * senza aver raggiunto lo step N).
   */
  dropOffFromPrevious: number | null;
  /** Percentuale di drop-off rispetto allo step precedente, 0-100, null per il primo step. */
  dropOffRatePercent: number | null;
}

/**
 * Calcola il funnel (raggiunti + drop-off per step) da un riepilogo Admin
 * già aggregato (lib/walkthrough/data.ts::getWalkthroughAdminSummary).
 * Pura: nessun accesso a Supabase, nessun side effect.
 */
export function computeWalkthroughFunnel(steps: WalkthroughAdminStepSummary[]): WalkthroughFunnelStep[] {
  return steps.map((step, index) => {
    const reached = step.completed + step.inProgress + step.skipped;
    if (index === 0) {
      return { ...step, reached, dropOffFromPrevious: null, dropOffRatePercent: null };
    }
    const previousReached = steps[index - 1].completed + steps[index - 1].inProgress + steps[index - 1].skipped;
    const dropOffFromPrevious = Math.max(0, previousReached - reached);
    const dropOffRatePercent = previousReached > 0 ? Math.round((dropOffFromPrevious / previousReached) * 1000) / 10 : 0;
    return { ...step, reached, dropOffFromPrevious, dropOffRatePercent };
  });
}
