// Segnalazione Fabrizio (02/09/2026): Sett.14 ("Prova FP", Lino) accettata
// dal centro giorno per giorno (tutti e 4 i giorni "Accettato" nel portale
// centro, confermato via query diretta: booking_days.partner_decision =
// "accepted" su tutti e 4, capacity_decremented = true), ma il Planner e
// "Le mie prenotazioni" continuavano a mostrare "in attesa di conferma del
// centro".
//
// ROOT CAUSE: per le prenotazioni "Giorni spot" (booking_days), il centro
// accetta/rifiuta un giorno alla volta tramite applyDayDecision (vedi
// apply-day-decision.ts), che scrive SOLO su booking_days.partner_decision
// — non aggiorna mai bookings.partner_decision (quel campo esiste per le
// prenotazioni a settimana intera, risposte tramite respondToBookingAction
// in app/actions/booking-response.ts, che invece lo scrive correttamente).
// lib/data/planner.ts e lib/data/my-bookings.ts leggevano SOLO
// bookings.partner_decision per decidere l'etichetta "in attesa di conferma
// del centro" — per le prenotazioni a giorni quel campo resta "pending" per
// sempre, indipendentemente da quanti giorni il centro abbia poi accettato.
//
// Stesso identico difetto concettuale già trovato e corretto la settimana
// precedente per la pagina di condivisione pubblica (lib/plan-shares/
// build-entries.ts::statusFromDecision) — qui generalizzato in un helper
// puro condiviso da ENTRAMBI i consumer rimasti (Planner legacy/nextgen e
// "Le mie prenotazioni"), per evitare di duplicare la stessa logica una
// terza volta.
//
// Nessuna modifica a DB/migration/RLS: il fix legge un campo già presente
// (booking_days.partner_decision) che semplicemente non veniva selezionato
// da queste due query — nessun backfill necessario, i dati storici tornano
// corretti automaticamente non appena il codice li legge nel modo giusto.

export type PartnerDecision = "pending" | "accepted" | "rejected" | "proposed";

// Aggrega la decisione "effettiva" di una prenotazione a giorni singoli
// partendo dai valori di TUTTI i suoi booking_days, invece di fidarsi del
// campo (mai aggiornato) a livello di prenotazione.
//
// Regola (PRODUCT TRUTH — mai dichiarare più di quanto i dati confermino):
// - "accepted" SOLO se OGNI giorno presente è stato accettato — un'accettazione
//   parziale (es. 2 giorni su 4) non deve mai apparire come "Confermata".
// - "rejected" SOLO se TUTTI i giorni sono stati rifiutati.
// - in ogni altro caso (misto, o giorni ancora "pending"/"waitlisted") resta
//   "pending" — coerente con lo stato "in attesa di conferma del centro" già
//   esistente, nessuna nuova etichetta introdotta.
//
// `fallback` è usato solo se non ci sono giorni da aggregare (array vuoto —
// non dovrebbe capitare per una prenotazione davvero "a giorni", ma tiene la
// funzione totale e sicura da chiamare comunque).
export function effectiveDayBasedDecision(
  dayDecisions: (string | null | undefined)[],
  fallback: PartnerDecision
): PartnerDecision {
  if (dayDecisions.length === 0) return fallback;
  const normalized = dayDecisions.map((d) => (d ?? "pending") as PartnerDecision);
  if (normalized.every((d) => d === "accepted")) return "accepted";
  if (normalized.every((d) => d === "rejected")) return "rejected";
  return "pending";
}
