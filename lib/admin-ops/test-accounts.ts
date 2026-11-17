// TRAMA — Account di prova esclusi dai report Admin (17/11/2026).
// Richiesta di Fabrizio: "flagghiamo tutti i parent e partner presenti ad oggi
// come DEMO [...] cosicché lato ADMIN possa filtrare e non considerarli nei
// report?" Decisione (17/11): restano fuori solo luca.d.magi, mariafpoli e
// ppirulli; faberpirulli e l'admin sono di prova.
// Iniziativa: claude/INIZIATIVA_account_prova.md (Project).
//
// REUSE: l'etichetta è la lista già esistente beta_cockpit_settings.
// excluded_user_ids (migration 46, "esclusi dal cockpit"), modificabile da
// Beta Famiglie. Nessuna colonna nuova: una lista sola, che ora vale per
// tutti i report Admin che contano persone. Puro, nessun I/O.

export const TEST_ACCOUNT_LABEL = "Account di prova";

export type TestAccountIds = ReadonlySet<string>;

export const NO_TEST_ACCOUNTS: TestAccountIds = new Set<string>();

export function isTestAccount(userId: string | null | undefined, ids: TestAccountIds): boolean {
  return Boolean(userId && ids.has(userId));
}

/** Toglie gli account di prova da un elenco, salvo che si chieda di vederli (?demo=1). */
export function withoutTestAccounts<T>(items: T[], userIdOf: (t: T) => string | null | undefined, ids: TestAccountIds, showTest = false): T[] {
  if (showTest || ids.size === 0) return items;
  return items.filter((i) => !isTestAccount(userIdOf(i), ids));
}
