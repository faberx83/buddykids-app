// UX-PARTNER-007 (report 30/10): "Nuova attività → scrivo il nome → Centro →
// indietro: nome vuoto, nessun avviso". Una bozza di quello che si sta
// scrivendo resta nella scheda del browser (sessionStorage, mai sul server):
// tornando alla pagina si riprende, con "Scarta" esplicito. Chiudendo o
// ricaricando la pagina con modifiche, il browser chiede conferma.
// Logica pura qui; l'uso in components/center/useActivityDraft.ts.

export const ACTIVITY_DRAFT_PREFIX = "trama:center:bozza-attivita:";

export function activityDraftKey(scope: string): string {
  return `${ACTIVITY_DRAFT_PREFIX}${scope}`;
}

/** Ci sono modifiche rispetto al modulo vuoto/iniziale? (confronto per valore, campi di primo livello) */
export function isDraftDirty<T extends Record<string, unknown>>(value: T, initial: T): boolean {
  return Object.keys(initial).some((k) => JSON.stringify(value[k]) !== JSON.stringify(initial[k]));
}

/** Bozza letta dalla memoria: solo i campi noti, dello stesso tipo dell'iniziale. Altrimenti null. */
export function parseDraft<T extends Record<string, unknown>>(raw: string | null, initial: T): T | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== "object") return null;
    const out = { ...initial } as Record<string, unknown>;
    for (const k of Object.keys(initial)) {
      if (k in data && typeof data[k] === typeof initial[k]) out[k] = data[k];
    }
    return isDraftDirty(out as T, initial) ? (out as T) : null;
  } catch {
    return null;
  }
}
