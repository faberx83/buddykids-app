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
//
// AGGIORNAMENTO 02/09/2026 (segnalazione beta di Fabrizio, sia da chat che
// dalla stessa CTA "Segnala un problema" lato gestore, /center/prenotazioni:
// "Verificare come mai la prenotazione accettata risulta ancora da
// rispondere? ... Da aggiungere conferma parziale della prenotazione"):
// DUE problemi distinti trovati verificando i dati reali (query diretta
// Supabase).
//
// 1) BUG — questo helper (già corretto qui sotto) non era mai stato esteso a
//    lib/data/center-bookings.ts (l'Inbox LATO GESTORE, /center/prenotazioni):
//    il fix del 02/09 mattina aveva coperto solo Planner e "Le mie
//    prenotazioni" (lato genitore) — da cui "dove sono finite le modifiche
//    della segnalazione precedente" nella nuova segnalazione: dal portale
//    gestore, letteralmente NIENTE era cambiato. Corretto ora estendendo lo
//    stesso identico pattern a center-bookings.ts.
//
// 2) FEATURE — "conferma parziale": prima di oggi, un giorno accettato + un
//    giorno rifiutato (nessun giorno più "pending"/"waitlisted", il centro ha
//    finito di rispondere) restava "pending" per sempre — sia lato gestore
//    (mostrato ancora "Da rispondere", pur non essendoci più nulla da fare)
//    sia lato genitore ("in attesa", pur essendo in realtà una risposta
//    definitiva e mista). Nuovo valore "partial": TUTTI i giorni sono stati
//    decisi (nessuno pending/waitlisted) ma l'esito non è uniforme.
export type PartnerDecision = "pending" | "accepted" | "rejected" | "proposed" | "partial";

// Aggrega la decisione "effettiva" di una prenotazione a giorni singoli
// partendo dai valori di TUTTI i suoi booking_days, invece di fidarsi del
// campo (mai aggiornato) a livello di prenotazione.
//
// Regola (PRODUCT TRUTH — mai dichiarare più di quanto i dati confermino):
// - "accepted" SOLO se OGNI giorno presente è stato accettato — un'accettazione
//   parziale (es. 2 giorni su 4) non deve mai apparire come "Confermata".
// - "rejected" SOLO se TUTTI i giorni sono stati rifiutati.
// - "pending" finché almeno un giorno è ancora "pending" o "waitlisted" — il
//   centro (o la lista d'attesa) ha ancora qualcosa in sospeso su questa
//   prenotazione.
// - "partial" quando TUTTI i giorni sono stati decisi in modo definitivo
//   (nessuno pending/waitlisted) ma l'esito è misto (alcuni accettati, altri
//   rifiutati) — il centro non deve più fare nulla, ma non è né una piena
//   accettazione né un pieno rifiuto: MAI travestita da "Confermata".
//
// `fallback` è usato solo se non ci sono giorni da aggregare (array vuoto —
// non dovrebbe capitare per una prenotazione davvero "a giorni", ma tiene la
// funzione totale e sicura da chiamare comunque).
// Valore grezzo di UN giorno (booking_days.partner_decision) — "waitlisted"
// esiste SOLO qui, mai come esito aggregato (PartnerDecision sopra non lo
// include: un giorno in lista d'attesa non è mai, di per sé, il risultato
// finale della prenotazione).
type DayDecisionValue = "pending" | "accepted" | "rejected" | "waitlisted";

export function effectiveDayBasedDecision(
  dayDecisions: (string | null | undefined)[],
  fallback: PartnerDecision
): PartnerDecision {
  if (dayDecisions.length === 0) return fallback;
  const normalized = dayDecisions.map((d) => (d ?? "pending") as DayDecisionValue);
  if (normalized.every((d) => d === "accepted")) return "accepted";
  if (normalized.every((d) => d === "rejected")) return "rejected";
  const stillOpen = normalized.some((d) => d === "pending" || d === "waitlisted");
  if (stillOpen) return "pending";
  return "partial";
}
