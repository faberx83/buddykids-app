// TRAMA — Feedback dal vivo del 15/10/2026 (mattina). [no browser]
//  1. "Indietro" chiude i fogli (+, Mese, Chi accompagna, filtri, Mappa/Gruppi).
//  2. Onboarding: il genere del figlio.
//  3. "Ponti e vacanze": toccando una settimana si apre nel Planner.
//  4. "Un impegno" legato alla settimana aperta nel Planner.
//  5. Pallini spiegati (legenda) e "chi resta scoperto" nei giorni di scuola chiusa.
//  6. Salvati (ex Preferiti) nello stile V2.

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { newExternalItemHref, defaultDateForWeek, NEW_EXTERNAL_ITEM_HREF } from "../../lib/planner/new-external-item-link";
import { uncoveredClosureDays, joinItalian } from "../../lib/nextgen/planner-week";
import { buildHolidaySummary } from "../../lib/nextgen/holiday-summary";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

test.describe("TRAMA — feedback 15/10 [no browser]", () => {
  test("FB15-01 'Indietro' chiude i fogli: hook condiviso su +, filtri, fogli del Planner, Mappa/Gruppi", () => {
    const hook = read("lib/nextgen/use-close-on-back.ts");
    expect(hook).toContain("window.history.pushState");
    expect(hook).toContain('window.addEventListener("popstate", onPop)');
    expect(hook).toContain("window.history.back()");
    expect(read("components/nextgen/AddSheet.tsx")).toContain("useCloseOnBack(open, onClose)");
    expect(read("components/nextgen/AddSheet.tsx")).toContain("closeThenNavigate(o.href)");
    expect(read("components/nextgen/DiscoverFiltersSheet.tsx")).toContain("useCloseOnBack(open, onClose)");
    const planner = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(planner).toContain("useCloseOnBack(true, onClose)");
    expect(planner).toContain('useCloseOnBack((panel === "mappa" || panel === "gruppi") && !initialPanel');
  });

  test("FB15-02 onboarding: genere facoltativo passato ad addKidAction", () => {
    const src = read("components/nextgen/OnboardingV2.tsx");
    expect(src).toContain("addKidAction(name, birthDate, gender || undefined, interests, declarationAccepted)");
    expect(src).toContain('["F", "Una bambina"]');
    expect(src).toContain('["M", "Un bambino"]');
  });

  test("FB15-03 'Ponti e vacanze': le celle hanno il lunedì e aprono la settimana", () => {
    const model = buildHolidaySummary({
      todayIso: "2026-10-15",
      periods: [
        {
          startDate: "2026-12-07",
          endDate: "2026-12-08",
          labels: ["Ponte di Sant'Ambrogio"],
          kidIds: ["lino"],
          weekdaysByKid: { lino: ["2026-12-07", "2026-12-08"] },
          weekdayCount: 2,
          state: "to_organize",
        } as never,
      ],
    });
    const cell = model?.cells.find((c) => c.closure);
    expect(cell?.weekStart).toBe("2026-12-07");
    const card = read("components/nextgen/SeasonSummaryCard.tsx");
    expect(card).toContain("weekHref(c.weekStart!)");
    expect(read("app/nextgen/HomeDashboardV2Client.tsx")).toContain("weekHref={(week) => `/nextgen/planner?week=${week}`}");
    expect(read("app/nextgen/planner/PlannerV2Client.tsx")).toContain("<SeasonSummaryCard model={summary} onWeekClick={onOpenWeek} />");
  });

  test("FB15-04 'Un impegno' nella settimana aperta: link con ?week= e data proposta", () => {
    expect(newExternalItemHref(null)).toBe(NEW_EXTERNAL_ITEM_HREF);
    expect(newExternalItemHref("2026-12-07")).toBe("/nextgen/planner?week=2026-12-07&nuovo=impegno#impegni");
    expect(newExternalItemHref("non-data")).toBe(NEW_EXTERNAL_ITEM_HREF);
    expect(defaultDateForWeek("2026-12-07", "2026-10-15")).toBe("2026-12-07");
    expect(defaultDateForWeek("2026-10-12", "2026-10-15")).toBe("2026-10-15");
    expect(read("components/nextgen/AddSheet.tsx")).toContain("href: newExternalItemHref(plannerWeek)");
    const planner = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(planner).toContain('url.searchParams.set("week", monday)');
    expect(planner).toContain("defaultDate={defaultDateForWeek(monday, todayIso)}");
    expect(read("components/nextgen/ExternalPlannerItemsSection.tsx")).toContain("initial={emptyInput(defaultDate)}");
  });

  test("FB15-05 chi resta scoperto nei giorni di scuola chiusa (es. Lino il 7 e l'8 dicembre)", () => {
    const days = [
      { dateIso: "2026-12-05", label: "Sabato 5", isPast: false, isWeekend: true, kidIds: ["fra"], closureLabels: [] },
      { dateIso: "2026-12-07", label: "Lunedì 7", isPast: false, isWeekend: false, kidIds: ["fra"], closureLabels: ["Sant'Ambrogio"] },
      { dateIso: "2026-12-08", label: "Martedì 8", isPast: false, isWeekend: false, kidIds: ["fra"], closureLabels: ["Immacolata"] },
      { dateIso: "2026-12-09", label: "Mercoledì 9", isPast: false, isWeekend: false, kidIds: [], closureLabels: [] },
    ];
    const kids = [
      { id: "lino", name: "Lino" },
      { id: "fra", name: "Franchidea" },
    ];
    expect(uncoveredClosureDays(days, kids)).toEqual([{ kidId: "lino", kidName: "Lino", dayLabels: ["lunedì 7", "martedì 8"] }]);
    expect(joinItalian(["lunedì 7", "martedì 8"])).toBe("lunedì 7 e martedì 8");
    expect(joinItalian(["a", "b", "c"])).toBe("a, b e c");
    const planner = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(planner).toContain("Scuola chiusa {joinItalian(u.dayLabels)}: per <b");
    expect(planner).toContain("15/10/2026: legenda dei pallini anche nel Mese.");
  });

  test("FB15-06 Salvati V2 con DISCOVER_V2_ENABLED (fail-closed), vecchia vista altrimenti", () => {
    const page = read("app/nextgen/preferiti/page.tsx");
    expect(page).toContain('flag("DISCOVER_V2_ENABLED")');
    expect(page).toContain("return <PreferitiView favorites={favorites} showBrandIcon />;");
    const view = read("app/nextgen/preferiti/SalvatiV2View.tsx");
    expect(view).toContain(">Salvati</h1>");
    expect(view).toContain("<DiscoverResultCard");
    expect(view).not.toContain("ActivityCardHorizontal");
  });
});
