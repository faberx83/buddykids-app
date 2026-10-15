// TRAMA — "INDIETRO" DA DOVE SI È VENUTI E RIPRESA DELLO SCORRIMENTO
// (15/10/2026, Fabrizio: "Sui gruppi se vado indietro va sul planner e non in
// profilo", "il pulsante indietro deve posizionarsi dove era prima, vale per
// tutta l'app"). [no browser] — la verifica sul telefono resta "pending local
// verification".

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  __resetInAppHistory,
  canGoBackInApp,
  consumeBackOnMount,
  goBackInApp,
  nextDepth,
  noteNavigation,
  notePopState,
  scrollKey,
} from "../../lib/nextgen/in-app-history";
import { profileV2Sections } from "../../lib/nextgen/profile-v2";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

test.describe("TRAMA — Indietro e scorrimento [no browser]", () => {
  test("IS-01 conteggio: avanti +1, indietro −1, mai sotto zero", () => {
    expect(nextDepth(0, false)).toBe(1);
    expect(nextDepth(2, true)).toBe(1);
    expect(nextDepth(0, true)).toBe(0);
  });

  test("IS-02 Profilo → Gruppi → indietro: torna al Profilo (cronologia), non al Planner", () => {
    __resetInAppHistory();
    const calls: string[] = [];
    const router = { back: () => calls.push("back"), push: (h: string) => calls.push(`push ${h}`) };
    // pagina aperta da un link esterno: niente dietro → ripiego
    goBackInApp(router, "/nextgen/planner");
    expect(calls).toEqual(["push /nextgen/planner"]);
    // dal Profilo si apre Gruppi: ora c'è una pagina dietro → cronologia
    noteNavigation("https://x/nextgen/groups");
    expect(canGoBackInApp()).toBe(true);
    goBackInApp(router, "/nextgen/planner");
    expect(calls[1]).toBe("back");
    // tornati al Profilo con "indietro": il conteggio scende
    notePopState("https://x/nextgen/profile");
    expect(noteNavigation("https://x/nextgen/profile")).toEqual({ wasBack: true });
    expect(canGoBackInApp()).toBe(false);
  });

  test("IS-03 ritorno dalla scheda attività (area rimontata): riconosciuto come indietro una volta sola", () => {
    __resetInAppHistory();
    notePopState("https://x/nextgen/search?when=dic");
    expect(consumeBackOnMount("https://x/nextgen/search?when=dic")).toBe(true);
    expect(consumeBackOnMount("https://x/nextgen/search?when=dic")).toBe(false);
    expect(scrollKey("/nextgen/search", "?when=dic")).toBe("trama:scroll:/nextgen/search?when=dic");
  });

  test("IS-04 collegamenti: area scorrevole salva e ripristina; intestazioni V2 usano la cronologia", () => {
    const area = read("components/nextgen/NextgenScrollActivity.tsx");
    expect(area).toContain("sessionStorage.setItem(scrollKey(");
    expect(area).toContain("el.scrollTop = target;");
    expect(area).toContain("wasBack = consumeBackOnMount(window.location.href);");
    const header = read("components/PageHeader.tsx");
    expect(header).toContain('goBackInApp(router, backHref ?? "/nextgen");');
    // ramo Legacy/Gestore invariato
    expect(header).toContain("if (backHref) router.push(backHref);\n    else router.back();");
    expect(read("components/GroupsClient.tsx")).toContain("onClick={() => goBackInApp(router, resolvedBackHref)}");
    for (const f of ["app/nextgen/planner/PlannerV2Client.tsx", "app/nextgen/preferiti/SalvatiV2View.tsx", "app/nextgen/profile/ProfileV2Client.tsx"]) {
      expect(read(f)).not.toContain("window.history.length > 1");
      expect(read(f)).toContain("goBackInApp(router, ");
    }
  });

  test("IS-05 Profilo: 'Gruppi' e 'Classe e scuola' sono due righe distinte", () => {
    const sections = profileV2Sections({ unreadReplies: 0 } as never);
    const famiglia = sections.find((s) => s.title === "Famiglia")!;
    const gruppi = famiglia.items.find((i) => i.key === "gruppi")!;
    const classe = famiglia.items.find((i) => i.key === "classe")!;
    expect(gruppi.subtitle).not.toMatch(/classe/i);
    expect(classe.title).toBe("Classe e scuola");
    expect(classe.href).toBe("/nextgen/community");
  });
});
