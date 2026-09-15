// TRAMA — GLOBAL ACTION PROGRESS · LIVE FIX (15/09/2026, segnalazione di
// Fabrizio dopo verifica live: "la progress bar non è visibile/percepibile").
//
// ROOT CAUSE (vedi commento in components/GlobalActionProgress.tsx per la
// traccia completa CLICK→start→pathname→complete): la versione precedente
// usava usePathname() come UNICO segnale — sia di inizio SIA di fine — di
// una navigazione. Ma usePathname() cambia SOLO dopo che React ha già
// renderizzato la nuova rotta: a quel punto la navigazione è di fatto già
// conclusa dal punto di vista dell'utente. start() e complete() finivano
// quindi per essere chiamati sullo stesso tick (complete() via
// requestAnimationFrame subito dopo start()), ben prima della soglia
// anti-flash — la barra non diventava MAI visibile per la navigazione,
// per costruzione, non per un timeout mal tarato.
//
// Fix: la navigazione deve partire dal GESTO dell'utente (il click), non
// dall'arrivo sulla nuova rotta — usePathname()/useSearchParams() restano,
// ma solo come segnale di COMPLETAMENTO. Questo file contiene la logica
// PURA (nessun DOM, nessun Event reale) che decide se un click su un
// elemento <a href> rappresenta una navigazione interna reale da segnalare
// — separata dal componente React per essere testabile senza un browser,
// stesso principio "core puro + wrapper I/O" già seguito da
// lib/school-calendar/need-core.ts e lib/planner/calendar-items-core.ts.

export interface LinkClickInfo {
  // getAttribute("href") dell'elemento <a> più vicino (closest) al target
  // del click — null se non è stato trovato alcun <a href> (mai un click
  // reale in quel caso, il chiamante non invoca nemmeno questa funzione,
  // ma il tipo resta difensivo).
  href: string | null;
  // getAttribute("target") — "_blank"/"_parent"/"_top" o un frame name
  // esplicito devono sempre essere esclusi (nuova scheda/finestra/contesto
  // diverso, non una navigazione "in-app" da segnalare).
  target: string | null;
  hasDownloadAttr: boolean;
  // MouseEvent.button: 0 = tasto sinistro. Un middle-click (1) apre quasi
  // sempre una nuova scheda nei browser desktop.
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  // true se un handler PRECEDENTE (in bubble, o un altro capture-listener
  // con priorità più alta) ha già chiamato preventDefault() — segnale che
  // il click è già gestito da altra logica applicativa (es. un modal/
  // conferma) e non deve essere trattato come navigazione.
  defaultPrevented: boolean;
}

const NON_NAVIGATION_HREF_PREFIXES = [/^#/, /^mailto:/i, /^tel:/i, /^javascript:/i, /^sms:/i];

/**
 * true SOLO se questo click rappresenta una navigazione interna reale che
 * la Global Action Progress Bar deve segnalare. Fail-safe per costruzione:
 * qualunque condizione ambigua o non riconosciuta ritorna false (mai una
 * barra mostrata per un click che poi non naviga davvero da nessuna parte
 * — coerente con "PURE LOCAL UI → no progress").
 *
 * currentOrigin/currentHref sono passati dal chiamante (window.location.*)
 * — questa funzione non tocca mai `window` direttamente, restando pura e
 * testabile con stringhe qualsiasi.
 */
export function isInternalNavigableClick(info: LinkClickInfo, currentOrigin: string, currentHref: string): boolean {
  if (info.defaultPrevented) return false;
  if (info.button !== 0) return false;
  if (info.metaKey || info.ctrlKey || info.shiftKey || info.altKey) return false;
  if (!info.href) return false;
  if (info.hasDownloadAttr) return false;
  if (info.target && info.target.trim() !== "" && info.target.trim().toLowerCase() !== "_self") return false;

  const href = info.href.trim();
  if (href === "") return false;
  if (NON_NAVIGATION_HREF_PREFIXES.some((re) => re.test(href))) return false;

  let resolved: URL;
  let current: URL;
  try {
    resolved = new URL(href, currentHref);
    current = new URL(currentHref);
  } catch {
    // href non risolvibile (raro, ma mai un errore che sale fino al click
    // handler reale) — fail-safe: nessuna barra.
    return false;
  }

  if (resolved.origin !== currentOrigin) return false; // link esterno
  if (resolved.href === current.href) return false; // stessa URL esatta già corrente (pathname+search+hash)

  return true;
}
