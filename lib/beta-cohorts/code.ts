// TRAMA — LINK BETA PIÙ SICURO (20/11/2026).
// Fabrizio: "verifica che, una volta fatta la lista dei genitori, e generati i
// link personali, possano accedere tutti nella cohort del pilot" → "ok
// sistemiamo il punto 2 come da tua proposta". Due buchi: il codice si perde
// se si passa dall'icona prima di registrarsi, e chi ha già un account non
// entra nella beta aprendo il link. Qui la parte pura.

/** Dove il browser ricorda il codice dell'ultimo link beta aperto (stessa origine, anche nell'app installata su Android). */
export const BETA_CODE_STORAGE_KEY = "trama_beta_code";

/** Come in Admin (app/actions/beta-invites.ts#normalizeCode): maiuscolo, senza spazi. Vuoto o troppo lungo → null. */
export function normalizeBetaCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  if (!code || code.length > 64 || !/^[A-Z0-9_-]+$/.test(code)) return null;
  return code;
}

export interface BetaCodeRow {
  active: boolean;
  expires_at: string | null;
  max_redemptions: number | null;
  redeemed_count: number;
}

/** Stesse condizioni del trigger handle_new_user e di get_beta_invite_preview. */
export function isBetaCodeUsable(row: BetaCodeRow | null, now: number = Date.now()): boolean {
  if (!row || !row.active) return false;
  if (row.expires_at && Date.parse(row.expires_at) < now) return false;
  if (row.max_redemptions !== null && row.redeemed_count >= row.max_redemptions) return false;
  return true;
}

export type BetaJoinOutcome = "joined" | "already" | "invalid" | "not_parent" | "error";

export function betaJoinMessage(outcome: BetaJoinOutcome): { title: string; text: string } {
  switch (outcome) {
    case "joined":
      return { title: "Sei nella beta di TRAMA", text: "Da ora vedi tutte le funzioni della beta. Apri l'app per cominciare." };
    case "already":
      return { title: "Sei già nella beta", text: "Il tuo account ha già accesso a tutte le funzioni della beta." };
    case "invalid":
      return { title: "Link non più valido", text: "Questo link d'invito è scaduto o disattivato. Chiedi un link nuovo a chi ti ha invitato." };
    case "not_parent":
      return { title: "Link per le famiglie", text: "Questo invito è per gli account delle famiglie: il tuo account è di un centro." };
    default:
      return { title: "Non ci siamo riusciti", text: "Qualcosa non ha funzionato. Riprova tra poco o scrivici da \"Problemi ad accedere?\"." };
  }
}
