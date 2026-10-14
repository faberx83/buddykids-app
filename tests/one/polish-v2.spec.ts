// TRAMA — POLISH V2 (14/10/2026, "NAVY + OFF-WHITE + FILI TRAMA").
// Palette navy primaria, un solo elemento flottante, emoji strutturali
// sostituite, Settimana del Planner limitata alla settimana, mappa di
// Scopri centrata sui risultati vicini, errori della Mappa del Planner senza
// dettagli tecnici per Pilot/Tutti. [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { itemsInWeek } from "../../lib/nextgen/planner-week";
import { mapFocusPoints, distanceKm } from "../../lib/nextgen/map-focus";
import { monogramFor, threadColorFor } from "../../components/nextgen/ActivityVisual";
import { profileV2Sections } from "../../lib/nextgen/profile-v2";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

const V2_FILES = [
  "app/nextgen/HomeDashboardV2Client.tsx",
  "app/nextgen/planner/PlannerV2Client.tsx",
  "app/nextgen/prenotazioni/PrenotazioniV2Client.tsx",
  "app/nextgen/profile/ProfileV2Client.tsx",
  "app/nextgen/trama/page.tsx",
  "components/nextgen/DiscoverResultCard.tsx",
  "components/nextgen/SeasonSummaryCard.tsx",
  "components/nextgen/AddSheet.tsx",
];

test.describe("TRAMA — Polish V2 [no browser]", () => {
  test("PO-01 token semantici: primary navy, accent viola, line", () => {
    const tw = read("tailwind.config.ts");
    expect(tw).toContain('primary: "#172A4D"');
    expect(tw).toContain('accent: "#6F63C5"');
    expect(tw).toContain('line: "#E9E6DF"');
    const ui = read("lib/nextgen/v2-ui.ts");
    expect(ui).toContain("bg-trama-primary");
    expect(ui).toContain("rounded-[12px]"); // 12px veri: nel tema di TRAMA rounded-xl vale 28px
  });

  test("PO-02 superfici V2: niente viola per le azioni principali, niente card 20px con ombra morbida", () => {
    for (const f of V2_FILES) {
      const src = read(f);
      expect(src, f).not.toMatch(/bg-trama-violet/);
      expect(src, f).not.toContain("rounded-[20px]");
      expect(src, f).not.toContain("0_6px_20px_rgba(23,42,77,0.06)");
    }
  });

  test("PO-03 barra: voce attiva e + in navy, trattino sopra la voce attiva (non solo colore)", () => {
    const nav = read("components/nextgen/NextgenBottomNav.tsx");
    const v2 = nav.slice(nav.indexOf('if (variant === "v2")'), nav.indexOf("V2_RIGHT.map(renderItem)"));
    expect(v2).not.toContain("trama-violet");
    expect(v2).toContain('active ? "text-trama-primary" : "text-ink-3"');
    expect(v2).toContain("bg-trama-primary");
    expect(v2).toContain('{active && <span aria-hidden="true" className="absolute -top-2');
  });

  test("PO-04 un solo elemento flottante con la nuova barra: niente campanella e feedback flottanti", () => {
    const layout = read("app/nextgen/layout.tsx");
    expect(layout).toContain("<BetaFeedbackButton hideFab={navV2Enabled} />");
    expect(layout).toContain("hideFloatingBell={navV2Enabled}");
    expect(read("components/nextgen/BetaFeedbackButton.tsx")).toContain("{!hideFab && (");
    expect(read("components/nextgen/NotificationCenter.tsx")).toContain("{!headerBellPresent && !hideFloatingBell && (");
    // il feedback resta raggiungibile dal Profilo
    const items = profileV2Sections({ unreadReplies: 0, classicFallbackEnabled: false, onFeedback: () => {}, onClassic: () => {} }).flatMap((s) => s.items);
    expect(items.map((i) => i.key)).toContain("feedback");
  });

  test("PO-05 emoji strutturali sostituite nelle superfici V2", () => {
    const groups = read("components/GroupsClient.tsx");
    expect(groups).toContain('<i className="ti ti-users-group text-[22px]" />');
    const detail = read("components/GroupDetailClient.tsx");
    expect(detail).toContain('<i className="ti ti-car text-[16px]" aria-hidden="true" />');
    expect(detail).toContain('{nextgen === "v2" ? "La tua offerta di passaggio" : "🚙 La tua offerta auto"}');
    const card = read("components/nextgen/DiscoverResultCard.tsx");
    expect(card).toContain("<ActivityVisual");
    expect(card).not.toContain("activity.emoji");
    expect(read("app/nextgen/HomeDashboardV2Client.tsx")).not.toContain("r.activity.emoji");
    expect(read("components/nextgen/DiscoveryLeadCard.tsx")).toContain('icon={CATEGORY_ICON[lead.category]}');
    expect(read("components/dashboard/DashboardLayout.tsx")).not.toContain("🔒");
  });

  test("PO-06 immagine di ripiego: monogramma e filo TRAMA stabili", () => {
    expect(monogramFor("Winter Camp Isola")).toBe("WC");
    expect(monogramFor("Nuoto")).toBe("N");
    expect(threadColorFor("Winter Camp Isola")).toBe(threadColorFor("Winter Camp Isola"));
    expect(["#F66B5E", "#F6A623", "#2DBA8C", "#6F63C5"]).toContain(threadColorFor("Qualunque"));
  });

  test("PO-07 Planner Settimana: solo gli impegni che toccano la settimana", () => {
    const items = [
      { id: "a", startDate: "2026-10-13", endDate: "2026-10-13" },
      { id: "b", startDate: "2026-10-01", endDate: "2026-10-02" },
      { id: "c", startDate: "2026-10-18", endDate: "2026-10-18" },
      { id: "d", startDate: "2026-10-10", endDate: "2026-10-12" },
      { id: "e", startDate: "2026-10-19", endDate: "2026-10-19" },
    ];
    expect(itemsInWeek(items, "2026-10-12").map((i) => i.id)).toEqual(["a", "c", "d"]);
    expect(read("app/nextgen/planner/PlannerV2Client.tsx")).toContain("items={itemsInWeek(externalItems, monday)}");
  });

  test("PO-08 mappa di Scopri: vista sui risultati vicini, non sull'Italia intera", () => {
    const milano: [number, number][] = [
      [45.48, 9.19],
      [45.46, 9.21],
      [45.5, 9.15],
    ];
    const puglia: [number, number][] = [
      [40.99, 17.01],
      [41.0, 17.05],
    ];
    const all = [...milano, ...puglia];
    expect(mapFocusPoints(all)).toEqual(milano);
    expect(mapFocusPoints(all, [41.0, 17.0])).toEqual(puglia);
    // nessun punto vicino alla famiglia: i più vicini
    expect(mapFocusPoints(all, [44.4, 8.9]).length).toBe(5);
    expect(Math.round(distanceKm([45.4642, 9.19], [41.9028, 12.4964]))).toBeGreaterThan(400);
    const src = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(src).toContain("fitPoints={mapFocus}");
    expect(src).toContain("attività non hanno ancora una posizione precisa. Le trovi in Elenco.");
  });

  test("PO-09 Mappa del Planner: dettaglio tecnico solo all'Admin, Riprova senza ricaricare, telemetria", () => {
    const client = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(client).toContain("Non siamo riusciti a caricare {what}.");
    expect(client).toContain("{showDiagnostics && (");
    expect(client).toContain('recordBetaSignalAction("planner_subview_error"');
    expect(client).toContain("onClick={onRetry}");
    expect(read("app/nextgen/planner/planner-v2-data.ts")).toContain('showDiagnostics: role === "platform_admin",');
    expect(read("app/actions/beta-signals.ts")).toContain('"planner_subview_error"');
    expect(read("lib/telemetry/known-events.ts")).toContain('"planner_subview_error"');
    // segnaposto con gestori del tocco stabili
    expect(read("components/ActivityMap.tsx")).toContain("eventHandlers={clickHandlers[it.id]}");
  });

  test("PO-12 Mappa del Planner: ogni segnaposto ha un'icona disegnata (causa vera: 'iconUrl not set in Icon options')", () => {
    const map = read("components/ActivityMap.tsx");
    // ramo del Planner (onSelect): mai l'icona immagine di default
    expect(map).toContain("icon={selectedId === it.id ? selectedIcon : plannerPinIcon}");
    expect(map).not.toContain("{...(selectedId === it.id ? { icon: selectedIcon } : {})}");
    expect(map).toContain("const plannerPinIcon = L.divIcon({");
    // l'indirizzo dell'immagine di default si ricava da qualunque forma d'import
    expect(map).toContain("function assetUrl(mod: unknown): string | undefined {");
  });

  test("PO-10 componenti condivisi con Legacy e Gestori: il ramo attuale resta quello di prima", () => {
    expect(read("components/GroupDetailClient.tsx")).toContain(': nextgen ? "bg-trama-violet" : "bg-sky";');
    expect(read("components/GroupsClient.tsx")).toContain(': nextgen ? "bg-trama-violet" : "bg-sky";');
    expect(read("components/ProfileKidsSection.tsx")).toContain(': accent === "violet" ? "bg-trama-violet" : "bg-sky";');
    expect(read("components/nextgen/ExternalPlannerItemsSection.tsx")).toContain('title = "I tuoi impegni",');
  });
});

test.describe("TRAMA — Mappa del Planner: niente distanza finta [no browser]", () => {
  test("PO-13 tolti i 'km · min (stimato)' generati dall'id: percorso e tempi reali da 'Avvia navigazione'", () => {
    const src = read("components/nextgen/PlannerMapView.tsx");
    expect(src).not.toContain("estimateDistance");
    expect(src).not.toContain("(stimato)");
    expect(src).not.toContain("distanza stimata");
    expect(src).toContain("Avvia navigazione");
    expect(src).toContain('{hasCoords ? "Vedi sulla mappa" : "Indirizzo non disponibile"}');
    expect(fs.existsSync(path.join(__dirname, "../..", "lib/nextgen/planner-map-estimate.ts"))).toBe(false);
  });
});

test.describe("TRAMA — Polish V2: forma dei pulsanti [no browser]", () => {
  test("PO-11 pulsanti navy con raggio 12 vero (nel tema TRAMA rounded-xl = 28px, cioè quasi una pillola)", () => {
    for (const f of [
      ...V2_FILES,
      "components/GroupsClient.tsx",
      "components/GroupDetailClient.tsx",
      "components/GroupCard.tsx",
      "components/nextgen/DiscoveryLeadCard.tsx",
      "components/nextgen/CommunityDiscoveryCard.tsx",
    ]) {
      // solo i pulsanti (classe con altezza minima): i badge piccoli restano pillole
      const buttons = read(f)
        .split("\n")
        .filter((l) => /min-h-\[/.test(l) && /bg-trama-primary\b(?!-)/.test(l));
      for (const l of buttons) expect(l, f).not.toMatch(/rounded-(xl|full)\b/);
    }
  });
});
