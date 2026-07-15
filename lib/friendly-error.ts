// BUGFIX (segnalato da Fabrizio: nel sottotitolo di Profilo compariva "The
// connection to the database timed out" — il messaggio grezzo del client
// Supabase, in inglese, mostrato 1:1 all'utente). Non è possibile tradurre
// OGNI possibile errore di rete/Postgres in modo affidabile senza un catalogo
// enorme e fragile — questa funzione riconosce solo le famiglie di errore più
// comuni (rete/timeout, permessi) e le traduce in un messaggio utile in
// italiano; per tutto il resto lascia passare il messaggio originale
// (meglio un messaggio tecnico che nessun messaggio, ma senza fingere di
// tradurre cose che non riconosciamo con certezza).
export function toFriendlyError(rawMessage: string | null | undefined): string {
  const raw = (rawMessage || "").toLowerCase();
  if (!raw) return "Qualcosa è andato storto. Riprova.";

  if (raw.includes("timed out") || raw.includes("timeout")) {
    return "La connessione è scaduta. Controlla la rete e riprova.";
  }
  if (raw.includes("failed to fetch") || raw.includes("network") || raw.includes("load failed")) {
    return "Problema di connessione. Controlla la rete e riprova.";
  }
  if (raw.includes("permission") || raw.includes("not authorized") || raw.includes("row-level security") || raw.includes("rls")) {
    return "Non hai i permessi per completare questa operazione.";
  }
  if (raw.includes("payload") && raw.includes("large")) {
    return "Il file è troppo grande.";
  }

  return rawMessage || "Qualcosa è andato storto. Riprova.";
}
