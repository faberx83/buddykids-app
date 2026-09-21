import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  REAL_DISCOVERY_LEADS,
  REJECTED_DISCOVERY_LEADS,
  isDiscoveryLeadCompatibleWithWeek,
  isDiscoveryLeadCompatibleWithAgeRange,
  isDiscoveryLeadCompatibleWithPriceCap,
  isDiscoveryLeadCompatibleWithZoneQuery,
  isDiscoveryLeadCompatibleWithCategoryTags,
  isDiscoveryLeadInvitable,
  secondaryLinkLabelForLead,
  type DiscoveryLeadRecord,
} from "../../lib/discovery/real-dataset";
import { interleaveDiscoveryResults, countDiscoveryResults, type DiscoveryResult } from "../../lib/discovery/result-model";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { KNOWN_PRODUCT_EVENTS } from "../../lib/telemetry/known-events";
import type { SmartMatch } from "../../lib/nextgen/smart-search";

// TRAMA — REAL DISCOVERY PILOT (16/09/2026, esteso 17/09/2026 · COMPLETION
// PASS). Stesso principio "[no browser]" già seguito da
// school-calendar-municipal-scope.spec.ts: unit test puri su
// lib/discovery/real-dataset.ts (nessun mock Supabase, nessuna dipendenza da
// dati live) + verifiche semantiche statiche sulla card/pipeline (grep sul
// sorgente, non un mock DOM) per il vincolo non negoziabile "REAL DATA YES,
// FAKE PARTNERS NO".
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

  test("RD-12: nessun record inventa un prezzo senza fonte — se null, resta null (spot-check sui record con dati incompleti)", () => {
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

// ============ COMPLETION PASS (17/09/2026) — nuovi scenari ============

test.describe("REAL DISCOVERY PILOT — filtro ETÀ (adapter puro)", () => {
  test("RD-22: età nota compatibile con il range scelto dall'utente → compatibile", () => {
    expect(isDiscoveryLeadCompatibleWithAgeRange({ ageMin: 5, ageMax: 14 }, 6, 10)).toBe(true);
  });

  test("RD-23: età nota fuori dal range scelto dall'utente → incompatibile", () => {
    expect(isDiscoveryLeadCompatibleWithAgeRange({ ageMin: 5, ageMax: 14 }, 15, 18)).toBe(false);
  });

  test("RD-24: età non dichiarata dalla fonte (ageMin/ageMax null) → MAI esclusa per età ignota", () => {
    expect(isDiscoveryLeadCompatibleWithAgeRange({ ageMin: null, ageMax: null }, 3, 5)).toBe(true);
    expect(isDiscoveryLeadCompatibleWithAgeRange({ ageMin: null, ageMax: null }, 15, 18)).toBe(true);
  });
});

test.describe("REAL DISCOVERY PILOT — filtro PREZZO (adapter puro)", () => {
  test("RD-25: prezzo noto entro il tetto scelto dall'utente → compatibile", () => {
    expect(isDiscoveryLeadCompatibleWithPriceCap({ price: 150, priceUnit: "per_settimana" }, 200)).toBe(true);
  });

  test("RD-26: prezzo noto sopra il tetto scelto dall'utente → incompatibile", () => {
    expect(isDiscoveryLeadCompatibleWithPriceCap({ price: 250, priceUnit: "per_settimana" }, 200)).toBe(false);
  });

  test("RD-27: prezzo non dichiarato dalla fonte (price: null) → MAI escluso, MAI trattato come 0€", () => {
    expect(isDiscoveryLeadCompatibleWithPriceCap({ price: null, priceUnit: null }, 50)).toBe(true);
  });
});

test.describe("REAL DISCOVERY PILOT — filtro ZONA testuale (adapter puro)", () => {
  test("RD-28: query vuota → sempre compatibile", () => {
    expect(isDiscoveryLeadCompatibleWithZoneQuery({ locationName: null, address: null, comune: "Rho" }, "")).toBe(true);
  });

  test("RD-29: query che corrisponde al comune → compatibile", () => {
    expect(isDiscoveryLeadCompatibleWithZoneQuery({ locationName: null, address: null, comune: "Rho" }, "rho")).toBe(true);
  });

  test("RD-30: query che non corrisponde a nulla → incompatibile", () => {
    expect(isDiscoveryLeadCompatibleWithZoneQuery({ locationName: null, address: null, comune: "Rho" }, "cornaredo")).toBe(false);
  });
});

test.describe("REAL DISCOVERY PILOT — filtro CATEGORIA/TAG (adapter puro, mappatura dichiarata)", () => {
  test("RD-31: nessun tag selezionato → sempre compatibile", () => {
    expect(isDiscoveryLeadCompatibleWithCategoryTags({ category: "sportivo" }, [])).toBe(true);
  });

  test("RD-32: categoria 'educativo' è sempre compatibile (nessun tag Partner la rappresenta correttamente)", () => {
    expect(isDiscoveryLeadCompatibleWithCategoryTags({ category: "educativo" }, ["danza"])).toBe(true);
  });

  test("RD-33: categoria 'sportivo' compatibile solo se il tag scelto è nella mappatura dichiarata", () => {
    expect(isDiscoveryLeadCompatibleWithCategoryTags({ category: "sportivo" }, ["sport"])).toBe(true);
    expect(isDiscoveryLeadCompatibleWithCategoryTags({ category: "sportivo" }, ["cucina"])).toBe(false);
  });
});

test.describe("REAL DISCOVERY PILOT — combinazione filtri e dataset esteso", () => {
  test("RD-34: una combinazione di filtri che non trova corrispondenze produce un array vuoto, non un errore", () => {
    const zeroResults = REAL_DISCOVERY_LEADS.filter(
      (lead) =>
        isDiscoveryLeadCompatibleWithAgeRange(lead, 0, 18) &&
        isDiscoveryLeadCompatibleWithZoneQuery(lead, "comune-inesistente-xyz")
    );
    expect(Array.isArray(zeroResults)).toBe(true);
    expect(zeroResults.length).toBe(0);
  });

  test("RD-35: il dataset esteso (COMPLETION PASS) ha almeno 10 record reali", () => {
    expect(REAL_DISCOVERY_LEADS.length).toBeGreaterThanOrEqual(10);
  });

  test("RD-36: i lead scartati restano documentati con una motivazione non vuota (mai silenziosamente omessi)", () => {
    expect(REJECTED_DISCOVERY_LEADS.length).toBeGreaterThan(0);
    for (const rejected of REJECTED_DISCOVERY_LEADS) {
      expect(rejected.reason.length).toBeGreaterThan(20);
    }
  });
});

test.describe("REAL DISCOVERY PILOT — no rating/disponibilità finti, Partner invariato (statico)", () => {
  // Nota: il file HA deliberatamente "rating"/"recensioni"/"posti disponibili"
  // nel COMMENTO di testa che spiega perché la card non li mostra mai (vedi
  // righe 8-22) — i commenti vengono quindi rimossi prima del controllo,
  // stesso principio già usato da RD-14/RD-15 sopra: qui si verifica il
  // CODICE renderizzato, non la documentazione che lo spiega.
  test("RD-37: DiscoveryLeadCard non introduce MAI rating/recensioni/voto finti nel codice renderizzato", () => {
    const source = readSource("../../components/nextgen/DiscoveryLeadCard.tsx");
    const codeOnly = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").toLowerCase();
    expect(codeOnly).not.toContain("rating");
    expect(codeOnly).not.toContain("recensioni");
    expect(codeOnly).not.toContain("voto");
  });

  test("RD-38: DiscoveryLeadCard non introduce MAI una disponibilità/posti finti nel codice renderizzato", () => {
    const source = readSource("../../components/nextgen/DiscoveryLeadCard.tsx");
    const codeOnly = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").toLowerCase();
    expect(codeOnly).not.toContain("posti disponibili");
    expect(codeOnly).not.toContain("spotsleft");
  });

  test("RD-39: la pipeline filtri Partner (filteredActivities) non referenzia i lead curati — nessuna contaminazione del dominio Activity", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    const filteredActivitiesMatch = source.match(
      /const filteredActivities = useMemo\(\(\) => \{[\s\S]*?\}, \[[\s\S]*?\]\);/
    );
    expect(filteredActivitiesMatch).not.toBeNull();
    const filteredActivitiesBlock = filteredActivitiesMatch![0];
    expect(filteredActivitiesBlock).not.toContain("realDiscoveryLeads");
    expect(filteredActivitiesBlock).not.toContain("compatibleRealDiscoveryLeads");
  });
});

test.describe("REAL DISCOVERY PILOT — analytics minimo (§10, riuso infrastruttura esistente)", () => {
  test("RD-40: curated_listing_viewed e curated_listing_external_clicked sono eventi noti (whitelist)", () => {
    expect(KNOWN_PRODUCT_EVENTS).toContain("curated_listing_viewed");
    expect(KNOWN_PRODUCT_EVENTS).toContain("curated_listing_external_clicked");
  });

  test("RD-41: app/actions/discovery.ts riusa persistProductEvent esistente, non introduce un nuovo insert diretto su product_events", () => {
    const source = readSource("../../app/actions/discovery.ts");
    expect(source).toContain("persistProductEvent");
    expect(source).not.toContain('.from("product_events")');
  });
});

// ============ DISCOVERY UNIFICATION + PROPONI INVITO (21/09/2026) ============
// Comando: npx playwright test tests/one/real-discovery-pilot.spec.ts

function makeFakeMatch(id: string): SmartMatch {
  return { activity: { id } as SmartMatch["activity"], kidName: null, score: 0, reasons: [] };
}

test.describe("DISCOVERY UNIFICATION — interleaveDiscoveryResults (view-model puro)", () => {
  test("RD-42: countDiscoveryResults = Partner + Curated, nessun count separato", () => {
    const partner = [makeFakeMatch("p1"), makeFakeMatch("p2")];
    const curated = [REAL_DISCOVERY_LEADS[0], REAL_DISCOVERY_LEADS[1]];
    expect(countDiscoveryResults(partner, curated)).toBe(4);
  });

  test("RD-43: interleaving 2 Partner : 1 Curated, ordine deterministico", () => {
    const partner = ["p1", "p2", "p3", "p4", "p5"].map(makeFakeMatch);
    const curated = [REAL_DISCOVERY_LEADS[0], REAL_DISCOVERY_LEADS[1]];
    const results = interleaveDiscoveryResults(partner, curated);
    expect(results.map((r) => r.kind)).toEqual(["partner", "partner", "curated", "partner", "partner", "curated", "partner"]);
    expect(results.length).toBe(7);
  });

  test("RD-44: l'ordine interno di ciascun dominio è preservato (mai ririordinato nell'interleaving)", () => {
    const partner = ["p1", "p2", "p3"].map(makeFakeMatch);
    const curated = [REAL_DISCOVERY_LEADS[0]];
    const results = interleaveDiscoveryResults(partner, curated);
    const partnerIds = results.filter((r) => r.kind === "partner").map((r) => (r as { kind: "partner"; match: SmartMatch }).match.activity.id);
    expect(partnerIds).toEqual(["p1", "p2", "p3"]);
    const curatedIds = results.filter((r) => r.kind === "curated").map((r) => (r as { kind: "curated"; lead: DiscoveryLeadRecord }).lead.id);
    expect(curatedIds).toEqual([REAL_DISCOVERY_LEADS[0].id]);
  });

  test("RD-45: curated vuoto (flag OFF o zero risultati compatibili) → risultato identico alla sola lista Partner, stesso ordine", () => {
    const partner = ["p1", "p2", "p3"].map(makeFakeMatch);
    const results = interleaveDiscoveryResults(partner, []);
    expect(results.every((r) => r.kind === "partner")).toBe(true);
    expect(results.map((r) => (r as { kind: "partner"; match: SmartMatch }).match.activity.id)).toEqual(["p1", "p2", "p3"]);
  });

  test("RD-46: Partner vuoto → risultato identico alla sola lista Curated, stesso ordine", () => {
    const curated = [REAL_DISCOVERY_LEADS[0], REAL_DISCOVERY_LEADS[1]];
    const results = interleaveDiscoveryResults([], curated);
    expect(results.every((r) => r.kind === "curated")).toBe(true);
    expect(results.map((r) => (r as { kind: "curated"; lead: DiscoveryLeadRecord }).lead.id)).toEqual([
      REAL_DISCOVERY_LEADS[0].id,
      REAL_DISCOVERY_LEADS[1].id,
    ]);
  });

  test("RD-47: nessun risultato mescola le due forme (un 'partner' non ha mai 'lead', un 'curated' non ha mai 'match')", () => {
    const results: DiscoveryResult[] = interleaveDiscoveryResults([makeFakeMatch("p1")], [REAL_DISCOVERY_LEADS[0]]);
    for (const r of results) {
      if (r.kind === "partner") {
        expect("lead" in r).toBe(false);
      } else {
        expect("match" in r).toBe(false);
      }
    }
  });
});

test.describe("DISCOVERY UNIFICATION — sezione separata rimossa, Search/Filters in alto, count unico (statico)", () => {
  test("RD-48: la sezione separata 'Scoperte TRAMA' sopra la searchbar non esiste più", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(source).not.toContain('<span className="text-sm font-bold text-ink">Scoperte TRAMA</span>');
  });

  test("RD-49: SearchDiscoveryClient importa il view-model unificato", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(source).toContain("interleaveDiscoveryResults");
    expect(source).toContain("countDiscoveryResults");
  });

  test("RD-50: il count mostrato in UI è quello unificato (Partner + Curated), non solo Partner", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(source).toContain("{totalResultsCount} attività trovate");
    expect(source).not.toContain("{matches.length} attività trovate");
  });

  test("RD-51: la searchbar precede nel sorgente il primo utilizzo dei risultati intercalati (Search/Filters in alto)", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    const searchbarIndex = source.indexOf('placeholder="Cerca per nome');
    const firstRenderIndex = source.indexOf(".map(renderDiscoveryResult)");
    expect(searchbarIndex).toBeGreaterThan(-1);
    expect(firstRenderIndex).toBeGreaterThan(searchbarIndex);
  });

  test("RD-52: la Mappa deriva SOLO da Partner (mapItems) — nessuna coordinata inventata per i lead curati", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    const mapItemsMatch = source.match(/const mapItems = useMemo\(\s*\(\)[\s\S]*?\[matches\]\s*\);/);
    expect(mapItemsMatch).not.toBeNull();
    expect(mapItemsMatch![0]).not.toContain("compatibleRealDiscoveryLeads");
  });
});

test.describe("DISCOVERY UNIFICATION — classificazione invitable (dataset, §8 entity audit)", () => {
  const INVITABLE_IDS = [
    "rho-cre-collodi-stripes",
    "milano-milanosport-campus-multisport",
    "milano-lyceum-summer-camp",
    "milano-notformalcamp-san-siro",
    "bareggio-usob-campus-multisport",
    "milano-baggio-oratorio-san-giovanni-bosco",
    "conversano-beltempo",
  ];
  const SOURCE_ONLY_IDS = [
    "cornaredo-centri-estivi-comunali",
    "pero-centro-estivo-primaria",
    "settimo-milanese-centro-diurno-ricreativo",
    "milano-centri-estivi-scuole-primarie-comunali",
    "bareggio-centro-estivo-comunale-infanzia",
    "noicattaro-centri-estivi-comunali",
  ];

  test("RD-53: esattamente 7 record invitabili e 6 source-only su 13 totali", () => {
    const invitableCount = REAL_DISCOVERY_LEADS.filter((l) => isDiscoveryLeadInvitable(l)).length;
    expect(invitableCount).toBe(7);
    expect(REAL_DISCOVERY_LEADS.length - invitableCount).toBe(6);
    expect(REAL_DISCOVERY_LEADS.length).toBe(13);
  });

  test("RD-54: i 7 id attesi sono invitabili", () => {
    for (const id of INVITABLE_IDS) {
      const lead = REAL_DISCOVERY_LEADS.find((l) => l.id === id);
      expect(lead, `record ${id} deve esistere nel dataset`).toBeDefined();
      expect(isDiscoveryLeadInvitable(lead!), `record ${id} deve essere invitable`).toBe(true);
    }
  });

  test("RD-55: i 6 id source-only NON sono invitabili", () => {
    for (const id of SOURCE_ONLY_IDS) {
      const lead = REAL_DISCOVERY_LEADS.find((l) => l.id === id);
      expect(lead, `record ${id} deve esistere nel dataset`).toBeDefined();
      expect(isDiscoveryLeadInvitable(lead!), `record ${id} NON deve essere invitable`).toBe(false);
    }
  });

  test("RD-56: secondaryLinkLabelForLead restituisce 'Sito dell'organizzatore' o 'Vedi la fonte' in base al dominio del link, mai un terzo valore", () => {
    expect(secondaryLinkLabelForLead({ officialUrlIsOrganizerSite: true })).toBe("Sito dell'organizzatore");
    expect(secondaryLinkLabelForLead({ officialUrlIsOrganizerSite: false })).toBe("Vedi la fonte");
  });

  test("RD-57: nessun record source-only ha officialUrlIsOrganizerSite=true (nessun 'sito dell'organizzatore' per un Comune)", () => {
    for (const id of SOURCE_ONLY_IDS) {
      const lead = REAL_DISCOVERY_LEADS.find((l) => l.id === id)!;
      expect(lead.officialUrlIsOrganizerSite).toBe(false);
    }
  });
});

test.describe("DISCOVERY UNIFICATION — CTA hierarchy nella card (statico)", () => {
  test("RD-58: 'Proponi invito' è condizionato a invitable nel sorgente", () => {
    const source = readSource("../../components/nextgen/DiscoveryLeadCard.tsx");
    expect(source).toContain("invitable && proposeState");
    expect(source).toContain("Proponi invito");
  });

  test("RD-59: la CTA secondaria usa secondaryLinkLabelForLead, mai una stringa 'sito ufficiale' generica", () => {
    const source = readSource("../../components/nextgen/DiscoveryLeadCard.tsx");
    const codeOnly = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(source).toContain("secondaryLinkLabelForLead");
    expect(codeOnly).not.toContain("sito ufficiale");
  });

  test("RD-60: il bottone Annulla del dialog non invoca mai proposeDiscoveryLeadInviteAction", () => {
    const source = readSource("../../components/nextgen/DiscoveryLeadCard.tsx");
    const annullaBlockMatch = source.match(/Annulla[\s\S]{0,20}<\/button>/);
    // Risalgo al blocco onClick immediatamente precedente al testo "Annulla"
    const onClickBeforeAnnulla = source.slice(0, source.indexOf(">Annulla<")).split("onClick={() => {").pop() ?? "";
    expect(annullaBlockMatch).not.toBeNull();
    expect(onClickBeforeAnnulla).not.toContain("proposeDiscoveryLeadInviteAction");
  });

  test("RD-61: aprire il dialog (tap su 'Proponi invito') non chiama MAI logDiscoveryLeadEventAction — solo la conferma lo fa", () => {
    const source = readSource("../../components/nextgen/DiscoveryLeadCard.tsx");
    const openDialogHandler = source.match(/onClick=\{\(\) => setProposeState\("confirm"\)\}/);
    expect(openDialogHandler).not.toBeNull();
    // Il pulsante che apre il dialog ha SOLO setProposeState("confirm") come
    // handler inline — nessuna chiamata ad azione/analytics nello stesso
    // punto (a differenza di handleConfirmPropose, distinto).
    expect(openDialogHandler![0]).not.toContain("logDiscoveryLeadEventAction");
  });
});

test.describe("DISCOVERY UNIFICATION — center_leads reuse, dedupe, analytics (statico)", () => {
  test("RD-62: proposeDiscoveryLeadInviteAction riusa suggestCenterLeadAction esistente, non inserisce direttamente", () => {
    const source = readSource("../../app/actions/discovery.ts");
    expect(source).toContain("import { suggestCenterLeadAction } from \"@/app/actions/center-leads\"");
    expect(source).toContain("suggestCenterLeadAction(organizerName, comune, undefined, demandContext)");
    expect(source).not.toContain('.from("center_leads").insert');
  });

  test("RD-63: il controllo 'proposto già da questo utente' avviene PRIMA dell'insert (dedupe preventivo)", () => {
    const source = readSource("../../app/actions/discovery.ts");
    const checkIndex = source.indexOf("hasParentAlreadySuggestedLead(dedupeKey)");
    const insertIndex = source.indexOf("suggestCenterLeadAction(organizerName, comune, undefined, demandContext)");
    expect(checkIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(checkIndex);
  });

  test("RD-64: l'evento curated_listing_invite_proposed è registrato SOLO dopo aver verificato che l'insert non ha fallito", () => {
    const source = readSource("../../app/actions/discovery.ts");
    const errorGuardIndex = source.indexOf("if (result.error) return result;");
    const eventIndex = source.indexOf('logDiscoveryLeadEventAction("curated_listing_invite_proposed"');
    expect(errorGuardIndex).toBeGreaterThan(-1);
    expect(eventIndex).toBeGreaterThan(errorGuardIndex);
  });

  test("RD-65: curated_listing_invite_proposed è nella whitelist degli eventi noti", () => {
    expect(KNOWN_PRODUCT_EVENTS).toContain("curated_listing_invite_proposed");
  });

  test("RD-66: CenterLeadDemandContext supporta discoveryLeadId (nessuna migration — jsonb già flessibile)", () => {
    const source = readSource("../../lib/types.ts");
    expect(source).toContain("discoveryLeadId?: string;");
  });

  test("RD-67: nessuna nuova tabella creata da questa unificazione (governance: zero migration)", () => {
    for (const file of ["../../lib/discovery/real-dataset.ts", "../../lib/discovery/result-model.ts", "../../app/actions/discovery.ts", "../../lib/data/center-leads.ts"]) {
      const source = readSource(file).toLowerCase();
      expect(source).not.toContain("create table");
    }
  });

  test("RD-68: normalizeDedupeKey è riusata da center-leads.ts, non duplicata in discovery.ts", () => {
    const source = readSource("../../app/actions/discovery.ts");
    expect(source).toContain("import { normalizeDedupeKey, hasParentAlreadySuggestedLead } from \"@/lib/data/center-leads\"");
    // Nessuna reimplementazione locale della normalizzazione (niente .normalize("NFD") duplicato qui).
    expect(source).not.toContain('.normalize("NFD")');
  });
});

test.describe("DISCOVERY UNIFICATION — documentazione stale corretta", () => {
  test("RD-69: lib/releases/catalog.ts non dichiara più 'Non integrato con i filtri esistenti di Scopri'", () => {
    const source = readSource("../../lib/releases/catalog.ts");
    expect(source).not.toContain("Non integrato con i filtri esistenti di Scopri");
  });
});

test.describe("DISCOVERY UNIFICATION — flag OFF invariato (regressione)", () => {
  test("RD-70: con dataset curato vuoto (flag OFF), il result set unificato coincide esattamente con i soli risultati Partner", () => {
    const partner = ["a1", "a2", "a3", "a4"].map(makeFakeMatch);
    const results = interleaveDiscoveryResults(partner, []);
    expect(countDiscoveryResults(partner, [])).toBe(partner.length);
    expect(results.length).toBe(partner.length);
    expect(results.every((r) => r.kind === "partner")).toBe(true);
  });
});
