// Portale centri V2, Attività (28/10/2026): crea da modello e duplica.
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  ACTIVITY_TEMPLATES,
  describeDates,
  duplicateName,
  getTemplate,
  templateDates,
  weeklyFromDaily,
} from "../../lib/centers/activity-templates";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");

test.describe("Attività V2 — modelli (logica pura)", () => {
  test("PA-01 tre modelli: ponte, Natale, pomeriggi", () => {
    expect(ACTIVITY_TEMPLATES.map((t) => t.key)).toEqual(["ponte", "natale", "pomeriggi"]);
    expect(getTemplate("natale")?.title).toBe("Vacanze di Natale");
    expect(getTemplate("estate")).toBeNull();
    expect(getTemplate(null)).toBeNull();
  });

  test("PA-02 ponte: 7 e 8 dicembre di quest'anno, poi dell'anno dopo", () => {
    expect(templateDates("ponte", "2026-10-28")).toEqual(["2026-12-07", "2026-12-08"]);
    expect(templateDates("ponte", "2026-12-08")).toEqual(["2026-12-08"]);
    expect(templateDates("ponte", "2026-12-09")).toEqual(["2027-12-07", "2027-12-08"]);
  });

  test("PA-03 Natale: feriali dal 22/12 al 6/1, senza 25, 26, 1 e 6; mai date passate", () => {
    const d = templateDates("natale", "2026-10-28");
    expect(d[0]).toBe("2026-12-22");
    expect(d).not.toContain("2026-12-25");
    expect(d).not.toContain("2026-12-26");
    expect(d).not.toContain("2027-01-01");
    expect(d).not.toContain("2027-01-06");
    expect(d).toContain("2027-01-05");
    for (const x of d) {
      const dow = new Date(`${x}T00:00:00Z`).getUTCDay();
      expect(dow >= 1 && dow <= 5, x).toBe(true);
    }
    // Il 2 gennaio si prosegue con la stagione in corso.
    const jan = templateDates("natale", "2027-01-02");
    expect(jan[0]).toBe("2027-01-04");
    expect(jan.every((x) => x >= "2027-01-02")).toBe(true);
    // Dopo l'Epifania si passa al Natale successivo.
    expect(templateDates("natale", "2027-01-10")[0]).toBe("2027-12-22");
  });

  test("PA-04 pomeriggi: 30 feriali dal prossimo lunedì", () => {
    const d = templateDates("pomeriggi", "2026-10-28"); // mercoledì
    expect(d).toHaveLength(30);
    expect(d[0]).toBe("2026-11-02");
    const fromMonday = templateDates("pomeriggi", "2026-11-02"); // lunedì: il successivo
    expect(fromMonday[0]).toBe("2026-11-09");
  });

  test("PA-05 descrizione dei giorni, prezzo a settimana, nome della copia", () => {
    expect(describeDates(["2026-12-07", "2026-12-08"])).toBe("7 e 8 dicembre");
    expect(describeDates(["2026-12-22", "2026-12-23", "2027-01-05"])).toBe("dal 22 dicembre al 5 gennaio, giorni feriali");
    expect(describeDates([])).toBe("");
    expect(weeklyFromDaily(30)).toBe(150);
    expect(weeklyFromDaily(-1)).toBe(0);
    expect(duplicateName("Pomeriggi")).toBe("Pomeriggi (copia)");
    expect(duplicateName("Pomeriggi (copia)")).toBe("Pomeriggi (copia)");
  });
});

test.describe("Attività V2 — flusso (controlli sul sorgente)", () => {
  test("PA-06 elenco V2 solo col guscio; date, modelli, duplica, anteprima", () => {
    const page = read("app/center/activities/page.tsx");
    expect(page).toContain("partnerShellEnabledForCurrentUser()");
    expect(page).toContain("<ActivitiesV2");
    expect(page).toContain("Le tue attività"); // l'elenco di prima resta
    const v2 = read("components/center/ActivitiesV2.tsx");
    for (const s of ["Mancano le date", "Crea da modello", "Aggiungi le date", "Date e posti", "Anteprima", "DuplicateActivityButton"]) {
      expect(v2, s).toContain(s);
    }
  });

  test("PA-07 da modello: solo col guscio; giorni della stagione al posto delle 6 settimane di default", () => {
    const page = read("app/center/activities/new/page.tsx");
    expect(page).toContain("TemplateActivityForm");
    expect(page).toContain("partnerShellEnabledForCurrentUser()");
    const a = read("app/actions/center-activities-v2.ts");
    expect(a).toContain('booking_mode: "day_only"');
    expect(a).toContain("templateDates(template.key");
    expect(a).not.toContain("defaultActivityDaysSeed");
    expect(a).toContain('revalidatePath("/center")');
  });

  test("PA-08 duplica: solo attività del proprio centro; non copia date, valutazioni, certificazioni", () => {
    const a = read("app/actions/center-activities-v2.ts");
    expect(a).toContain("row.center_id !== centerDbId");
    const cols = a.slice(a.indexOf("const DUPLICATE_COLUMNS"), a.indexOf("] as const"));
    for (const forbidden of ['"rating"', '"reviews_count"', '"badges"', '"spots_left"', '"slug"', '"id"']) {
      expect(cols, forbidden).not.toContain(forbidden);
    }
    const dup = a.slice(a.indexOf("export async function duplicateActivityAction"));
    expect(dup).not.toContain('from("activity_days")');
    expect(dup).not.toContain('from("activity_weeks")');
  });
});
