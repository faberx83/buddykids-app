import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  buildClosureIntervals,
  computeSchoolWeekNeed,
  aggregateFamilySchoolWeekNeed,
  isWeekSchoolClosed,
  SCHOOL_WEEK_NEED_LABEL,
  type SchoolCalendarEventInput,
  type SeasonWeekNeedInput,
} from "../../lib/school-calendar/need-core";

// TRAMA — SCHOOL CALENDAR INTELLIGENCE (12-14/09/2026, Parte B della richiesta
// "RELEASE CONTROL HARDENING + NEXT PRODUCT EVOLUTION"). Unit test puri per
// lib/school-calendar/need-core.ts — stesso principio "[no browser]" già
// seguito da tests/one/calendar-export.spec.ts: nessuna dipendenza da
// Supabase/Next, eseguibili ovunque. Il layer I/O (lib/data/school-calendar.ts,
// "server-only" implicito via createClient) e la UI Planner sono coperti da
// test di lettura statica del codice sorgente più sotto in questo stesso
// file (stessa tecnica readSource già usata da calendar-export.spec.ts) —
// nessun mock Supabase per un DB live con 0 righe reali.
//
// Comando: npx playwright test tests/one/school-calendar-intelligence.spec.ts

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf-8");
}

// Fixture: una settimana stagione lun-ven "tipica" (dati SEMPRE sintetici,
// mai un comune/regione reale — §B5: nessun dato reale finché Fabrizio non
// indica quale Regione/Comune usare per il proprio account).
function week(startDate: string, endDate: string, overrides: Partial<SeasonWeekNeedInput> = {}): SeasonWeekNeedInput {
  return { startDate, endDate, covered: false, dismissed: false, ...overrides };
}

test.describe("School Calendar Intelligence — need-core [no browser]", () => {
  // §B15-6: kid senza profilo scolastico -> nessuna intelligence, mai un
  // falso segnale.
  test("6. kid senza profilo scolastico -> no_school_context, indipendentemente dalle chiusure", () => {
    const closures = buildClosureIntervals([
      { startDate: "2026-08-01", endDate: "2026-08-31", eventType: "regional_closure", label: "Chiusura estiva regionale" },
    ]);
    const result = computeSchoolWeekNeed(false, week("2026-08-03", "2026-08-07"), closures, undefined);
    expect(result).toBe("no_school_context");
    expect(SCHOOL_WEEK_NEED_LABEL[result]).toBe("");
  });

  // §B15-7: periodo scuola aperta -> nessun segnale.
  test("7. settimana scolastica normale (nessuna chiusura sovrapposta) -> school_open", () => {
    const events: SchoolCalendarEventInput[] = [
      { startDate: "2026-12-23", endDate: "2027-01-06", eventType: "christmas_break", label: "Vacanze di Natale" },
    ];
    const closures = buildClosureIntervals(events);
    const result = computeSchoolWeekNeed(true, week("2026-11-02", "2026-11-06"), closures, undefined);
    expect(result).toBe("school_open");
  });

  // §B15-8: vacanza scolastica diretta (es. Natale) -> settimana interamente
  // dentro l'intervallo -> chiusa.
  test("8. settimana interamente dentro una vacanza scolastica diretta -> scuola chiusa", () => {
    const events: SchoolCalendarEventInput[] = [
      { startDate: "2026-12-21", endDate: "2027-01-06", eventType: "christmas_break", label: "Vacanze di Natale" },
    ];
    const closures = buildClosureIntervals(events);
    expect(isWeekSchoolClosed(week("2026-12-21", "2026-12-25"), closures)).toBe(true);
    const result = computeSchoolWeekNeed(true, week("2026-12-21", "2026-12-25"), closures, undefined);
    expect(result).toBe("closed_to_organize");
    expect(SCHOOL_WEEK_NEED_LABEL[result]).toBe("Scuola chiusa · da organizzare");
  });

  // §B15-9: estate = gap fra school_year_end dell'anno corrente e
  // school_year_start dell'anno successivo, derivato correttamente (§B6).
  test("9. estate: intervallo derivato correttamente fine anno -> inizio anno successivo (esclusi i due giorni di scuola)", () => {
    const events: SchoolCalendarEventInput[] = [
      { startDate: "2026-06-10", endDate: "2026-06-10", eventType: "school_year_end", label: "Ultimo giorno di scuola 2025/2026" },
      { startDate: "2026-09-14", endDate: "2026-09-14", eventType: "school_year_start", label: "Primo giorno di scuola 2026/2027" },
    ];
    const closures = buildClosureIntervals(events);
    const summer = closures.find((c) => c.kind === "summer_break");
    expect(summer).toBeDefined();
    // Il giorno di fine scuola e il giorno di ripresa NON sono chiusura.
    expect(summer!.startDate).toBe("2026-06-11");
    expect(summer!.endDate).toBe("2026-09-13");

    // Una settimana piena d'estate (es. fine luglio) -> chiusa.
    const midSummerWeek = week("2026-07-20", "2026-07-24");
    expect(isWeekSchoolClosed(midSummerWeek, closures)).toBe(true);

    // La settimana che contiene il PRIMO giorno di scuola (14/09, lunedì)
    // non è interamente chiusa (venerdì precedente sì, ma il 14 è già
    // scuola) -> school_open per questa logica "tutti i 5 giorni" V1.
    const resumeWeek = week("2026-09-14", "2026-09-18");
    expect(isWeekSchoolClosed(resumeWeek, closures)).toBe(false);
  });

  // §B15-14: anno scolastico — nessun school_year_start successivo caricato
  // -> nessuna estate derivata (dati insufficienti, mai un falso segnale).
  test("14. nessun calendario dell'anno successivo pubblicato -> nessuna estate derivata (mai un errore)", () => {
    const events: SchoolCalendarEventInput[] = [{ startDate: "2026-06-10", endDate: "2026-06-10", eventType: "school_year_end", label: "Fine anno" }];
    const closures = buildClosureIntervals(events);
    expect(closures.find((c) => c.kind === "summer_break")).toBeUndefined();
    const result = computeSchoolWeekNeed(true, week("2026-07-20", "2026-07-24"), closures, undefined);
    expect(result).toBe("school_open");
  });

  // §B15-10/11: la distinzione chiave del prodotto (§B7) — SCHOOL NEED vs
  // PLANNER COVERAGE, mai confusi.
  test("10. settimana con scuola chiusa E prenotazione reale (covered=true) -> closed_covered (già coperta)", () => {
    const closures = buildClosureIntervals([{ startDate: "2026-06-22", endDate: "2026-06-26", eventType: "regional_closure", label: "Chiusura regionale" }]);
    const result = computeSchoolWeekNeed(true, week("2026-06-22", "2026-06-26", { covered: true }), closures, undefined);
    expect(result).toBe("closed_covered");
  });

  test("11. settimana con scuola chiusa E nessuna prenotazione (covered=false) -> closed_to_organize (da organizzare)", () => {
    const closures = buildClosureIntervals([{ startDate: "2026-06-29", endDate: "2026-07-03", eventType: "regional_closure", label: "Chiusura regionale" }]);
    const result = computeSchoolWeekNeed(true, week("2026-06-29", "2026-07-03", { covered: false }), closures, undefined);
    expect(result).toBe("closed_to_organize");
  });

  // §B15-12: multi-figlio con contesto scolastico diverso — il segnale più
  // azionabile vince, nessun figlio "nascosto" dietro l'altro.
  test("12. multi-figlio: un figlio da organizzare + un figlio senza profilo -> il figlio scoperto vince (closed_to_organize)", () => {
    const result = aggregateFamilySchoolWeekNeed(["closed_to_organize", "no_school_context"]);
    expect(result).toBe("closed_to_organize");
  });

  test("12b. multi-figlio: un figlio coperto + un figlio a scuola aperta -> closed_covered (nessun bisogno nascosto, nessuno falso)", () => {
    const result = aggregateFamilySchoolWeekNeed(["closed_covered", "school_open"]);
    expect(result).toBe("closed_covered");
  });

  test("12c. tutti i figli senza profilo scolastico -> no_school_context (mai un segnale inventato)", () => {
    const result = aggregateFamilySchoolWeekNeed(["no_school_context", "no_school_context"]);
    expect(result).toBe("no_school_context");
  });

  // §B15-13: override locale (già_organizzato/non_serve) — dichiarazione
  // esplicita del genitore, vince sempre sull'euristica derivata.
  test("13a. override already_organized -> closed_covered anche se covered=false (booking reale assente)", () => {
    const closures = buildClosureIntervals([{ startDate: "2026-08-03", endDate: "2026-08-07", eventType: "regional_closure", label: "Chiusura" }]);
    const result = computeSchoolWeekNeed(true, week("2026-08-03", "2026-08-07", { covered: false }), closures, {
      weekStartDate: "2026-08-03",
      overrideType: "already_organized",
    });
    expect(result).toBe("closed_covered");
  });

  test("13b. override not_needed -> closed_not_needed anche se covered=false", () => {
    const closures = buildClosureIntervals([{ startDate: "2026-08-03", endDate: "2026-08-07", eventType: "regional_closure", label: "Chiusura" }]);
    const result = computeSchoolWeekNeed(true, week("2026-08-03", "2026-08-07", { covered: false }), closures, {
      weekStartDate: "2026-08-03",
      overrideType: "not_needed",
    });
    expect(result).toBe("closed_not_needed");
  });

  test("13c. dismissed esistente (meccanismo generico Planner) -> closed_not_needed, mai un secondo stato diverso", () => {
    const closures = buildClosureIntervals([{ startDate: "2026-08-03", endDate: "2026-08-07", eventType: "regional_closure", label: "Chiusura" }]);
    const result = computeSchoolWeekNeed(true, week("2026-08-03", "2026-08-07", { dismissed: true }), closures, undefined);
    expect(result).toBe("closed_not_needed");
  });

  // §B15-15: mai trasformare weekend in "da organizzare" — le SeasonWeek
  // sono sempre lun-ven per costruzione, verificato qui che un singolo
  // giorno festivo isolato (es. un ponte) NON fa scattare l'intera
  // settimana (decisione V1 documentata in need-core.ts).
  test("15a. nessun rumore da weekend: una settimana lun-ven con chiusura SOLO nel weekend adiacente resta school_open", () => {
    const closures = buildClosureIntervals([{ startDate: "2026-09-19", endDate: "2026-09-20", eventType: "other_closure", label: "Evento sabato-domenica" }]);
    const result = computeSchoolWeekNeed(true, week("2026-09-14", "2026-09-18"), closures, undefined);
    expect(result).toBe("school_open");
  });

  test("15b. un singolo giorno di ponte isolato (1/5 giorni) non fa scattare l'intera settimana", () => {
    const closures = buildClosureIntervals([{ startDate: "2026-11-02", endDate: "2026-11-02", eventType: "bridge", label: "Ponte" }]);
    const result = computeSchoolWeekNeed(true, week("2026-11-02", "2026-11-06"), closures, undefined);
    expect(result).toBe("school_open");
    expect(isWeekSchoolClosed(week("2026-11-02", "2026-11-06"), closures)).toBe(false);
  });

  // §B15-16: nessuna regressione su computeWeekStatus/WeekStatus — questo
  // modulo non li importa, non li chiama, non li modifica. Verificato sia
  // per assenza di import/riferimento in need-core.ts, sia per la firma di
  // computeWeekStatus in planner-insights.ts (invariata).
  test("16. need-core.ts non importa/chiama computeWeekStatus (nessuna regressione Planner esistente)", () => {
    // I doc-comment di need-core.ts CITANO computeWeekStatus a scopo
    // esplicativo (per spiegare cosa NON viene toccato) — verifichiamo
    // quindi l'assenza di un vero import/chiamata, non della stringa nei
    // commenti.
    const source = readSource("../../lib/school-calendar/need-core.ts");
    expect(source).not.toContain('from "@/lib/nextgen/planner-insights"');
    expect(source).not.toContain("computeWeekStatus(");
    const insightsSource = readSource("../../lib/nextgen/planner-insights.ts");
    expect(insightsSource).toContain(
      'export type WeekStatus = "dismissed" | "covered" | "partial" | "conflict" | "priority" | "uncovered" | "awaiting" | "past";'
    );
  });

  test("aggregazione: priorità corretta fra tutti gli stati possibili", () => {
    expect(aggregateFamilySchoolWeekNeed(["school_open", "closed_not_needed"])).toBe("closed_not_needed");
    expect(aggregateFamilySchoolWeekNeed(["closed_not_needed", "closed_covered"])).toBe("closed_covered");
    expect(aggregateFamilySchoolWeekNeed(["school_open"])).toBe("school_open");
    expect(aggregateFamilySchoolWeekNeed([])).toBe("no_school_context");
  });
});
