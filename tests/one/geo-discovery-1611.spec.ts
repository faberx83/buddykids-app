// TRAMA — GEO DISCOVERY & CONTENT INTELLIGENCE (16/11/2026). Richiesta di
// Fabrizio: "TRAMA deve essere pronta per famiglie che vivono in due
// territori differenti, con contenuti reali, credibili e una comunicazione
// che non limiti il progetto a una singola città". Iniziativa:
// claude/GEO_DISCOVERY_20261116.md. Logica pura + controlli sul sorgente.
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  REAL_DISCOVERY_LEADS,
  discoveryRegionFor,
  leadTemporalLabel,
  sortDiscoveryLeadsForDisplay,
  type DiscoveryLeadRecord,
} from "../../lib/discovery/real-dataset";

const ROOT = path.join(__dirname, "../..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
const TODAY = "2026-11-16";

test.describe("Dataset: due territori, niente doppioni, verifiche oneste", () => {
  test("id unici e nessun doppione organizzatore + titolo", () => {
    const ids = REAL_DISCOVERY_LEADS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = REAL_DISCOVERY_LEADS.map((l) => `${l.organizerName.toLowerCase()}|${l.activityTitle.toLowerCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("Rutigliano ha Scoperte proprie, in Puglia e mai attribuite a Bari", () => {
    const rut = REAL_DISCOVERY_LEADS.filter((l) => l.comune === "Rutigliano");
    expect(rut.map((l) => l.id).sort()).toEqual(["rutigliano-centro-anchio", "rutigliano-colonia-estiva-comunale"]);
    for (const l of rut) expect(l.region).toBe("Puglia");
    const bari = REAL_DISCOVERY_LEADS.find((l) => l.id === "bari-cus-xmas-vacanze")!;
    expect(bari.comune).toBe("Bari");
  });

  test("verifiedOn solo su edizioni pubblicate dall'organizzatore, con date e confidenza alta", () => {
    for (const l of REAL_DISCOVERY_LEADS.filter((x) => x.verifiedOn)) {
      expect(l.confidence, l.id).toBe("high");
      expect(l.startDate, l.id).not.toBeNull();
      expect(l.sourceType, l.id).toBe("primary_organizer");
    }
    // Da portali o stampa: niente date strutturate né verifica.
    for (const id of ["milano-idea-parco-nord-campus-natale", "vanzago-idea-campus-natale-oasi-wwf", "milano-villaggio-delle-meraviglie-2026", "rho-campus-invernale-comune-lafucina"]) {
      const l = REAL_DISCOVERY_LEADS.find((x) => x.id === id)!;
      expect(l.verifiedOn ?? null, id).toBeNull();
      expect(l.startDate, id).toBeNull();
      expect(l.confidence, id).toBe("medium");
    }
  });

  test("estate 2027 senza programma: anno giusto e 'Date 2027 da verificare'", () => {
    const colonia = REAL_DISCOVERY_LEADS.find((l) => l.id === "rutigliano-colonia-estiva-comunale")!;
    expect(colonia.seasonYear).toBe(2027);
    expect(leadTemporalLabel(colonia, TODAY)).toEqual({ text: "Date 2027 da verificare", tone: "warn" });
    expect(colonia.invitable).toBe(false);
  });
});

test.describe("Scopri: prima la zona della famiglia, senza nascondere le altre", () => {
  test("discoveryRegionFor riconosce Lombardia e Puglia dal profilo scuola", () => {
    expect(discoveryRegionFor(["Puglia"])).toBe("Puglia");
    expect(discoveryRegionFor([null, "lombardia"])).toBe("Lombardia");
    expect(discoveryRegionFor(["Lazio"])).toBeNull();
    expect(discoveryRegionFor([])).toBeNull();
  });

  test("famiglia pugliese: prima le Scoperte in Puglia, poi le altre (nessuna esclusa)", () => {
    const sorted = sortDiscoveryLeadsForDisplay(REAL_DISCOVERY_LEADS, TODAY, "Puglia");
    expect(sorted.length).toBe(REAL_DISCOVERY_LEADS.length);
    const firstNonPuglia = sorted.findIndex((l) => l.region !== "Puglia");
    expect(firstNonPuglia).toBe(REAL_DISCOVERY_LEADS.filter((l) => l.region === "Puglia").length);
    const milano = sortDiscoveryLeadsForDisplay(REAL_DISCOVERY_LEADS, TODAY, "Lombardia");
    expect(milano[0].region).toBe("Lombardia");
    // Senza regione: stesso ordinamento di prima (concluse in fondo, poi confidenza).
    const plain = sortDiscoveryLeadsForDisplay(REAL_DISCOVERY_LEADS as DiscoveryLeadRecord[], TODAY);
    expect(plain.length).toBe(REAL_DISCOVERY_LEADS.length);
  });

  test("la pagina passa la regione del profilo scuola; Scopri dice che il catalogo cresce", () => {
    const page = read("app/nextgen/search/page.tsx");
    expect(page).toContain("familyRegion = discoveryRegionFor(");
    expect(page).toContain("familyRegion={familyRegion}");
    const client = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(client).toContain("sortDiscoveryLeadsForDisplay(filtered, todayIso, familyRegion)");
    expect(client).toContain('data-testid="scopri-intro"');
  });
});

test.describe("Copy: beta in aree selezionate, non solo Milano", () => {
  test("niente 'pilota a Milano' o 'solo a Milano' nelle pagine pubbliche", () => {
    for (const f of ["components/landing/CentriView.tsx", "components/landing/BenvenutoView.tsx", "app/centri/page.tsx", "app/(main)/page.tsx"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/pilota a Milano|Pilota a Milano|solo a Milano|limitati a Milano|Milano e dintorni/);
    }
    expect(read("components/landing/BenvenutoView.tsx")).toContain("alcune aree selezionate");
    expect(read("components/landing/CentriView.tsx")).toContain("pilota in aree selezionate");
  });
});
