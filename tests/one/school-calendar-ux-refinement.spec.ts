import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { deriveCurrentAcademicYear } from "../../lib/school-calendar/academic-year";
import { computeWeekClosureDetail, describePartialClosure, datesInRange } from "../../lib/school-calendar/need-core";

// TRAMA — SCHOOL CALENDAR UX REFINEMENT (14/09/2026, §35-36). Stesso
// principio "[no browser]" di tests/one/calendar-export.spec.ts: unit test
// puri sulle funzioni core + verifica statica del codice sorgente per i call
// site che non è pratico/sicuro esercitare con un browser live in questa
// sessione (nessun Playwright live run eseguito contro produzione/staging —
// solo `npx playwright test` locale, stesso comando già usato per l'intera
// suite "[no browser]" preesistente).
//
// Comando: npx playwright test tests/one/school-calendar-ux-refinement.spec.ts

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf-8");
}

test.describe("TRAMA — §15 Academic year: deriveCurrentAcademicYear [no browser]", () => {
  test("AY-01: settembre → anno appena iniziato (2026/2027)", () => {
    expect(deriveCurrentAcademicYear("2026-09-14")).toEqual({ stored: "2026/2027", short: "2026/27" });
  });

  test("AY-02: dicembre → stesso anno scolastico di settembre", () => {
    expect(deriveCurrentAcademicYear("2026-12-20")).toEqual({ stored: "2026/2027", short: "2026/27" });
  });

  test("AY-03: gennaio → ancora l'anno scolastico iniziato l'anno civile precedente", () => {
    expect(deriveCurrentAcademicYear("2027-01-10")).toEqual({ stored: "2026/2027", short: "2026/27" });
  });

  test("AY-04: agosto → ultimo mese dell'anno scolastico che sta per finire", () => {
    expect(deriveCurrentAcademicYear("2027-08-31")).toEqual({ stored: "2026/2027", short: "2026/27" });
  });

  test("AY-05: 1° settembre → già il nuovo anno scolastico (confine esatto)", () => {
    expect(deriveCurrentAcademicYear("2027-09-01")).toEqual({ stored: "2027/2028", short: "2027/28" });
  });
});

test.describe("TRAMA — §6 Partial closures: computeWeekClosureDetail/describePartialClosure [no browser]", () => {
  const week = { startDate: "2026-11-02", endDate: "2026-11-06", covered: false, dismissed: false };

  test("PC-01: nessun giorno chiuso → detail vuoto, describePartialClosure null", () => {
    const detail = computeWeekClosureDetail(week, []);
    expect(detail).toEqual({ closedWeekdaysCount: 0, totalWeekdays: 5, closedWeekdays: [] });
    expect(describePartialClosure(detail)).toBeNull();
  });

  test("PC-02: 1 giorno chiuso (ponte) → 'Scuola chiusa {ggg} {d}'", () => {
    const closures = [{ startDate: "2026-11-02", endDate: "2026-11-02", kind: "bridge" as const, label: "Ponte" }];
    const detail = computeWeekClosureDetail(week, closures);
    expect(detail.closedWeekdaysCount).toBe(1);
    expect(describePartialClosure(detail)).toBe("Scuola chiusa lun 2");
  });

  test("PC-03: 3 giorni chiusi su 5 → '{n} giorni senza scuola'", () => {
    const closures = [{ startDate: "2026-11-04", endDate: "2026-11-06", kind: "regional_closure" as const, label: "Chiusura regionale" }];
    const detail = computeWeekClosureDetail(week, closures);
    expect(detail.closedWeekdaysCount).toBe(3);
    expect(describePartialClosure(detail)).toBe("3 giorni senza scuola");
  });

  test("PC-04: 5/5 giorni chiusi → describePartialClosure null (segnale primario già sufficiente, nessuna duplicazione)", () => {
    const closures = [{ startDate: "2026-11-02", endDate: "2026-11-06", kind: "christmas_break" as const, label: "Vacanze" }];
    const detail = computeWeekClosureDetail(week, closures);
    expect(detail.closedWeekdaysCount).toBe(5);
    expect(describePartialClosure(detail)).toBeNull();
  });

  test("PC-05: datesInRange resta lun-ven per una SeasonWeek reale (nessun weekend nel conteggio)", () => {
    expect(datesInRange(week.startDate, week.endDate)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
    ]);
  });
});

test.describe("TRAMA — §3 Planner hierarchy [no browser, static source]", () => {
  test("HIER-01: SchoolCalendarOnboardingCallout è montato DOPO 'Vedi tutte le settimane' e PRIMA di 'Calendario e Chi fa cosa?'", () => {
    const source = readSource("../../app/nextgen/planner/PlannerClient.tsx");
    // "Vedi tutte le settimane" compare anche nel bottone toggle (riga) e in
    // commenti — usiamo l'ultima occorrenza del bottone reale come ancora, e
    // cerchiamo l'intestazione "Calendario e Chi fa cosa?" SOLO a partire dal
    // callout (un commento più in alto nel file la nomina già, prima ancora
    // che esista il bottone: non è quello l'anchor che conta qui).
    const seeAllIndex = source.indexOf('{timelineOpen ? "Nascondi elenco completo" : "Vedi tutte le settimane"}');
    const calloutIndex = source.indexOf("<SchoolCalendarOnboardingCallout");
    const calendarSectionIndex = source.indexOf("Calendario e Chi fa cosa", calloutIndex);
    expect(seeAllIndex).toBeGreaterThan(-1);
    expect(calloutIndex).toBeGreaterThan(seeAllIndex);
    expect(calendarSectionIndex).toBeGreaterThan(calloutIndex);
  });

  test("HIER-02: PlannerCalendarExportCard NON è più montato in cima al Planner (prima card dopo PlannerModeTabs)", () => {
    const source = readSource("../../app/nextgen/planner/PlannerClient.tsx");
    const tabsIndex = source.indexOf("<PlannerModeTabs");
    const exportIndex = source.indexOf("<PlannerCalendarExportCard");
    const calendarViewIndex = source.indexOf("<PlannerCalendarView");
    expect(tabsIndex).toBeGreaterThan(-1);
    expect(exportIndex).toBeGreaterThan(-1);
    // §7-8: ora dentro "Calendario e Chi fa cosa?", dopo la vista calendario —
    // non più subito dopo i tab (posizione originale pre-refinement).
    expect(exportIndex).toBeGreaterThan(calendarViewIndex);
  });
});

test.describe("TRAMA — §17-28 Global CTA Progress [no browser, static source]", () => {
  test("PROG-01: il provider è montato in app/nextgen/layout.tsx", () => {
    const source = readSource("../../app/nextgen/layout.tsx");
    expect(source).toContain("GlobalActionProgressProvider");
  });

  test("PROG-02: le 4 CTA esplicitamente wired chiamano start()/complete() attorno alla Server Action reale", () => {
    const calloutSource = readSource("../../components/nextgen/SchoolCalendarOnboardingCallout.tsx");
    expect(calloutSource).toContain("useGlobalActionProgress");
    expect(calloutSource).toContain("setSchoolContextForFamilyAction");

    const profileKidsSource = readSource("../../components/ProfileKidsSection.tsx");
    expect(profileKidsSource).toContain("useGlobalActionProgress");

    const addKidSource = readSource("../../components/AddKidForm.tsx");
    expect(addKidSource).toContain("useGlobalActionProgress");
    expect(addKidSource).toContain("startProgress();");

    const plannerSource = readSource("../../app/nextgen/planner/PlannerClient.tsx");
    expect(plannerSource).toContain("useGlobalActionProgress");
  });

  test("PROG-03: il componente non forza mai il completamento automatico al 100% (solo complete() esplicito)", () => {
    const source = readSource("../../components/GlobalActionProgress.tsx");
    // Nessuna chiamata automatica a complete()/setProgress(100) fuori dalla
    // funzione complete stessa — il contatore pending governa sempre lo stato.
    expect(source).toContain("pendingCountRef");
  });

  test("PROG-04: rispetta prefers-reduced-motion (nessuna animazione forzata)", () => {
    const css = readSource("../../app/globals.css");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("trama-progress-fill");
  });
});
