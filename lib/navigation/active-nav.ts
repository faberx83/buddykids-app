// TRAMA — ADMIN OPERATIVO (12/11/2026). Richiesta di Fabrizio: "Evidenzia
// una sola voce corrente". Iniziativa: claude/INIZIATIVA_admin_operativo.md.
//
// Prima (components/dashboard/DashboardLayout.tsx#isNavItemActive) ogni voce
// si accendeva da sola se il percorso cominciava con il suo href: con voci
// annidate (/admin/one e /admin/one/pilot, /admin/beta e /admin/beta/report)
// se ne accendevano due. Ora vince UNA voce: quella con il prefisso più lungo
// che corrisponde, contando anche gli alias (matchPrefixes: pagine fuori menu
// che appartengono a una voce, es. /admin/demo sotto "Analisi e crescita").
// La voce radice (la prima, es. /admin o /center) vale solo per il percorso
// esatto o per i suoi alias. Pura, senza I/O.

export interface ActiveNavCandidate {
  href: string;
  matchPrefixes?: string[];
}

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** href della sola voce da evidenziare, o null se nessuna corrisponde. */
export function pickActiveHref(pathname: string, items: ActiveNavCandidate[], rootHref: string | null): string | null {
  let best: { href: string; len: number } | null = null;
  for (const item of items) {
    const prefixes = [item.href, ...(item.matchPrefixes ?? [])];
    for (const p of prefixes) {
      const ok = p === rootHref && p === item.href ? pathname === p : matches(pathname, p);
      if (ok && (!best || p.length > best.len)) best = { href: item.href, len: p.length };
    }
  }
  return best?.href ?? null;
}
