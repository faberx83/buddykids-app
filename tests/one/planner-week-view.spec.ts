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
  // WEEK VIEW V2 (29/09/2026, brief verbatim di Fabrizio dopo la
  // validazione live del redesign precedente — vedi lib/nextgen/week-view.ts
  // per la documentazione completa di ciascuna funzione).
  formatSelectedDayHeaderIt,
  selectedDayItemsCountLabel,
  countDayConflicts,
  dayConflictBadgeLabel,
  categoryChipForTramaRow,
  externalKindChip,
  selectedDayIndexInWeek,
} from "../../lib/nextgen/week-view";
import type { AgendaRow } from "../../lib/nextgen/agenda-view";
import type { KidOverlap } from "../../lib/nextgen/planner-insights";

// TRAMA — WEEK VIEW V2 (29/09/2026). Stesso principio "[no browser]" di
// tests/one/planner-agenda-view.spec.ts: la logica pura specifica della
// vista Settimana (lib/nextgen/week-view.ts) è coperta qui con unit test
// diretti, senza browser. Le parti non praticamente esercitabili con un
// browser live in questa sessione (sticky reale a ~390px, tap sullo strip)
// sono verificate con controlli statici del sorgente del componente — stessa
// tecnica di tests/one/planner-agenda-view.spec.ts.
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

function tramaRow(overrides: Partial<Extract<AgendaRow, { kind: "trama" }>> = {}): AgendaRow {
  return {
    kind: "trama",
    kidId: "kid-1",
    kidName: "Lino",
    accentColor: "sky",
    title: "Campus",
    ...overrides,
  };
}

// ============================================================================
// Funzioni INVARIATE dal redesign precedente (WEEK PLANNER UX REDESIGN) —
// riusate identiche da V2 per l'header/riepilogo/conflitto a livello di
// INTERA settimana. Test invariati.
// ============================================================================

test.describe("lib/nextgen/week-view — formatWeekDateRangeIt", () => {
  test("stessa settimana/mese/anno: 'D–D mese anno'", () => {
    expect(formatWeekDateRangeIt("2026-04-06")).toBe("6–12 aprile 2026");
  });

  test("settimana a cavallo di due mesi, stesso anno", () => {
    expect(formatWeekDateRangeIt("2026-03-30")).toBe("30 mar – 5 apr 2026");
  });

  test("settimana a cavallo di due anni (dicembre/gennaio)", () => {
    expect(formatWeekDateRangeIt("2026-12-28")).toBe("28 dic 2026 – 3 gen 2027");
  });
});

test.describe("lib/nextgen/week-view — overlapsForWeekIndex / conflitti settimana", () => {
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
    const rows: AgendaRow[][] = [[], [tramaRow()], [], [], [], [], []];
    expect(firstConflictedDayIndex(rows, new Set(["kid-1"]))).toBe(1);
  });

  test("firstConflictedDayIndex: null se nessun giorno ha un conflitto reale", () => {
    const rows: AgendaRow[][] = [[tramaRow()]];
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
      [tramaRow({ title: "Campus" })],
      [],
      [tramaRow({ title: "Calcio" })],
      [],
      [],
      [],
      [],
    ];
    expect(buildWeekSummaryLabel(rows, 0)).toBe("2 attività · 2 giorni");
  });

  test("include il conteggio conflitti quando presente", () => {
    const rows: AgendaRow[][] = [[tramaRow()], [], [], [], [], [], []];
    expect(buildWeekSummaryLabel(rows, 1)).toBe("1 attività · 1 giorno · 1 sovrapposizione");
  });
});

// ============================================================================
// Funzioni NUOVE — WEEK VIEW V2 (sticky navigator + selected-day timeline).
// ============================================================================

test.describe("lib/nextgen/week-view — formatSelectedDayHeaderIt", () => {
  test("giorno completo minuscolo (uppercase applicato via CSS, stessa convenzione di formatWeekDateRangeIt)", () => {
    // Martedì 29 settembre 2026
    expect(formatSelectedDayHeaderIt("2026-09-29")).toBe("martedì 29 settembre");
  });

  test("domenica (fine settimana ISO)", () => {
    expect(formatSelectedDayHeaderIt("2026-10-04")).toBe("domenica 4 ottobre");
  });
});

test.describe("lib/nextgen/week-view — selectedDayItemsCountLabel", () => {
  test("giorno vuoto -> stringa vuota (il chiamante mostra l'empty state, sezione 23)", () => {
    expect(selectedDayItemsCountLabel([])).toBe("");
  });

  test("singolare", () => {
    expect(selectedDayItemsCountLabel([tramaRow()])).toBe("1 impegno");
  });

  test("plurale", () => {
    expect(selectedDayItemsCountLabel([tramaRow(), tramaRow({ kidId: "kid-2" })])).toBe("2 impegni");
  });
});

test.describe("lib/nextgen/week-view — countDayConflicts / dayConflictBadgeLabel", () => {
  test("nessun bambino in conflitto -> 0, null (nessun warning fabbricato)", () => {
    const rows = [tramaRow({ kidId: "kid-1" })];
    expect(countDayConflicts(rows, new Set())).toBe(0);
    expect(dayConflictBadgeLabel(countDayConflicts(rows, new Set()))).toBeNull();
  });

  test("conta solo le righe TRAMA di kid realmente in conflitto in questa settimana", () => {
    const rows: AgendaRow[] = [
      tramaRow({ kidId: "kid-1" }),
      tramaRow({ kidId: "kid-2" }),
      { kind: "external", occ: extOcc() },
    ];
    expect(countDayConflicts(rows, new Set(["kid-1"]))).toBe(1);
  });

  test("dayConflictBadgeLabel: singolare/plurale", () => {
    expect(dayConflictBadgeLabel(1)).toBe("1 conflitto");
    expect(dayConflictBadgeLabel(2)).toBe("2 conflitti");
  });
});

test.describe("lib/nextgen/week-view — categoryChipForTramaRow (sezione 8/9/11 del brief)", () => {
  test("nessun tag assegnato -> null (fallback neutro, MAI un'icona/colore inventati)", () => {
    expect(categoryChipForTramaRow({})).toBeNull();
    expect(categoryChipForTramaRow({ categoryLabel: undefined })).toBeNull();
  });

  test("tag reale con emoji -> emoji+label passati così come sono (mai inferiti dal titolo)", () => {
    expect(categoryChipForTramaRow({ categoryLabel: "Calcio", categoryEmoji: "⚽" })).toEqual({
      emoji: "⚽",
      label: "Calcio",
    });
  });

  test("tag reale SENZA emoji (admin non l'ha scelto) -> pallino neutro '•', mai un emoji indovinato", () => {
    expect(categoryChipForTramaRow({ categoryLabel: "Judo" })).toEqual({ emoji: "•", label: "Judo" });
  });
});

test.describe("lib/nextgen/week-view — externalKindChip (sezione 9 del brief, audit External Items)", () => {
  test("kind='activity' -> etichetta neutra, mai una categoria specifica indovinata", () => {
    expect(externalKindChip("activity")).toEqual({ emoji: "🎯", label: "Attività" });
  });

  test("kind='commitment' -> etichetta neutra distinta", () => {
    expect(externalKindChip("commitment")).toEqual({ emoji: "📌", label: "Impegno" });
  });
});

test.describe("lib/nextgen/week-view — selectedDayIndexInWeek", () => {
  const weekDates = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];

  test("trova l'indice 0=Lun..6=Dom", () => {
    expect(selectedDayIndexInWeek(weekDates, "2026-09-29")).toBe(1);
    expect(selectedDayIndexInWeek(weekDates, "2026-10-04")).toBe(6);
  });

  test("-1 se la data non appartiene a questa settimana (guardia difensiva)", () => {
    expect(selectedDayIndexInWeek(weekDates, "2026-10-05")).toBe(-1);
  });
});

function extOcc() {
  return {
    itemId: "ext-1",
    dateIso: "2026-09-29",
    title: "Centro Diurno Estivo",
    kind: "activity" as const,
    allDay: true,
    startTime: null,
    endTime: null,
    kidNames: ["Lino"],
    sourceType: "manual" as const,
    isRangeStart: true,
    isRangeEnd: true,
  };
}

// AUDIT SORGENTE (WEEK VIEW V2) — verifiche statiche sul componente reale,
// stessa tecnica già in uso in tests/one/planner-agenda-view.spec.ts:
// "nessun browser reale disponibile in questo sandbox" (sezione 33 del
// brief) — qui verifichiamo dal sorgente che le regole del redesign siano
// rispettate nel JSX reale, non solo nella logica pura sopra.
test.describe("PlannerCalendarView.tsx — audit sorgente Week View V2", () => {
  const source = readSource("../../components/nextgen/PlannerCalendarView.tsx");

  test("la vista Settimana ha un data-testid dedicato", () => {
    expect(source).toContain('data-testid="planner-week-view"');
  });

  test("sezione 3/27 — navigatore sticky presente, con offset sotto l'header mobile e z-index sotto l'header (z-30)", () => {
    expect(source).toContain('data-testid="week-sticky-navigator"');
    const navStart = source.indexOf('data-testid="week-sticky-navigator"');
    const navBlock = source.slice(navStart - 400, navStart + 200);
    expect(navBlock).toContain("sticky top-[57px]");
    expect(navBlock).toContain("z-20");
    expect(navBlock).toContain("md:top-0");
  });

  test("intestazione mostra SEMPRE il range di date reale (mai solo 'Sett. N')", () => {
    expect(source).toContain("formatWeekDateRangeIt(weekMonday)");
  });

  test("day strip a 7 giorni presente dentro il navigatore sticky", () => {
    const navStart = source.indexOf('data-testid="week-sticky-navigator"');
    const navEnd = source.indexOf("</div>\n              </div>", navStart);
    const navBlock = source.slice(navStart, navEnd > 0 ? navEnd : navStart + 4000);
    expect(navBlock).toContain('data-testid="week-day-strip"');
  });

  test("sezione 16 — NESSUN anchor scroll/page jump nella vista Settimana: scrollIntoView/scrollToDay rimossi dal redesign V2 (il .scrollIntoView() del pannello Condivisione Piano, funzionalità distinta e invariata, resta fuori da questo blocco)", () => {
    const weekViewStart = source.indexOf('data-testid="planner-week-view"');
    const weekViewEnd = source.indexOf("Riepilogo del giorno selezionato", weekViewStart);
    const weekViewBlock = source.slice(weekViewStart, weekViewEnd);
    expect(weekViewBlock).not.toContain("scrollToDay");
    expect(weekViewBlock).not.toContain(".scrollIntoView(");
    expect(weekViewBlock).not.toContain("weekDayGroupRefs");
  });

  test("sezione 5 — SOLO il giorno selezionato è renderizzato (nessuna sezione-giorno per gli altri 6 giorni)", () => {
    expect(source).toContain('data-testid="week-selected-day"');
    expect(source).toContain('data-testid="week-selected-day-header"');
    // Il vecchio pattern "un blocco per ciascuna data" (week-day-group-${dateIso})
    // non esiste più: la V2 non mappa weekDates in blocchi multipli di contenuto.
    expect(source).not.toContain("week-day-group-");
  });

  test("badge conflitto settimana esiste, è condizionale e NON scrolla (status tappabile, sezione 20/22)", () => {
    expect(source).toContain('data-testid="week-conflict-badge"');
    expect(source).toContain("{conflictBadge && (");
    const badgeStart = source.indexOf('data-testid="week-conflict-badge"');
    const nearby = source.slice(badgeStart - 200, badgeStart + 500);
    expect(nearby).toContain("firstConflictIdx");
    expect(nearby).not.toContain("scrollToDay");
  });

  test("Andata/Ritorno restano incorporati nella card attività TRAMA, non isolati", () => {
    const rowStart = source.indexOf('data-testid="week-row-trama"');
    const rowBlock = source.slice(rowStart, rowStart + 4500);
    expect(rowBlock).toContain("MOMENTS.map");
    expect(rowBlock).toContain("respKey(row.kidId");
  });

  test("card TRAMA in conflitto mostra il dettaglio reale (kidName + attività), non solo un triangolo isolato", () => {
    expect(source).toContain("weekConflictDetailForKid(weekOverlaps, row.kidId, kid?.gender)");
    expect(source).toContain("{conflictDetail && (");
  });

  test("sezione 8 — gerarchia visiva: pallino colore bambino primario, badge TRAMA/Esterno espliciti, categoria come cue secondario testuale", () => {
    // categoryChip è calcolato PRIMA della JSX (const, subito dopo
    // conflictDetail) — la finestra parte quindi un po' prima del
    // data-testid, non dopo.
    const rowStart = source.indexOf('data-testid="week-row-trama"');
    const rowBlock = source.slice(rowStart - 300, rowStart + 2500);
    expect(rowBlock).toContain("DOT_BG[row.accentColor]");
    expect(rowBlock).toContain("TRAMA");
    expect(rowBlock).toContain("categoryChipForTramaRow(row)");
    expect(rowBlock).toContain('data-testid="week-category-chip"');

    const extStart = source.indexOf('data-testid="week-row-external"');
    const extBlock = source.slice(extStart - 300, extStart + 2000);
    expect(extBlock).toContain("Esterno");
    expect(extBlock).toContain("externalKindChip(occ.kind)");
  });

  test("più attività nello stesso giorno restano card separate (selectedRows.map, non un trasporto unico aggregato)", () => {
    const selStart = source.indexOf('data-testid="week-selected-day"');
    const selBlock = source.slice(selStart, selStart + 8000);
    expect(selBlock).toContain("selectedRows.map((row, rowIdx) => {");
  });

  test("empty state del GIORNO selezionato compatto (sezione 23), mai un elenco lungo vuoto", () => {
    expect(source).toContain("Nessun impegno");
    expect(source).toContain("selectedRows.length === 0");
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

  test("SCOPERTA LABEL AUDIT — nessuna label ambigua 'Scoperta' bare (era il vecchio stato 'settimana non coperta')", () => {
    const bareScopertaRegex = />\s*Scoperta\s*</;
    expect(bareScopertaRegex.test(source)).toBe(false);
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
