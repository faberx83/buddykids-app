// TRAMA — UN POSTO PER OGNI BAMBINO (QA in produzione 04/11/2026, EXTRA-02).
// Prima: lib/capacity/service.ts toglieva sempre 1 posto per riga
// booking_days / booking_weeks, anche con due bambini nella stessa
// prenotazione (verificato su UX DEMO 3 novembre: 2 bambini, posti 2 → 1).
// Ora ogni riga toglie un posto per bambino e ricorda quanti ne ha tolti
// (capacity_units, migration 60), così annullamenti e modifiche restituiscono
// esattamente quelli. Le righe accettate prima ne hanno tolto 1: restituiscono 1.
// Funzioni pure, senza I/O (test: tests/one/qa-prod-0411.spec.ts).

/** Posti da togliere per una prenotazione: uno per bambino, almeno 1. */
export function unitsForKids(kidsCount: number | null | undefined): number {
  const n = Math.floor(Number(kidsCount ?? 0));
  return Number.isFinite(n) && n > 1 ? n : 1;
}

/** Riserva di `units` posti: riesce solo se ci sono tutti (mai metà famiglia). */
export function planReserve(spotsLeft: number, capacity: number | null | undefined, units: number): { ok: boolean; next: number } {
  const u = Math.max(1, Math.floor(units));
  if (spotsLeft < u) return { ok: false, next: spotsLeft };
  const cap = capacity ?? spotsLeft;
  return { ok: true, next: Math.min(Math.max(spotsLeft - u, 0), Math.max(cap, 0)) };
}

/** Restituzione di `units` posti, mai oltre i posti totali. */
export function planRelease(spotsLeft: number, capacity: number | null | undefined, units: number): number {
  const u = Math.max(0, Math.floor(units));
  const cap = capacity ?? spotsLeft + u;
  return Math.min(Math.max(spotsLeft + u, 0), Math.max(cap, 0));
}

/** Quanti posti restituire per una riga: quelli che ha tolto (1 per le righe vecchie). */
export function unitsToRelease(row: { capacity_decremented: boolean; capacity_units?: number | null }): number {
  if (!row.capacity_decremented) return 0;
  const u = Math.floor(Number(row.capacity_units ?? 0));
  return u > 0 ? u : 1;
}

/** Posti confermati per data: somma dei posti presi da ogni riga (pura, testata). */
export function confirmedByDate(
  rows: { activity_day_id: string; capacity_decremented: boolean; capacity_units?: number | null }[],
  dateById: Map<string, string>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const date = dateById.get(r.activity_day_id);
    const units = unitsToRelease(r);
    if (date && units > 0) out[date] = (out[date] ?? 0) + units;
  }
  return out;
}
