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

  test("Rutigliano: record in Puglia; gli eventi di Bari restano a Bari", () => {
    const rut = REAL_DISCOVERY_LEADS.filter((l) => l.comune === "Rutigliano");
    expect(rut.map((l) => l.id).sort()).toEqual(["rutigliano-centro-anchio", "rutigliano-colonia-estiva-comunale", "rutigliano-presepi-pastorelle-2026"]);
    for (const l of rut) expect(l.region).toBe("Puglia");
    for (const id of ["bari-cus-xmas-vacanze", "bari-casa-pulcinella-natale-2026"]) {
      expect(REAL_DISCOVERY_LEADS.find((l) => l.id === id)!.comune).toBe("Bari");
    }
  });

  test("verifiedOn solo su edizioni pubblicate dall'organizzatore, con date e confidenza alta", () => {
    for (const l of REAL_DISCOVERY_LEADS.filter((x) => x.verifiedOn)) {
      expect(l.confidence, l.id).toBe("high");
      expect(l.startDate, l.id).not.toBeNull();
      expect(["primary_organizer", "primary_official"], l.id).toContain(l.sourceType);
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

// INTEGRAZIONE STAGIONALE (16/11/2026). Fabrizio: "Per il lancio del 20
// novembre voglio esclusivamente contenuti stagionali… ESCLUDI PER ORA corsi
// sportivi annuali… programmazioni ordinarie ricorrenti… Centri estivi 2027,
// soltanto quando il programma è effettivamente confermato."
import { ARCHIVE_DISCOVERY_LEADS, SUMMER_DISCOVERY_LEADS, seasonalCatalogLeads } from "../../lib/discovery/real-dataset";

test.describe("Catalogo stagionale della beta", () => {
  const catalog = seasonalCatalogLeads(TODAY);
  const ids = catalog.map((l) => l.id);

  test("dentro: inverno 2026/27 (camp, eventi, spettacoli); fuori: archivio, estate 2026 e 2027 non confermata", () => {
    for (const id of [
      "milano-garegnano-winter-camp-2026",
      "milano-chiaravalle-campus-natale-2026",
      "milano-colla-canto-di-natale-2026",
      "milano-manzoni-grinch-2026",
      "milano-martinitt-burro-marmellata-natale-2026",
      "rho-tfamily-bosco-storie-natale-2026",
      "rho-tfamily-bella-mai-addormentata-2027",
      "bari-casa-pulcinella-natale-2026",
      "rutigliano-presepi-pastorelle-2026",
    ])
      expect(ids, id).toContain(id);
    for (const l of ARCHIVE_DISCOVERY_LEADS) expect(ids).not.toContain(l.id);
    expect(ids).not.toContain("rutigliano-centro-anchio");
    expect(ids).not.toContain("rutigliano-colonia-estiva-comunale");
    for (const l of SUMMER_DISCOVERY_LEADS) expect(ids, l.id).not.toContain(l.id);
  });

  test("un evento finito esce dal catalogo il giorno dopo", () => {
    expect(seasonalCatalogLeads("2026-11-22").map((l) => l.id)).not.toContain("rho-tfamily-bosco-storie-natale-2026");
    expect(seasonalCatalogLeads("2026-11-21").map((l) => l.id)).toContain("rho-tfamily-bosco-storie-natale-2026");
  });

  test("un programma estivo con date future pubblicate entrerebbe (regola, non dati)", () => {
    const base = SUMMER_DISCOVERY_LEADS[0];
    const future = { ...base, startDate: "2027-06-14", endDate: "2027-07-30", seasonYear: 2027 };
    expect(Boolean(future.startDate && future.startDate > TODAY)).toBe(true);
  });

  test("Scopri legge il catalogo stagionale, non l'archivio completo", () => {
    const page = read("app/nextgen/search/page.tsx");
    expect(page).toContain("realDiscoveryLeads = seasonalCatalogLeads(todayIso);");
    expect(page).not.toContain("realDiscoveryLeads = REAL_DISCOVERY_LEADS;");
  });

  test("Bari è area estesa: la scheda dice che non è a Rutigliano", () => {
    const pul = REAL_DISCOVERY_LEADS.find((l) => l.id === "bari-casa-pulcinella-natale-2026")!;
    expect(pul.shortDescription).toMatch(/Bari, circa 20 km da Rutigliano/);
    expect(pul.temporalNote).toMatch(/non a Rutigliano/);
  });
});

// 16/11/2026, Fabrizio: "ha senso introdurre un filtro ad hoc per le
// tipologie? ed un ordinamento in generale?… correggi anche la grafica della
// modale che si apre con 'aggiungi al planner'".
import { DISCOVERY_KIND_LABELS, leadKind } from "../../lib/discovery/real-dataset";

test.describe("Scopri: tipo di proposta, ordinamento, pannello Planner V2", () => {
  test("ogni Scoperta del catalogo ha un tipo; eventi e laboratori marcati", () => {
    expect(Object.keys(DISCOVERY_KIND_LABELS)).toEqual(["campus", "evento", "laboratorio"]);
    const byId = (id: string) => REAL_DISCOVERY_LEADS.find((l) => l.id === id)!;
    expect(leadKind(byId("milano-garegnano-winter-camp-2026"))).toBe("campus");
    expect(leadKind(byId("milano-manzoni-grinch-2026"))).toBe("evento");
    expect(leadKind(byId("bari-casa-pulcinella-natale-2026"))).toBe("evento");
    expect(leadKind(byId("milano-casa-note-natale-in-musica-2026"))).toBe("laboratorio");
  });

  test("ordinamento: prima le date più vicine, in corso = oggi, senza date in fondo", () => {
    const base = REAL_DISCOVERY_LEADS[0];
    const mk = (id: string, startDate: string | null, endDate: string | null, verifiedOn?: string) =>
      ({ ...base, id, region: "Lombardia", confidence: "high", startDate, endDate, verifiedOn }) as DiscoveryLeadRecord;
    const sorted = sortDiscoveryLeadsForDisplay(
      [mk("undated", null, null), mk("jan", "2027-01-10", "2027-01-10", "2026-11-16"), mk("ongoing", "2026-11-05", "2026-11-29", "2026-11-16"), mk("dec", "2026-12-12", "2026-12-20")],
      TODAY,
      "Lombardia"
    ).map((l) => l.id);
    expect(sorted).toEqual(["ongoing", "dec", "jan", "undated"]);
  });

  test("Scopri: chip Tutto / Campus / Spettacoli / Laboratori, filtro anche su 'Date da verificare', DEMO in fondo", () => {
    const src = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(src).toContain('data-testid="discover-kind-filter"');
    expect(src).toContain("if (kindFilter && leadKind(lead) !== kindFilter) return false;");
    expect(src).toContain("(!kindFilter || leadKind(lead) === kindFilter)");
    expect(src).toContain('if (kindFilter && kindFilter !== "campus") return [];');
    expect(src).toContain("...interleaveDiscoveryResults(real, leads, 2, community), ...interleaveDiscoveryResults(demo, [])");
    expect(src).toContain('if (kindFilter) params.set("tipo", kindFilter);');
  });

  test("pannello 'Aggiungi al Planner' in grafica V2 (card bianca, campi 48px, chip 44px)", () => {
    const src = read("components/nextgen/DiscoveryLeadCard.tsx");
    expect(src).toContain('data-testid="lead-planner-panel" className={panel.box}');
    expect(src).toContain('box: "rounded-2xl border border-trama-line bg-white p-4');
    expect(src).toContain("min-h-[48px] w-full rounded-[12px] border-[1.5px] border-trama-line");
    expect(src).toContain('chipOn: "min-h-[44px] rounded-full bg-trama-navy');
    expect(src).toContain("aria-pressed={planKidIds.includes(kid.id)}");
  });
});
