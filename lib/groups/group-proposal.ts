// Richiesta di gruppo: UNA definizione per famiglie e centri (test browser
// del 03/11/2026). Verificato nel modello: group_requests ha solo gruppo,
// attività, numero di bambini, sconto % e stato (migration_gruppi_avanzati).
// Niente date, niente partecipanti con nome, niente importo, niente posti:
// accettarla NON crea prenotazioni e NON riserva posti, e lo sconto di gruppo
// non entra nel calcolo della prenotazione in app (BookingClient applica solo
// più settimane, fratelli e invito). È quindi un accordo preliminare: la
// "Proposta di gruppo". Dopo il sì del centro ogni famiglia prenota i giorni
// dalla scheda dell'attività, e il centro conferma come sempre; lo sconto di
// gruppo lo riconosce il centro, che nel pilota incassa direttamente.

export type GroupProposalStatus = "pending" | "accepted" | "rejected";

export const GROUP_PROPOSAL_NAME = "Proposta di gruppo";

export const GROUP_PROPOSAL_STATUS: Record<
  GroupProposalStatus,
  { family: string; partner: string; tone: "todo" | "done" | "closed" }
> = {
  pending: { family: "In attesa del centro", partner: "Da rispondere", tone: "todo" },
  accepted: { family: "Proposta di gruppo accettata", partner: "Proposta accettata", tone: "done" },
  rejected: { family: "Proposta di gruppo non accettata", partner: "Proposta rifiutata", tone: "closed" },
};

/** Cosa significa, in una frase, per chi la invia e per chi la riceve. */
export const GROUP_PROPOSAL_MEANING =
  "È un accordo preliminare con il centro: non riserva posti e non crea prenotazioni.";

/** Il passo dopo, per le famiglie, dato lo stato. */
export function groupProposalNextStep(status: GroupProposalStatus): string {
  if (status === "accepted") {
    return "I posti non sono ancora prenotati: ogni famiglia sceglie i giorni dalla scheda dell'attività e manda la sua richiesta; il centro la conferma come sempre. Lo sconto di gruppo lo riconosce il centro quando pagate.";
  }
  if (status === "rejected") return "Potete comunque prenotare i giorni dalla scheda dell'attività, ognuno per i propri figli.";
  return "Quando il centro risponde ve lo diciamo qui. Intanto nessun posto è riservato.";
}

/** Per il centro, prima di rispondere. */
export const GROUP_PROPOSAL_PARTNER_HINT =
  "Accettando confermate lo sconto di gruppo per queste famiglie: non si riservano posti e non si crea nessuna prenotazione. Ogni famiglia poi chiede i suoi giorni e voi li confermate come sempre; lo sconto lo applicate voi all'incasso.";

/**
 * "Raggruppa per attività preferita" (ex "Genera aggregazioni") serve solo se
 * almeno due bambini hanno indicato preferenze diverse: con una sola
 * preferenza (o nessuna) ne verrebbe un unico gruppo, inutile.
 * Test browser 03/11/2026, Parent #3.
 */
export const GROUP_BY_PREFERENCE_LABEL = "Raggruppa per attività preferita";

export function groupingByPreferenceUseful(kids: { preferredTagId: string | null }[]): boolean {
  const prefs = new Set(kids.map((k) => k.preferredTagId).filter((t): t is string => Boolean(t)));
  return prefs.size >= 2;
}
