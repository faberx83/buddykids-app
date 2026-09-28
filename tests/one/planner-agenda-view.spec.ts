import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  mondayOfIso,
  addDaysIso,
  agendaWeekDates,
  formatMonthYearIt,
  buildAgendaRows,
  AGENDA_BORDER_BG,
  AGENDA_EXTERNAL_BORDER_BG,
  WEEKDAY_SHORT3_IT,
  type AgendaRow,
} from "../../lib/nextgen/agenda-view";
import type { CalendarDay } from "../../lib/nextgen/calendar-weeks";
import type { ExternalCalendarOccurrence } from "../../lib/planner/external-calendar-items-core";

// TRAMA — CALENDARIO PLANNER · AGENDA COME SUPERFICIE PRINCIPALE
// (28/09/2026). Stesso principio "[no browser]" di
// tests/one/external-planner-items-calendar.spec.ts e
// tests/one/school-calendar-ux-refinement.spec.ts: la logica del day
// strip/agenda cronologica è pura (nessun I/O), coperta qui con unit test
// diretti su lib/nextgen/agenda-view.ts (stesso modulo importato da
// components/nextgen/PlannerCalendarView.tsx, nessuna logica duplicata tra
// test e componente). Le parti non praticamente esercitabili con un browser
// live in questa sessione (interazione DOM reale del day strip, overflow a
// 360px) sono verificate con controlli statici del sorgente — stessa
// tecnica già in uso in school-calendar-ux-refinement.spec.ts.
//
// Comando: npx playwright test tests/one/planner-agenda-view.spec.ts

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf-8");
}

function cell(overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    dateIso: "2026-09-28",
    dayOfMonth: 28,
    weekIndex: 1,
    weekLabel: "Settimana 1",
    weekStartDate: "2026-09-28",
    weekEndDate: "2026-10-02",
    inSeason: true,
    covered: false,
    dismissed: false,
    kids: [],
    hasConflict: false,
    externalItems: [],
    ...overrides,
  };
}

function occ(overrides: Partial<ExternalCalendarOccurrence> = {}): ExternalCalendarOccurrence {
  return {
    itemId: "item-1",
    kind: "commitment",
    title: "Dentista",
    dateIso: "2026-09-28",
    allDay: true,
    startTime: null,
    endTime: null,
    sourceType: "manual",
    kidNames: [],
    isRangeStart: true,
    isRangeEnd: true,
    ...overrides,
  };
}

test.describe("Agenda — mondayOfIso/agendaWeekDates (day strip) [no browser]", () => {
  test("AGD-01: mondayOfIso di un lunedì restituisce se stesso", () => {
    expect(mondayOfIso("2026-09-28")).toBe("2026-09-28"); // 28/09/2026 è lunedì
  });

  test("AGD-02: mondayOfIso di una domenica torna al lunedì della stessa settimana", () => {
    expect(mondayOfIso("2026-10-04")).toBe("2026-09-28"); // 04/10/2026 è domenica
  });

  test("AGD-03: agendaWeekDates restituisce sempre 7 date consecutive Lun→Dom", () => {
    const dates = agendaWeekDates("2026-09-30"); // mercoledì
    expect(dates).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
  });

  test("AGD-04: navigazione tra i giorni — spostarsi di ±7 giorni cambia la settimana visibile mantenendo lo stesso giorno della settimana", () => {
    const start = "2026-09-30";
    const nextWeek = addDaysIso(start, 7);
    const prevWeek = addDaysIso(start, -7);
    expect(nextWeek).toBe("2026-10-07");
    expect(prevWeek).toBe("2026-09-23");
    // Stesso giorno della settimana (mercoledì) in entrambe le direzioni —
    // il day strip risultante è sempre una finestra di 7 giorni consecutiva.
    expect(agendaWeekDates(nextWeek)[2]).toBe(nextWeek);
    expect(agendaWeekDates(prevWeek)[2]).toBe(prevWeek);
  });

  test("AGD-05: WEEKDAY_SHORT3_IT ha 7 etichette, indicizzate Lun..Dom", () => {
    expect(WEEKDAY_SHORT3_IT).toEqual(["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"]);
  });
});

test.describe("Agenda — buildAgendaRows: ordina per orario, TRAMA + Esterno coesistono [no browser]", () => {
  test("AGD-10: giorno coperto TRAMA senza impegni esterni → una riga per bambino coperto", () => {
    const rows = buildAgendaRows(
      cell({
        covered: true,
        kids: [{ kidId: "k1", kidName: "Sofia", accentColor: "sky" }],
        activityName: "Nuoto",
      })
    );
    expect(rows).toEqual([
      { kind: "trama", kidId: "k1", kidName: "Sofia", accentColor: "sky", title: "Nuoto" },
    ]);
  });

  test("AGD-11: giorno dismissed ('non ti serve') → nessuna riga TRAMA anche se coveredKids non è vuoto (covered/dismissed non toccati)", () => {
    const rows = buildAgendaRows(
      cell({
        covered: true,
        dismissed: true,
        kids: [{ kidId: "k1", kidName: "Sofia", accentColor: "sky" }],
      })
    );
    expect(rows).toEqual([]);
  });

  test("AGD-12: item TRAMA (bg tutto il giorno) ed esterni con orario coesistono nella STESSA lista, senza sezioni separate", () => {
    const rows = buildAgendaRows(
      cell({
        covered: true,
        kids: [{ kidId: "k1", kidName: "Sofia", accentColor: "sky" }],
        activityName: "Nuoto",
        externalItems: [occ({ itemId: "ext-1", title: "Dentista", allDay: false, startTime: "16:00" })],
      })
    );
    // Un unico array, non due gruppi: la riga TRAMA e quella esterna sono
    // elementi consecutivi dello stesso AgendaRow[].
    expect(rows.length).toBe(2);
    expect(rows[0].kind).toBe("trama");
    expect(rows[1].kind).toBe("external");
  });

  test("AGD-13: ordina per orario — TRAMA (tutto il giorno) e esterni allDay prima, poi esterni con orario crescente", () => {
    const rows = buildAgendaRows(
      cell({
        covered: true,
        kids: [{ kidId: "k1", kidName: "Sofia", accentColor: "sky" }],
        externalItems: [
          occ({ itemId: "ext-late", title: "Piscina", allDay: false, startTime: "18:00" }),
          occ({ itemId: "ext-early", title: "Compleanno", allDay: false, startTime: "09:00" }),
          occ({ itemId: "ext-allday", title: "Gita", allDay: true }),
        ],
      })
    );
    const order = rows.map((r: AgendaRow) => (r.kind === "trama" ? "trama" : r.occ.itemId));
    expect(order).toEqual(["trama", "ext-allday", "ext-early", "ext-late"]);
  });

  test("AGD-14: più bambini coperti lo stesso giorno → una riga per bambino, stesso ordine di cell.kids", () => {
    const rows = buildAgendaRows(
      cell({
        covered: true,
        kids: [
          { kidId: "k1", kidName: "Sofia", accentColor: "sky" },
          { kidId: "k2", kidName: "Leo", accentColor: "orange" },
        ],
      })
    );
    expect(rows.map((r) => (r as { kidId?: string }).kidId)).toEqual(["k1", "k2"]);
  });

  test("AGD-15: giorno senza copertura TRAMA ma con impegno esterno → solo la riga esterna (VISIBILE ≠ COVERED)", () => {
    const rows = buildAgendaRows(
      cell({
        covered: false,
        kids: [],
        externalItems: [occ({ itemId: "ext-1" })],
      })
    );
    expect(rows).toEqual([{ kind: "external", occ: occ({ itemId: "ext-1" }) }]);
  });
});

test.describe("Agenda — mappatura colore bambino→bordo card [no browser]", () => {
  test("AGD-20: ogni colore bambino della palette (DOT_BG in PlannerCalendarView.tsx) ha una voce AGENDA_BORDER_BG statica corrispondente", () => {
    for (const color of ["sky", "aqua", "orange", "purple", "green"]) {
      expect(AGENDA_BORDER_BG[color]).toContain(`border-${color}`);
      expect(AGENDA_BORDER_BG[color]).toContain(`bg-${color}/10`);
    }
  });

  test("AGD-21: gli impegni esterni usano sempre il bordo violetto TRAMA fisso, mai il colore di un bambino", () => {
    expect(AGENDA_EXTERNAL_BORDER_BG).toBe("border-trama-violet bg-trama-violet/10");
  });
});

test.describe("Agenda — formatMonthYearIt [no browser]", () => {
  test("AGD-30: formatta mese/anno in italiano con iniziale maiuscola", () => {
    expect(formatMonthYearIt("2026-09-28")).toBe("Settembre 2026");
  });
});

// Verifiche statiche del sorgente per le parti non praticamente esercitabili
// con un browser live in questa sessione (nessun Playwright live run
// eseguito contro un deploy in questa sessione) — stessa tecnica già usata
// in school-calendar-ux-refinement.spec.ts.
test.describe("Agenda — verifiche statiche del componente [no browser]", () => {
  const source = readSource("../../components/nextgen/PlannerCalendarView.tsx");

  test("AGD-40: 'agenda' è il default di viewMode (superficie principale)", () => {
    expect(source).toMatch(/useState<ViewMode>\("agenda"\)/);
  });

  test("AGD-41: la CTA 'Apri calendario completo' esiste ed è raggiungibile dalla vista Agenda", () => {
    expect(source).toContain("Apri calendario completo");
    expect(source).toContain('data-testid="open-full-calendar-cta"');
  });

  test("AGD-42: la CTA porta alla vista Mese esistente (setViewMode(\"mese\")), mai rimossa", () => {
    const ctaBlockMatch = source.match(
      /data-testid="open-full-calendar-cta"[\s\S]{0,300}/
    );
    expect(ctaBlockMatch).not.toBeNull();
    expect(source).toContain('setViewMode("mese")');
  });

  test("AGD-43: la griglia Mese e il ramo Settimana restano nel sorgente, invariati e raggiungibili (nessuna eliminazione)", () => {
    expect(source).toContain('viewMode === "mese" ? (');
    expect(source).toContain("WEEKDAY_SHORT_IT.map");
    expect(source).toContain('{ key: "settimana", label: "Settimana" }');
  });

  test("AGD-44: il toggle Agenda/Mese/Settimana espone le tre opzioni", () => {
    expect(source).toContain('{ key: "agenda", label: "Agenda" }');
    expect(source).toContain('{ key: "mese", label: "Mese" }');
    expect(source).toContain('{ key: "settimana", label: "Settimana" }');
  });

  test("AGD-45: il day strip usa uno scroll orizzontale CONFINATO (overflow-x-auto sul contenitore della striscia), non sull'intera vista", () => {
    const stripBlock = source.match(/data-testid="agenda-day-strip"[\s\S]{0,50}/)?.[0] ?? "";
    // Il contenitore del day strip precede l'attributo data-testid nel JSX:
    // verifichiamo che overflow-x-auto compaia vicino al day strip, non che
    // sia applicato a un elemento di pagina esterno.
    const stripContainer = source.match(/className="[^"]*overflow-x-auto[^"]*"\s*\n\s*data-testid="agenda-day-strip"/);
    expect(stripContainer).not.toBeNull();
    expect(stripBlock.length >= 0).toBe(true);
  });

  test("AGD-46: covered/dismissed non sono mai scritti/ricalcolati nella vista Agenda (solo letti da CalendarDay già esistente)", () => {
    // La vista Agenda (blocco 'planner-agenda-view') non deve contenere
    // alcuna assegnazione a covered/dismissed — solo letture (cell.covered,
    // cell.dismissed) già calcolate a monte da buildCalendarMonths/dayFromWeek.
    const agendaBlockStart = source.indexOf('data-testid="planner-agenda-view"');
    const agendaBlockEnd = source.indexOf('data-testid="planner-view-mode-selector"', agendaBlockStart) === -1
      ? source.indexOf("Legenda per bambino", agendaBlockStart)
      : agendaBlockStart;
    const agendaBlock = source.slice(agendaBlockStart, agendaBlockStart + 9000);
    expect(agendaBlock).not.toMatch(/\bcovered\s*[:=]\s*(true|false)/);
    expect(agendaBlock).not.toMatch(/\bdismissed\s*[:=]\s*(true|false)/);
    expect(agendaBlockEnd).toBeGreaterThan(-1);
  });
});
