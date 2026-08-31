// TRAMA — Wave 3 "Actionable In-App Notifications", estensione (31/08/2026,
// richiesta di Fabrizio: pallino di notifica anche su bottom nav "Profilo"/
// "Prenotazioni", non solo sulla campanella). Cursore "ultimo accesso al
// notification center" letto/scritto in localStorage — ESTRATTO da
// NotificationCenter.tsx (dove viveva inline, unico consumer fino ad ora)
// perché ora SERVE ANCHE a NextgenBottomNav.tsx per calcolare isSeen con la
// stessa identica logica (REUSE, non una seconda implementazione che
// rischierebbe di disallinearsi).
//
// Estensione (stesso giorno, notification center Partner "stesso stile"):
// due SCOPE separati (parent/partner), chiavi localStorage distinte. Non
// per un vero requisito multi-account (un browser reale ha quasi sempre una
// sola sessione), ma per sicurezza durante test/demo dove lo stesso
// dispositivo può passare da un ruolo all'altro — evita che il cursore di
// un ruolo "marchi visto" per errore le notifiche dell'altro.
//
// Client-only (usa window.localStorage) — chiamare SOLO da Client Component,
// stesso vincolo già rispettato dal chiamante originale.

export type SeenCursorScope = "parent" | "partner";

function storageKey(scope: SeenCursorScope): string {
  return scope === "parent" ? "trama-notifications-last-seen-at" : "trama-notifications-partner-last-seen-at";
}

export function readLastSeenAt(scope: SeenCursorScope): string | null {
  try {
    return window.localStorage.getItem(storageKey(scope));
  } catch {
    return null; // localStorage non disponibile (es. modalità privata) — nessun cursore, tutto "non visto"
  }
}

export function writeLastSeenAt(scope: SeenCursorScope, iso: string) {
  try {
    window.localStorage.setItem(storageKey(scope), iso);
  } catch {
    // best-effort, coerente col resto del progetto (es. BetaFeedbackButton)
  }
}
