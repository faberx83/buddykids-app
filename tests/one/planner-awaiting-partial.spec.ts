import { test, expect } from "@playwright/test";
import { computeAwaitingPartnerConfirmation } from "../../lib/data/planner";

// TRAMA FINAL HARDENING CLOSURE (04/09/2026) — unit test puri per
// lib/data/planner.ts#computeAwaitingPartnerConfirmation, stesso principio
// "no browser" già usato in tests/one/planner-first-uncovered.spec.ts.
//
// Bug reale segnalato da Fabrizio (screenshot Planner): "Sett. 15 · Prova FP
// · in attesa di conferma del centro" per una prenotazione Giorni spot con
// 4 giorni su 5 già ACCETTATI dal centro (uno rifiutato) — cioè un kid con
// partnerDecision effettivo "partial" (vedi
// lib/booking-response/effective-decision.ts::effectiveDayBasedDecision).
// Causa: il controllo precedente trattava "partial" come "pending"
// (entrambi "!== accepted"), facendo risultare la settimana sempre "in
// attesa" invece di "Confermata parzialmente" — anche con la maggior parte
// dei giorni già confermati dal centro.
//
// Comando: npx playwright test tests/one/planner-awaiting-partial.spec.ts

test.describe("planner — computeAwaitingPartnerConfirmation [no browser]", () => {
  test("PLNAWAIT-01 - kid con esito 'partial' NON è 'in attesa' (bug reale segnalato)", () => {
    // 4 giorni accettati + 1 rifiutato => partnerDecision effettivo "partial"
    expect(computeAwaitingPartnerConfirmation(true, [{ partnerDecision: "partial" }])).toBe(false);
  });

  test("PLNAWAIT-03 - kid con esito 'pending' resta davvero 'in attesa' (comportamento invariato)", () => {
    expect(computeAwaitingPartnerConfirmation(true, [{ partnerDecision: "pending" }])).toBe(true);
  });

  test("PLNAWAIT-04 - kid con esito 'accepted' NON è 'in attesa'", () => {
    expect(computeAwaitingPartnerConfirmation(true, [{ partnerDecision: "accepted" }])).toBe(false);
  });

  test("PLNAWAIT-05 - multi-figlio: un 'partial' e un 'pending' insieme NON è 'in attesa' (basta un segnale positivo reale)", () => {
    expect(
      computeAwaitingPartnerConfirmation(true, [
        { partnerDecision: "partial" },
        { partnerDecision: "pending" },
      ])
    ).toBe(false);
  });

  test("PLNAWAIT-06 - multi-figlio: tutti 'pending' resta 'in attesa'", () => {
    expect(
      computeAwaitingPartnerConfirmation(true, [
        { partnerDecision: "pending" },
        { partnerDecision: "pending" },
      ])
    ).toBe(true);
  });

  test("PLNAWAIT-07 - settimana non 'covered' non è mai 'in attesa', qualunque sia coveredKids", () => {
    expect(computeAwaitingPartnerConfirmation(false, [{ partnerDecision: "pending" }])).toBe(false);
  });

  test("PLNAWAIT-08 - nessun coveredKids (array vuoto) non è mai 'in attesa'", () => {
    expect(computeAwaitingPartnerConfirmation(true, [])).toBe(false);
  });

  test("PLNAWAIT-09 - kid con esito 'rejected' resta 'in attesa' (comportamento invariato, fuori scope di questa segnalazione)", () => {
    expect(computeAwaitingPartnerConfirmation(true, [{ partnerDecision: "rejected" }])).toBe(true);
  });
});
