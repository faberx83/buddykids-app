// Invio email transazionali (inviti del Gestore) tramite Resend
// (https://resend.com — API semplice, buon piano gratuito per iniziare).
// Se RESEND_API_KEY non è configurata, l'invio è semplicemente "disattivato":
// il Gestore vede comunque il link/codice invito da copiare e mandare a mano
// (WhatsApp, email personale, SMS...) — nessuna funzionalità bloccata,
// stesso principio di isSupabaseConfigured usato nel resto dell'app.
//
// Per attivare l'invio automatico: creare un account su resend.com, generare
// una API key, e impostare in .env.local (e nelle variabili d'ambiente di
// Vercel):
//   RESEND_API_KEY=re_xxxxxxxx
//   INVITE_FROM_EMAIL="TRAMA <inviti@tuodominio.it>"  (opzionale — senza
//   questa variabile si usa un mittente di test di Resend, valido solo per
//   inviare a se stessi in fase di prova)

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.INVITE_FROM_EMAIL || "TRAMA <onboarding@resend.dev>";

export const isEmailConfigured = Boolean(RESEND_API_KEY);

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
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

async function attemptSend(input: SendEmailInput): Promise<{ error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
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
  if (!RESEND_API_KEY) return { error: "not_configured", attempts: 0 };

  let result = await attemptSend(input);
  if (!result.error) return { attempts: 1 };

  console.error(
    `[email] Primo tentativo di invio fallito (to=${input.to}, subject="${input.subject}"): ${result.error}. Riprovo una volta...`
  );
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  result = await attemptSend(input);

  if (result.error) {
    console.error(
      `[email] Secondo tentativo fallito (to=${input.to}, subject="${input.subject}"): ${result.error}. Rinuncio dopo 2 tentativi.`
    );
    return { error: result.error, attempts: 2 };
  }
  console.info(`[email] Invio riuscito al secondo tentativo (to=${input.to}, subject="${input.subject}").`);
  return { attempts: 2 };
}
