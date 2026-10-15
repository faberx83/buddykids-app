// TRAMA — "CHI ACCOMPAGNA" ANCHE PER GLI IMPEGNI AGGIUNTI A MANO
// (15/10/2026, Fabrizio: "Si feriali"). [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { coordinationDaysForWeek } from "../../lib/nextgen/planner-week";

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
});
