// TRAMA — feedback 20/10/2026 (Fabrizio: "Questo giro è un po' arzigogolato…
// assegna in home, assegnazioni nel planner e poi se clicco da decidere torna
// indietro, assegna non fa nulla… semplifichiamo: da home vado diretto nella
// sezione di assegnazione reale"). [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

test.describe("TRAMA — Chi accompagna, giro semplice [no browser]", () => {
  test("CA20-01 Home: Assegna (e la tabella con 'da decidere') aprono direttamente la scelta di oggi", () => {
    const home = read("app/nextgen/HomeDashboardV2Client.tsx");
    expect(home).toContain("assignHref={`/nextgen/planner?week=${weekStartIso}&assegna=${todayIso}`}");
    const block = read("components/nextgen/DayCoordination.tsx");
    expect(block).toContain('<Link href={assignHref} aria-label={tableLabel}');
    expect(block).toContain("<button type=\"button\" onClick={onAssign} aria-label={tableLabel}");
  });

  test("CA20-02 Planner: ?assegna=AAAA-MM-GG apre il foglio del giorno, che fa da pagina e torna alla Home", () => {
    const data = read("app/nextgen/planner/planner-v2-data.ts");
    expect(data).toContain("searchParams.assegna && ISO_DATE.test(searchParams.assegna)");
    expect(data).toContain("? { assign: searchParams.assegna }");
    const planner = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(planner).toContain('const assignFromLink = useRef(initialPanel !== null && typeof initialPanel === "object");');
    expect(planner).toContain("ownHistoryEntry={!assignFromLink.current}");
    expect(planner).toContain('goBackInApp(router, "/nextgen");\n              return;');
  });

  test("CA20-03 da un foglio all'altro (Chi fa cosa → giorno) il secondo non si chiude da solo", () => {
    const hook = read("lib/nextgen/use-close-on-back.ts");
    expect(hook).toContain("if (pendingBack && state[KEY] === pendingBack.marker) {");
    expect(hook).toContain("window.history.replaceState({ ...state, [KEY]: marker }, \"\");");
    expect(hook).toContain("if ((window.history.state as Record<string, unknown> | null)?.[KEY] === marker) window.history.back();");
  });
});
