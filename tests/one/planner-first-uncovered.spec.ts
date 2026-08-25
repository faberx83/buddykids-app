import { test, expect } from "@playwright/test";
import { firstUncoveredWeekIndex } from "../../lib/data/planner";

// Segnalazione 24/08/2026 (Fabrizio) — unit test puri per
// lib/data/planner.ts#firstUncoveredWeekIndex, stesso principio "no browser"
// già usato in tests/one/spotlight-position.spec.ts e
// tests/one/season-weeks.spec.ts: nessun "page" fixture, funzione pura
// eseguita direttamente, senza mock di Supabase.
//
// Bug reale: Scopri (/nextgen/search) mostrava "priorità a chi è libero in
// GIU 1-5" con oggi già al 24/08 — settimane ormai passate. Causa:
// firstUncoveredIndex non escludeva le settimane trascorse.
//
// Comando: npx playwright test tests/one/planner-first-uncovered.spec.ts

function week(index: number, covered: boolean, dismissed: boolean, endDate: string) {
  return { index, covered, dismissed, endDate };
}

test.describe("planner — firstUncoveredWeekIndex [no browser]", () => {
  test("ignora le settimane scoperte ma già trascorse (bug reale segnalato)", () => {
    const todayIso = "2026-08-24";
    const weeks = [
      week(1, false, false, "2026-06-05"), // scoperta, ma passata
      week(2, false, false, "2026-06-12"), // scoperta, ma passata
      week(13, false, false, "2026-08-28"), // scoperta, ancora in corso/futura
      week(14, false, false, "2026-09-04"),
    ];
    expect(firstUncoveredWeekIndex(weeks, todayIso)).toBe(13);
  });

  test("una settimana coperta o 'non mi serve' non conta, anche se futura", () => {
    const todayIso = "2026-08-24";
    const weeks = [
      week(13, true, false, "2026-08-28"),
      week(14, false, true, "2026-09-04"), // dismissed
      week(15, false, false, "2026-09-11"),
    ];
    expect(firstUncoveredWeekIndex(weeks, todayIso)).toBe(15);
  });

  test("nessuna settimana scoperta/non passata -> null", () => {
    const todayIso = "2026-08-24";
    const weeks = [
      week(1, false, false, "2026-06-05"),
      week(2, true, false, "2026-06-12"),
    ];
    expect(firstUncoveredWeekIndex(weeks, todayIso)).toBeNull();
  });

  test("una settimana IN CORSO oggi (endDate == todayIso) conta ancora come valida", () => {
    const todayIso = "2026-08-28";
    const weeks = [week(13, false, false, "2026-08-28")];
    expect(firstUncoveredWeekIndex(weeks, todayIso)).toBe(13);
  });
});
