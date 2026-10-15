// TRAMA — "CHI ACCOMPAGNA" ANCHE PER GLI IMPEGNI AGGIUNTI A MANO
// (15/10/2026, Fabrizio: "Si feriali"). [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { coordinationDaysForWeek, dayCoordinationSlots } from "../../lib/nextgen/planner-week";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");
const MON = "2026-10-12";
const names = { g: "Giulia", s: "Sofia" };
const booking = {
  status: "confirmed", dayDates: ["2026-10-14"], weeks: [] as { startDate: string; endDate: string }[],
  kidIds: ["g"], kidNames: ["Giulia"],
};

test.describe("TRAMA — Chi accompagna sugli impegni [no browser]", () => {
  test("CA-01 impegno a mano: conta nei giorni feriali coperti, si unisce alle prenotazioni", () => {
    const out = coordinationDaysForWeek(
      [booking],
      [
        { startDate: "2026-10-13", endDate: "2026-10-13", kidIds: ["s"] }, // martedì, Sofia
        { startDate: "2026-10-14", endDate: "2026-10-15", kidIds: ["g"] }, // mer–gio, Giulia (mer già prenotato)
      ],
      MON,
      names
    );
    expect(out).toEqual([
      { kidId: "g", kidName: "Giulia", dates: ["2026-10-14", "2026-10-15"] },
      { kidId: "s", kidName: "Sofia", dates: ["2026-10-13"] },
    ]);
  });

  test("CA-02 weekend, altre settimane, figli sconosciuti e impegni senza figli: fuori", () => {
    const out = coordinationDaysForWeek(
      [],
      [
        { startDate: "2026-10-17", endDate: "2026-10-18", kidIds: ["s"] }, // sabato–domenica
        { startDate: "2026-10-20", endDate: "2026-10-20", kidIds: ["s"] }, // settimana dopo
        { startDate: "2026-10-13", endDate: "2026-10-13", kidIds: ["x"] }, // figlio non in famiglia
        { startDate: "2026-10-13", endDate: "2026-10-13", kidIds: [] },
      ],
      MON,
      names
    );
    expect(out).toEqual([]);
  });

  test("CA-03 Planner V2: settimana, 'Chi fa cosa', singolo giorno e stagione usano la stessa regola", () => {
    const src = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(src).not.toContain("bookedDaysForWeek(");
    expect((src.match(/coordinationDaysForWeek\(bookings, /g) ?? []).length).toBe(3);
    expect(read("lib/nextgen/planner-week.ts")).toContain(
      "coordinationDaysForWeek(input.bookings, input.externalItems, monday, input.kidNameById)"
    );
  });

  test("CA-04 Home: Porta/Ritira di un giorno tutto l'anno (ottobre), impegni a mano inclusi, weekend no", () => {
    const base = {
      bookings: [booking],
      externalItems: [{ startDate: "2026-10-13", endDate: "2026-10-13", kidIds: ["s"] }],
      responsibilities: [
        { kidId: "s", weekStartDate: MON, weekday: "mar" as const, moment: "andata" as const, responsible: "io" as const, responsibleLabel: null },
      ],
      kidNameById: names,
      labelFor: () => "Papà",
    };
    expect(dayCoordinationSlots({ ...base, dateIso: "2026-10-13" })).toEqual([
      { kidId: "s", kidName: "Sofia", moment: "andata", label: "Papà" },
      { kidId: "s", kidName: "Sofia", moment: "ritorno", label: null },
    ]);
    expect(dayCoordinationSlots({ ...base, dateIso: "2026-10-14" }).map((x) => x.kidName)).toEqual(["Giulia", "Giulia"]);
    expect(dayCoordinationSlots({ ...base, dateIso: "2026-10-12" })).toEqual([]); // lunedì: niente
    expect(dayCoordinationSlots({ ...base, dateIso: "2026-10-17" })).toEqual([]); // sabato
  });

  test("CA-05 Home V2: 'Oggi' e 'Da fare' usano la regola del Planner, non più solo l'estate", () => {
    const src = read("app/nextgen/home-v2-data.ts");
    expect(src).not.toContain("getTodayResponsibilities");
    expect(src).not.toContain("computeCoordinationGap");
    expect(src).toContain("dayCoordinationSlots({ ...coordinationInput, dateIso: todayIso })");
    expect(src).toContain("dayCoordinationSlots({ ...coordinationInput, dateIso: date })");
    // la Home attuale (senza V2) resta com'era
    expect(read("app/nextgen/page.tsx")).toContain("getKidsBookedDaysForWeek");
  });
});
