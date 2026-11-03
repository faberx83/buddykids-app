// TRAMA — COME SI APPLICANO GLI SCONTI (test browser 03/11/2026, Partner #4).
// La pagina Sconti chiedeva le percentuali senza dire se si sommano né cosa
// succede con le prenotazioni a giornate. Questo testo descrive le regole
// REALI del calcolo, verificate nel codice — se cambia il calcolo, cambia
// anche qui (test: tests/one/test-browser-0311.spec.ts):
//   - app/booking/[id]/BookingClient.tsx: weekDiscount solo con
//     !dayBookingMode && nWeeks >= 2; familyDiscountAmount su
//     perChildSubtotal (settimane o giorni); sconti sommati, ciascuno sul
//     subtotale; servizi (navetta, pre/post, pranzo) aggiunti dopo, senza
//     sconto, e non offerti sulle prenotazioni a giornate;
//   - lib/day-pricing.ts dayPrice: lo sconto del singolo giorno (calendario)
//     è già dentro il prezzo del giorno;
//   - group_requests.discount_percent: NON entra nel totale della
//     prenotazione; è una Proposta di gruppo concordata con il centro
//     (lib/groups/group-proposal.ts).

export interface DiscountRule {
  key: "multiweek" | "siblings" | "group" | "together" | "days";
  title: string;
  text: string;
}

export const DISCOUNT_RULES: DiscountRule[] = [
  {
    key: "multiweek",
    title: "Più settimane",
    text: "Vale quando una famiglia prenota almeno 2 settimane nella stessa richiesta. Non vale per le prenotazioni a giornate.",
  },
  {
    key: "siblings",
    title: "Fratelli e sorelle",
    text: "Dal secondo figlio nella stessa richiesta, sul prezzo di quel figlio. Vale anche per le giornate.",
  },
  {
    key: "group",
    title: "Gruppi",
    text: "La percentuale compare nella Proposta di gruppo che ricevete. Non viene tolta in automatico dalle prenotazioni: le famiglie prenotano poi i giorni, e lo sconto lo applicate voi come concordato.",
  },
  {
    key: "together",
    title: "Si sommano",
    text: "Più settimane, fratelli e l'eventuale sconto invito della famiglia si sommano: ognuno si calcola sul totale prima degli sconti. Navetta, pre e post scuola e pranzo non vengono scontati.",
  },
  {
    key: "days",
    title: "Giornate",
    text: "Lo sconto di un singolo giorno si imposta nel calendario dell'attività ed è già nel prezzo di quel giorno; si aggiunge allo sconto fratelli.",
  },
];
