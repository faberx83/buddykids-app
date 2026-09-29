import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  formatWeekDateRangeIt,
  overlapsForWeekIndex,
  weekConflictBadgeLabel,
  weekConflictDetailForKid,
  buildWeekSummaryLabel,
  firstConflictedDayIndex,
} from "../../lib/nextgen/week-view";
import type { AgendaRow } from "../../lib/nextgen/agenda-view";
import type { KidOverlap } from "../../lib/nextgen/planner-insights";

// TRAMA — WEEK PLANNER UX REDESIGN (29/09/2026, brief verbatim di Fabrizio).
// Stesso principio "[no browser]" di tests/one/planner-agenda-view.spec.ts:
// la logica pura specifica della vista Settimana (lib/nextgen/week-view.ts)
// è coperta qui con unit test diretti, senza browser. Le parti non
// praticamente esercitabili con un browser live in questa sessione
// (interazione DOM reale del day strip/scroll-to-day a ~390px) sono
// verificate con controlli statici del sorgente del componente — stessa
// tecnica di tests/one/planner-agenda-view.spec.ts e
// tests/one/school-calendar-ux-refinement.spec.ts.
//
// Comando: npx playwright test tests/one/planner-week-view.spec.ts

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf-8");
}

function overlap(overrides: Partial<KidOverlap> = {}): KidOverlap {
  return {
    kidId: "kid-1",
    kidName: "Lino",
    weekId: "week-1",
    weekLabel: "Settimana 15",
    bookings: [
      { bookingId: "b1", activityName: "Campus Creativo" },
      { bookingId: "b2", activityName: "Calcio" },
    ],
    ...overrides,
  };
}

test.describe("lib/nextgen/week-view — formatWeekDateRangeIt", () => {
  test("stessa settimana/mese/anno: 'D–D mese anno'", () => {
    expect(formatWeekDateRangeIt("2026-04-06")).toBe("6–12 aprile 2026");
  });

  test("settimana a cavallo di due mesi, stesso anno", () => {
    // Lunedì 30/03/2026 -> Domenica 05/04/2026
    expect(formatWeekDateRangeIt("2026-03-30")).toBe("30 mar – 5 apr 2026");
  });

  test("settimana a cavallo di due anni (dicembre/gennaio)", () => {
    // Lunedì 28/12/2026 -> Domenica 03/01/2027
    expect(formatWeekDateRangeIt("2026-12-28")).toBe("28 dic 2026 – 3 gen 2027");
  });
});

test.describe("lib/nextgen/week-view — overlapsForWeekIndex / conflitti", () => {
  test("weekIndex null -> nessun overlap (fuori stagione, mai un falso conflitto)", () => {
    expect(overlapsForWeekIndex([overlap()], null)).toEqual([]);
  });

  test("filtra solo gli overlap della settimana richiesta", () => {
    const o1 = overlap({ weekLabel: "Settimana 15" });
    const o2 = overlap({ weekLabel: "Settimana 16", kidId: "kid-2" });
    expect(overlapsForWeekIndex([o1, o2], 15)).toEqual([o1]);
  });

  test("weekConflictBadgeLabel: null se zero conflitti (mai un warning generico)", () => {
    expect(weekConflictBadgeLabel(0)).toBeNull();
  });

  test("weekConflictBadgeLabel: singolare/plurale", () => {
    expect(weekConflictBadgeLabel(1)).toBe("1 sovrapposizione");
    expect(weekConflictBadgeLabel(3)).toBe("3 sovrapposizioni");
  });

  test("weekConflictDetailForKid: null se il bambino non ha overlap in questa settimana", () => {
    expect(weekConflictDetailForKid([overlap({ kidId: "kid-1" })], "kid-2")).toBeNull();
  });

  test("weekConflictDetailForKid: dettaglio reale con nomi attività (mai un orario inventato)", () => {
    const detail = weekConflictDetailForKid([overlap()], "kid-1");
    expect(detail).toBe("Lino risulta prenotato anche in Campus Creativo e Calcio");
  });

  test("weekConflictDetailForKid: genere femminile -> 'prenotata'", () => {
    const detail = weekConflictDetailForKid([overlap({ kidName: "Sofia" })], "kid-1", "F");
    expect(detail).toBe("Sofia risulta prenotata anche in Campus Creativo e Calcio");
  });

  test("firstConflictedDayIndex: trova il primo giorno con una riga TRAMA in conflitto", () => {
    const rows: AgendaRow[][] = [
      [], // Lun — niente
      [{ kind: "trama", kidId: "kid-1", kidName: "Lino", accentColor: "sky", title: "Campus" }], // Mar — conflitto
      [],
      [],
      [],
      [],
      [],
    ];
    expect(firstConflictedDayIndex(rows, new Set(["kid-1"]))).toBe(1);
  });

  test("firstConflictedDayIndex: null se nessun giorno ha un conflitto reale", () => {
    const rows: AgendaRow[][] = [
      [{ kind: "trama", kidId: "kid-1", kidName: "Lino", accentColor: "sky", title: "Campus" }],
    ];
    expect(firstConflictedDayIndex(rows, new Set())).toBeNull();
  });
});

test.describe("lib/nextgen/week-view — buildWeekSummaryLabel", () => {
  test("settimana vuota -> stringa vuota (il chiamante mostra l'empty state, non '0 attività')", () => {
    const empty: AgendaRow[][] = [[], [], [], [], [], [], []];
    expect(buildWeekSummaryLabel(empty, 0)).toBe("");
  });

  test("conteggio attività/giorni, nessun conflitto -> niente terza parte", () => {
    const rows: AgendaRow[][] = [
      [{ kind: "trama", kidId: "kid-1", kidName: "Lino", accentColor: "sky", title: "Campus" }],
      [],
      [{ kind: "trama", kidId: "kid-1", kidName: "Lino", accentColor: "sky", title: "Calcio" }],
      [],
      [],
      [],
      [],
    ];
    expect(buildWeekSummaryLabel(rows, 0)).toBe("2 attività · 2 giorni");
  });

  test("include il conteggio conflitti quando presente", () => {
    const rows: AgendaRow[][] = [
      [{ kind: "trama", kidId: "kid-1", kidName: "Lino", accentColor: "sky", title: "Campus" }],
      [],
      [],
      [],
      [],
      [],
      [],
    ];
    expect(buildWeekSummaryLabel(rows, 1)).toBe("1 attività · 1 giorno · 1 sovrapposizione");
  });
});

// AUDIT SORGENTE (sezioni 3-21 del brief) — verifiche statiche sul
// componente reale, stessa tecnica già in uso in
// tests/one/planner-agenda-view.spec.ts e
// tests/one/school-calendar-ux-refinement.spec.ts: "nessun browser reale
// disponibile in questo sandbox" (sezione 21 del brief) — qui verifichiamo
// dal sorgente che le regole del redesign siano rispettate nel JSX reale,
// non solo nella logica pura sopra.
test.describe("PlannerCalendarView.tsx — audit sorgente vista Settimana", () => {
  const source = readSource("../../components/nextgen/PlannerCalendarView.tsx");

  test("la vista Settimana ha un data-testid dedicato", () => {
    expect(source).toContain('data-testid="planner-week-view"');
  });

  test("intestazione mostra SEMPRE il range di date reale (mai solo 'Sett. N')", () => {
    expect(source).toContain("formatWeekDateRangeIt(weekMonday)");
  });

  test("day strip a 7 giorni presente", () => {
    expect(source).toContain('data-testid="week-day-strip"');
  });

  test("gruppi cronologici per giorno (uno per data, non un'unica lista appiattita)", () => {
    expect(source).toContain("data-testid={`week-day-group-${dateIso}`}");
  });

  test("badge conflitto settimana esiste ed è condizionale (mai renderizzato incondizionatamente)", () => {
    expect(source).toContain('data-testid="week-conflict-badge"');
    expect(source).toContain("{conflictBadge && (");
  });

  test("il badge conflitto settimana naviga al primo giorno interessato (scrollToDay)", () => {
    const badgeBlockStart = source.indexOf('data-testid="week-conflict-badge"');
    const nearby = source.slice(badgeBlockStart - 400, badgeBlockStart + 600);
    expect(nearby).toContain("firstConflictIdx");
    expect(nearby).toContain("scrollToDay");
  });

  test("Andata/Ritorno restano incorporati nella card attività TRAMA, non isolati", () => {
    const rowStart = source.indexOf('data-testid="week-row-trama"');
    const rowBlock = source.slice(rowStart, rowStart + 4000);
    expect(rowBlock).toContain("MOMENTS.map");
    expect(rowBlock).toContain("respKey(row.kidId");
  });

  test("card TRAMA in conflitto mostra il dettaglio reale (kidName + attività), non solo un triangolo isolato", () => {
    expect(source).toContain("weekConflictDetailForKid(weekOverlaps, row.kidId, kid?.gender)");
    expect(source).toContain("{conflictDetail && (");
  });

  test("più attività nello stesso giorno restano card separate (rows.map, non un trasporto unico aggregato)", () => {
    const groupStart = source.indexOf('data-testid={`week-day-group-${dateIso}`}');
    const groupBlock = source.slice(groupStart, groupStart + 6000);
    expect(groupBlock).toContain("rows.map((row, rowIdx) => {");
  });

  test("empty state settimana compatto, mai un elenco lungo vuoto", () => {
    expect(source).toContain("Nessun impegno questa settimana.");
    expect(source).toContain("totalActivities === 0");
  });

  test("riepilogo settimana presente e condizionale (mai '0 attività')", () => {
    expect(source).toContain("buildWeekSummaryLabel(weekDayRows, weekOverlaps.length)");
    expect(source).toContain("{summaryLabel && (");
  });

  test("'Applica a tutta la settimana' ha un'etichetta esplicita sullo scope (accompagnamento)", () => {
    expect(source).toContain("Applica accompagnamento alla settimana");
  });

  test("azione bulk assign nella vista Settimana usa setWeekBulkResponsibilityAction (stessa logica esistente, nessuna nuova azione)", () => {
    const panelStart = source.indexOf('data-testid="week-bulk-assign-panel"');
    const panelBlock = source.slice(panelStart, panelStart + 4000);
    expect(panelBlock).toContain("handleBulkAssign(");
    expect(panelBlock).toContain("activeWeek.startDate");
  });

  test("Condividi resta raggiungibile dalla vista Settimana (stessa openShare di Mese)", () => {
    const weekViewStart = source.indexOf('data-testid="planner-week-view"');
    const weekViewEnd = source.indexOf("Riepilogo del giorno selezionato", weekViewStart);
    const weekViewBlock = source.slice(weekViewStart, weekViewEnd);
    expect(weekViewBlock).toContain("openShare(activeWeek.startDate, activeWeek.endDate");
  });

  test("selettore compatto per saltare a una settimana specifica (mai solo scroll di Sett. 1..N)", () => {
    expect(source).toContain('data-testid="week-picker-select"');
  });

  test("SCOPERTA LABEL AUDIT — nessuna label ambigua 'Scoperta' bare (era il vecchio stato 'settimana non coperta', riusava la stessa parola del concetto Discovery/'Scoperta TRAMA')", () => {
    // La sola occorrenza ammessa è la provenienza "Da Scoperta TRAMA"
    // (Discovery reale) — mai una card/label che dice solo "Scoperta".
    const bareScopertaRegex = />\s*Scoperta\s*</;
    expect(bareScopertaRegex.test(source)).toBe(false);
    // Il rimpiazzo semantico corretto ("questa settimana non ha ancora
    // organizzazione") usa "Da organizzare", stesso testo già usato altrove
    // nell'app per lo stato "uncovered" (WEEK_STATUS_LABEL in
    // lib/nextgen/planner-insights.ts) — coerenza di vocabolario, non un
    // neologismo inventato per questo task.
    expect(source).toContain("Da organizzare");
  });

  test("il riepilogo/Applica/Condividi di Mese restano isolati alla vista Mese (viewMode === \"mese\")", () => {
    expect(source).toContain('{viewMode === "mese" && selectedDay && (');
  });

  test("REGRESSIONE — la griglia Mese non è stata toccata (stesso grid-cols-7/DOT_BG/hasConflict per cella)", () => {
    expect(source).toContain('<div className="grid grid-cols-7 gap-1">');
    expect(source).toContain("cell.hasConflict && (");
  });

  test("REGRESSIONE — Agenda non è stata toccata (stesso data-testid, stesso buildAgendaRows)", () => {
    expect(source).toContain('data-testid="planner-agenda-view"');
    expect(source).toContain('data-testid="agenda-day-strip"');
    expect(source).toContain("buildAgendaRows(cell)");
  });

  test("REGRESSIONE — legenda Esterno/Sovrapposizione condivisa resta invariata", () => {
    expect(source).toContain("Impegno esterno");
  });
});
