// TRAMA — Wave 3 "Actionable In-App Notifications", estensione (31/08/2026,
// richiesta di Fabrizio: pallino di notifica anche su bottom nav "Profilo"/
// "Prenotazioni", non solo sulla campanella). Cursore "ultimo accesso al
// notification center" letto/scritto in localStorage — ESTRATTO da
// NotificationCenter.tsx (dove viveva inline, unico consumer fino ad ora)
// perché ora SERVE ANCHE a NextgenBottomNav.tsx per calcolare isSeen con la
// stessa identica logica (REUSE, non una seconda implementazione che
// rischierebbe di disallinearsi). Nessuna nuova chiave/formato: stesso
// esatto comportamento di prima, solo condiviso.
//
// Client-only (usa window.localStorage) — chiamare SOLO da Client Component,
// stesso vincolo già rispettato dal chiamante originale.

export const LAST_SEEN_STORAGE_KEY = "trama-notifications-last-seen-at";

export function readLastSeenAt(): string | null {
  try {
    return window.localStorage.getItem(LAST_SEEN_STORAGE_KEY);
  } catch {
    return null; // localStorage non disponibile (es. modalità privata) — nessun cursore, tutto "non visto"
  }
}

export function writeLastSeenAt(iso: string) {
  try {
    window.localStorage.setItem(LAST_SEEN_STORAGE_KEY, iso);
  } catch {
    // best-effort, coerente col resto del progetto (es. BetaFeedbackButton)
  }
}
