// Invio email transazionali tramite Resend (https://resend.com). Unico punto
// di invio dell'app: inviti famiglia e gruppo, risposte del centro alle
// prenotazioni, assenze e ritardi, inviti del Gestore, notifica lista d'attesa.
//
// Variabili d'ambiente (Vercel → Production, e .env.local in sviluppo):
//   RESEND_API_KEY=re_xxxxxxxx
//   INVITE_FROM_EMAIL=notifiche@<dominio>     (solo l'indirizzo: il nome
//                                             visibile "TRAMA" lo aggiunge il
//                                             codice; accettato anche il
//                                             formato "Nome <indirizzo>")
//   EMAIL_REPLY_TO=risposte@<dominio>        (facoltativa: dove arrivano le
//                                             risposte delle famiglie)
//
// Regola unica (20/10/2026, Fabrizio):
//   From:     TRAMA <INVITE_FROM_EMAIL>
//   Reply-To: EMAIL_REPLY_TO
//
// Se RESEND_API_KEY o INVITE_FROM_EMAIL mancano (o l'indirizzo non è valido)
// l'invio è "disattivato", come prima quando mancava la chiave: chi invita
// vede comunque il link da copiare e mandare a mano, e le prenotazioni
// registrano email_delivery_status = "not_configured". Nessun mittente di
// ripiego: niente mittente di prova di Resend, niente indirizzi personali.
// Se EMAIL_REPLY_TO manca, l'email parte senza Reply-To, come oggi.

export const EMAIL_SENDER_NAME = "TRAMA";

const EMAIL_ADDRESS_RE = /^[^\s@<>"]+@[^\s@<>".]+(\.[^\s@<>".]+)+$/;

// Ricava il solo indirizzo da "indirizzo" oppure da "Nome <indirizzo>".
// Restituisce null se vuoto o non valido.
export function extractEmailAddress(raw: string | undefined | null): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const bracket = value.match(/<([^<>]+)>\s*$/);
  const address = (bracket ? bracket[1] : value).trim();
  return EMAIL_ADDRESS_RE.test(address) ? address : null;
}

export interface EmailSettings {
  apiKeyPresent: boolean;
  from: string | null;
  replyTo: string | null;
  problems: string[];
}

type EmailEnv = Partial<Record<"RESEND_API_KEY" | "INVITE_FROM_EMAIL" | "EMAIL_REPLY_TO", string | undefined>>;

export function resolveEmailSettings(env: EmailEnv): EmailSettings {
  const problems: string[] = [];
  const apiKeyPresent = Boolean(env.RESEND_API_KEY?.trim());

  const fromAddress = extractEmailAddress(env.INVITE_FROM_EMAIL);
  if (!env.INVITE_FROM_EMAIL?.trim()) {
    problems.push("INVITE_FROM_EMAIL mancante: nessuna email viene inviata.");
  } else if (!fromAddress) {
    problems.push("INVITE_FROM_EMAIL non è un indirizzo valido: nessuna email viene inviata.");
  }

  const replyTo = extractEmailAddress(env.EMAIL_REPLY_TO);
  if (env.EMAIL_REPLY_TO?.trim() && !replyTo) {
    problems.push("EMAIL_REPLY_TO non è un indirizzo valido: le email partono senza Reply-To.");
  }

  return {
    apiKeyPresent,
    from: fromAddress ? `${EMAIL_SENDER_NAME} <${fromAddress}>` : null,
    replyTo,
    problems,
  };
}

const SETTINGS = resolveEmailSettings({
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  INVITE_FROM_EMAIL: process.env.INVITE_FROM_EMAIL,
  EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
});

// Si segnala solo se la chiave c'è: senza chiave l'invio è spento per scelta
// (sviluppo locale, test) e non è un errore.
if (SETTINGS.apiKeyPresent) {
  for (const problem of SETTINGS.problems) console.error(`[email] ${problem}`);
}

export const isEmailConfigured = SETTINGS.apiKeyPresent && SETTINGS.from !== null;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export interface ResendPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  reply_to?: string;
}

// Corpo della chiamata Resend (API REST: il campo è `reply_to`).
export function buildResendPayload(input: SendEmailInput, settings: Pick<EmailSettings, "from" | "replyTo">): ResendPayload | null {
  if (!settings.from) return null;
  const payload: ResendPayload = {
    from: settings.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  };
  if (settings.replyTo) payload.reply_to = settings.replyTo;
  return payload;
}

// TRAMA ONE Build Sprint 6 (backlog vincolante P2, "email fire-and-forget",
// SPRINT_GOVERNANCE.md riga 151 / CORE_DOMAIN_SOURCE_OF_TRUTH.md §8) —
// prima di questo sprint un fallimento di rete/Resend spariva nel nulla: un
// singolo tentativo, nessun log, nessuno stato persistito. Qui si aggiunge
// SOLO il "retry minimo" richiesto esplicitamente dal backlog ("anche solo
// un secondo tentativo automatico prima di arrendersi") + logging esplicito
// su fallimento — il numero di tentativi (`attempts`) è un campo aggiuntivo
// sul risultato, non sostituisce `error`, quindi tutti i call site esistenti
// che fanno `const { error } = await sendEmail(...)` restano invariati.
export interface SendEmailResult {
  error?: string;
  attempts: number;
}

const RETRY_DELAY_MS = 400;

async function attemptSend(payload: ResendPayload): Promise<{ error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      return { error: `Resend error ${res.status}: ${body}` };
    }
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore di rete nell'invio email" };
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!SETTINGS.apiKeyPresent) return { error: "not_configured", attempts: 0 };
  const payload = buildResendPayload(input, SETTINGS);
  if (!payload) {
    console.error(
      `[email] Invio non eseguito (to=${input.to}, subject="${input.subject}"): INVITE_FROM_EMAIL mancante o non valido.`
    );
    return { error: "not_configured", attempts: 0 };
  }

  let result = await attemptSend(payload);
  if (!result.error) return { attempts: 1 };

  console.error(
    `[email] Primo tentativo di invio fallito (to=${input.to}, subject="${input.subject}"): ${result.error}. Riprovo una volta...`
  );
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  result = await attemptSend(payload);

  if (result.error) {
    console.error(
      `[email] Secondo tentativo fallito (to=${input.to}, subject="${input.subject}"): ${result.error}. Rinuncio dopo 2 tentativi.`
    );
    return { error: result.error, attempts: 2 };
  }
  console.info(`[email] Invio riuscito al secondo tentativo (to=${input.to}, subject="${input.subject}").`);
  return { attempts: 2 };
}
