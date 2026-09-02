import { test as pureTest, expect as pureExpect } from "@playwright/test";
import { effectiveDayBasedDecision } from "@/lib/booking-response/effective-decision";

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

  pureTest("accettazione parziale (alcuni giorni accettati, altri no) -> pending, mai 'accepted' millantato", () => {
    pureExpect(effectiveDayBasedDecision(["accepted", "pending"], "pending")).toBe("pending");
    pureExpect(effectiveDayBasedDecision(["accepted", "rejected"], "pending")).toBe("pending");
  });

  pureTest("tutti i giorni rifiutati -> rejected", () => {
    pureExpect(effectiveDayBasedDecision(["rejected", "rejected"], "pending")).toBe("rejected");
  });

  pureTest("valori null/undefined nei giorni trattati come 'pending' (nessun crash, nessun falso 'accepted')", () => {
    pureExpect(effectiveDayBasedDecision(["accepted", null, "accepted"], "pending")).toBe("pending");
    pureExpect(effectiveDayBasedDecision([null, undefined], "pending")).toBe("pending");
  });

  pureTest("nessun giorno (array vuoto) -> ricade sul fallback passato (comportamento invariato per prenotazioni a settimana intera)", () => {
    pureExpect(effectiveDayBasedDecision([], "pending")).toBe("pending");
    pureExpect(effectiveDayBasedDecision([], "accepted")).toBe("accepted");
  });
});
