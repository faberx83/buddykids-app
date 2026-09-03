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
//    definitiva e mista). Nuovo valore "partial": almeno un giorno è stato
//    accettato, ma non tutti.
//
// AGGIORNAMENTO 02/09/2026 (seconda passata, feedback diretto di Fabrizio):
// la primissima versione di "partial" scattava SOLO quando il centro aveva
// finito di rispondere a ogni giorno (nessun pending/waitlisted residuo).
// Fabrizio: "la conferma parziale serve anche nei casi in cui ci sono giorni
// non ancora gestiti (1 accettato e 1 boh)" — cioè l'informazione "almeno un
// giorno è già confermato" è utile SUBITO, anche se il centro deve ancora
// decidere sugli altri, non solo a risposta completata. "partial" ora
// scatta appena c'è almeno un giorno accettato che convive con QUALSIASI
// altro esito (pending, waitlisted o rejected) — la label mostra sempre "X
// di Y giorni confermati" (mai un'accettazione piena millantata). Il segnale
// "il centro ha ancora qualcosa da decidere" resta comunque disponibile
// separatamente (vedi bookingNeedsAction in PrenotazioniClient.tsx, che
// guarda i singoli booking_days invece di questo esito aggregato): una
// prenotazione "partial" con un giorno ancora pending continua a comparire
// nel filtro "Da rispondere" del gestore, non sparisce solo perché ha già
// un'etichetta diversa.
export type PartnerDecision = "pending" | "accepted" | "rejected" | "proposed" | "partial";

// Aggrega la decisione "effettiva" di una prenotazione a giorni singoli
// partendo dai valori di TUTTI i suoi booking_days, invece di fidarsi del
// campo (mai aggiornato) a livello di prenotazione.
//
// Regola (PRODUCT TRUTH — mai dichiarare più di quanto i dati confermino):
// - "accepted" SOLO se OGNI giorno presente è stato accettato.
// - "rejected" SOLO se TUTTI i giorni sono stati rifiutati.
// - "partial" appena ALMENO UN giorno è accettato ma non tutti — vale sia a
//   risposta completata (es. 3 accettati + 2 rifiutati) sia a risposta
//   ancora in corso (es. 1 accettato + 1 ancora pending/waitlisted): in
//   entrambi i casi c'è già un'informazione reale e positiva da mostrare
//   ("X di Y giorni confermati"), non ha senso nasconderla dietro un
//   generico "pending" finché il centro non finisce di rispondere.
// - "pending" in ogni altro caso — NESSUN giorno ancora accettato (tutto
//   pending/waitlisted, o un mix di rifiutati e ancora da decidere ma senza
//   nessuna conferma vera): non c'è ancora nulla di positivo da comunicare.
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
  if (normalized.some((d) => d === "accepted")) return "partial";
  return "pending";
}

// Segnalazione Fabrizio 03/09/2026 ("aggiornare dashboard gestore con dati
// reali"): app/center/page.tsx (dashboard del centro) legge già Supabase per
// intero (nessun mock, a differenza di quanto un audit precedente al 24/08
// riportava per questa pagina — corretto in quella data, prima di questa
// sessione) — ma DUE numeri restavano concettualmente sbagliati perché
// derivati da bookings.status (transazione/pagamento, quasi sempre già
// "confirmed" col pagamento demo) invece che da partnerDecision (risposta
// OPERATIVA del centro, la stessa distinzione documentata sopra e in
// app/(main)/prenotazioni/PrenotazioniClient.tsx): "Fatturato confermato"
// includeva prenotazioni ancora in attesa o già rifiutate dal centro come se
// fossero fatturato reale, e "Prenotazioni in attesa" — usando lo stesso
// bug di visibilità già corretto nell'Inbox — non contava una prenotazione
// "partial" con giorni ancora da decidere. Estratti qui (invece che
// duplicati in page.tsx) perché la stessa identica logica serve
// all'Inbox gestore (PrenotazioniClient.tsx) — riuso, non una terza
// implementazione.
interface BookingDecisionLike {
  status: string;
  isDayBased: boolean;
  partnerDecision: PartnerDecision;
  days: { partnerDecision: string }[];
}

// "Da rispondere" — per una prenotazione a giorni, l'esito aggregato può
// essere "partial" pur avendo ancora giorni pending/waitlisted (vedi sopra):
// guarda i singoli giorni invece di fidarsi della sola etichetta aggregata,
// altrimenti una prenotazione con "1 accettato + 1 ancora da decidere"
// sparirebbe dal conteggio di ciò che il centro deve ancora fare.
export function bookingNeedsAction(b: BookingDecisionLike): boolean {
  if (b.status === "cancelled") return false;
  if (b.isDayBased) return b.days.some((d) => d.partnerDecision === "pending" || d.partnerDecision === "waitlisted");
  return b.partnerDecision === "pending";
}

// Etichetta/colore condivisa per PartnerDecision — prima duplicata solo in
// PrenotazioniClient.tsx (Inbox gestore); estratta qui il 03/09/2026 così
// anche app/center/page.tsx (dashboard) può mostrare lo stesso stato
// operativo con lo stesso linguaggio/colore, invece di continuare a
// mostrare bookings.status (che con pagamento demo è quasi sempre
// "Confermata" indipendentemente da cosa il centro abbia deciso).
export const PARTNER_DECISION_LABEL: Record<PartnerDecision, { label: string; cls: string }> = {
  pending: { label: "Da rispondere", cls: "bg-orange-light text-trama-orange" },
  accepted: { label: "Accettata", cls: "bg-green-light text-[#2d8f52]" },
  rejected: { label: "Rifiutata", cls: "bg-bg text-ink-3" },
  proposed: { label: "Proposta inviata", cls: "bg-sky-light text-sky" },
  partial: { label: "Confermata parzialmente", cls: "bg-[#F0EEFF] text-[#6F63C5]" },
};

// Fatturato REALMENTE confermato dal centro — mai bookings.total_amount
// preso per intero: per una prenotazione a giorni conta solo il prezzo dei
// giorni EFFETTIVAMENTE accettati (bd.price), per una a settimana intera
// l'intero importo solo se accettata. Una richiesta ancora pending, o
// rifiutata, o solo parzialmente accettata, non vale mai il suo
// total_amount pieno.
export function acceptedRevenue(b: {
  isDayBased: boolean;
  partnerDecision: PartnerDecision;
  totalAmount: number;
  days: { partnerDecision: string; price: number }[];
}): number {
  if (b.isDayBased) {
    return b.days.filter((d) => d.partnerDecision === "accepted").reduce((sum, d) => sum + d.price, 0);
  }
  return b.partnerDecision === "accepted" ? b.totalAmount : 0;
}
