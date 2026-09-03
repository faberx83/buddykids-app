import { test as pureTest, expect as pureExpect } from "@playwright/test";
import { effectiveDayBasedDecision, pendingRevenue } from "@/lib/booking-response/effective-decision";

// Segnalazione Fabrizio (02/09/2026): Sett.14 ("Prova FP", Lino) accettata dal
// centro giorno per giorno (verificato via query diretta: booking_days.
// partner_decision = "accepted" su tutti e 4 i giorni, capacity_decremented
// = true) ma ancora mostrata "in attesa di conferma del centro" sia nel
// Planner sia in "Le mie prenotazioni". ROOT CAUSE: applyDayDecision scrive
// solo su booking_days.partner_decision, mai su bookings.partner_decision —
// entrambi i data layer leggevano solo quest'ultimo. Fix: helper puro
// (lib/booking-response/effective-decision.ts, nessun import server-only)
// condiviso da lib/data/planner.ts e lib/data/my-bookings.ts.

pureTest.describe("effectiveDayBasedDecision — fix Sett.14 (bookings.partner_decision mai aggiornato per prenotazioni a giorni)", () => {
  pureTest("tutti i giorni accettati -> accepted (replica esatta del caso reale Sett.14)", () => {
    pureExpect(
      effectiveDayBasedDecision(["accepted", "accepted", "accepted", "accepted"], "pending")
    ).toBe("accepted");
  });

  pureTest("tutti i giorni pending -> pending (nessuna risposta ancora data dal centro)", () => {
    pureExpect(effectiveDayBasedDecision(["pending", "pending"], "pending")).toBe("pending");
  });

  pureTest("tutti i giorni rifiutati -> rejected", () => {
    pureExpect(effectiveDayBasedDecision(["rejected", "rejected"], "pending")).toBe("rejected");
  });

  pureTest("un solo giorno rifiutato (nessun accettato) resta 'rejected', non 'partial' (esito uniforme)", () => {
    pureExpect(effectiveDayBasedDecision(["rejected"], "pending")).toBe("rejected");
  });

  pureTest("valori null/undefined nei giorni trattati come 'pending' (nessun crash, nessun falso 'accepted')", () => {
    pureExpect(effectiveDayBasedDecision([null, undefined], "pending")).toBe("pending");
  });

  pureTest("nessun giorno (array vuoto) -> ricade sul fallback passato (comportamento invariato per prenotazioni a settimana intera)", () => {
    pureExpect(effectiveDayBasedDecision([], "pending")).toBe("pending");
    pureExpect(effectiveDayBasedDecision([], "accepted")).toBe("accepted");
  });
});

// 02/09/2026 — feature "conferma parziale" (segnalazione beta di Fabrizio,
// sia da chat sia dalla CTA "Segnala un problema" lato gestore: "Da
// aggiungere conferma parziale della prenotazione").
//
// PRIMA PASSATA (mattina): "partial" scattava solo a risposta COMPLETATA
// (nessun giorno più pending/waitlisted) con esito misto.
//
// SECONDA PASSATA (feedback diretto di Fabrizio sulla prima versione): "la
// conferma parziale serve anche nei casi in cui ci sono giorni non ancora
// gestiti (1 accettato e 1 boh)" — cioè l'informazione "almeno un giorno è
// già confermato" va mostrata SUBITO, anche a risposta ancora in corso.
// Regola finale: "partial" scatta appena c'è ALMENO UN giorno accettato che
// convive con un esito diverso (pending, waitlisted o rejected) — MAI
// un'accettazione piena millantata, ma nemmeno un'informazione positiva
// nascosta finché il centro non "finisce" di rispondere. Il segnale "il
// centro ha ancora qualcosa da decidere" resta disponibile separatamente
// (bookingNeedsAction in PrenotazioniClient.tsx, che guarda i singoli
// booking_days invece di questo esito aggregato) — vedi anche
// tests/gestore (non presenti in questo repo di test puri, verificato a
// mano nel commento del componente).
pureTest.describe("effectiveDayBasedDecision — 'partial' (conferma parziale, appena c'è almeno un giorno accettato)", () => {
  pureTest("un giorno accettato + un giorno ancora pending ('1 accettato e 1 boh', caso letterale di Fabrizio) -> partial", () => {
    pureExpect(effectiveDayBasedDecision(["accepted", "pending"], "pending")).toBe("partial");
  });

  pureTest("un giorno accettato + un giorno in lista d'attesa -> partial (il posto in lista può ancora cambiare l'esito, ma l'accettato è reale)", () => {
    pureExpect(effectiveDayBasedDecision(["accepted", "waitlisted"], "pending")).toBe("partial");
  });

  pureTest("un giorno accettato + un giorno rifiutato (risposta completata, esito misto) -> partial", () => {
    pureExpect(effectiveDayBasedDecision(["accepted", "rejected"], "pending")).toBe("partial");
  });

  pureTest("3 accettati su 5, 2 rifiutati -> partial", () => {
    pureExpect(
      effectiveDayBasedDecision(["accepted", "accepted", "accepted", "rejected", "rejected"], "pending")
    ).toBe("partial");
  });

  pureTest("accettato + rifiutato + ancora waitlisted -> partial comunque (c'è già un giorno confermato)", () => {
    pureExpect(effectiveDayBasedDecision(["accepted", "rejected", "waitlisted"], "pending")).toBe("partial");
  });

  pureTest("rifiutato + ancora pending, NESSUN accettato -> resta pending (nulla di positivo ancora da mostrare)", () => {
    pureExpect(effectiveDayBasedDecision(["rejected", "pending"], "pending")).toBe("pending");
  });

  pureTest("rifiutato + in lista d'attesa, NESSUN accettato -> resta pending", () => {
    pureExpect(effectiveDayBasedDecision(["rejected", "waitlisted"], "pending")).toBe("pending");
  });
});

// 03/09/2026 — KPI "Fatturato in sospeso" nella dashboard gestore
// (segnalazione Fabrizio: "in dashboard GESTORE inserirei qualche KPI in
// più, che sia utile a vedere le azioni da svolgere o le informazioni
// utili"). Mirror esatto di acceptedRevenue, ma per il denaro legato a
// decisioni non ancora prese dal centro.
pureTest.describe("pendingRevenue — fatturato legato a decisioni ancora da prendere (KPI dashboard gestore)", () => {
  pureTest("prenotazione a giorni: conta solo i giorni pending/waitlisted, mai gli accettati/rifiutati", () => {
    pureExpect(
      pendingRevenue({
        isDayBased: true,
        partnerDecision: "partial",
        totalAmount: 100,
        days: [
          { partnerDecision: "accepted", price: 25 },
          { partnerDecision: "pending", price: 25 },
          { partnerDecision: "waitlisted", price: 25 },
          { partnerDecision: "rejected", price: 25 },
        ],
      })
    ).toBe(50);
  });

  pureTest("prenotazione a giorni tutta accettata -> 0 in sospeso (nulla da decidere)", () => {
    pureExpect(
      pendingRevenue({
        isDayBased: true,
        partnerDecision: "accepted",
        totalAmount: 100,
        days: [
          { partnerDecision: "accepted", price: 50 },
          { partnerDecision: "accepted", price: 50 },
        ],
      })
    ).toBe(0);
  });

  pureTest("prenotazione a settimana intera pending -> l'intero importo è in sospeso", () => {
    pureExpect(
      pendingRevenue({ isDayBased: false, partnerDecision: "pending", totalAmount: 120, days: [] })
    ).toBe(120);
  });

  pureTest("prenotazione a settimana intera 'proposed' -> 0 (la palla è dal lato del genitore, non del centro)", () => {
    pureExpect(
      pendingRevenue({ isDayBased: false, partnerDecision: "proposed", totalAmount: 120, days: [] })
    ).toBe(0);
  });

  pureTest("prenotazione a settimana intera accettata -> 0 in sospeso", () => {
    pureExpect(
      pendingRevenue({ isDayBased: false, partnerDecision: "accepted", totalAmount: 120, days: [] })
    ).toBe(0);
  });
});
