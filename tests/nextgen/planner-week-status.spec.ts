import { test, expect } from "@playwright/test";
import { computeWeekStatus } from "@/lib/nextgen/planner-insights";

// PRE-LAUNCH REMEDIATION WAVE 1 — R-09 (decisione Fabrizio, 24/08/2026):
// computeWeekStatus (lib/nextgen/planner-insights.ts) è la fonte di verità
// condivisa da entrambe le viste del Planner (striscia compatta "Stato per
// settimana" e riga della Timeline, vedi commento in PlannerClient.tsx) —
// un bug qui si propaga silenziosamente a entrambe. Segnalato nell'Audit
// 360° come area a rischio di regressione (nessun test isolava la funzione
// pura dai suoi 8 rami), in particolare i due bug reali già corretti in
// passato proprio su questa funzione (dayBookingOnly → "partial", 06/08;
// settimana passata mai coperta → "past" invece di "priorità"/"scoperta",
// 06/08).
//
// A differenza degli altri file in tests/nextgen/*.spec.ts, questi test
// NON usano `page`/`loginAs`/`isRealDeployment`: computeWeekStatus è una
// funzione pura (nessuna chiamata Supabase, nessun DOM) — gira in
// qualunque ambiente, compreso questo sandbox, senza bisogno di un deploy
// reale o di account di test. Nessun altro file esistente segue già
// questo pattern "solo logica" — introdotto qui per la prima volta,
// nessun cambio a tests/fixtures/roles.ts o al resto della suite.

test.describe("lib/nextgen/planner-insights — computeWeekStatus (regressione pura, R-09)", () => {
  const base = {
    covered: false,
    dismissed: false,
    coveredKids: [] as { kidId: string }[],
  };

  test("TC-N658 - settimana non coperta e dismissed è sempre 'dismissed', qualunque altro segnale", () => {
    const status = computeWeekStatus(
      { ...base, dismissed: true, covered: true, coveredKids: [{ kidId: "a" }], isPast: true },
      1,
      true,
      true
    );
    expect(status).toBe("dismissed");
  });

  test("TC-N659 - copertura SOLO con booking_days (dayBookingOnly) è sempre 'partial', anche con un solo figlio", () => {
    // BUG CORRETTO 06/08/2026: prima di questo fix una settimana coperta solo
    // da prenotazioni "Giorni spot" con un solo figlio in famiglia risultava
    // "covered" (fuorviante: nessuna prenotazione a settimana intera esiste).
    const status = computeWeekStatus(
      { ...base, covered: true, dayBookingOnly: true, coveredKids: [{ kidId: "a" }] },
      1,
      false,
      false
    );
    expect(status).toBe("partial");
  });

  test("TC-N660 - copertura parziale multi-figlio (alcuni ma non tutti coperti) è 'partial'", () => {
    const status = computeWeekStatus(
      { ...base, covered: true, coveredKids: [{ kidId: "a" }] },
      2,
      false,
      false
    );
    expect(status).toBe("partial");
  });

  test("TC-N661 - copertura completa multi-figlio (tutti coperti) è 'covered', non 'partial'", () => {
    const status = computeWeekStatus(
      { ...base, covered: true, coveredKids: [{ kidId: "a" }, { kidId: "b" }] },
      2,
      false,
      false
    );
    expect(status).toBe("covered");
  });

  // NOTA: la funzione controlla `hasOverlap` PRIMA di `awaitingPartnerConfirmation`
  // (computeWeekStatus, lib/nextgen/planner-insights.ts) — "conflict" vince
  // sempre su "awaiting" quando entrambi i segnali sono veri (un
  // avvertimento di sovrapposizione è più urgente di uno stato di attesa).
  // Questo test fissa quel comportamento come intenzionale: un domani, se
  // qualcuno invertisse l'ordine dei controlli senza saperlo, questo test
  // fallirebbe e andrebbe verificato con Fabrizio prima di "correggerlo".
  test("TC-N662a - con sovrapposizione E in attesa di conferma insieme, vince 'conflict' su 'awaiting'", () => {
    const status = computeWeekStatus(
      { ...base, covered: true, awaitingPartnerConfirmation: true, coveredKids: [{ kidId: "a" }] },
      1,
      true,
      false
    );
    expect(status).toBe("conflict");
  });

  test("TC-N662b - 'awaiting' (in attesa di conferma Partner) senza sovrapposizione ha priorità su 'partial'", () => {
    const status = computeWeekStatus(
      {
        ...base,
        covered: true,
        awaitingPartnerConfirmation: true,
        dayBookingOnly: true,
        coveredKids: [{ kidId: "a" }],
      },
      2,
      false,
      false
    );
    expect(status).toBe("awaiting");
  });

  test("TC-N663 - sovrapposizione (hasOverlap) su settimana coperta è 'conflict'", () => {
    const status = computeWeekStatus(
      { ...base, covered: true, coveredKids: [{ kidId: "a" }] },
      1,
      true,
      false
    );
    expect(status).toBe("conflict");
  });

  // BUG CORRETTO 06/08/2026: una settimana MAI coperta ma ormai trascorsa
  // (isPast) non è più "priorità" né "scoperta" — è semplicemente chiusa.
  test("TC-N664 - settimana MAI coperta e già passata (isPast) è 'past', anche se sarebbe stata priorità", () => {
    const status = computeWeekStatus({ ...base, isPast: true }, 1, false, true);
    expect(status).toBe("past");
  });

  test("TC-N665 - settimana COPERTA ma già passata resta 'covered' (la storia non si nasconde), non 'past'", () => {
    const status = computeWeekStatus(
      { ...base, covered: true, coveredKids: [{ kidId: "a" }], isPast: true },
      1,
      false,
      false
    );
    expect(status).toBe("covered");
  });

  test("TC-N666 - settimana COPERTA parziale ma già passata resta 'partial', non 'past'", () => {
    const status = computeWeekStatus(
      { ...base, covered: true, coveredKids: [{ kidId: "a" }], isPast: true },
      2,
      false,
      false
    );
    expect(status).toBe("partial");
  });

  test("TC-N667 - settimana futura non coperta e marcata 'priorità' è 'priority', non 'uncovered'", () => {
    const status = computeWeekStatus({ ...base, isPast: false }, 1, false, true);
    expect(status).toBe("priority");
  });

  test("TC-N668 - settimana futura non coperta e NON prioritaria è 'uncovered'", () => {
    const status = computeWeekStatus({ ...base, isPast: false }, 1, false, false);
    expect(status).toBe("uncovered");
  });

  test("TC-N669 - isPast omesso (nessun chiamante che lo passa) non produce mai 'past' — comportamento pre-fix invariato", () => {
    // Nessuna proprietà isPast: undefined è falsy, stesso ramo di isPast:false.
    const status = computeWeekStatus(base, 1, false, true);
    expect(status).toBe("priority");
  });
});
