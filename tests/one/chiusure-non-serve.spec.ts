// TRAMA — CHIUSURE DELLA SCUOLA: FILTRO PER FIGLIO E "NON SERVE" (20/10/2026).
// Fabrizio (screenshot 7–13 dicembre, filtro su Lino): "Franchidea ha un
// impegno e me lo segna come da dare… e su Lino non ho una CTA per segnare
// come non necessario o per fargli fare qualcosa". [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { buildWeekModel, uncoveredClosureDays } from "../../lib/nextgen/planner-week";
import { notNeededCoverage, notNeededKey, weekdaysOfWeek } from "../../lib/nextgen/closure-not-needed";
import { closureState } from "../../lib/nextgen/holiday-summary";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

const kids = [
  { id: "lino", name: "Lino" },
  { id: "fra", name: "Franchidea" },
];
const gara = {
  id: "g1",
  kind: "activity" as const,
  title: "Gara Rimininfiera Winter",
  startDate: "2026-12-05",
  endDate: "2026-12-08",
  allDay: true,
  startTime: null,
  endTime: null,
  location: null,
  sourceType: "manual",
  kidIds: ["fra"],
};
function week(kidFilter: string | null) {
  return buildWeekModel({
    mondayIso: "2026-12-07",
    todayIso: "2026-10-20",
    bookings: [],
    externalItems: [gara] as never,
    hoursByActivityDbId: {},
    kidNameById: { lino: "Lino", fra: "Franchidea" },
    responsibilities: [],
    labelFor: () => "",
    kidFilter,
    closureLabelsByDate: { "2026-12-07": ["Ponte dell'Immacolata"], "2026-12-08": ["Immacolata"] },
  });
}

test.describe("TRAMA — chiusure: filtro e Non serve [no browser]", () => {
  test("CNS-01 con il filtro su Lino, Franchidea (che ha la gara) non risulta scoperta", () => {
    // Prima del fix: con il filtro su Lino il calcolo vedeva solo gli
    // impegni di Lino e segnalava anche Franchidea.
    const filtered = week("lino");
    expect(uncoveredClosureDays(filtered.days, kids).map((u) => u.kidName)).toEqual(["Lino"]);
    // Senza filtro: stesso risultato.
    expect(uncoveredClosureDays(week(null).days, kids).map((u) => u.kidName)).toEqual(["Lino"]);
    // I pallini della striscia restano filtrati (solo Lino), il conteggio no.
    const monday = filtered.days.find((d) => d.dateIso === "2026-12-07")!;
    expect(monday.kidIds).toEqual([]);
    expect(monday.allKidIds).toEqual(["fra"]);
  });

  test("CNS-02 'Non serve' per Lino in quella settimana toglie l'avviso", () => {
    const handled = new Set(weekdaysOfWeek("2026-12-07").map((d) => `lino|${d}`));
    expect(uncoveredClosureDays(week(null).days, kids, handled)).toEqual([]);
    expect(notNeededKey("lino", "2026-12-07")).toBe("lino|2026-12-07");
  });

  test("CNS-03 'Non serve' conta come copertura: la chiusura diventa organizzata", () => {
    const period = {
      startDate: "2026-12-07",
      endDate: "2026-12-08",
      labels: ["Immacolata"],
      kidIds: ["lino", "fra"],
      weekdaysByKid: { lino: ["2026-12-07", "2026-12-08"], fra: ["2026-12-07", "2026-12-08"] },
      weekdayCount: 2,
    };
    const garaCoverage = [{ kidIds: ["fra"], dates: ["2026-12-05", "2026-12-06", "2026-12-07", "2026-12-08"] }];
    expect(closureState(period, garaCoverage)).toBe("to_complete");
    expect(closureState(period, [...garaCoverage, ...notNeededCoverage([{ kidId: "lino", weekStartDate: "2026-12-07" }])])).toBe("organized");
  });

  test("CNS-04 cablaggio: stessa tabella degli override scuola, nessuna migrazione; Planner, Home e promemoria", () => {
    const loader = read("lib/data/closure-not-needed.ts");
    expect(loader).toContain('.from("school_calendar_overrides")');
    expect(loader).toContain('.eq("override_type", "not_needed")');
    for (const p of ["app/nextgen/planner/planner-v2-data.ts", "app/nextgen/home-v2-data.ts", "lib/data/family-reminders.ts"]) {
      expect(read(p), p).toContain("notNeededCoverage(closureNotNeeded)");
    }
    const client = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(client).toContain("uncoveredClosureDays(week.days, alertKids, handledClosureDays)");
    expect(client).toContain('setSchoolCalendarOverrideAction(monday, "not_needed", kidId)');
    expect(client).toContain("clearSchoolCalendarOverrideAction(monday, kidId)");
    expect(client).toContain("Trova attività");
    expect(client).toContain("Aggiungi impegno");
    expect(client).toContain("Non serve");
  });
});
