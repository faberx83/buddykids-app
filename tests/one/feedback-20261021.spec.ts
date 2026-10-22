// TRAMA — FEEDBACK DEL 21/10/2026 (impegno ricorrente, scuola non trovata,
// separatore a fine settimana). [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

test.describe("TRAMA — feedback 21/10 [no browser]", () => {
  test("FB21-01 dopo un impegno l'app non resta spostata in su: niente scroll verso la sezione col foglio V2, contenitore sempre a zero", () => {
    const s = read("components/nextgen/ExternalPlannerItemsSection.tsx");
    expect(s).toContain('if (!v2) document.getElementById("impegni")?.scrollIntoView({ behavior: "smooth", block: "start" });');
    expect(s).toContain("el.focus({ preventScroll: true });");
    expect(s).not.toContain("autoFocus={!editing}");
    const guard = read("components/nextgen/ShellScrollGuard.tsx");
    expect(guard).toContain('document.querySelector<HTMLElement>(".app-shell")');
    expect(guard).toContain("if (shell.scrollTop !== 0) shell.scrollTop = 0;");
    expect(read("app/nextgen/layout.tsx")).toContain("<ShellScrollGuard />");
  });

  test("FB21-02 scuola non trovata fra le 'scuole' di OpenStreetMap: si cerca fra tutti i luoghi; niente risultati = lo diciamo", () => {
    const r = read("app/api/places/search/route.ts");
    // 22/10/2026: non più "solo se fra le scuole non c'è niente" (Photon trova quasi sempre qualche scuola
    // simile e il ripiego non partiva): scuole e tutti i luoghi insieme, sempre (vedi UXF-62).
    expect(r).toContain('searchPhoton(buildPhotonUrl({ q, kind: "school", near, limit })),'); // 22/10: limit più alto con strict=1
    expect(r).toContain('searchPhoton(buildPhotonUrl({ q, kind: "any", near, limit })),'); // 22/10: limit più alto con strict=1
    expect(r.match(/^export /gm)).toHaveLength(1);
    expect(read("components/nextgen/PlaceAutocomplete.tsx")).toContain("Non lo trovo sulla mappa: va bene anche scritto a mano.");
  });

  test("FB21-03 separatore fra domenica e 'Condividi settimana' / 'Esporta calendario'", () => {
    expect(read("app/nextgen/planner/PlannerV2Client.tsx")).toContain('<div className="mt-2 border-t border-trama-line pt-4" data-testid="week-actions">');
  });
});
