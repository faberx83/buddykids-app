// TRAMA — "INDIETRO" COME SI ASPETTA UNA FAMIGLIA (15/10/2026). Fabrizio:
// "Sui gruppi se vado indietro va sul planner e non in profilo", "Famiglia:
// se torno indietro va in Famiglia e logistica", "il pulsante indietro non
// deve ripartire da inizio pagina ma posizionarsi dove era prima — vale per
// tutta l'app".
//
// Due regole, per tutta l'area famiglie:
//   1. la freccia "indietro" torna DA DOVE SI È VENUTI (cronologia), non a
//      una pagina fissa scritta nel codice; la pagina fissa resta solo come
//      ripiego quando non c'è nulla dietro dentro l'app (link aperto da una
//      notifica, da WhatsApp, pagina ricaricata);
//   2. tornando indietro la pagina riprende dal punto in cui la si era
//      lasciata (posizione dello scorrimento salvata per indirizzo).
// Modulo senza React e senza Next: lo stato vive in memoria per la durata
// della scheda (si azzera con un ricaricamento, che è il comportamento
// giusto: dopo un ricaricamento non sappiamo cosa c'è "dietro").

let depth = 0;
let poppedHref: string | null = null;

/** Profondità dopo un cambio di pagina: +1 andando avanti, −1 tornando indietro (mai sotto zero). */
export function nextDepth(current: number, wasBack: boolean): number {
  return wasBack ? Math.max(0, current - 1) : current + 1;
}

/** Chiamata dal listener "popstate" (indietro/avanti del telefono o del browser). */
export function notePopState(href: string): void {
  poppedHref = href;
}

// Ascolto unico, attivo anche quando l'area famiglie non è montata (es. dalla
// scheda attività /activity/[id] si torna a Scopri: l'area si rimonta DOPO
// il "popstate", e deve comunque sapere che è stato un "indietro").
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => notePopState(window.location.href));
}

/** Prima pagina montata: era un ritorno con "indietro"? (non cambia il conteggio) */
export function consumeBackOnMount(href: string): boolean {
  const wasBack = poppedHref !== null && poppedHref === href;
  poppedHref = null;
  return wasBack;
}

/** Chiamata a ogni cambio di pagina; dice se il cambio è stato un "indietro". */
export function noteNavigation(href: string): { wasBack: boolean } {
  const wasBack = poppedHref !== null && poppedHref === href;
  poppedHref = null;
  depth = nextDepth(depth, wasBack);
  return { wasBack };
}

export function canGoBackInApp(): boolean {
  return depth > 0;
}

/** Freccia "indietro": cronologia se c'è una pagina dell'app dietro, altrimenti la pagina di ripiego. */
export function goBackInApp(router: { back: () => void; push: (href: string) => void }, fallbackHref: string): void {
  if (canGoBackInApp()) router.back();
  else router.push(fallbackHref);
}

export const SCROLL_KEY_PREFIX = "trama:scroll:";

export function scrollKey(pathname: string, search: string): string {
  return `${SCROLL_KEY_PREFIX}${pathname}${search}`;
}

/** Solo per i test. */
export function __resetInAppHistory(): void {
  depth = 0;
  poppedHref = null;
}
