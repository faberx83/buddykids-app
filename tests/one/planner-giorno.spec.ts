// TRAMA — PLANNER UN GIORNO ALLA VOLTA (21/10/2026, release "planner-giorno").
// Caso reale: la settimana di Giovanni (profilo di test) del 19–25 ottobre:
// Franchidea scuola 8:00–13:40 e Ritmica mer/ven 15:30–19:00 (andata sempre
// Zio Sberla, ritorno del mercoledì da decidere), Lino scuola 8:30–16:30.
// Versione A delle anteprime mostrate a Fabrizio. [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { buildWeekModel, weekStatusParts } from "../../lib/nextgen/planner-week";
import { buildKidDayChains, dayTeaser, defaultDayIso, PLANNER_DAY_VIEW_FLAG } from "../../lib/nextgen/planner-day";
import type { WeekResponsibility } from "../../lib/nextgen/responsibility-options";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { getReleaseById } from "../../lib/releases/catalog";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");
const weekly = (weekdays: number[]) => ({ freq: "weekly" as const, weekdays, interval: 1 as const, anchor: "2026-08-31" });
const ext = (o: Record<string, unknown>) => ({
  allDay: false,
  location: null,
  sourceType: "manual",
  recurrence: null,
  isSchool: false,
  startDate: "2026-09-01",
  endDate: "2027-06-30",
  ...o,
});
const items = [
  ext({ id: "sg", title: 'Scuola Primaria "San Giusto"', kidIds: ["lino"], startTime: "08:30:00", endTime: "16:30:00", recurrence: weekly([1, 2, 3, 4, 5]), isSchool: true }),
  ext({ id: "fg", title: "Fondazione Grossman", kidIds: ["fra"], startTime: "08:00:00", endTime: "13:40:00", recurrence: weekly([1, 2, 3, 4, 5]), isSchool: true }),
  ext({ id: "rt", title: "Ritmica", kidIds: ["fra"], location: "Via F.R. Lamennais", startDate: "2026-10-21", startTime: "15:30:00", endTime: "19:00:00", recurrence: weekly([3, 5]) }),
  ext({ id: "pv", title: "Priva", kidIds: ["fra"], startDate: "2026-10-20", endDate: "2026-10-20", allDay: true, startTime: null, endTime: null }),
];
const resp = (weekday: WeekResponsibility["weekday"], moment: WeekResponsibility["moment"], label: string): WeekResponsibility => ({
  kidId: "fra",
  weekStartDate: "2026-10-19",
  weekday,
  moment,
  responsible: "altro",
  responsibleLabel: label,
});
const responsibilities = [
  ...(["lun", "mar", "mer", "gio", "ven"] as const).map((d) => resp(d, "andata", "Zio Sberla")),
  resp("mar", "ritorno", "Mamma"),
];
const kids = [
  { id: "lino", name: "Lino" },
  { id: "fra", name: "Franchidea" },
];
function week(todayIso = "2026-10-21", kidFilter: string | null = null) {
  return buildWeekModel({
    mondayIso: "2026-10-19",
    todayIso,
    bookings: [],
    externalItems: items as never,
    hoursByActivityDbId: {},
    kidNameById: { lino: "Lino", fra: "Franchidea" },
    responsibilities,
    labelFor: (r) => r.responsibleLabel ?? "",
    kidFilter,
    closureLabelsByDate: {},
    schoolClosedDates: [],
  });
}
const dayOf = (iso: string) => week().days.find((d) => d.dateIso === iso)!;

test.describe("TRAMA — Planner un giorno alla volta [no browser]", () => {
  test("PG-01 mercoledì di Franchidea: entra, esce, Ritmica, ritiro da decidere; andata sul primo passaggio", () => {
    const [lino, fra] = buildKidDayChains(dayOf("2026-10-21"), kids);
    expect(fra.steps.map((s) => [s.time, s.title])).toEqual([
      ["08:00", "Entra a scuola"],
      ["13:40", "Esce da scuola"],
      ["15:30", "Ritmica"],
      ["19:00", "Ritiro da Ritmica"],
    ]);
    expect(fra.steps[0].detail).toBe("Fondazione Grossman");
    expect(fra.steps[0].passage).toEqual({ moment: "andata", label: "Zio Sberla" });
    expect(fra.steps[1].passage).toBeNull(); // uscita da scuola: passaggio suo con la Fase B
    expect(fra.steps[2].detail).toBe("Via F.R. Lamennais · fino alle 19:00");
    expect(fra.steps[3].passage).toEqual({ moment: "ritorno", label: null });
    expect(fra.missing).toBe(1);
    expect(fra.onlySchool).toBe(false);
    // Lino: solo scuola, nessun passaggio (la scuola non ne crea in questa fase).
    expect(lino.onlySchool).toBe(true);
    expect(lino.steps.every((s) => s.passage === null)).toBe(true);
    expect(lino.missing).toBe(0);
  });

  test("PG-02 martedì: Priva tutto il giorno prima della scuola; ritorno della Mamma deciso", () => {
    const [, fra] = buildKidDayChains(dayOf("2026-10-20"), kids);
    expect(fra.steps[0]).toMatchObject({ kind: "all_day", time: null, title: "Priva" });
    expect(fra.steps[0].passage).toEqual({ moment: "andata", label: "Zio Sberla" });
    const pickup = fra.steps[fra.steps.length - 1];
    expect(pickup).toMatchObject({ kind: "pickup", time: null, title: "Ritiro", passage: { moment: "ritorno", label: "Mamma" } });
    expect(fra.missing).toBe(0);
  });

  test("PG-03 giorno aperto: oggi se è in settimana, altrimenti il primo giorno utile", () => {
    expect(defaultDayIso(week("2026-10-21"), "2026-10-21")).toBe("2026-10-21");
    // Settimana futura vista da oggi: il primo giorno con qualcosa (lunedì, scuola).
    expect(defaultDayIso(week("2026-10-14"), "2026-10-14")).toBe("2026-10-19");
    // Settimana passata: niente di "futuro" → primo giorno con qualcosa.
    expect(defaultDayIso(week("2026-11-02"), "2026-11-02")).toBe("2026-10-19");
  });

  test("PG-04 anteprima del giorno dopo e conteggio della settimana senza la scuola", () => {
    expect(dayTeaser(dayOf("2026-10-22"))).toBe("solo scuola");
    expect(dayTeaser(dayOf("2026-10-23"))).toBe("Ritmica");
    expect(dayTeaser(dayOf("2026-10-24"))).toBe("giornata libera");
    // Priva + Ritmica mer + Ritmica ven = 3 (le dieci righe di scuola non contano).
    expect(weekStatusParts(week()).entries).toBe("3 impegni");
    expect(weekStatusParts(week()).missing).toBe("2 passaggi da assegnare"); // ritorno mer e ven
  });

  test("PG-05 filtro su Lino: la catena di Franchidea non c'è", () => {
    const d = week("2026-10-21", "lino").days.find((x) => x.dateIso === "2026-10-21")!;
    const [lino] = buildKidDayChains(d, [{ id: "lino", name: "Lino" }]);
    expect(lino.steps.map((s) => s.title)).toEqual(["Entra a scuola", "Esce da scuola"]);
  });

  test("PG-06 dietro la release: flag spento di default, catalogo, release, ripiego sulla lista dei sette giorni", () => {
    expect(PLANNER_DAY_VIEW_FLAG).toBe("PLANNER_DAY_VIEW_ENABLED");
    expect(FEATURE_FLAG_REGISTRY.PLANNER_DAY_VIEW_ENABLED.defaultValue).toBe(false);
    expect(FEATURE_CATALOG.find((f) => f.key === "planner_day_view")?.releaseEligible).toBe(true);
    expect(getReleaseById("planner-giorno")?.featureKeys).toEqual(["planner_day_view"]);
    const client = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(client).toContain("{dayView && selectedIdx >= 0 ? (");
    expect(client).toContain("dayView ? setPicked(d.dateIso) : dayRefs.current[d.dateIso]?.scrollIntoView");
    // Con la release spenta resta la sezione "Aggiunti da te, questa settimana".
    expect(client).toContain('{externalEnabled && view === "settimana" && !dayViewEnabled && (');
    expect(client).toContain("collapsible");
    expect(read("app/nextgen/planner/planner-v2-data.ts")).toContain("flagOn(PLANNER_DAY_VIEW_FLAG, userId, role),");
    // Il + della barra apre comunque "Nuovo impegno": la scheda chiusa monta il foglio.
    const section = read("components/nextgen/ExternalPlannerItemsSection.tsx");
    expect(section).toContain('if (collapsible && !expanded && (mode === "idle" || mode === "creating")) {');
  });
});
