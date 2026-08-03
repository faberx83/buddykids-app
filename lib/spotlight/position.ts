// TRAMA ONE — Controlled Beta Experience Gate (§7-14), Spotlight reale.
//
// Logica pura, nessun I/O: testabile senza browser (vedi
// tests/one/spotlight-position.spec.ts). L'unico modulo con I/O/DOM è
// components/spotlight/SpotlightOverlay.tsx, che chiama queste funzioni
// passando le misure lette da getBoundingClientRect()/window — mai il
// contrario, per poter verificare il posizionamento con semplici oggetti,
// senza montare un componente React o un browser reale.

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export type PopoverPlacement = "top" | "bottom";

export interface PopoverPosition {
  placement: PopoverPlacement;
  top: number;
  left: number;
}

const GAP = 12;
const POPOVER_WIDTH = 320;

/**
 * Calcola dove posizionare il popover ancorato al target reale: sotto per
 * default (pattern più naturale per un elemento "in alto" nella pagina),
 * sopra solo se lo spazio sotto è insufficiente E lo spazio sopra è
 * maggiore — mai un posizionamento fisso indipendente dal target, a
 * differenza di un modal generico al centro schermo.
 */
export function computePopoverPosition(
  target: Rect,
  viewport: Viewport,
  popoverHeight = 180
): PopoverPosition {
  const spaceBelow = viewport.height - (target.top + target.height);
  const spaceAbove = target.top;
  const placement: PopoverPlacement =
    spaceBelow >= popoverHeight + GAP || spaceBelow >= spaceAbove ? "bottom" : "top";

  const idealTop =
    placement === "bottom"
      ? target.top + target.height + GAP
      : Math.max(GAP, target.top - popoverHeight - GAP);

  // Clamp verticale di sicurezza: il calcolo sopra sceglie sopra/sotto in
  // base allo spazio del TARGET rispetto alla viewport, ma non garantisce da
  // solo che il risultato resti dentro i bordi — un target parzialmente o
  // interamente fuori viewport (non ancora scrollato in vista, es. una card
  // in fondo a una pagina lunga) produce altrimenti un `top` che eccede
  // `viewport.height`, rendendo il popover "fixed" invisibile a qualunque
  // scroll (bug reale osservato da Fabrizio durante il Visual Acceptance
  // Gate, §15 righe 14/15 — vedi DEC-68). Il chiamante deve comunque portare
  // il target in vista (scrollIntoView) PRIMA di chiamare questa funzione:
  // questo clamp è una rete di sicurezza aggiuntiva, non un sostituto.
  const top = Math.min(Math.max(GAP, idealTop), Math.max(GAP, viewport.height - popoverHeight - GAP));

  const idealLeft = target.left + target.width / 2 - POPOVER_WIDTH / 2;
  const left = Math.min(Math.max(GAP, idealLeft), Math.max(GAP, viewport.width - POPOVER_WIDTH - GAP));

  return { placement, top, left };
}

/**
 * Rettangolo del "ritaglio" (cutout) nell'overlay scuro attorno al target
 * reale, con un margine di respiro — non un semplice bordo attaccato al
 * bordo dell'elemento.
 */
export function computeCutoutRect(target: Rect, padding = 8): Rect {
  return {
    top: target.top - padding,
    left: target.left - padding,
    width: target.width + padding * 2,
    height: target.height + padding * 2,
  };
}

/**
 * Route matching per gli step Spotlight — un singolo carattere jolly `*`
 * opzionale, per coprire sia path esatti ("/center", la dashboard) sia
 * prefissi ("/center/activities/*", qualunque scheda attività) sia
 * prefisso+suffisso ("/center/activities/*\/calendar", il calendario Giorni
 * spot di qualunque attività) — senza introdurre una dipendenza da regex
 * generiche (più difficile da rendere sicura per input non fidato, qui non
 * serve: i pattern sono scritti a mano nel registry, mai da input utente).
 */
export function matchesSpotlightRoute(pattern: string, pathname: string): boolean {
  if (!pattern.includes("*")) return pathname === pattern;
  const [prefix, suffix] = pattern.split("*");
  return pathname.startsWith(prefix) && pathname.endsWith(suffix);
}
