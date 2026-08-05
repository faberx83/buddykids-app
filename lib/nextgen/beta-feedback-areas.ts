// SPRINT 5 (NEXTGEN) — "Segnala un problema" (feedback Fabrizio: floating CTA
// draggabile su ogni pagina genitore durante la BETA, con contatore Admin per
// area/sottosezione).
//
// Piccola funzione pura pathname -> etichetta leggibile, NESSUN import
// server-only: usata dal componente client BetaFeedbackButton.tsx per
// calcolare l'"area" da mandare insieme alla segnalazione, senza dover
// mantenere un enum rigido lato database (vedi supabase/schema.sql,
// tabella beta_feedback — "area" è testo libero, non un check constraint).
// Nuove sezioni NEXTGEN si aggiungono qui, senza migrazioni.
export function areaLabelFromPath(pathname: string): string {
  if (pathname === "/nextgen") return "Home";
  if (pathname.startsWith("/nextgen/planner/indirizzi")) return "Planner · Indirizzi";
  if (pathname.startsWith("/nextgen/planner/famiglia")) return "Planner · Famiglia";
  if (pathname.startsWith("/nextgen/planner/promemoria")) return "Planner · Promemoria";
  if (pathname.startsWith("/nextgen/planner")) return "Planner";
  if (pathname.startsWith("/nextgen/search")) return "Scopri";
  if (pathname.startsWith("/nextgen/community")) return "Community";
  if (pathname.startsWith("/nextgen/profile/famiglia")) return "Profilo · Famiglia e logistica";
  if (pathname.startsWith("/nextgen/profile/impostazioni")) return "Profilo · Impostazioni";
  if (pathname.startsWith("/nextgen/profile")) return "Profilo";
  if (pathname.startsWith("/activity/")) return "Scheda attività";
  if (pathname.startsWith("/booking/")) return "Prenotazione";
  if (pathname.startsWith("/prenotazioni")) return "Le mie prenotazioni";
  if (pathname.startsWith("/presenze")) return "Presenze";
  if (pathname.startsWith("/preferiti")) return "Preferiti";
  if (pathname.startsWith("/richieste")) return "Le mie richieste";
  return "Altro";
}

// ESTENSIONE PARTNER — stessa idea di areaLabelFromPath sopra, ma per le
// rotte /center/* (vedi app/center/layout.tsx per l'elenco reale delle voci
// di menu). Funzione separata anziché un'unica mappa condivisa: le due app
// (genitori/NEXTGEN e gestori/LEGACY) hanno alberi di rotte del tutto
// distinti e non sovrapposti, unirle avrebbe solo reso più difficile capire
// quale ramo appartiene a quale app.
export function centerAreaLabelFromPath(pathname: string): string {
  if (pathname === "/center") return "Dashboard";
  if (pathname.startsWith("/center/profile")) return "Il mio centro";
  if (pathname.startsWith("/center/activities")) return "Attività";
  if (pathname.startsWith("/center/promotions")) return "Promozioni";
  if (pathname.startsWith("/center/servizi-consigliati")) return "Servizi consigliati";
  if (pathname.startsWith("/center/attendance")) return "Registro presenze";
  if (pathname.startsWith("/center/report-presenze")) return "Report presenze";
  if (pathname.startsWith("/center/prenotazioni")) return "Prenotazioni";
  if (pathname.startsWith("/center/group-requests")) return "Richieste Gruppo";
  if (pathname.startsWith("/center/richieste")) return "Le mie richieste";
  if (pathname.startsWith("/center/invites")) return "Inviti";
  if (pathname.startsWith("/center/account")) return "Il mio account";
  if (pathname.startsWith("/center/one")) return "Tour guidato";
  return "Altro";
}
