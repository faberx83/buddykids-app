// TRAMA — ADMIN OPERATIVO, retest del 12/11/2026 (Fabrizio): "Correggi anche
// '5 codae' e i plurali '1 occupati / 1 liberi'". Un numero con il nome
// giusto, singolare o plurale. Pura.

/** "1 posto", "2 posti", "0 posti". */
export function countOf(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Riga di sintesi di Oggi: "5 elementi in sospeso su tutte le code, 2 code in priorità alta". */
export function oggiSummary(totalOpen: number, criticalQueues: number): string {
  const base = `${countOf(totalOpen, "elemento", "elementi")} in sospeso su tutte le code`;
  return criticalQueues > 0 ? `${base}, ${countOf(criticalQueues, "coda", "code")} in priorità alta` : base;
}

/** Sintesi di una giornata: "2 posti totali · 1 occupato · 1 libero per le famiglie". */
export function daySummary(capacity: number, occupied: number, free: number): string {
  return `${countOf(capacity, "posto totale", "posti totali")} · ${countOf(occupied, "occupato", "occupati")} · ${countOf(free, "libero", "liberi")} per le famiglie`;
}
