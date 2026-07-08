// Traduce i messaggi di errore di Supabase Auth (in inglese, tecnici) in
// messaggi chiari in italiano per l'utente finale.
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Email o password non corrette. Controlla e riprova.";
  }
  if (m.includes("email not confirmed")) {
    return "Devi prima confermare la tua email — controlla la posta in arrivo (e lo spam).";
  }
  if (m.includes("user already registered") || m.includes("already registered")) {
    return "Esiste già un account con questa email — prova ad accedere invece di registrarti.";
  }
  if (m.includes("password should be at least")) {
    return "La password deve avere almeno 6 caratteri.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Troppi tentativi in poco tempo — attendi qualche minuto e riprova.";
  }
  if (m.includes("network")) {
    return "Problema di connessione — controlla la rete e riprova.";
  }
  return message;
}
