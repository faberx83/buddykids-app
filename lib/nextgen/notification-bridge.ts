// TRAMA — HOME V2 (Fase 1, 13/10/2026). Ponte minimo tra la campanella
// nell'intestazione della Home V2 e il centro notifiche ESISTENTE
// (components/nextgen/NotificationCenter.tsx, montato una sola volta nel
// layout NEXTGEN). Nessun secondo centro notifiche, nessun dato duplicato:
//   - la Home V2 annuncia che la sua campanella è presente (e quando sparisce);
//   - il centro notifiche, finché quella campanella c'è, non mostra il suo
//     pulsante flottante (niente due campanelle) e comunica il conteggio
//     dei non letti;
//   - un tap sulla campanella in alto apre lo stesso dialog di sempre.
// Fuori dalla Home V2 nessuno emette questi eventi: comportamento invariato.

export const OPEN_NOTIFICATIONS_EVENT = "trama:open-notifications";
export const HEADER_BELL_EVENT = "trama:header-bell";
export const UNSEEN_COUNT_EVENT = "trama:notifications-unseen";

export interface HeaderBellDetail {
  present: boolean;
}

export interface UnseenCountDetail {
  count: number;
  /** Secondo test UX (22/10): testo per lettori di schermo ("Notifiche, 1 invito da gestire"). */
  label?: string;
}

function dispatch<T>(name: string, detail?: T): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<T>(name, { detail }));
}

export function requestOpenNotifications(): void {
  dispatch(OPEN_NOTIFICATIONS_EVENT);
}

// Stato condiviso nel bundle client: gli effetti della pagina possono girare
// PRIMA che il centro notifiche (montato dopo, nel layout) si metta in
// ascolto, quindi l'evento da solo potrebbe andare perso.
let headerBellPresentNow = false;

export function isHeaderBellPresent(): boolean {
  return headerBellPresentNow;
}

export function announceHeaderBell(present: boolean): void {
  headerBellPresentNow = present;
  dispatch<HeaderBellDetail>(HEADER_BELL_EVENT, { present });
}

export function announceUnseenCount(count: number, label?: string): void {
  dispatch<UnseenCountDetail>(UNSEEN_COUNT_EVENT, label ? { count, label } : { count });
}
