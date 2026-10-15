// TRAMA — SCHEDA ATTIVITÀ V2 + FILTRI DI SCOPRI V2 + "Avvia navigazione"
// (14/10/2026). [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  activityDetailReasons,
  includedServices,
  navigationDestination,
  placeLine,
  sharesInterest,
  uniqueLabels,
} from "../../lib/nextgen/activity-detail-v2";
import { activities } from "../../lib/mock-data";
import { AGE_PRESETS, PRICE_PRESETS, SERVICE_OPTIONS } from "../../lib/nextgen/discover-filters";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");
const camp = activities[0]; // Summer Camp Acquatico (6-14 anni, pranzo incluso, pre/post, navetta)

test.describe("TRAMA — Scheda attività V2 [no browser]", () => {
  test("SV2-01 'Perché fa per voi': età, interessi, logistica — massimo 3, mai il voto", () => {
    const reasons = activityDetailReasons(camp, [
      { name: "Lino", age: 7, interests: ["🏊 Piscina"] },
      { name: "Nina", age: 3, interests: [] },
    ]);
    expect(reasons.length).toBeLessThanOrEqual(3);
    expect(reasons[0]).toBe("Età giusta per Lino");
    expect(reasons).toContain("Vicina agli interessi di Lino");
    expect(reasons.join(" ")).not.toMatch(/valutat|stelle|recension/i);
    // nessun figlio: restano solo i motivi della logistica
    expect(activityDetailReasons(camp, []).every((r) => !r.startsWith("Età"))).toBe(true);
    // fuori fascia: nessun "Età giusta"
    expect(activityDetailReasons(camp, [{ name: "Nina", age: 3 }]).some((r) => r.startsWith("Età"))).toBe(false);
  });

  test("SV2-02 interessi: conta la parola, non il punteggio di Scopri (dove l'età da sola bastava)", () => {
    expect(sharesInterest(["🏊 Piscina"], camp)).toBe(true);
    expect(sharesInterest(["🎵 Musica"], camp)).toBe(false);
    expect(sharesInterest([], camp)).toBe(false);
  });

  test("SV2-03 'Cosa include': solo i servizi presenti; 'Accessibile' al posto di 'Nessuna limitazione'", () => {
    const keys = includedServices(camp).map((s) => s.key);
    expect(keys).toContain("pranzo");
    for (const s of includedServices(camp)) expect(s.label).not.toBe("Nessuna limitazione");
    const bare = { ...camp, preService: undefined, postService: undefined, mealOption: undefined, shuttlePrice: 0, centerHasBar: false, centerAccessible: false };
    expect(includedServices(bare as typeof camp)).toEqual([]);
    const accessible = includedServices({ ...bare, centerAccessible: true } as typeof camp);
    expect(accessible.map((s) => s.label)).toEqual(["Accessibile"]);
  });

  test("SV2-04 riga del luogo senza ripetere l'indirizzo; etichette senza doppioni né emoji", () => {
    expect(placeLine({ center: "Centro Lido", address: "Porta Nuova, Milano" })).toBe("Centro Lido · Porta Nuova, Milano");
    expect(placeLine({ center: "Centro Lido", address: "" })).toBe("Centro Lido");
    expect(uniqueLabels(["🏊 Piscina", "Piscina", "🍽️ Pranzo", "Pranzo incl.", "Inglese"])).toEqual(["Piscina", "Pranzo", "Inglese"]);
  });

  test("SV2-05 componente: niente voto, recensioni, km, emoji; CTA blu notte a raggio 12; logica in DetailClient", () => {
    const v2 = read("components/nextgen/ActivityDetailV2.tsx");
    expect(v2).not.toContain("activity.rating");
    expect(v2).not.toContain("reviewsCount");
    expect(v2).not.toContain("distanceKm");
    expect(v2).not.toContain("activity.emoji");
    expect(v2).not.toMatch(/⚡|🏷️|⚠️/);
    expect(v2).toContain("rounded-[12px] bg-trama-primary");
    expect(v2).toContain('data-spotlight="book_activity"');
    expect(v2).toContain("<ActivityVisual");
    expect(v2).toContain("Perché fa per voi");
    expect(v2).toContain("Cosa include");
    const detail = read("app/activity/[id]/DetailClient.tsx");
    expect(detail).toContain("if (v2 && !partnerPreview) {");
    // la scheda di prima resta per Legacy e per l'anteprima Partner
    expect(detail).toContain("Recensioni ({activity.reviewsCount})");
  });

  test("SV2-06 pagina: V2 con DISCOVER_V2_ENABLED, fail-closed, mai in anteprima Partner", () => {
    const page = read("app/activity/[id]/page.tsx");
    expect(page).toContain('flagName: "DISCOVER_V2_ENABLED"');
    expect(page).toContain("if (nextgen && !partnerPreview) {");
    expect(page).toContain("}).catch(() => false);");
    const entry = FEATURE_CATALOG.find((f) => f.key === "discover_v2");
    expect(entry?.sourceFiles).toContain("components/nextgen/ActivityDetailV2.tsx");
    expect(entry?.sourceFiles).toContain("components/nextgen/DiscoverFiltersSheet.tsx");
  });
});

test.describe("TRAMA — Filtri di Scopri V2 [no browser]", () => {
  test("SV2-07 foglio dal basso con sezioni e 'Mostra N risultati'; la vecchia riga resta fuori da V2", () => {
    const sheet = read("components/nextgen/DiscoverFiltersSheet.tsx");
    expect(sheet).toContain('role="dialog"');
    expect(sheet).toContain("Mostra ${resultsCount} risultati");
    expect(sheet).not.toMatch(/type="checkbox"|type="range"|type="number"/);
    expect(sheet).not.toMatch(/🕗|🍽️|🤝|🥗|✨/);
    expect(sheet).not.toContain("toFixed(4)"); // niente coordinate GPS a schermo
    const client = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(client).toContain("<DiscoverFiltersSheet");
    expect(client).toContain("{!v2 && (\n        <div className=\"mb-1 flex items-center gap-2\">");
  });

  test("SV2-08 scelte rapide coerenti con i limiti dei filtri esistenti", () => {
    expect(AGE_PRESETS[0]).toEqual({ label: "Tutte", min: 0, max: 18 });
    for (const p of AGE_PRESETS) expect(p.min).toBeLessThanOrEqual(p.max);
    expect(PRICE_PRESETS[0].value).toBe(500); // "Qualsiasi" = nessun filtro prezzo (stesso default di Scopri)
    expect(SERVICE_OPTIONS.map((s) => s.label)).toContain("Accessibile");
    expect(SERVICE_OPTIONS).toHaveLength(7);
  });

  test("SV2-09 card di Scopri V2: niente 'Ben valutata' (voto inserito a mano)", () => {
    expect(read("app/nextgen/search/SearchDiscoveryClient.tsx")).toContain('r !== "Ben valutata"');
  });
});

test.describe("TRAMA — Avvia navigazione [no browser]", () => {
  test("SV2-10 destinazione: indirizzo se c'è, altrimenti coordinate ('Prova FP')", () => {
    expect(navigationDestination("Via Roma 1, Milano", 45.4, 9.1)).toBe("Via Roma 1, Milano");
    expect(navigationDestination("", 45.48, 9.19)).toBe("45.48,9.19");
    expect(navigationDestination("   ", 45.48, 9.19)).toBe("45.48,9.19");
    expect(navigationDestination(null, null, null)).toBeNull();
    const map = read("components/nextgen/PlannerMapView.tsx");
    expect(map).toContain("{selectedDestination && (");
    expect(map).toContain("mapsUrl(selectedDestination, selectedOrigin?.address)");
  });
});

test.describe("TRAMA — Radar dal + [no browser]", () => {
  test("SV2-11 'Una scoperta' nel foglio del + con RADAR_ENABLED; si apre anche se si è già in Scopri", () => {
    const sheet = read("components/nextgen/AddSheet.tsx");
    expect(sheet).toContain('href: "/nextgen/search?radar=1"');
    expect(sheet).toContain("...(radarEnabled");
    const layout = read("app/nextgen/layout.tsx");
    expect(layout).toContain('flagName: "RADAR_ENABLED"');
    expect(layout).toContain("radarEnabled={radarEnabled}");
    expect(read("components/nextgen/NextgenBottomNav.tsx")).toContain("radarEnabled={radarEnabled}");
    expect(read("app/nextgen/search/SearchDiscoveryClient.tsx")).toContain('if (radarEnabled && radarParam === "1") setRadarOpen(true);');
  });
});
