// TRAMA ONE Build Sprint 6 — Command Center Admin (E08, ACR-001/008/015).
//
// Logica PURA (nessuna I/O) di classificazione priorità di una coda
// operativa, isolata in un proprio file per essere testabile senza browser
// né database (stesso principio già applicato a
// lib/feature-flags/evaluate.ts::computeOverrideStatus,
// lib/day-pricing.ts, ecc. — funzioni pure separate dai moduli server-only
// che le usano).
//
// Principio guida (Handbook Admin 1.1, §1.2 "Queue-first operations": "ogni
// dashboard deve rendere espliciti owner, SLA, next action e motivo della
// priorità"): una coda è "alta" priorità se ha ELEMENTI DA TROPPO TEMPO in
// sospeso (soglia esplicita, non solo "conteggio > 0"), "media" se ha
// elementi in sospeso ma recenti, "bassa" se è vuota.

export type QueuePriority = "alta" | "media" | "bassa";

// Soglia oltre la quale un elemento in coda è considerato "vecchio" a
// prescindere dal dominio — stesso ordine di grandezza già scelto altrove in
// questo sprint per gli allarmi (SILENT_FALLBACK_GRACE_MS/EXPIRING_SOON_WINDOW_MS
// in lib/feature-flags, 72h): qui espresso in giorni per coerenza con i
// campi *Days già esistenti in lib/data/admin-bookings.ts/admin-inquiries.ts.
export const QUEUE_STALE_THRESHOLD_DAYS = 3;

/**
 * Classifica la priorità di una coda in base al numero di elementi in
 * sospeso e all'età (in giorni) dell'elemento più vecchio ancora in
 * sospeso. `oldestPendingDays` null significa "nessun elemento in sospeso
 * abbastanza vecchio da avere un'età nota" (tipicamente perché la coda è
 * vuota, ma alcuni data layer possono restituire null anche con count=0 per
 * costruzione — la funzione non assume nulla sulla relazione tra i due
 * argomenti, tratta ogni combinazione esplicitamente).
 */
export function computeQueuePriority(count: number, oldestPendingDays: number | null): QueuePriority {
  if (count <= 0) return "bassa";
  if (oldestPendingDays !== null && oldestPendingDays >= QUEUE_STALE_THRESHOLD_DAYS) return "alta";
  return "media";
}

// Ordine di rendering: priorità decrescente, poi conteggio decrescente a
// parità di priorità (una coda con più elementi in sospeso viene prima di
// una con meno, anche se entrambe "media") — stessa logica di ordinamento
// già usata in lib/data/admin-bookings.ts (sort per pendingCount/totalCount).
const PRIORITY_RANK: Record<QueuePriority, number> = { alta: 0, media: 1, bassa: 2 };

export interface RankableQueue {
  priority: QueuePriority;
  count: number;
}

export function compareQueuesByPriority<T extends RankableQueue>(a: T, b: T): number {
  const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (rankDiff !== 0) return rankDiff;
  return b.count - a.count;
}
