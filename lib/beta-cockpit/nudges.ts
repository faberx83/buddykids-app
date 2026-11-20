// TRAMA — SOLLECITI ALLE FAMIGLIE DELLA BETA (20/11/2026).
// Fabrizio: "Poi dobbiamo definire una campagna di push per 'sollecitare' chi
// non si è iscritto" → scelta: "Registrati poco attivi" (push + email) e
// "Invitati via WhatsApp" (messaggi da incollare, fuori dall'app).
//
// Logica pura: le campagne, chi le riceve (dalle frizioni e dagli alert del
// Beta cockpit) e la pausa minima tra due solleciti uguali alla stessa persona.
// Si inviano solo a mano dall'Admin (mai in automatico), via push (rispetta
// "Notifiche push") ed email (rispetta "Email"), mai agli account di prova.

import type { AlertKey, FrictionKey } from "./model";

export type NudgeKey = "completa_onboarding" | "primo_impegno" | "altro_genitore" | "torna";

export interface NudgeCampaign {
  key: NudgeKey;
  /** A chi va, in parole semplici (per l'Admin). */
  audience: string;
  /** Da quale fatto del cockpit si ricavano i destinatari. */
  source: { kind: "friction"; key: FrictionKey } | { kind: "alert"; key: AlertKey };
  push: { title: string; body: string; deepLink: string };
  email: { subject: string; heading: string; body: string; cta: string };
}

export const NUDGE_CAMPAIGNS: NudgeCampaign[] = [
  {
    key: "completa_onboarding",
    audience: "Registrati che non hanno finito l'introduzione (figli e scuola)",
    source: { kind: "friction", key: "onboarding_incomplete" },
    push: {
      title: "Ti mancano 2 minuti",
      body: "Aggiungi i tuoi figli e la scuola: TRAMA ti mostra subito le settimane da organizzare.",
      deepLink: "/nextgen",
    },
    email: {
      subject: "Ti mancano 2 minuti per iniziare con TRAMA",
      heading: "Manca poco",
      body: "Aggiungi i tuoi figli e la loro scuola: TRAMA ti mostra subito ponti, vacanze e settimane da organizzare.",
      cta: "Continua da dove eri",
    },
  },
  {
    key: "primo_impegno",
    audience: "Registrati che non hanno ancora nessun impegno nel Planner",
    source: { kind: "friction", key: "no_commitment" },
    push: {
      title: "La tua prima settimana su TRAMA",
      body: "Aggiungi un impegno (calcio, piscina, i nonni): in 10 secondi è nel Planner.",
      deepLink: "/nextgen/planner",
    },
    email: {
      subject: "Aggiungi il primo impegno della settimana",
      heading: "Partiamo da un impegno",
      body: "Il corso di calcio, la piscina, il pomeriggio dai nonni: aggiungilo in pochi secondi e vedi la settimana prendere forma.",
      cta: "Apri il Planner",
    },
  },
  {
    key: "altro_genitore",
    audience: "Famiglie senza un secondo adulto e senza inviti in corso",
    source: { kind: "friction", key: "no_second_adult" },
    push: {
      title: "Organizzatevi in due",
      body: "Invita l'altro genitore: vedrete lo stesso Planner e chi porta e chi ritira.",
      deepLink: "/nextgen/profile/famiglia",
    },
    email: {
      subject: "TRAMA funziona meglio in due",
      heading: "Invita l'altro genitore",
      body: "Con l'altro genitore nella stessa famiglia vedete gli stessi impegni e vi dividete chi porta e chi ritira, senza messaggi avanti e indietro.",
      cta: "Invita ora",
    },
  },
  {
    key: "torna",
    audience: "Famiglie dormienti (nessuna azione da qualche giorno)",
    source: { kind: "alert", key: "dormant" },
    push: {
      title: "Com'è andata la settimana?",
      body: "Dai un'occhiata alla prossima: chi porta, chi ritira, cosa manca.",
      deepLink: "/nextgen",
    },
    email: {
      subject: "La prossima settimana è già pronta?",
      heading: "Diamo un'occhiata alla prossima settimana",
      body: "In un minuto vedi impegni, chi porta e chi ritira, e cosa manca ancora da organizzare.",
      cta: "Apri TRAMA",
    },
  },
];

export function nudgeByKey(key: string): NudgeCampaign | null {
  return NUDGE_CAMPAIGNS.find((c) => c.key === key) ?? null;
}

/** Mai due solleciti uguali alla stessa persona a meno di 7 giorni. */
export const NUDGE_COOLDOWN_DAYS = 7;

/** Evento in product_events per ricordare l'invio (detail = "<campagna>:<userId>"). */
export const NUDGE_SENT_EVENT = "beta_nudge_sent";

export function nudgeDedupeKey(key: NudgeKey, userId: string): string {
  return `${key}:${userId}`;
}

export function isInCooldown(lastSentAt: string | null | undefined, now: Date): boolean {
  if (!lastSentAt) return false;
  const t = Date.parse(lastSentAt);
  return !Number.isNaN(t) && now.getTime() - t < NUDGE_COOLDOWN_DAYS * 24 * 3600 * 1000;
}

/** Famiglie destinatarie secondo il cockpit: solo famiglie registrate (mai le invitate "w:"). */
export function familiesForCampaign(
  campaign: NudgeCampaign,
  frictionMap: Record<FrictionKey, string[]>,
  alerts: { key: AlertKey; families: string[] }[]
): string[] {
  const keys =
    campaign.source.kind === "friction"
      ? (frictionMap[campaign.source.key] ?? [])
      : (alerts.find((a) => a.key === campaign.source.key)?.families ?? []);
  return Array.from(new Set(keys.filter((k) => !k.startsWith("w:"))));
}

export interface NudgeRecipient {
  userId: string;
  familyKey: string;
}

/**
 * Persone a cui inviare: i genitori delle famiglie destinatarie, senza account
 * di prova e senza chi ha già ricevuto lo stesso sollecito negli ultimi 7 giorni.
 */
export function selectNudgeRecipients(input: {
  familyKeys: string[];
  membersByFamily: Map<string, string[]>;
  testUserIds: ReadonlySet<string>;
  lastSentByUser: Map<string, string>;
  now: Date;
}): { recipients: NudgeRecipient[]; skippedCooldown: number } {
  const recipients: NudgeRecipient[] = [];
  let skippedCooldown = 0;
  const seen = new Set<string>();
  for (const familyKey of input.familyKeys) {
    for (const userId of input.membersByFamily.get(familyKey) ?? []) {
      if (seen.has(userId) || input.testUserIds.has(userId)) continue;
      seen.add(userId);
      if (isInCooldown(input.lastSentByUser.get(userId), input.now)) {
        skippedCooldown += 1;
        continue;
      }
      recipients.push({ userId, familyKey });
    }
  }
  return { recipients, skippedCooldown };
}

/** Testo dell'email di sollecito (HTML semplice, stile delle email di TRAMA). */
export function nudgeEmailHtml(campaign: NudgeCampaign, link: string, firstName: string | null): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  return `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#172A4D;font-size:16px;line-height:1.5;max-width:520px">
<p style="font-size:20px;font-weight:700;margin:0 0 8px">${esc(campaign.email.heading)}</p>
<p style="margin:0 0 6px">${firstName ? `Ciao ${esc(firstName)},` : "Ciao,"}</p>
<p style="margin:0 0 18px">${esc(campaign.email.body)}</p>
<p style="margin:0 0 22px"><a href="${esc(link)}" style="display:inline-block;background:#172A4D;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px">${esc(campaign.email.cta)}</a></p>
<p style="font-size:13px;color:#5B6478;margin:0">Ricevi questa email perché partecipi alla beta di TRAMA. Puoi spegnere le email da Profilo → Impostazioni → Notifiche.</p></div>`;
}

export function nudgeEmailText(campaign: NudgeCampaign, link: string, firstName: string | null): string {
  return [firstName ? `Ciao ${firstName},` : "Ciao,", "", campaign.email.body, "", `${campaign.email.cta}: ${link}`, "", "Puoi spegnere le email da Profilo → Impostazioni → Notifiche."].join("\n");
}

/** Messaggi pronti per chi ha ricevuto il link d'invito su WhatsApp (non tracciabili dall'app). */
export const WHATSAPP_NUDGES: { label: string; text: string }[] = [
  {
    label: "Dopo 2-3 giorni",
    text: "Ciao! Sei riuscito a dare un'occhiata a TRAMA? Bastano 2 minuti per iscriverti e aggiungere i bimbi: ti fa vedere subito ponti e vacanze da organizzare. Il link è sempre questo: {link}",
  },
  {
    label: "Dopo una settimana",
    text: "Ciao, ti riscrivo per TRAMA 🙂 Siamo ancora poche famiglie nella beta e il tuo parere mi servirebbe davvero: anche solo 5 minuti di prova. Se ti va: {link}",
  },
  {
    label: "Ultimo promemoria",
    text: "Ultimo messaggio, promesso! La beta di TRAMA resta aperta ancora qualche settimana: se vuoi provarla con l'altro genitore, il link è {link}. Grazie comunque!",
  },
];
