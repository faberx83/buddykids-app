import { test, expect } from "@playwright/test";
import { isRealDeployment } from "../fixtures/roles";
import {
  buildExternalOccurrencesByDate,
  externalOccurrencesInRange,
} from "../../lib/planner/external-calendar-items-core";
import { buildCalendarMonths } from "../../lib/nextgen/calendar-weeks";
import {
  buildExternalPlannerItemInputFromCuratedLead,
  type ExternalPlannerItemInput,
} from "../../lib/planner/external-planner-items-core";
import { REAL_DISCOVERY_LEADS, type DiscoveryLeadRecord } from "../../lib/discovery/real-dataset";
// "import type": stesso principio già in uso in tutto il repo (vedi
// PlannerCalendarView.tsx) — SeasonWeek/ExternalPlannerItem sono usati SOLO
// come tipo qui: nessun import a runtime di lib/data/planner.ts o
// lib/data/external-planner-items.ts (entrambi "server-only"), quindi
// nessun errore di risoluzione modulo in un test Node puro.
import type { SeasonWeek } from "../../lib/data/planner";
import type { ExternalPlannerItem } from "../../lib/data/external-planner-items";
import type { Kid } from "../../lib/types";

// TRAMA — EXTERNAL PLANNER ITEMS · CALENDAR VISIBILITY + DATELESS DISCOVERY
// (live UX fix, 28/09/2026, sezione 9 del task "TESTS"). Stesso principio
// "[no browser]" di tests/one/external-planner-items.spec.ts: tutta la
// logica coperta qui è pura (nessun I/O) — vedi
// lib/planner/external-calendar-items-core.ts e lib/nextgen/calendar-weeks.ts
// per il codice testato.

function kid(overrides: Partial<Kid> = {}): Kid {
  return { id: "kid-1", name: "Sofia", emoji: "🦄", accentColor: "sky", ...overrides } as Kid;
}

function externalItem(overrides: Partial<ExternalPlannerItem> = {}): ExternalPlannerItem {
  return {
    id: "item-1",
    kind: "commitment",
    title: "Dentista",
    startDate: "2026-09-28",
    endDate: "2026-09-28",
    allDay: true,
    startTime: null,
    endTime: null,
    location: null,
    notes: null,
    externalUrl: null,
    sourceType: "manual",
    sourceRef: null,
    organizerSnapshot: null,
    kidIds: ["kid-1"],
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function seasonWeek(overrides: Partial<SeasonWeek> = {}): SeasonWeek {
  return {
    index: 1,
    label: "SETT 1",
    dateRange: "28/9–2/10",
    startDate: "2026-09-28",
    endDate: "2026-10-02",
    covered: false,
    coveredKids: [],
    dismissed: false,
    ...overrides,
  };
}

test.describe("External Planner Items — buildExternalOccurrencesByDate (no browser)", () => {
  test("ECAL-01 [no browser] - one-day item: esattamente un'occorrenza sulla data esatta", () => {
    const byDate = buildExternalOccurrencesByDate([externalItem()], [kid()]);
    expect(byDate.get("2026-09-28")?.length).toBe(1);
    expect(byDate.get("2026-09-27")).toBeUndefined();
    expect(byDate.get("2026-09-29")).toBeUndefined();
  });

  test("ECAL-02 [no browser] - multi-day item: range INCLUSIVO, un'occorrenza per ciascun giorno incluso", () => {
    const byDate = buildExternalOccurrencesByDate(
      [externalItem({ startDate: "2026-09-28", endDate: "2026-10-01" })],
      [kid()]
    );
    for (const d of ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]) {
      expect(byDate.get(d)?.length).toBe(1);
    }
    expect(byDate.get("2026-09-27")).toBeUndefined();
    expect(byDate.get("2026-10-02")).toBeUndefined();
  });

  test("ECAL-03 [no browser] - month boundary: il range attraversa settembre→ottobre senza saltare giorni", () => {
    const byDate = buildExternalOccurrencesByDate(
      [externalItem({ startDate: "2026-09-29", endDate: "2026-10-02" })],
      [kid()]
    );
    const dates = [...byDate.keys()].sort();
    expect(dates).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });

  test("ECAL-04 [no browser] - week boundary: il range attraversa una settimana ISO senza saltare giorni (weekend incluso)", () => {
    // 2026-09-25 è venerdì, 2026-09-28 è lunedì della settimana successiva:
    // il range deve includere anche il weekend (sabato/domenica), coerente
    // con "un impegno esterno è indipendente dalla stagione TRAMA Lun-Ven".
    const byDate = buildExternalOccurrencesByDate(
      [externalItem({ startDate: "2026-09-25", endDate: "2026-09-28" })],
      [kid()]
    );
    expect([...byDate.keys()].sort()).toEqual(["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28"]);
  });

  test("ECAL-05 [no browser] - più impegni nello stesso giorno: entrambe le occorrenze presenti, nessuna sovrascrittura", () => {
    const byDate = buildExternalOccurrencesByDate(
      [
        externalItem({ id: "item-a", title: "Dentista" }),
        externalItem({ id: "item-b", title: "Calcio", kind: "activity" }),
      ],
      [kid()]
    );
    const occs = byDate.get("2026-09-28");
    expect(occs?.length).toBe(2);
    expect(occs?.map((o) => o.itemId).sort()).toEqual(["item-a", "item-b"]);
  });

  test("ECAL-06 [no browser] - soft-deleted: un item non presente nell'array in ingresso non produce alcuna occorrenza (contratto: il chiamante filtra deleted_at a monte, vedi getExternalPlannerItemsForParent)", () => {
    // Nessun item passato = nessuna occorrenza, per qualunque data: stesso
    // comportamento di un item soft-deleted, che getExternalPlannerItemsForParent
    // esclude già a monte (.is('deleted_at', null)) prima che arrivi qui.
    const byDate = buildExternalOccurrencesByDate([], [kid()]);
    expect(byDate.size).toBe(0);
  });

  test("ECAL-07 [no browser] - isRangeStart/isRangeEnd corretti per un range multi-day", () => {
    const byDate = buildExternalOccurrencesByDate(
      [externalItem({ startDate: "2026-06-10", endDate: "2026-06-14" })],
      [kid()]
    );
    expect(byDate.get("2026-06-10")?.[0].isRangeStart).toBe(true);
    expect(byDate.get("2026-06-10")?.[0].isRangeEnd).toBe(false);
    expect(byDate.get("2026-06-12")?.[0].isRangeStart).toBe(false);
    expect(byDate.get("2026-06-12")?.[0].isRangeEnd).toBe(false);
    expect(byDate.get("2026-06-14")?.[0].isRangeStart).toBe(false);
    expect(byDate.get("2026-06-14")?.[0].isRangeEnd).toBe(true);
  });

  test("ECAL-08 [no browser] - one-day: isRangeStart e isRangeEnd sono entrambi true", () => {
    const byDate = buildExternalOccurrencesByDate([externalItem()], [kid()]);
    const occ = byDate.get("2026-09-28")?.[0];
    expect(occ?.isRangeStart).toBe(true);
    expect(occ?.isRangeEnd).toBe(true);
  });

  test("ECAL-09 [no browser] - kidNames risolti dall'elenco kids passato, non dal solo kidId", () => {
    const byDate = buildExternalOccurrencesByDate(
      [externalItem({ kidIds: ["kid-1", "kid-2"] })],
      [kid(), kid({ id: "kid-2", name: "Leo" })]
    );
    expect(byDate.get("2026-09-28")?.[0].kidNames.sort()).toEqual(["Leo", "Sofia"]);
  });
});

test.describe("External Planner Items — externalOccurrencesInRange (vista Settimana, no browser)", () => {
  test("ECAL-10 [no browser] - aggrega le occorrenze di più giorni in un unico array, ciascuna con il proprio dateIso", () => {
    const byDate = buildExternalOccurrencesByDate(
      [externalItem({ startDate: "2026-09-28", endDate: "2026-09-30" })],
      [kid()]
    );
    const inRange = externalOccurrencesInRange(byDate, "2026-09-28", "2026-10-02");
    expect(inRange.length).toBe(3);
    expect(inRange.map((o) => o.dateIso).sort()).toEqual(["2026-09-28", "2026-09-29", "2026-09-30"]);
  });

  test("ECAL-11 [no browser] - range senza alcuna occorrenza: array vuoto, nessun errore", () => {
    const byDate = buildExternalOccurrencesByDate([], [kid()]);
    expect(externalOccurrencesInRange(byDate, "2026-01-01", "2026-01-05")).toEqual([]);
  });
});

test.describe("External Planner Items — buildCalendarMonths integrazione + COVERAGE NEUTRALITY (no browser)", () => {
  test("ECAL-12 [no browser] - un giorno con un impegno esterno porta externalItems non vuoto nella cella corrispondente", () => {
    const weeks = [seasonWeek()];
    const byDate = buildExternalOccurrencesByDate([externalItem()], [kid()]);
    const months = buildCalendarMonths(weeks, [kid()], [], byDate);
    const cell = months.flatMap((m) => m.cells).find((c) => c?.dateIso === "2026-09-28");
    expect(cell?.externalItems.length).toBe(1);
  });

  test("ECAL-13 [no browser] - un giorno SENZA impegni esterni ha externalItems=[] (default innocuo)", () => {
    const weeks = [seasonWeek()];
    const months = buildCalendarMonths(weeks, [kid()], []); // nessun 4° parametro
    const cell = months.flatMap((m) => m.cells).find((c) => c?.dateIso === "2026-09-28");
    expect(cell?.externalItems).toEqual([]);
  });

  test("ECAL-14 [no browser] - REGOLA CRITICA sezione 1: la presenza di un impegno esterno NON altera covered/dismissed della cella (VISIBILE ≠ COVERED)", () => {
    // Settimana NON coperta (covered:false) con un impegno esterno lo
    // stesso giorno — la cella deve restare covered:false: un impegno
    // esterno non deve mai far apparire una settimana come "organizzata".
    const weeksUncovered = [seasonWeek({ covered: false, dismissed: false })];
    const byDate = buildExternalOccurrencesByDate([externalItem()], [kid()]);
    const monthsUncovered = buildCalendarMonths(weeksUncovered, [kid()], [], byDate);
    const cellUncovered = monthsUncovered.flatMap((m) => m.cells).find((c) => c?.dateIso === "2026-09-28");
    expect(cellUncovered?.covered).toBe(false);
    expect(cellUncovered?.externalItems.length).toBe(1);

    // Settimana COPERTA con lo stesso impegno esterno — covered deve
    // restare true (calcolato SOLO da SeasonWeek.covered, mai da
    // externalItems).
    const weeksCovered = [seasonWeek({ covered: true, dismissed: false })];
    const monthsCovered = buildCalendarMonths(weeksCovered, [kid()], [], byDate);
    const cellCovered = monthsCovered.flatMap((m) => m.cells).find((c) => c?.dateIso === "2026-09-28");
    expect(cellCovered?.covered).toBe(true);
    expect(cellCovered?.externalItems.length).toBe(1);
  });

  test("ECAL-15 [no browser] - un impegno esterno fuori stagione (inSeason=false) resta visibile in externalItems, senza forzare inSeason/covered", () => {
    const weeks = [seasonWeek({ startDate: "2026-09-01", endDate: "2026-09-04", index: 1 })];
    // 2026-09-28 non è coperta da nessuna SeasonWeek passata qui (fuori
    // range) — la cella sarà inSeason:false, ma deve comunque portare
    // l'impegno esterno.
    const byDate = buildExternalOccurrencesByDate([externalItem({ startDate: "2026-09-28", endDate: "2026-09-28" })], [kid()]);
    const months = buildCalendarMonths(weeks, [kid()], [], byDate);
    const cell = months.flatMap((m) => m.cells).find((c) => c?.dateIso === "2026-09-28");
    expect(cell?.inSeason).toBe(false);
    expect(cell?.covered).toBe(false);
    expect(cell?.externalItems.length).toBe(1);
  });

  test("ECAL-16 [no browser] - rendering TRAMA esistente (kids/covered/hasConflict per cella) invariato quando externalItemsByDate è vuota", () => {
    const weeks = [
      seasonWeek({
        covered: true,
        coveredKids: [{ kidId: "kid-1", activityName: "Centro Estivo", partnerDecision: "accepted", bookingId: "b1" }],
      }),
    ];
    const months = buildCalendarMonths(weeks, [kid()], []);
    const cell = months.flatMap((m) => m.cells).find((c) => c?.dateIso === "2026-09-28");
    expect(cell?.covered).toBe(true);
    expect(cell?.kids.length).toBe(1);
    expect(cell?.kids[0].kidName).toBe("Sofia");
    expect(cell?.externalItems).toEqual([]);
  });
});

test.describe("Discovery — dateOverride su buildExternalPlannerItemInputFromCuratedLead (CASE A/B/C, no browser)", () => {
  function lead(overrides: Partial<DiscoveryLeadRecord> = {}): DiscoveryLeadRecord {
    return { ...REAL_DISCOVERY_LEADS[0], ...overrides };
  }

  test("EPIC-01 [no browser] - CASE A (lead con date note, nessun override): usa le date del lead, come prima (EPI-10 invariato)", () => {
    const built = buildExternalPlannerItemInputFromCuratedLead(lead({ startDate: "2026-06-15", endDate: "2026-06-19" }), ["kid-1"]);
    expect(built.startDate).toBe("2026-06-15");
    expect(built.endDate).toBe("2026-06-19");
  });

  test("EPIC-02 [no browser] - CASE A (lead con date note, utente modifica nel form): dateOverride ha la precedenza sulle date del lead", () => {
    const built = buildExternalPlannerItemInputFromCuratedLead(
      lead({ startDate: "2026-06-15", endDate: "2026-06-19" }),
      ["kid-1"],
      { startDate: "2026-06-16", endDate: "2026-06-20" }
    );
    expect(built.startDate).toBe("2026-06-16");
    expect(built.endDate).toBe("2026-06-20");
  });

  test("EPIC-03 [no browser] - CASE B (lead SENZA date, dateOverride fornito dal form): usa le date scelte dall'utente, mai 'oggi'", () => {
    const built = buildExternalPlannerItemInputFromCuratedLead(lead({ startDate: null, endDate: null }), ["kid-1"], {
      startDate: "2026-11-03",
      endDate: "2026-11-05",
    });
    expect(built.startDate).toBe("2026-11-03");
    expect(built.endDate).toBe("2026-11-05");
    // Le date ora sono certe (scelte dall'utente): niente più la nota
    // "non indicate dalla fonte" (avrebbe senso solo per il vecchio
    // fallback silenzioso a 'oggi').
    expect(built.notes).toBeNull();
  });

  test("EPIC-04 [no browser] - CASE B senza dateOverride (retrocompatibilità, EPI-11 invariato): fallback sicuro a 'oggi', mai un dato inventato più specifico", () => {
    const built = buildExternalPlannerItemInputFromCuratedLead(lead({ startDate: null, endDate: null }), ["kid-1"]);
    const today = new Date().toISOString().slice(0, 10);
    expect(built.startDate).toBe(today);
    expect(built.endDate).toBe(today);
    expect(built.notes).toMatch(/non indicate/i);
  });

  test("EPIC-05 [no browser] - lo snapshot con dateOverride resta sempre valido secondo validateExternalPlannerItemInput", async () => {
    const { validateExternalPlannerItemInput } = await import("../../lib/planner/external-planner-items-core");
    const built = buildExternalPlannerItemInputFromCuratedLead(lead({ startDate: null, endDate: null }), ["kid-1"], {
      startDate: "2026-11-03",
      endDate: "2026-11-05",
    });
    expect(validateExternalPlannerItemInput(built as ExternalPlannerItemInput).valid).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════
// SCENARI GATED — richiedono deploy reale/browser (UI, click reali,
// timing percepito). REQUIRES LIVE VALIDATION — mai eseguiti in questo
// sandbox, stesso principio di external-planner-items.spec.ts.
// ════════════════════════════════════════════════════════════════
test.describe("Calendar/Delete/Discovery UX — scenari live (REQUIRES LIVE VALIDATION)", () => {
  test("ECAL-L01 - CALENDAR: one-day external visibile esattamente sul 28/09 nella vista Mese reale", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale con migration 39 applicata e flag risolto true.");
  });
  test("ECAL-L02 - CALENDAR: multi-day external (28/09→01/10) visibile su 28/29/30 settembre E 1 ottobre attraversando il cambio mese", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale.");
  });
  test("ECAL-L03 - CALENDAR: click sul giorno apre l'agenda con l'impegno esterno tra gli elementi del giorno", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale.");
  });
  test("ECAL-L04 - DELETE: tap Rimuovi → la card sparisce immediatamente (percepito <300ms), nessun flash/ricomparsa dopo la revalidation", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale — misura di percezione UX, non riproducibile senza browser.");
  });
  test("ECAL-L05 - DELETE: doppio tap rapido su Rimuovi non genera due soft-delete concorrenti visibili come errore", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale.");
  });
  test("ECAL-L06 - DISCOVERY: CTA 'Aggiungi al Planner' visibile e funzionante su tutte e 4 le combinazioni invitable/source-only × dates/no-dates", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale con REAL_DISCOVERY_DATASET_ENABLED + EXTERNAL_PLANNER_ITEMS_ENABLED attivi.");
  });
  test("ECAL-L07 - LAYOUT: nessuna rottura di layout su mobile stretto (360px) nella vista Mese/agenda", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale/verifica visiva.");
  });
  test("ECAL-L08 - REGRESSION: School Calendar/coverage/booking/Curated Favorites invariati dopo questo rilascio", () => {
    test.skip(!isRealDeployment, "Richiede un deploy reale — golden journey completa.");
  });
});
