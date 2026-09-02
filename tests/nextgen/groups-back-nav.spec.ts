import { test as pureTest, expect as pureExpect } from "@playwright/test";
import {
  resolveGroupsListBackHref,
  groupsDetailQuery,
  resolveGroupDetailBackHref,
} from "@/lib/nextgen/groups-back-nav";

// TRAMA BETA v1.1.1 — FINAL FUNCTIONAL + UI CONSISTENCY FIXES (punto 16).
// Copre GROUP-BACK-01..04. Funzione pura (lib/nextgen/groups-back-nav.ts,
// nessun import Next.js/React) — gira in QUALUNQUE ambiente senza browser/
// deploy, stesso principio di build-entries.ts/planner-insights.ts.

pureTest.describe("TRAMA BETA v1.1.1 — GROUP-BACK-01..04: back-navigation context (punto 4-5)", () => {
  pureTest("GROUP-BACK-01 - Planner/Gruppi -> Gruppi & Community -> Back -> Planner/Gruppi (non Organizzazione)", () => {
    // Simula l'arrivo da PlannerGroupsView (?from=planner-gruppi) sulla lista.
    const backHref = resolveGroupsListBackHref("planner-gruppi", "/nextgen/planner");
    pureExpect(backHref).toBe("/nextgen/planner?mode=gruppi");
    // MAI il default "/nextgen/planner" nudo, che PlannerClient risolverebbe
    // sulla tab "organizzazione" (vedi PLANNER_MODES/initialMode).
    pureExpect(backHref).not.toBe("/nextgen/planner");
  });

  pureTest("GROUP-BACK-02 - dettaglio gruppo -> Back -> lista Gruppi & Community (contesto preservato)", () => {
    // Simula il link generato dalla lista verso una card di dettaglio.
    const detailQuery = groupsDetailQuery("planner-gruppi");
    pureExpect(detailQuery).toBe("?from=planner-gruppi");
    // Il dettaglio legge "from" da quella stessa query string e calcola il
    // proprio backHref verso la lista, CON lo stesso contesto riattaccato.
    const detailBackHref = resolveGroupDetailBackHref("planner-gruppi");
    pureExpect(detailBackHref).toBe("/nextgen/groups?from=planner-gruppi");
  });

  pureTest("GROUP-BACK-03 - lista -> Back -> Planner/Gruppi (catena completa a due salti)", () => {
    // Secondo giro: dal backHref del dettaglio (GROUP-BACK-02) si ricostruisce
    // il "from" della lista, e il Back della lista deve tornare a Planner/Gruppi.
    const listBackHref = resolveGroupsListBackHref("planner-gruppi", "/nextgen/planner");
    pureExpect(listBackHref).toBe("/nextgen/planner?mode=gruppi");
  });

  pureTest("GROUP-BACK-04 - senza contesto Planner/Gruppi, il comportamento resta INVARIATO", () => {
    // Nessun "from" (es. accesso diretto/bottom-nav): backHref statico come prima.
    pureExpect(resolveGroupsListBackHref(undefined, "/nextgen/planner")).toBe("/nextgen/planner");
    pureExpect(resolveGroupsListBackHref("qualcosa-altro", "/nextgen/planner")).toBe("/nextgen/planner");
    pureExpect(groupsDetailQuery(undefined)).toBe("");
    pureExpect(resolveGroupDetailBackHref(undefined)).toBe("/nextgen/groups");
    // Legacy (basePath="/groups", nessun backContext mai passato): stesso esito.
    pureExpect(resolveGroupsListBackHref(undefined, undefined)).toBeUndefined();
  });
});
