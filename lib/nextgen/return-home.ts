// TRAMA — RITORNO ALLA HOME DOPO UNA PAUSA (20/10/2026, Fabrizio: "ogni volta
// che apro l'app rimane nell'ultima pagina che ho visitato… forse ha senso
// dopo un tot ritornare sempre sulla Home").
//
// Regola (solo app installata, non il sito nel browser):
//   - se l'app torna in primo piano, o si riapre, dopo più di 30 minuti
//   - ed è ancora sulla STESSA pagina lasciata (nessun link, nessuna notifica
//     l'ha portata altrove nel frattempo)
//   - e quella pagina non è già la Home
// → si va sulla Home. Un link o una notifica aperti dopo la pausa si
// rispettano sempre. Funzione pura: testata in tests/one/feedback-20261020-b.spec.ts.

export const RETURN_HOME_AFTER_MS = 30 * 60 * 1000;
export const RETURN_HOME_STORAGE_KEY = "trama_last_seen";
export const HOME_PATH = "/nextgen";
/** Parametro aggiunto dal service worker ai link delle notifiche (public/sw.js). */
export const FROM_NOTIFICATION_PARAM = "da";
export const FROM_NOTIFICATION_VALUE = "notifica";

export interface LastSeen {
  at: number;
  path: string;
}

export function parseLastSeen(raw: string | null): LastSeen | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<LastSeen>;
    return typeof v.at === "number" && typeof v.path === "string" ? { at: v.at, path: v.path } : null;
  } catch {
    return null;
  }
}

export function shouldReturnHome(input: {
  now: number;
  last: LastSeen | null;
  currentPath: string;
  fromNotification: boolean;
}): boolean {
  const { now, last, currentPath, fromNotification } = input;
  if (fromNotification || !last) return false;
  if (now - last.at < RETURN_HOME_AFTER_MS) return false;
  const pathname = currentPath.split("?")[0].replace(/\/+$/, "") || "/";
  if (pathname === HOME_PATH || !pathname.startsWith(`${HOME_PATH}/`)) return false;
  return currentPath === last.path;
}
