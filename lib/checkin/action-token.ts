import "server-only";
import {
  CheckinActionTokenPayload,
  VerifiedCheckinActionToken,
  isCheckinActionTokenError,
  signCheckinActionToken,
  verifyCheckinActionTokenWithSecret,
} from "./action-token-core";

// TRAMA — Push check-in: azioni rapide sulla notifica (11/09/2026, richiesta
// di Fabrizio: stesse opzioni "Sì / In ritardo / No" già disponibili in app
// — vedi components/CheckinPrompt.tsx / components/nextgen/NextgenCheckinCard.tsx
// — direttamente come bottoni della notifica push, zero tap in app).
//
// PROBLEMA: il tap su un bottone della notifica arriva dal service worker
// (public/sw.js), che non ha la sessione browser dell'utente (niente cookie
// di autenticazione) — app/actions/checkin.ts::parentCheckinAction, la
// Server Action che scrive il check-in oggi, richiede invece
// supabase.auth.getUser() e quindi una sessione valida: non è chiamabile da
// lì.
//
// SOLUZIONE: un token firmato (HMAC-SHA256, algoritmo puro in
// ./action-token-core.ts) generato QUI, lato server, al momento dell'invio
// della push (vedi app/api/cron/checkin-reminders/route.ts) — porta con sé
// tutti i dati della scrittura che autorizza (chi, quale bambino, quale
// giorno/settimana, quale stato) così non serve alcuna query per sapere
// COSA scrivere, solo verificare che il token sia autentico e non scaduto
// (app/api/checkin/quick-action/route.ts). Nessuna tabella nuova: il token
// stesso è l'unica "riga" coinvolta, mai persistito da nessuna parte.
//
// SICUREZZA: richiede CHECKIN_ACTION_SECRET (nuova variabile d'ambiente —
// Fabrizio la imposta su Vercel, non è mai scritta qui). Se assente,
// generateCheckinActionToken() ritorna null e il payload push semplicemente
// non include alcuna azione rapida — fail-safe per costruzione, stesso
// principio già seguito da ensureVapidConfigured() in lib/push/send.ts.
// Scadenza breve (36h, vedi CHECKIN_ACTION_TOKEN_TTL_HOURS) per limitare la
// finestra di un token intercettato. NON è single-use (nessuna tabella di
// redenzione, per restare senza migration in questa wave): un eventuale
// replay entro la finestra può solo ri-scrivere LO STESSO stato che il
// token autorizza fin dall'origine — lo stesso identico effetto di un
// secondo tap legittimo sullo stesso bottone, mai la possibilità di
// scrivere uno stato diverso o per un bambino diverso (il token è
// specifico per bambino+giorno+stato, firmato, non riutilizzabile per
// altro).
//
// "server-only" qui (assente in ./action-token-core.ts, che è pura e non
// legge mai process.env) impedisce a costruzione che questo wrapper — che
// legge davvero CHECKIN_ACTION_SECRET — finisca mai in un bundle client.

export type { CheckinActionTokenPayload, VerifiedCheckinActionToken };
export { isCheckinActionTokenError };

const CHECKIN_ACTION_TOKEN_TTL_HOURS = 36;

/**
 * Genera un token firmato per UNA scrittura specifica. Ritorna null se
 * CHECKIN_ACTION_SECRET non è configurato — il chiamante deve trattarlo come
 * "azioni rapide non disponibili ora", mai come un errore bloccante (la
 * push normale, senza azioni, resta comunque inviata).
 */
export function generateCheckinActionToken(input: Omit<CheckinActionTokenPayload, "exp">): string | null {
  const secret = process.env.CHECKIN_ACTION_SECRET;
  if (!secret) return null;

  const payload: CheckinActionTokenPayload = {
    ...input,
    exp: Math.floor(Date.now() / 1000) + CHECKIN_ACTION_TOKEN_TTL_HOURS * 3600,
  };
  return signCheckinActionToken(secret, payload);
}

export function verifyCheckinActionToken(token: string): VerifiedCheckinActionToken {
  const secret = process.env.CHECKIN_ACTION_SECRET;
  if (!secret) return { error: "Azioni rapide non configurate" };
  return verifyCheckinActionTokenWithSecret(secret, token);
}
