// TRAMA — LOTTO 2, primo incremento (16/11/2026). Richiesta di Fabrizio:
// "Riusa il Funnel di Beta Famiglie. Indica unità e periodo di ciascun
// conteggio. Non calcolare percentuali fra visite, richieste, account e
// famiglie finché non hai verificato che coorte e denominatore siano
// confrontabili. Mostra esplicitamente i passaggi non tracciati."
// Iniziativa: claude/INIZIATIVA_admin_operativo.md (Lotto 2).
//
// Puro. Passaggi PRIMA della registrazione, ognuno con la sua unità: nessuna
// percentuale fra righe (unità diverse, popolazioni non collegabili: le visite
// sono anonime). Il funnel famiglie esistente resta sotto, invariato.

import { inPeriod, type Period } from "./dates";

export interface PreRegistrationRaw {
  /** Date delle visite alla pagina di benvenuto; null = non leggibili. */
  landingViews: string[] | null;
  requests: { createdAt: string; invitedAt: string | null; status: "nuovo" | "invitato" | "archiviato"; hasAccount: boolean }[];
  /** Account genitore, già senza interni ed esclusi. */
  accounts: { createdAt: string; withCode: boolean; fromRequest: boolean }[];
  /** Account genitore interni o esclusi dal cockpit, non contati. */
  excludedAccounts: number;
  /** 17/11/2026: richieste fatte da account interni o di prova, non contate. */
  excludedRequests?: number;
}

export interface PreFunnelRow {
  key: string;
  label: string;
  /** null = non tracciato. */
  value: number | null;
  unit: string;
  scope: string;
  rule: string;
  detail?: string;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Rome" });
}

export function computePreFunnel(raw: PreRegistrationRaw, period: Period): PreFunnelRow[] {
  const inP = (at: string | null) => Boolean(at) && inPeriod(at as string, period);
  const periodScope = `creati nel periodo: ${period.label}`;
  const firstView = raw.landingViews && raw.landingViews.length > 0 ? [...raw.landingViews].sort()[0] : null;
  const requestsInP = raw.requests.filter((r) => inP(r.createdAt));
  const accountsInP = raw.accounts.filter((a) => inP(a.createdAt));

  return [
    {
      key: "visite",
      label: "Visite alla pagina di benvenuto",
      value: raw.landingViews ? raw.landingViews.filter((v) => inP(v)).length : null,
      unit: "visite (aperture di pagina, non persone)",
      scope: `nel periodo: ${period.label}${firstView ? ` · tracciate dal ${day(firstView)}` : ""}`,
      rule: "Evento landing_viewed. Anonime: la stessa persona può contare più volte e non si collega a richieste o account.",
    },
    {
      key: "richieste",
      label: "Richieste d'invito",
      value: requestsInP.length,
      unit: "richieste (una per email)",
      scope: periodScope,
      rule: `Righe della lista d'attesa (pagina di benvenuto o '+ Famiglia invitata'), archiviate comprese. Escluse quelle di account interni o di prova (${raw.excludedRequests ?? 0} in tutto).`,
      detail: `${requestsInP.filter((r) => r.status === "archiviato").length} archiviate`,
    },
    {
      key: "preparato",
      label: "Invito preparato",
      value: null,
      unit: "—",
      scope: "—",
      rule: "Non tracciato: 'Scrivi l'invito' e 'Copia link' non lasciano traccia.",
    },
    {
      key: "segnato",
      label: "Invito segnato come inviato",
      value: raw.requests.filter((r) => inP(r.invitedAt)).length,
      unit: "richieste",
      scope: `segnati nel periodo: ${period.label}`,
      rule: "Segnato a mano dall'Admin dopo l'invio: dichiarazione, non prova di consegna.",
    },
    {
      key: "consegnato",
      label: "Invito ricevuto o aperto",
      value: null,
      unit: "—",
      scope: "—",
      rule: "Non tracciato: gli inviti partono dalla posta personale, non da TRAMA.",
    },
    {
      key: "codice",
      label: "Codice beta girato a qualcuno",
      value: null,
      unit: "—",
      scope: "—",
      rule: "Non tracciato: di un codice si sa solo chi lo ha usato per registrarsi.",
    },
    {
      key: "account",
      label: "Account genitore creati",
      value: accountsInP.length,
      unit: "persone (account genitore)",
      scope: periodScope,
      rule: `Esclusi account interni e di prova (${raw.excludedAccounts} in tutto).`,
      detail: `${accountsInP.filter((a) => a.withCode).length} con codice beta · ${accountsInP.filter((a) => a.fromRequest).length} da una richiesta in lista`,
    },
    {
      key: "registrate_senza_invio",
      label: "Richieste già registrate senza invio segnato",
      value: requestsInP.filter((r) => r.hasAccount && !r.invitedAt && r.status !== "archiviato").length,
      unit: "richieste",
      scope: `richieste ${periodScope.replace("creati", "create")}, stato di oggi`,
      rule: "Account con la stessa email ma invio mai segnato: fuori dalla coda 'Da invitare', nessuna data d'invio inventata.",
    },
  ];
}

/** Perché non ci sono percentuali qui: lo si dice, non lo si lascia intuire. */
export const PRE_FUNNEL_NOTE =
  "Ogni riga ha la sua unità (visite, richieste, persone) e popolazioni non collegabili: nessuna percentuale fra queste righe, né verso le famiglie del funnel sotto.";

export function familyFunnelScope(period: Period): string {
  return `Unità: famiglie della beta (invitate o registrate, esclusi account interni e di prova), stato al ${day(period.to)}. "n su N" usa sempre la riga Invitata come denominatore; la percentuale compare solo da 20 famiglie in su.`;
}
