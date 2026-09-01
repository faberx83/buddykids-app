import { test, expect } from "@playwright/test";
import { computeRolesToCover } from "@/lib/nextgen/week-roles";
import { WeekResponsibility } from "@/lib/nextgen/responsibility-options";

// TRAMA BETA v1.1 — child-day / Andata-Ritorno (Wave 2 della revisione).
// Copre PLN11-T01..T08. Stesso pattern "solo logica" di
// planner-week-status.spec.ts: computeRolesToCover (lib/nextgen/week-roles.ts)
// è una funzione pura (nessuna chiamata Supabase, nessun DOM) — questi test
// girano in QUALUNQUE ambiente, compreso questo sandbox, senza deploy reale.
//
// Formula verificata (dalla revisione approvata):
//   SUM( REAL BOOKED CHILD-DAYS × {ANDATA, RITORNO} ) − ASSIGNED RESPONSIBILITIES
//   = ROLES TO COVER
//
// Settimana di riferimento per tutti i test: lunedì 2026-06-01 (lun 6/1, mar
// 6/2, mer 6/3, gio 6/4, ven 6/5) — coerente con WEEKDAYS/dayOffset in
// lib/nextgen/responsibility-options.ts.

const WEEK_START = "2026-06-01";

function resp(kidId: string, weekday: WeekResponsibility["weekday"], moment: WeekResponsibility["moment"]): WeekResponsibility {
  return {
    kidId,
    weekStartDate: WEEK_START,
    weekday,
    moment,
    responsible: "io",
    responsibleLabel: null,
  };
}

test.describe("TRAMA BETA v1.1 — computeRolesToCover (child-day, regressione pura)", () => {
  // Esempio vincolante della revisione: Sofia (lun, mar, gio) + Niccolò
  // (mar, mer, ven), nessuna assegnazione ancora fatta → 12 slot totali
  // (6 + 6), tutti "da organizzare".
  test("PLN11-T01 - Sofia (lun,mar,gio) + Niccolò (mar,mer,ven), nessuna assegnazione -> 12 slot totali", () => {
    const bookedDays = [
      { kidId: "sofia", kidName: "Sofia", dates: ["2026-06-01", "2026-06-02", "2026-06-04"] },
      { kidId: "niccolo", kidName: "Niccolò", dates: ["2026-06-02", "2026-06-03", "2026-06-05"] },
    ];
    const result = computeRolesToCover(WEEK_START, bookedDays, []);
    expect(result.hasBookedDays).toBe(true);
    expect(result.totalSlots).toBe(12);
    expect(result.assignedSlots).toBe(0);
    expect(result.missingSlots).toBe(12);
  });

  // "Il martedì genera QUATTRO slot distinti: Sofia Andata, Sofia Ritorno,
  // Niccolò Andata, Niccolò Ritorno. NON deduplicare per giorno della
  // famiglia."
  test("PLN11-T02 - martedì (condiviso da Sofia e Niccolò) genera 4 slot distinti, non deduplicati", () => {
    const bookedDays = [
      { kidId: "sofia", kidName: "Sofia", dates: ["2026-06-01", "2026-06-02", "2026-06-04"] },
      { kidId: "niccolo", kidName: "Niccolò", dates: ["2026-06-02", "2026-06-03", "2026-06-05"] },
    ];
    const result = computeRolesToCover(WEEK_START, bookedDays, []);
    const tuesdaySlots = result.missing.filter((s) => s.weekday === "mar");
    expect(tuesdaySlots).toHaveLength(4);
    const keys = new Set(tuesdaySlots.map((s) => `${s.kidId}__${s.moment}`));
    expect(keys).toEqual(new Set(["sofia__andata", "sofia__ritorno", "niccolo__andata", "niccolo__ritorno"]));
  });

  // "Una responsibility assegnata a Sofia/martedì/Andata NON deve
  // influenzare Niccolò/martedì/Andata" — non-interferenza cross-bambino.
  test("PLN11-T03 - assegnare Sofia/martedì/Andata non tocca Niccolò/martedì/Andata (non-interferenza cross-bambino)", () => {
    const bookedDays = [
      { kidId: "sofia", kidName: "Sofia", dates: ["2026-06-01", "2026-06-02", "2026-06-04"] },
      { kidId: "niccolo", kidName: "Niccolò", dates: ["2026-06-02", "2026-06-03", "2026-06-05"] },
    ];
    const responsibilities = [resp("sofia", "mar", "andata")];
    const result = computeRolesToCover(WEEK_START, bookedDays, responsibilities);
    expect(result.assignedSlots).toBe(1);
    expect(result.missingSlots).toBe(11);
    // Niccolò/martedì/Andata deve restare fra i mancanti.
    expect(
      result.missing.some((s) => s.kidId === "niccolo" && s.weekday === "mar" && s.moment === "andata")
    ).toBe(true);
    // Sofia/martedì/Andata invece non deve più comparire fra i mancanti.
    expect(
      result.missing.some((s) => s.kidId === "sofia" && s.weekday === "mar" && s.moment === "andata")
    ).toBe(false);
  });

  // Quando tutti gli slot di un bambino sono assegnati, missingSlots === 0
  // — condizione che la UI usa per mostrare lo stato positivo
  // "Accompagnamenti organizzati" invece dell'elenco "da organizzare".
  test("PLN11-T04 - tutti gli slot assegnati -> missingSlots 0 (stato 'Accompagnamenti organizzati')", () => {
    const bookedDays = [{ kidId: "sofia", kidName: "Sofia", dates: ["2026-06-01"] }];
    const responsibilities = [resp("sofia", "lun", "andata"), resp("sofia", "lun", "ritorno")];
    const result = computeRolesToCover(WEEK_START, bookedDays, responsibilities);
    expect(result.totalSlots).toBe(2);
    expect(result.assignedSlots).toBe(2);
    expect(result.missingSlots).toBe(0);
  });

  // Nessun child-day realmente prenotato questa settimana -> hasBookedDays
  // false: la UI non deve mostrare affatto il blocco "Organizzazione" (né
  // uno stato "0 da organizzare" come alert dominante).
  test("PLN11-T05 - nessun child-day prenotato -> hasBookedDays false, totalSlots 0", () => {
    const result = computeRolesToCover(WEEK_START, [], []);
    expect(result.hasBookedDays).toBe(false);
    expect(result.totalSlots).toBe(0);
    expect(result.missingSlots).toBe(0);
  });

  // Una responsibility della stessa combinazione kid/weekday/moment ma per
  // un'ALTRA settimana non deve contare come assegnata qui — lo scoping per
  // weekStartDate deve essere rispettato.
  test("PLN11-T06 - una responsibility di un'altra settimana non conta come assegnata", () => {
    const bookedDays = [{ kidId: "sofia", kidName: "Sofia", dates: ["2026-06-01"] }];
    const otherWeekResp: WeekResponsibility = { ...resp("sofia", "lun", "andata"), weekStartDate: "2026-06-08" };
    const result = computeRolesToCover(WEEK_START, bookedDays, [otherWeekResp]);
    expect(result.assignedSlots).toBe(0);
    expect(result.missingSlots).toBe(2);
  });

  // Difesa: una data booked fuori dai 5 giorni feriali della settimana
  // target (non dovrebbe accadere per costruzione lato dominio, ma la
  // funzione deve ignorarla invece di generare slot fantasma) non deve
  // gonfiare totalSlots.
  test("PLN11-T07 - una data booked fuori dai 5 giorni feriali della settimana viene ignorata (nessuno slot fantasma)", () => {
    const bookedDays = [
      { kidId: "sofia", kidName: "Sofia", dates: ["2026-06-01", "2026-06-06"] }, // 06-06 = sabato, fuori range
    ];
    const result = computeRolesToCover(WEEK_START, bookedDays, []);
    expect(result.totalSlots).toBe(2); // solo lunedì × {andata, ritorno}
  });

  // byMoment deve riflettere correttamente assegnato/mancante PER momento
  // (Andata e Ritorno contati separatamente) — usato dalla UI per mostrare
  // "Andata ✓N assegnate !M da organizzare / Ritorno ✓N assegnati !M da
  // organizzare".
  test("PLN11-T08 - byMoment conta assegnato/mancante separatamente per Andata e Ritorno", () => {
    const bookedDays = [{ kidId: "sofia", kidName: "Sofia", dates: ["2026-06-01", "2026-06-02"] }];
    // Assegna solo le due Andate, nessun Ritorno.
    const responsibilities = [resp("sofia", "lun", "andata"), resp("sofia", "mar", "andata")];
    const result = computeRolesToCover(WEEK_START, bookedDays, responsibilities);
    expect(result.byMoment.andata).toEqual({ assigned: 2, missing: 0 });
    expect(result.byMoment.ritorno).toEqual({ assigned: 0, missing: 2 });
  });
});
