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
//   INVITE_FROM_EMAIL="BuddyKids <inviti@tuodominio.it>"  (opzionale — senza
//   questa variabile si usa un mittente di test di Resend, valido solo per
//   inviare a se stessi in fase di prova)

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.INVITE_FROM_EMAIL || "BuddyKids <onboarding@resend.dev>";

export const isEmailConfigured = Boolean(RESEND_API_KEY);

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ error?: string }> {
  if (!RESEND_API_KEY) return { error: "not_configured" };

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
