import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  buildWeekModel,
  bookedDaysForWeek,
  weekRangeLabel,
  relativeWeekLabel,
  weekStatusParts,
  buildMonthModel,
  mondayOfIso,
} from "../../lib/nextgen/planner-week";
import { buildSeasonRows, coverageByKid, countSavedNotInPlanner } from "../../lib/nextgen/planner-season";
import { buildHolidaySummary, closureRangeLabel } from "../../lib/nextgen/holiday-summary";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { RELEASE_CATALOG } from "../../lib/releases/catalog";

// TRAMA — PLANNER V2 + NUOVA BARRA (14/10/2026). Logica pura + controlli
// statici. Comando: npx playwright test tests/one/planner-v2.spec.ts --project=chromium
// La verifica visiva dal vivo resta "pending local verification" (Fabrizio,
// con PLANNER_V2_ENABLED e NAV_V2_ENABLED accesi per internal-preview).

const ROOT = path.join(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const MON = "2026-10-12";
const TODAY = "2026-10-13"; // martedì

const bookings = [
  {
    id: "b1", status: "confirmed", partnerDecision: "accepted", activityName: "Doposcuola", activityDbId: "a1",
    centerName: "Il Melograno", isDayBased: false, dayDates: [], weeks: [{ startDate: MON, endDate: "2026-10-16" }],
    kidIds: ["g"], kidNames: ["Giulia"],
  },
  {
    id: "b2", status: "cancelled", partnerDecision: "accepted", activityName: "Annullata", activityDbId: null,
    centerName: "", isDayBased: true, dayDates: ["2026-10-14"], weeks: [], kidIds: ["s"], kidNames: ["Sofia"],
  },
];
const external = [
  { id: "e1", title: "Nuoto", startDate: "2026-10-13", endDate: "2026-10-13", allDay: false, startTime: "16:45", endTime: "17:30", location: "Piscina", sourceType: "manual", kidIds: ["s"] },
  { id: "e2", title: "Festa", startDate: "2026-10-17", endDate: "2026-10-17", allDay: false, startTime: "15:30", endTime: "18:30", location: null, sourceType: "manual", kidIds: ["s"] },
];
const kidNameById = { g: "Giulia", s: "Sofia" };
const responsibilities = [
  { kidId: "g", weekStartDate: MON, weekday: "mar" as const, moment: "andata" as const, responsible: "io" as const, responsibleLabel: null },
  { kidId: "g", weekStartDate: MON, weekday: "mar" as const, moment: "ritorno" as const, responsible: "partner" as const, responsibleLabel: null },
];
const week = (kidFilter: string | null = null) =>
  buildWeekModel({
    mondayIso: MON,
    todayIso: TODAY,
    bookings,
    externalItems: external,
    hoursByActivityDbId: { a1: "13:00 - 16:30" },
    kidNameById,
    responsibilities,
    labelFor: (r) => (r.responsible === "io" ? "Papà" : "Mamma"),
    kidFilter,
    closureLabelsByDate: { "2026-10-16": ["Ponte"] },
  });

test.describe("PLANNER-V2 — Settimana", () => {
  test("PV2-01: sette giorni, oggi e passato marcati, impegni misti in ordine di orario", () => {
    const w = week();
    expect(w.days).toHaveLength(7);
    expect(w.days[1].isToday).toBe(true);
    expect(w.days[0].isPast).toBe(true);
    expect(w.days[1].entries.map((e) => e.title)).toEqual(["Doposcuola", "Nuoto"]);
    expect(w.days[5].entries.map((e) => e.title)).toEqual(["Festa"]); // sabato: impegni manuali sì
    expect(w.days[5].entries.some((e) => e.title === "Doposcuola")).toBe(false); // settimana intera: solo feriali
    expect(w.days[4].closureLabels).toEqual(["Ponte"]);
  });

  test("PV2-02: coordinamento per giorno — compatto se deciso, esteso se manca qualcuno", () => {
    const w = week();
    expect(w.days[1].coordination.mode).toBe("compact");
    expect(w.days[1].coordination.people).toEqual(["Papà", "Mamma"]);
    expect(w.days[2].coordination.mode).toBe("detailed");
    expect(w.days[5].coordination.mode).toBe("none");
    // da oggi in poi: mer, gio, ven × andata/ritorno = 6 (lunedì è passato e non conta)
    expect(w.missingCount).toBe(6);
    expect(weekStatusParts(w)).toEqual({ entries: "7 impegni", missing: "6 passaggi da assegnare" });
  });

  test("PV2-03: filtro per figlio", () => {
    const w = week("s");
    expect(w.days[1].entries.map((e) => e.title)).toEqual(["Nuoto"]);
    expect(w.days[1].coordination.mode).toBe("none"); // Sofia non ha prenotazioni TRAMA
  });

  test("PV2-04: prenotazioni annullate fuori dai giorni prenotati", () => {
    const days = bookedDaysForWeek(bookings, MON);
    expect(days).toEqual([{ kidId: "g", kidName: "Giulia", dates: ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"] }]);
  });

  test("PV2-05: etichette della settimana e navigazione", () => {
    expect(weekRangeLabel(MON)).toBe("12 – 18 ottobre");
    expect(weekRangeLabel("2026-09-28")).toBe("28 settembre – 4 ottobre");
    expect(weekRangeLabel("2026-12-28", TODAY)).toBe("28 dicembre – 3 gennaio 2027");
    expect(relativeWeekLabel(MON, TODAY)).toBe("Questa settimana");
    expect(relativeWeekLabel("2026-10-19", TODAY)).toBe("Settimana prossima");
    expect(relativeWeekLabel("2026-11-02", TODAY)).toBeNull();
    expect(mondayOfIso("2026-10-18")).toBe(MON);
    const w = week();
    expect([w.prevMondayIso, w.nextMondayIso]).toEqual(["2026-10-05", "2026-10-19"]);
  });

  test("PV2-06: mese — righe da lunedì, giorni fuori mese senza pallini", () => {
    const m = buildMonthModel({ anyDayIso: TODAY, todayIso: TODAY, kidIdsByDate: (d) => (d === TODAY ? ["g"] : []), closureDates: new Set(["2026-10-16"]) });
    expect(m.label).toBe("ottobre 2026");
    expect(m.rows[0].mondayIso).toBe("2026-09-28");
    expect(m.rows[m.rows.length - 1].cells.some((c) => c.dateIso === "2026-10-31")).toBe(true);
    const today = m.rows.flatMap((r) => r.cells).find((c) => c.isToday)!;
    expect(today.kidIds).toEqual(["g"]);
    expect(m.rows.flatMap((r) => r.cells).find((c) => c.dateIso === "2026-10-16")!.closure).toBe(true);
    expect([m.prevFirstIso, m.nextFirstIso]).toEqual(["2026-09-01", "2026-11-01"]);
  });
});

test.describe("PLANNER-V2 — Stagione", () => {
  const kids = [{ id: "g", name: "Giulia" }, { id: "s", name: "Sofia" }];
  const sw = (index: number, start: string, end: string, covered: { kidId: string; activityName: string; partnerDecision: string }[], over: Partial<{ dismissed: boolean; awaitingPartnerConfirmation: boolean }> = {}) => ({
    index, startDate: start, endDate: end, dismissed: false, awaitingPartnerConfirmation: false, coveredKids: covered, ...over,
  });
  const weeks = [
    sw(1, "2027-06-14", "2027-06-18", [{ kidId: "g", activityName: "Campus", partnerDecision: "accepted" }, { kidId: "s", activityName: "Campus", partnerDecision: "accepted" }]),
    sw(2, "2027-06-21", "2027-06-25", [{ kidId: "g", activityName: "Arte", partnerDecision: "accepted" }]),
    sw(3, "2027-06-28", "2027-07-02", []),
    sw(4, "2027-07-05", "2027-07-09", [], { dismissed: true }),
  ];

  test("PV2-07: settimane raggruppate per mese, sempre una riga ciascuna, stessi stati della Home", () => {
    const g = buildSeasonRows({ weeks, kids, kidFilter: null, todayIso: TODAY, missingSlotsByStart: {}, filter: "all" });
    expect(g.map((m) => m.label)).toEqual(["giugno", "luglio"]);
    expect(g[0].rows.map((r) => r.state)).toEqual(["organized", "to_complete", "to_organize"]);
    expect(g[1].rows[0].state).toBe("not_needed");
    expect(g[0].rows[0].lines).toEqual(["Campus · Giulia, Sofia"]);
    expect(g[0].rows[1].missingKidNames).toEqual(["Sofia"]);
    expect(g[0].rows[1].dateLabel).toBe("21 – 25 giugno");
  });

  test("PV2-08: filtro 'Da sistemare' e filtro per figlio", () => {
    const fix = buildSeasonRows({ weeks, kids, kidFilter: null, todayIso: TODAY, missingSlotsByStart: {}, filter: "to_fix" });
    expect(fix.flatMap((m) => m.rows.map((r) => r.index))).toEqual([2, 3]);
    const giulia = buildSeasonRows({ weeks, kids, kidFilter: "g", todayIso: TODAY, missingSlotsByStart: {}, filter: "all" });
    expect(giulia[0].rows.map((r) => r.state)).toEqual(["organized", "organized", "to_organize"]);
    const coord = buildSeasonRows({ weeks, kids, kidFilter: null, todayIso: TODAY, missingSlotsByStart: { "2027-06-14": 2 }, filter: "all" });
    expect(coord[0].rows[0].state).toBe("to_complete");
  });

  test("PV2-09: settimane passate non organizzate → 'past', mai 'da organizzare'", () => {
    const g = buildSeasonRows({ weeks, kids, kidFilter: null, todayIso: "2027-07-01", missingSlotsByStart: {}, filter: "all" });
    expect(g[0].rows.map((r) => r.state)).toEqual(["organized", "past", "to_organize"]);
  });

  test("PV2-10: copertura per figlio sulle settimane che servono", () => {
    expect(coverageByKid({ weeks, kids })).toEqual([
      { kidId: "g", name: "Giulia", covered: 2, needed: 3 },
      { kidId: "s", name: "Sofia", covered: 1, needed: 3 },
    ]);
  });

  test("PV2-11: Salvati = preferiti non prenotati e non già nel Planner", () => {
    const n = countSavedNotInPlanner({
      saved: [
        { kind: "partner", ref: "a1" },
        { kind: "partner", ref: "a2" },
        { kind: "curated", ref: "lead-1" },
        { kind: "community", ref: "c-1" },
      ],
      bookedActivityDbIds: ["a1"],
      externalSourceRefs: ["lead-1"],
    });
    expect(n).toBe(2);
  });
});

test.describe("PLANNER-V2 — flag, ripiego e release", () => {
  test("PV2-12: PLANNER_V2_ENABLED e NAV_V2_ENABLED nascono spenti e ammettono le coorti", () => {
    for (const f of ["PLANNER_V2_ENABLED", "NAV_V2_ENABLED"] as const) {
      expect(FEATURE_FLAG_REGISTRY[f].defaultValue).toBe(false);
      expect(FEATURE_FLAG_REGISTRY[f].allowedScopes).toContain("cohort");
    }
  });

  test("PV2-13: ogni funzione nella sua release", () => {
    const planner = FEATURE_CATALOG.find((f) => f.key === "planner_v2");
    const nav = FEATURE_CATALOG.find((f) => f.key === "nav_v2");
    expect(planner?.releaseEligible).toBe(true);
    expect(nav?.releaseEligible).toBe(true);
    expect(RELEASE_CATALOG.find((r) => r.id === "planner-v2")?.featureKeys).toEqual(["planner_v2"]);
    expect(RELEASE_CATALOG.find((r) => r.id === "nav-v2")?.featureKeys).toEqual(["nav_v2"]);
  });

  test("PV2-14: Planner attuale come ripiego (flag spento o errore)", () => {
    const page = read("app/nextgen/planner/page.tsx");
    expect(page).toContain('flagName: "PLANNER_V2_ENABLED"');
    expect(page).toMatch(/catch \{\s*plannerV2Enabled = false;/);
    expect(page).toContain("<PlannerClient");
    expect(page).toContain("<PlannerV2Client");
  });

  test("PV2-15: barra — Profilo esce dalla barra solo con NAV_V2, + al centro", () => {
    const nav = read("components/nextgen/NextgenBottomNav.tsx");
    expect(nav).toContain('variant === "v2"');
    expect(nav).toContain("AddSheet");
    const layout = read("app/nextgen/layout.tsx");
    expect(layout).toContain('flagName: "NAV_V2_ENABLED"');
    expect(read("app/nextgen/HomeDashboardV2Client.tsx")).toContain('href="/nextgen/profile"');
    expect(read("app/nextgen/trama/page.tsx")).toContain("Cos&apos;è TRAMA");
  });

  test("PV2-16: nessuna scrittura nuova nei loader e nessuna migration", () => {
    for (const f of ["app/nextgen/planner/planner-v2-data.ts"]) {
      expect(read(f)).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
    }
  });
});

// ─── Correzioni dopo la verifica dal vivo (14/10/2026, pomeriggio) ───────
test.describe("PLANNER-V2 — correzioni verifica live 14/10", () => {
  test("PV2-17: Mappa e Gruppi come pagina interna, con rete di sicurezza", () => {
    const src = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(src).toContain('if (panel === "mappa" || panel === "gruppi")');
    expect(src).toContain("class SafeBoundary extends Component");
    expect(src).toMatch(/<SafeBoundary[\s\S]*<PlannerMapView/);
    expect(src).not.toMatch(/<Sheet title="Mappa"/);
  });

  test("PV2-18: 'Chi fa cosa' nella Settimana, giorno per giorno e uguale per tutta la settimana", () => {
    const src = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(src).toContain("Chi fa cosa");
    expect(src).toContain("function WeekWhoSheet(");
    expect(src).toContain("setWeekBulkResponsibilityAction(");
    expect(src).toContain("Uguale per tutta la settimana");
  });

  test("PV2-19: a estate finita la Stagione elenca le chiusure con le azioni", () => {
    const src = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(src).toContain("Chiusure della scuola");
    expect(src).toMatch(/Trova attività[\s\S]*Apri la settimana/);
    expect(read("app/nextgen/planner/planner-v2-data.ts")).toContain("holidayPeriodsInRange(closurePeriods, todayIso)");
    const p = (start: string, end: string, state: "organized" | "to_organize") => ({
      startDate: start, endDate: end, labels: ["x"], kidIds: ["g"], weekdaysByKid: { g: [start] }, weekdayCount: 2, state,
    });
    const m = buildHolidaySummary({ todayIso: "2026-10-14", periods: [p("2026-11-02", "2026-11-02", "organized"), p("2026-12-07", "2026-12-08", "to_organize")] });
    expect(m?.firstAttention?.startDate).toBe("2026-12-07");
    expect(m?.firstAttention?.dateRange).toBe("7–8 dicembre");
    expect(closureRangeLabel("2026-12-23", "2027-01-06")).toBe("23 dicembre – 6 gennaio");
  });

  test("PV2-20: sul telefono la cornice dell'app è fissa: la pagina non scorre, la barra resta ferma", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/@media \(max-width: 639\.98px\) \{\s*\.app-shell \{\s*position: fixed;/);
    expect(css).toMatch(/html:has\(\.app-shell\),\s*body:has\(\.app-shell\) \{\s*overflow: hidden;/);
  });

  test("PV2-21: saluto della Home senza conteggio degli impegni", () => {
    const src = read("app/nextgen/HomeDashboardV2Client.tsx");
    expect(src).toContain('day === "domenica" ? "Buona" : "Buon"');
    expect(src).not.toContain("nessun impegno oggi");
  });
});
