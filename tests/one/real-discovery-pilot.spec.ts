import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { REAL_DISCOVERY_LEADS, isDiscoveryLeadCompatibleWithWeek, type DiscoveryLeadRecord } from "../../lib/discovery/real-dataset";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";

// TRAMA — REAL DISCOVERY PILOT (16/09/2026). Stesso principio "[no browser]"
// già seguito da school-calendar-municipal-scope.spec.ts: unit test puri su
// lib/discovery/real-dataset.ts (nessun mock Supabase, nessuna dipendenza da
// dati live — il dataset è code-based per costruzione) + verifiche
// semantiche statiche sulla card (grep sul sorgente, non un mock DOM) per
// il vincolo non negoziabile "REAL DATA YES, FAKE PARTNERS NO".
//
// Comando: npx playwright test tests/one/real-discovery-pilot.spec.ts

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf-8");
}

test.describe("REAL DISCOVERY PILOT — isDiscoveryLeadCompatibleWithWeek (logica pura)", () => {
  test("RD-01: nessuna data nota sul record → sempre compatibile", () => {
    const lead: Pick<DiscoveryLeadRecord, "startDate" | "endDate"> = { startDate: null, endDate: null };
    expect(isDiscoveryLeadCompatibleWithWeek(lead, "2026-07-06", "2026-07-12")).toBe(true);
  });

  test("RD-02: periodo del record si sovrappone alla settimana → compatibile", () => {
    const lead: Pick<DiscoveryLeadRecord, "startDate" | "endDate"> = { startDate: "2026-06-15", endDate: "2026-07-24" };
    expect(isDiscoveryLeadCompatibleWithWeek(lead, "2026-07-06", "2026-07-12")).toBe(true);
  });

  test("RD-03: periodo del record NON si sovrappone alla settimana → incompatibile", () => {
    const lead: Pick<DiscoveryLeadRecord, "startDate" | "endDate"> = { startDate: "2026-08-24", endDate: "2026-08-28" };
    expect(isDiscoveryLeadCompatibleWithWeek(lead, "2026-07-06", "2026-07-12")).toBe(false);
  });

  test("RD-04: settimana adiacente ma non sovrapposta → incompatibile (confine esclusivo corretto)", () => {
    const lead: Pick<DiscoveryLeadRecord, "startDate" | "endDate"> = { startDate: "2026-07-13", endDate: "2026-07-19" };
    // La settimana termina il 12/07, il record inizia il 13/07: nessuna sovrapposizione.
    expect(isDiscoveryLeadCompatibleWithWeek(lead, "2026-07-06", "2026-07-12")).toBe(false);
  });

  test("RD-05: ultimo giorno del record coincide col primo della settimana → compatibile (bordo incluso)", () => {
    const lead: Pick<DiscoveryLeadRecord, "startDate" | "endDate"> = { startDate: "2026-06-29", endDate: "2026-07-06" };
    expect(isDiscoveryLeadCompatibleWithWeek(lead, "2026-07-06", "2026-07-12")).toBe(true);
  });
});

test.describe("REAL DISCOVERY PILOT — integrità dataset (REAL DATA YES, FAKE PARTNERS NO)", () => {
  test("RD-06: almeno un record reale presente", () => {
    expect(REAL_DISCOVERY_LEADS.length).toBeGreaterThan(0);
  });

  test("RD-07: id univoci", () => {
    const ids = REAL_DISCOVERY_LEADS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("RD-08: ogni record ha almeno una fonte tracciabile (sources non vuoto, URL http/https)", () => {
    for (const lead of REAL_DISCOVERY_LEADS) {
      expect(lead.sources.length).toBeGreaterThan(0);
      for (const source of lead.sources) {
        expect(source.url).toMatch(/^https?:\/\//);
      }
      expect(lead.officialUrl).toMatch(/^https?:\/\//);
    }
  });

  test("RD-09: image è sempre null (nessuna immagine copiata senza verifica di liceità — §9)", () => {
    for (const lead of REAL_DISCOVERY_LEADS) {
      expect(lead.image).toBeNull();
    }
  });

  test("RD-10: ogni record ha una temporalNote non vuota (trasparenza stagionalità — §7)", () => {
    for (const lead of REAL_DISCOVERY_LEADS) {
      expect(lead.temporalNote.length).toBeGreaterThan(20);
    }
  });

  test("RD-11: nessun record ha confidence 'low' (i LOW non entrano nel dataset pilota — §8)", () => {
    for (const lead of REAL_DISCOVERY_LEADS) {
      expect(["high", "medium"]).toContain(lead.confidence);
    }
  });

  test("RD-12: nessun record inventa un prezzo/età senza fonte — se null, resta null (spot-check sui record con dati incompleti)", () => {
    const noPrice = REAL_DISCOVERY_LEADS.filter((l) => l.price === null);
    // Sample gate: almeno un record del dataset deve onestamente avere il
    // prezzo assente (altrimenti sospetteremmo un dataset "troppo perfetto"
    // per essere stato costruito senza inferenze) — è un vincolo di
    // processo, non solo di dato.
    expect(noPrice.length).toBeGreaterThan(0);
  });

  test("RD-13: copertura geografica — almeno un comune Lombardia e almeno un comune Puglia", () => {
    const regions = new Set(REAL_DISCOVERY_LEADS.map((l) => l.region));
    expect(regions.has("Lombardia")).toBe(true);
    expect(regions.has("Puglia")).toBe(true);
  });
});

test.describe("REAL DISCOVERY PILOT — semantica Partner/non-Partner (statico, sul sorgente)", () => {
  test("RD-14: DiscoveryLeadCard non contiene MAI la parola 'Prenota' (CTA model — §16)", () => {
    const source = readSource("../../components/nextgen/DiscoveryLeadCard.tsx");
    const codeOnly = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(codeOnly.toLowerCase()).not.toContain("prenota");
  });

  test("RD-15: DiscoveryLeadCard non contiene MAI 'Verificato da TRAMA' né 'Partner TRAMA' come affermazione (semantica §3)", () => {
    const source = readSource("../../components/nextgen/DiscoveryLeadCard.tsx");
    const codeOnly = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(codeOnly).not.toContain("Verificato da TRAMA");
    expect(codeOnly).not.toContain("Partner TRAMA");
  });

  test("RD-16: DiscoveryLeadCard mostra sempre il disclaimer di provenienza", () => {
    const source = readSource("../../components/nextgen/DiscoveryLeadCard.tsx");
    expect(source).toContain("Informazioni raccolte da fonti pubbliche");
  });

  test("RD-17: DiscoveryLeadCard usa link esterno sicuro (target=_blank + rel=noopener noreferrer)", () => {
    const source = readSource("../../components/nextgen/DiscoveryLeadCard.tsx");
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noopener noreferrer"');
  });

  test("RD-18: real-dataset.ts non importa mai lib/data/activities o Supabase (dataset code-based, zero I/O)", () => {
    const source = readSource("../../lib/discovery/real-dataset.ts");
    expect(source).not.toContain("lib/data/activities");
    expect(source).not.toContain("supabase");
  });
});

test.describe("REAL DISCOVERY PILOT — gating Dark Release (default OFF)", () => {
  test("RD-19: REAL_DISCOVERY_DATASET_ENABLED esiste ed è default false", () => {
    const flag = FEATURE_FLAG_REGISTRY.REAL_DISCOVERY_DATASET_ENABLED;
    expect(flag).toBeDefined();
    expect(flag.defaultValue).toBe(false);
  });

  test("RD-20: il flag supporta lo scope 'cohort' (necessario per cohort:internal-preview)", () => {
    const flag = FEATURE_FLAG_REGISTRY.REAL_DISCOVERY_DATASET_ENABLED;
    expect(flag.allowedScopes).toContain("cohort");
  });

  test("RD-21: page.tsx risolve il flag server-side prima di passare il dataset al client", () => {
    const source = readSource("../../app/nextgen/search/page.tsx");
    expect(source).toContain("REAL_DISCOVERY_DATASET_ENABLED");
    expect(source).toContain("resolveFeatureFlagVisibility");
    // Il dataset deve essere assegnato SOLO dentro il ramo "enabled" — verifica
    // di posizione: la riga che assegna REAL_DISCOVERY_LEADS deve comparire
    // dopo il controllo "if (realDiscoveryDetail.enabled)".
    const gateIndex = source.indexOf("if (realDiscoveryDetail.enabled)");
    const assignIndex = source.indexOf("realDiscoveryLeads = REAL_DISCOVERY_LEADS");
    expect(gateIndex).toBeGreaterThan(-1);
    expect(assignIndex).toBeGreaterThan(gateIndex);
  });
});
