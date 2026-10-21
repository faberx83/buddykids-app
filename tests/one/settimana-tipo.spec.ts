// TRAMA — SETTIMANA TIPO, FASE A (21/10/2026, release "settimana-tipo").
// Caso reale: gli orari settimanali di Noemi e Bianca (PDF del 20/10).
// Iniziativa: claude/INIZIATIVA_planner_routine_settimanale.md. [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  occurrenceDates,
  occursOn,
  parseRecurrence,
  recurrenceLabel,
  schoolYearRange,
  serializeRecurrence,
  isSchoolMetadata,
  type WeeklyRecurrence,
} from "../../lib/planner/recurrence";
import { buildTodayAgenda, type AgendaExternalInput } from "../../lib/nextgen/today-agenda";
import { coordinationDaysForWeek, itemsInWeek } from "../../lib/nextgen/planner-week";
import { buildCoverage } from "../../lib/nextgen/holiday-summary";
import { otherDaysOfCommitments } from "../../lib/nextgen/assign-plus";
import { validateExternalPlannerItemInput } from "../../lib/planner/external-planner-items-core";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { getReleaseById } from "../../lib/releases/catalog";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");
const weekly = (weekdays: number[], interval: 1 | 2 = 1, anchor = "2026-09-14"): WeeklyRecurrence => ({ freq: "weekly", weekdays, interval, anchor });
const item = (over: Partial<AgendaExternalInput>): AgendaExternalInput => ({
  id: "x",
  title: "x",
  startDate: "2026-09-14",
  endDate: "2027-06-06",
  allDay: false,
  startTime: "17:00",
  endTime: "18:00",
  location: null,
  sourceType: "manual",
  kidIds: ["noemi"],
  recurrence: null,
  isSchool: false,
  ...over,
});

// Settimana di prova: lun 19 – dom 25 ottobre 2026.
const NOEMI = {
  scuola: item({ id: "sn", title: "Scuola", startTime: "08:30", endTime: "16:30", recurrence: weekly([1, 2, 3, 4, 5]), isSchool: true }),
  gateway: item({ id: "gw", title: "Gateway", location: "Irith", recurrence: weekly([1]) }),
  catechismo: item({ id: "ca", title: "Catechismo", startDate: "2027-01-11", recurrence: weekly([2]) }),
  ritmicaMer: item({ id: "rm", title: "Ritmica", location: "Lamennais", startTime: "18:00", endTime: "20:00", recurrence: weekly([3]) }),
  nuoto: item({ id: "nu", title: "Nuoto", location: "Corsico", startTime: "11:00", endTime: "12:00", recurrence: weekly([6]) }),
};
const BIANCA_INGLESE = item({ id: "in", title: "Inglese", kidIds: ["bianca"], startTime: "14:30", endTime: "16:00", recurrence: weekly([5], 2, "2026-10-19") });
const all = [...Object.values(NOEMI), BIANCA_INGLESE];
const kidNameById = { noemi: "Noemi", bianca: "Bianca" };

test.describe("TRAMA — Settimana tipo [no browser]", () => {
  test("ST-01 ricorrenza: solo i giorni scelti, settimane alterne, 'da gennaio'", () => {
    expect(occursOn(NOEMI.ritmicaMer, "2026-10-21")).toBe(true); // mercoledì
    expect(occursOn(NOEMI.ritmicaMer, "2026-10-22")).toBe(false); // giovedì: prima risultava "tutti i giorni"
    expect(occursOn(NOEMI.nuoto, "2026-10-24")).toBe(true); // sabato
    expect(occursOn(BIANCA_INGLESE, "2026-10-23")).toBe(true);
    expect(occursOn(BIANCA_INGLESE, "2026-10-30")).toBe(false); // settimana "no"
    expect(occursOn(BIANCA_INGLESE, "2026-11-06")).toBe(true);
    expect(occursOn(NOEMI.catechismo, "2026-10-20")).toBe(false); // da gennaio
    expect(occursOn(NOEMI.catechismo, "2027-01-12")).toBe(true);
    // Senza ricorrenza: ogni giorno del periodo (comportamento di sempre).
    expect(occursOn({ startDate: "2026-12-05", endDate: "2026-12-08" }, "2026-12-06")).toBe(true);
    expect(occurrenceDates(NOEMI.ritmicaMer, "2026-10-19", "2026-11-01")).toEqual(["2026-10-21", "2026-10-28"]);
  });

  test("ST-02 lettura dal database: forme non valide = nessuna ricorrenza; etichette in italiano", () => {
    expect(parseRecurrence(null)).toBeNull();
    expect(parseRecurrence({ freq: "daily" })).toBeNull();
    expect(parseRecurrence({ freq: "weekly", weekdays: [] })).toBeNull();
    expect(parseRecurrence({ freq: "weekly", weekdays: [3, 3, 9, 1] })).toEqual({ freq: "weekly", weekdays: [1, 3], interval: 1, anchor: "1970-01-05" });
    expect(parseRecurrence({ freq: "weekly", weekdays: [5], interval: 2, anchor: "2026-10-23" })?.anchor).toBe("2026-10-19");
    expect(serializeRecurrence(weekly([3]))).toEqual({ freq: "weekly", weekdays: [3], interval: 1, anchor: "2026-09-14" });
    expect(recurrenceLabel(weekly([3]))).toBe("ogni mercoledì");
    expect(recurrenceLabel(weekly([1, 2, 3, 4, 5]))).toBe("dal lunedì al venerdì");
    expect(recurrenceLabel(weekly([5], 2))).toBe("ogni venerdì, settimane alterne");
    expect(recurrenceLabel(weekly([3, 5]))).toBe("mer e ven");
    expect(isSchoolMetadata({ role: "school" })).toBe(true);
    expect(schoolYearRange("2026-10-21")).toEqual({ startDate: "2026-09-01", endDate: "2027-06-30" });
    expect(schoolYearRange("2027-07-15")).toEqual({ startDate: "2027-09-01", endDate: "2028-06-30" });
  });

  test("ST-03 agenda di Noemi: mercoledì scuola (riga discreta) + ritmica; giovedì solo scuola; nei giorni di chiusura niente scuola", () => {
    const mer = buildTodayAgenda({ todayIso: "2026-10-21", bookings: [], externalItems: all, hoursByActivityDbId: {}, kidNameById });
    expect(mer.map((e) => e.title)).toEqual(["Scuola", "Ritmica"]);
    expect(mer[0].school).toBe(true);
    const gio = buildTodayAgenda({ todayIso: "2026-10-22", bookings: [], externalItems: all, hoursByActivityDbId: {}, kidNameById });
    expect(gio.map((e) => e.title)).toEqual(["Scuola"]);
    const ponte = buildTodayAgenda({ todayIso: "2026-12-07", bookings: [], externalItems: all, hoursByActivityDbId: {}, kidNameById, schoolClosedDates: ["2026-12-07"] });
    expect(ponte.map((e) => e.title)).toEqual(["Gateway"]);
  });

  test("ST-04 Chi accompagna: la ritmica solo il mercoledì; la scuola non crea passaggi in questa fase", () => {
    const days = coordinationDaysForWeek([], all, "2026-10-19", kidNameById);
    const noemi = days.find((d) => d.kidId === "noemi")!;
    expect(noemi.dates).toEqual(["2026-10-19", "2026-10-21"]); // Gateway lun, Ritmica mer (sabato fuori: lun–ven)
    expect(days.find((d) => d.kidId === "bianca")!.dates).toEqual(["2026-10-23"]);
  });

  test("ST-05 coperture: un impegno ricorrente copre solo i suoi giorni; la scuola non copre mai", () => {
    // Ritmica (2 ore) non basta a coprire una giornata di scuola chiusa: come prima.
    expect(buildCoverage({ bookings: [], externalItems: [NOEMI.ritmicaMer] })).toEqual([]);
    const nonni = item({ id: "nn", title: "Dai nonni", allDay: true, startTime: null, endTime: null, recurrence: weekly([3]) });
    const cov = buildCoverage({ bookings: [], externalItems: [nonni, NOEMI.scuola] });
    expect(cov).toHaveLength(1);
    expect(cov[0].dates).toContain("2026-12-09");
    expect(cov[0].dates).not.toContain("2026-12-07");
  });

  test("ST-06 'Aggiunti da te, questa settimana' e 'tutto l'impegno' rispettano la ricorrenza", () => {
    expect(itemsInWeek(all, "2026-10-26").map((i) => i.id)).toEqual(["gw", "rm", "nu"]); // inglese: settimana "no"; scuola mai
    expect(itemsInWeek(all, "2026-10-19").map((i) => i.id)).toContain("in");
    const r = otherDaysOfCommitments({ dateIso: "2026-10-21", todayIso: "2026-10-20", kidId: "noemi", bookings: [], externalItems: all });
    expect(r).toHaveLength(1);
    expect(r[0].title).toBe("Ritmica");
    expect(r[0].dates.slice(0, 3)).toEqual(["2026-10-28", "2026-11-04", "2026-11-11"]);
  });

  test("ST-07 salvataggio: validazione, colonna già esistente (nessuna migrazione), flag e release", () => {
    const base = { kind: "activity" as const, title: "Ritmica", startDate: "2026-09-14", endDate: "2027-06-06", allDay: false, startTime: "18:00", endTime: "20:00", location: null, notes: null, externalUrl: null, kidIds: ["noemi"] };
    expect(validateExternalPlannerItemInput({ ...base, recurrence: weekly([3]) }).valid).toBe(true);
    expect(validateExternalPlannerItemInput({ ...base, recurrence: { ...weekly([3]), weekdays: [] } }).valid).toBe(false);
    expect(validateExternalPlannerItemInput({ ...base, endDate: "2029-06-06", recurrence: weekly([3]) }).valid).toBe(false);
    const data = read("lib/data/external-planner-items.ts");
    expect(data).toContain("recurrence_rule, source_metadata, external_planner_item_kids ( kid_id )");
    expect(data).toContain("recurrence_rule: serializeRecurrence(input.recurrence),");
    expect(data).toContain("...(input.isSchool ? { source_metadata: { role: SCHOOL_ROLE } } : {}),");
    expect(data).toContain("...(input.recurrence !== undefined ? { recurrence_rule: serializeRecurrence(input.recurrence) } : {}),");
    expect(FEATURE_FLAG_REGISTRY.WEEKLY_ROUTINE_ENABLED.defaultValue).toBe(false);
    expect(FEATURE_CATALOG.find((f) => f.key === "weekly_routine")?.releaseEligible).toBe(true);
    expect(getReleaseById("settimana-tipo")?.featureKeys).toEqual(["weekly_routine"]);
    // Interfaccia dietro la release: "Si ripete ogni settimana" e "Orario della scuola".
    expect(read("components/nextgen/ExternalPlannerItemsSection.tsx")).toContain("{routineEnabled && (");
    expect(read("app/nextgen/profile/famiglia/page.tsx")).toContain("weeklyRoutineEnabled && externalEnabled");
  });
});
