import { test, expect } from "@playwright/test";
import { SEASON_TOTAL_WEEKS, getSeasonWeekRanges, isoDate } from "../../lib/season-weeks";

// Segnalazione 24/08/2026 (Fabrizio) — unit test puri per lib/season-weeks.ts,
// stesso principio "no browser" già usato in tests/one/spotlight-position.spec.ts:
// nessun "page" fixture, funzioni pure eseguite direttamente, eseguibili in
// qualunque ambiente Node incluso il sandbox Claude (nessun browser reale
// disponibile).
//
// Bug reale: una prenotazione a giorni per la settimana del 31/08/2026 non
// appariva nella barra di copertura del Planner. Causa: con
// SEASON_TOTAL_WEEKS=13 e partenza dal primo lunedì di giugno, la griglia
// 2026 finiva il 28/08 — un mese prima di "metà settembre", nonostante il
// commento di lib/season-weeks.ts dichiarasse esplicitamente quella copertura.
// Portato a 16 settimane (la settimana 16 è la prima a includere il 15
// settembre).
//
// Comando: npx playwright test tests/one/season-weeks.spec.ts

test.describe("season-weeks — SEASON_TOTAL_WEEKS [no browser]", () => {
  test("copre davvero fino a metà settembre (include il 15 settembre)", () => {
    const ranges = getSeasonWeekRanges(2026);
    expect(ranges.length).toBe(SEASON_TOTAL_WEEKS);
    const midSeptember = "2026-09-15";
    const coversMidSeptember = ranges.some(
      (r) => isoDate(r.start) <= midSeptember && midSeptember <= isoDate(r.end)
    );
    expect(coversMidSeptember).toBe(true);
  });

  test("include la settimana del 31/08/2026 (bug reale segnalato da Fabrizio)", () => {
    const ranges = getSeasonWeekRanges(2026);
    const bookedWeekStart = "2026-08-31";
    const bookedWeekEnd = "2026-09-04";
    const match = ranges.find(
      (r) => isoDate(r.start) === bookedWeekStart && isoDate(r.end) === bookedWeekEnd
    );
    expect(match).toBeDefined();
  });

  test("non si estende oltre inizio ottobre (nessuna settimana su dati [TEST]/demo)", () => {
    const ranges = getSeasonWeekRanges(2026);
    const last = ranges[ranges.length - 1];
    expect(isoDate(last.end) <= "2026-09-30").toBe(true);
  });

  test("prima settimana parte sempre da un lunedì", () => {
    const ranges = getSeasonWeekRanges(2026);
    expect(ranges[0].start.getUTCDay()).toBe(1); // 1 = lunedì
  });
});
