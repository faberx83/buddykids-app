// TRAMA — SOTTOPAGINE V2 (15/10/2026, "report di tutte le pagine ancora in
// vecchio stile: se sono cose semplici modifica già"). [no browser]
//  - intestazione V2 per tutte le sottopagine (PageHeader, solo con la nuova barra);
//  - righe degli hub (Impostazioni, Famiglia) come il Profilo V2 (HubCard);
//  - ponte colori: nell'area con la nuova barra il viola pieno diventa blu notte;
//  - "Chi accompagna" dal + apre davvero il foglio della settimana.

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

test.describe("TRAMA — Sottopagine V2 [no browser]", () => {
  test("SP-01 PageHeader: intestazione V2 solo con la nuova barra e solo per le pagine famiglie (showBrandIcon)", () => {
    const src = read("components/PageHeader.tsx");
    expect(src).toContain("const navV2 = useNavV2();");
    // 15/10 pomeriggio: forzabile anche con v2 (flusso di richiesta /booking, fuori da /nextgen)
    expect(src).toContain("if ((navV2 && showBrandIcon) || v2) {");
    expect(src).toContain("font-poppins text-[24px] font-semibold");
    // ramo di prima invariato per Legacy, Gestore e prenotazione
    expect(src).toContain("border-b border-[#F0F2F5] bg-white px-5 py-3.5");
    expect(read("components/nextgen/ProfileChip.tsx")).toContain("export function useNavV2(): boolean {");
  });

  test("SP-02 HubCard: righe V2 con bordo, icona su tinta neutra, tocco da 64px", () => {
    const src = read("components/nextgen/HubCard.tsx");
    expect(src.startsWith('"use client"')).toBe(true);
    expect(src).toContain("if (navV2) {");
    expect(src).toContain("min-h-[64px]");
    expect(src).toContain("bg-trama-primary-soft");
  });

  test("SP-03 ponte colori limitato all'area con la nuova barra; le pagine V2 non usano trama-violet", () => {
    const css = read("app/globals.css");
    expect(css).toContain("[data-nav-v2] .bg-trama-violet {\n  background-color: #172a4d;");
    expect(css).toContain("[data-nav-v2] .text-trama-violet {\n  color: #4a3f9e;");
    expect(css).not.toMatch(/^\.bg-trama-violet\s*\{/m); // mai globale
    expect(read("app/nextgen/layout.tsx")).toContain('data-nav-v2={navV2Enabled ? "" : undefined}');
  });

  test("SP-04 'Chi accompagna' dal + apre il foglio 'Chi fa cosa' della settimana", () => {
    expect(read("components/nextgen/AddSheet.tsx")).toContain("href: `/nextgen/planner?week=${plannerWeek ?? mondayOfTodayRome()}&panel=chi`");
    expect(read("app/nextgen/planner/planner-v2-data.ts")).toContain('searchParams.panel === "chi"');
    // 20/10/2026: si aggiunge { assign } ("Assegna" dalla Home), "chi" resta.
    expect(read("app/nextgen/planner/PlannerV2Client.tsx")).toContain('initialPanel: "mappa" | "gruppi" | "chi" | { assign: string } | null;');
  });
});
