// TRAMA — FEEDBACK DEL 20/10/2026 SERA (screenshot Gruppi, Planner, Salvati). [no browser]
//  - "Classe e scuola c'è una sovrapposizione" → la proposta va sotto, su una riga sua;
//  - "la card Salvati nel Planner serve? dipende dalla disponibilità o dalla
//    necessità" → nella Settimana solo i salvati disponibili quei giorni;
//  - "Prova FP non si vede nei salvati che è confermata" → riga "Già prenotata".

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { countSavedNotInPlanner, savedForWeek, savedNotInPlanner } from "../../lib/nextgen/planner-season";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

test.describe("TRAMA — feedback 20/10 sera [no browser]", () => {
  test("FS-01 Gruppi V2: la proposta della classe non schiaccia più nome e famiglie", () => {
    const s = read("components/nextgen/PlannerGroupsView.tsx");
    expect(s).toContain("{v2 && community.activeProposalsCount > 0 && (");
    expect(s).toContain('"1 proposta per un Gruppo"');
    expect(s).toContain("{!v2 && community.activeProposalsCount > 0 && (");
  });

  test("FS-02 Salvati nel Planner: solo se disponibili nella settimana; 'coprono la scuola chiusa' se servono", () => {
    const saved = [
      { kind: "partner" as const, ref: "lab", title: "Laboratorio Arti Creative", ranges: [{ startDate: "2027-06-14", endDate: "2027-06-18" }] },
      { kind: "community" as const, ref: "c1", title: "Open day", ranges: [{ startDate: "2026-12-07", endDate: "2026-12-07" }] },
      { kind: "curated" as const, ref: "x", title: "Senza date", ranges: [] },
      { kind: "partner" as const, ref: "fp", title: "Prova FP", ranges: [{ startDate: "2026-12-07", endDate: "2026-12-11" }] },
    ];
    const input = { saved, bookedActivityDbIds: ["fp"], externalSourceRefs: [] };
    expect(countSavedNotInPlanner(input)).toBe(3);
    const pending = savedNotInPlanner(input);
    // Ottobre: niente di disponibile → nessuna card nella Settimana.
    expect(savedForWeek(pending, "2026-10-19").items).toEqual([]);
    // Settimana del 7 dicembre: l'open day, che copre lunedì 7 (scuola chiusa, scoperto).
    const dic = savedForWeek(pending, "2026-12-07", ["2026-12-07"]);
    expect(dic.items.map((i) => i.title)).toEqual(["Open day"]);
    expect(dic.coversNeed).toBe(true);
    expect(savedForWeek(pending, "2026-12-07", []).coversNeed).toBe(false);
    const c = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(c).toContain("const { items, coversNeed } = savedForWeek(savedPending, monday, uncoveredDates);");
    expect(c).toContain('"Salvati che coprono la scuola chiusa"');
  });

  test("FS-03 Salvati: le attività già prenotate lo dicono e portano a Prenotazioni", () => {
    const v = read("app/nextgen/preferiti/SalvatiV2View.tsx");
    expect(v).toContain("item.activity.dbId && booked.has(item.activity.dbId)");
    expect(v).toContain("Già prenotata · vedi la prenotazione");
    expect(read("app/nextgen/preferiti/page.tsx")).toContain('.filter((b) => b.status !== "cancelled" && b.partnerDecision !== "rejected")');
  });
});
