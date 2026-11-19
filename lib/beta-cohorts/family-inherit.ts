// TRAMA — L'ALTRO GENITORE ENTRA NELLA STESSA BETA (19/11/2026).
// Fabrizio: "ok allora correggi per l'altro genitore". Prima della correzione
// chi entrava in una famiglia con l'invito ("+ → L'altro genitore", link
// /nextgen/i/… o codice famiglia) si registrava senza codice beta: nessuna
// coorte, quindi niente Home nuova, Chi accompagna, Scopri e Gruppi nuovi,
// Nodi (accesi solo per coorte). Qui la parte pura: quali coorti ereditare
// dagli altri adulti della famiglia. Le scritture sono in membership.ts.

/** Coorti che passano all'altro genitore. Solo quelle delle famiglie in prova. */
export const FAMILY_INHERITABLE_COHORTS = ["trama-one-controlled-beta", "internal-preview"] as const;

export interface CohortRow {
  user_id: string;
  cohort_key: string;
  active: boolean;
  expires_at: string | null;
}

export interface InheritedCohort {
  cohort_key: string;
  expires_at: string | null;
  /** Adulto della famiglia da cui arriva (per created_by). */
  from_user_id: string;
}

/**
 * Coorti da dare a `userId` entrando nella famiglia, a partire dalle righe
 * degli altri adulti. Solo righe attive, non scadute, in elenco; nessuna che
 * l'utente abbia già (attiva o no: una disattivata da Admin resta tale).
 * Per ogni coorte vale la scadenza più lontana (null = senza scadenza).
 */
export function cohortsToInherit(userId: string, rows: CohortRow[], now: number = Date.now()): InheritedCohort[] {
  const own = new Set(rows.filter((r) => r.user_id === userId).map((r) => r.cohort_key));
  const allowed = new Set<string>(FAMILY_INHERITABLE_COHORTS);
  const best = new Map<string, InheritedCohort>();
  for (const r of rows) {
    if (r.user_id === userId || !r.active || !allowed.has(r.cohort_key) || own.has(r.cohort_key)) continue;
    if (r.expires_at && Date.parse(r.expires_at) <= now) continue;
    const prev = best.get(r.cohort_key);
    if (!prev) {
      best.set(r.cohort_key, { cohort_key: r.cohort_key, expires_at: r.expires_at, from_user_id: r.user_id });
      continue;
    }
    if (prev.expires_at === null) continue;
    if (r.expires_at === null || Date.parse(r.expires_at) > Date.parse(prev.expires_at)) {
      best.set(r.cohort_key, { cohort_key: r.cohort_key, expires_at: r.expires_at, from_user_id: r.user_id });
    }
  }
  return FAMILY_INHERITABLE_COHORTS.filter((k) => best.has(k)).map((k) => best.get(k)!);
}
