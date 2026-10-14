// TRAMA — GRUPPI V2 (14/10/2026). Elenco e dettaglio gruppo nello stile V2
// dietro GROUPS_V2_ENABLED, scheda Gruppi del Planner V2, home con saluto
// grande quanto i titoli, mappa del Planner protetta. [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { RELEASE_CATALOG } from "../../lib/releases/catalog";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

test.describe("TRAMA — Gruppi V2 e ritocchi [no browser]", () => {
  test("GV2-01 flag spento di default, nel catalogo, nella release del Planner V2", () => {
    expect(FEATURE_FLAG_REGISTRY.GROUPS_V2_ENABLED.defaultValue).toBe(false);
    const entry = FEATURE_CATALOG.find((f) => f.key === "groups_v2");
    expect(entry?.flagName).toBe("GROUPS_V2_ENABLED");
    expect(entry?.releaseEligible).toBe(true);
    expect(RELEASE_CATALOG.find((r) => r.id === "planner-v2")?.featureKeys).toContain("groups_v2");
  });

  test("GV2-02 le pagine scelgono lo stile V2 solo con il flag; ripiego sulle pagine attuali", () => {
    for (const p of ["app/nextgen/groups/page.tsx", "app/nextgen/groups/[id]/page.tsx"]) {
      const src = read(p);
      expect(src).toContain("groupsV2Enabled()");
      expect(src).toContain('nextgen={v2 ? "v2" : true}');
    }
    const flag = read("lib/nextgen/groups-v2-flag.ts");
    expect(flag).toContain('flagName: "GROUPS_V2_ENABLED"');
    expect(flag).toMatch(/catch \{\s*return false;/);
  });

  test("GV2-03 componenti condivisi con Legacy: la variante V2 si attiva solo con nextgen === \"v2\"", () => {
    expect(read("components/GroupsClient.tsx")).toContain('const v2 = nextgen === "v2";');
    expect(read("components/GroupCard.tsx")).toContain('const v2 = nextgen === "v2";');
    const detail = read("components/GroupDetailClient.tsx");
    expect(detail).toContain('const v2 = nextgen === "v2";');
    expect(detail).toContain('if (nextgen === "v2") {');
    // Legacy: le classi di prima restano il ramo di default
    expect(detail).toContain(': "mb-4 rounded-lg border border-[#E8EBF0] bg-white p-3.5"');
  });

  test("GV2-04 intestazioni con titolo 24px e segno TRAMA, schede a pillola", () => {
    const list = read("components/GroupsClient.tsx");
    expect(list).toContain('<h1 className="font-poppins text-[24px] font-semibold leading-tight text-ink">Gruppi</h1>');
    expect(list).toContain("<TramaThread");
    expect(list).toContain("grid grid-cols-3 gap-1 rounded-full bg-[#EEF0F4] p-1");
    const detail = read("components/GroupDetailClient.tsx");
    expect(detail).toContain("<TramaThread");
    expect(detail).toContain("grid grid-cols-2 gap-1 rounded-full bg-[#EEF0F4] p-1");
  });

  test("GV2-05 scheda Gruppi del Planner V2 nello stile V2", () => {
    expect(read("app/nextgen/planner/PlannerV2Client.tsx")).toContain("<PlannerGroupsView communities={communities} groups={groups} v2 />");
    expect(read("components/nextgen/PlannerGroupsView.tsx")).toContain("I tuoi gruppi");
  });

  test("GV2-06 Home: 'Ciao …' grande quanto i titoli di Planner, Scopri, Prenotazioni (24px)", () => {
    expect(read("app/nextgen/HomeDashboardV2Client.tsx")).toContain('<h1 className="font-poppins text-[24px] font-semibold leading-tight text-ink">');
  });

  test("GV2-07 mappa: un marker senza icona non fa cadere la mappa; l'errore mostra anche dove", () => {
    const map = read("components/ActivityMap.tsx");
    expect(map).toContain("markerProto._removeIcon = function");
    expect(map).toContain("if (!this._icon) {");
    expect(read("app/nextgen/planner/PlannerV2Client.tsx")).toContain("error.stack");
  });
});
