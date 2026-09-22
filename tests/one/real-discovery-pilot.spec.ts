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
  isDiscoveryLeadCompatibleWithCoverage,
  isDiscoveryLeadInvitable,
  secondaryLinkLabelForLead,
  type DiscoveryLeadRecord,
} from "../../lib/discovery/real-dataset";
import {
  interleaveDiscoveryResults,
  countDiscoveryResults,
  buildDiscoveryMapItems,
  countMappedCuratedActivities,
  type DiscoveryResult,
  type DiscoveryMapItem,
} from "../../lib/discovery/result-model";
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

  test("RD-52: partnerMapItems (Partner) deriva SOLO da `matches`, mai da compatibleRealDiscoveryLeads — nessuna coordinata inventata (aggiornato da DISCOVERY MAP + POLISH: la Mappa unificata riusa questo array invariato, vedi MAP-01..MAP-10)", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    const partnerMapItemsMatch = source.match(/const partnerMapItems = useMemo\(\s*\(\)[\s\S]*?\[matches\]\s*\);/);
    expect(partnerMapItemsMatch).not.toBeNull();
    expect(partnerMapItemsMatch![0]).not.toContain("compatibleRealDiscoveryLeads");
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

// ============ TRAMA — DISCOVERY MAP + POLISH (21/09/2026) ============
//
// §20 del prompt "TEST REQUIRED" — 20 scenari minimi. Stesso principio
// "[no browser]" di sopra: unit test puri su buildDiscoveryMapItems
// (lib/discovery/result-model.ts) + verifiche statiche sul sorgente per
// tutto ciò che è UI/popup/copy (nessun mock DOM/Leaflet in questo runner).

function makeFakePartnerMapItem(id: string, lat = 45.46, lng = 9.19) {
  return { id, name: `Attività ${id}`, emoji: "🏊", lat, lng };
}

// Clona un record reale del dataset con override mirati — mai un record
// "inventato da zero": parte sempre da un DiscoveryLeadRecord reale e
// tracciabile, cambia solo i campi che il test deve controllare (stesso
// principio già in uso per makeFakeMatch sopra, applicato ai lead).
function makeFakeLead(overrides: Partial<DiscoveryLeadRecord>): DiscoveryLeadRecord {
  return { ...REAL_DISCOVERY_LEADS[0], ...overrides };
}

test.describe("DISCOVERY MAP + POLISH — buildDiscoveryMapItems (view-model puro)", () => {
  test("MAP-01: i marker Partner/mock passati in ingresso sono TUTTI presenti in uscita, stessi id (nessun marker perso)", () => {
    const partnerItems = [makeFakePartnerMapItem("a1"), makeFakePartnerMapItem("a2"), makeFakePartnerMapItem("707bc5da")];
    const result = buildDiscoveryMapItems(partnerItems, []);
    const partnerIdsOut = result.filter((r) => r.kind === "partner").map((r) => r.id);
    expect(partnerIdsOut).toEqual(["a1", "a2", "707bc5da"]);
  });

  test("MAP-02: con zero lead curati (flag OFF o nessun risultato compatibile), l'output coincide esattamente con l'input Partner (regressione)", () => {
    const partnerItems = [makeFakePartnerMapItem("a1"), makeFakePartnerMapItem("a2")];
    const result = buildDiscoveryMapItems(partnerItems, []);
    expect(result.length).toBe(partnerItems.length);
    expect(result.every((r) => r.kind === "partner")).toBe(true);
  });

  test("MAP-03: lead curato INVITABILE con lat/lng noti → marker 'curated_invitable' ('Da invitare')", () => {
    const lead = makeFakeLead({ id: "test-invitabile", invitable: true, lat: 45.5, lng: 9.2 });
    const result = buildDiscoveryMapItems([], [lead]);
    expect(result.length).toBe(1);
    expect(result[0].kind).toBe("curated_invitable");
  });

  test("MAP-04: lead curato SOURCE-ONLY con lat/lng noti → marker 'curated_source' ('Fonte pubblica')", () => {
    const lead = makeFakeLead({ id: "test-source", invitable: false, lat: 45.5, lng: 9.2 });
    const result = buildDiscoveryMapItems([], [lead]);
    expect(result.length).toBe(1);
    expect(result[0].kind).toBe("curated_source");
  });

  test("MAP-05: lead curato SENZA lat/lng (null) → nessun marker generato, qualunque sia invitable", () => {
    const invitableNoGeo = makeFakeLead({ id: "test-no-geo-1", invitable: true, lat: null, lng: null });
    const sourceNoGeo = makeFakeLead({ id: "test-no-geo-2", invitable: false, lat: null, lng: null });
    const result = buildDiscoveryMapItems([], [invitableNoGeo, sourceNoGeo]);
    expect(result.length).toBe(0);
  });

  test("MAP-06: nessuna coordinata fake — un lead con lat noto ma lng null resta escluso (mai metà coordinata)", () => {
    const halfGeo = makeFakeLead({ id: "test-half-geo", invitable: true, lat: 45.5, lng: null });
    expect(buildDiscoveryMapItems([], [halfGeo]).length).toBe(0);
  });

  test("MAP-07: il dataset reale REAL_DISCOVERY_LEADS non contiene MAI una coordinata parziale o stimata senza fonte (invariante lat/lng)", () => {
    for (const lead of REAL_DISCOVERY_LEADS) {
      // O entrambi noti, o entrambi null — mai uno solo.
      expect(lead.lat === null).toBe(lead.lng === null);
      if (lead.geoPrecision !== null) {
        expect(["exact", "venue"]).toContain(lead.geoPrecision);
      }
    }
  });

  test("MAP-08: mappableResultsCount (lunghezza dell'output) può essere INFERIORE al count totale Partner+Curated, mai superiore", () => {
    const partnerItems = [makeFakePartnerMapItem("a1")];
    const curated = [
      makeFakeLead({ id: "geo-1", invitable: true, lat: 45.5, lng: 9.2 }),
      makeFakeLead({ id: "no-geo-1", invitable: true, lat: null, lng: null }),
      makeFakeLead({ id: "no-geo-2", invitable: false, lat: null, lng: null }),
    ];
    const mapItems = buildDiscoveryMapItems(partnerItems, curated);
    const totalCount = countDiscoveryResults(
      partnerItems.map(makeFakeMatch as unknown as (id: string) => SmartMatch),
      curated
    );
    expect(mapItems.length).toBeLessThanOrEqual(totalCount);
    expect(mapItems.length).toBe(2); // 1 partner + 1 curato con geo, i 2 senza geo restano fuori
  });

  test("MAP-09: la Mappa riusa GLI STESSI due result set filtrati della Lista, mai una terza pipeline (statico)", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(source).toContain("buildDiscoveryMapItems(partnerMapItems, compatibleRealDiscoveryLeads)");
    // partnerMapItems deriva da `matches` — lo stesso array filtrato usato dalla Lista, non una ricerca nuova.
    const partnerMapItemsBlock = source.slice(
      source.indexOf("const partnerMapItems = useMemo"),
      source.indexOf("const discoveryMapItems = useMemo")
    );
    expect(partnerMapItemsBlock).toContain("matches\n");
  });

  test("MAP-10: 'kind' dei marker è sempre uno dei 3 valori ammessi, mai una quarta categoria implicita", () => {
    const partnerItems = [makeFakePartnerMapItem("a1")];
    const curated = [
      makeFakeLead({ id: "geo-inv", invitable: true, lat: 45.5, lng: 9.2 }),
      makeFakeLead({ id: "geo-src", invitable: false, lat: 45.5, lng: 9.2 }),
    ];
    const result: DiscoveryMapItem[] = buildDiscoveryMapItems(partnerItems, curated);
    for (const item of result) {
      expect(["partner", "curated_invitable", "curated_source"]).toContain(item.kind);
    }
  });
});

test.describe("DISCOVERY MAP + POLISH — popup (statico sul sorgente)", () => {
  test("MAP-11: i marker 'partner' NON ricevono popupContent custom → ActivityMap usa il popup di default INVARIATO ('Apri scheda')", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    const block = source.slice(source.indexOf("const mapMarkerItems: MapItem[]"), source.indexOf("const mapMarkersCount"));
    expect(block).toContain('markerKind: "partner"');
    // Il ramo "partner" del map() non include mai popupContent.
    const partnerBranch = block.slice(block.indexOf('item.kind === "partner"'), block.indexOf(": {"));
    expect(partnerBranch).not.toContain("popupContent");
  });

  test("MAP-12: i marker Curated ricevono SEMPRE un popupContent dedicato (mai il fallback 'Apri scheda', che non esiste per un lead)", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(source).toContain("popupContent: <DiscoveryMapPopupCard lead={item.lead} locationLabel={item.locationLabel} />");
  });

  test("MAP-13: il popup invitabile (DiscoveryMapPopupCard) mostra 'Proponi invito' e riusa proposeDiscoveryLeadInviteAction", () => {
    const source = readSource("../../components/nextgen/DiscoveryMapPopupCard.tsx");
    expect(source).toContain("Proponi invito");
    expect(source).toContain("proposeDiscoveryLeadInviteAction(lead.id, lead.organizerName, lead.comune)");
  });

  test("MAP-14: il popup source-only NON mostra mai il bottone 'Proponi invito' (solo dentro il ramo invitable)", () => {
    const source = readSource("../../components/nextgen/DiscoveryMapPopupCard.tsx");
    const codeOnly = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    // Ogni occorrenza del testo "Proponi invito" vive dentro un blocco `invitable && ...`.
    const idx = codeOnly.indexOf("Proponi invito");
    expect(idx).toBeGreaterThan(-1);
    const before = codeOnly.slice(0, idx);
    expect(before.lastIndexOf("invitable &&")).toBeGreaterThan(before.lastIndexOf("</a>"));
  });

  test("MAP-15: il popup mostra la microcopy 'Gestore non ancora identificato da TRAMA' solo per i lead non invitabili", () => {
    const source = readSource("../../components/nextgen/DiscoveryMapPopupCard.tsx");
    expect(source).toContain("Gestore non ancora identificato da TRAMA");
    expect(source).toContain("{!invitable && (");
  });

  test("MAP-16: nessun popup Curated mostra Match/rating/availability/posti finti (fuori dai commenti)", () => {
    const source = readSource("../../components/nextgen/DiscoveryMapPopupCard.tsx");
    const codeOnly = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").toLowerCase();
    for (const forbidden of ["match%", "rating", "posti disponibili", "spotsleft"]) {
      expect(codeOnly).not.toContain(forbidden);
    }
  });
});

test.describe("DISCOVERY MAP + POLISH — legend, empty state, count (statico sul sorgente)", () => {
  test("MAP-17: la legenda mostra i 3 wording parent-friendly richiesti, mai terminologia tecnica", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    const legendStart = source.indexOf("MAP LEGEND");
    const legendBlock = source.slice(legendStart, source.indexOf("MAP COUNT / MISSING GEO", legendStart));
    expect(legendBlock).toContain("TRAMA");
    expect(legendBlock).toContain("Da invitare");
    expect(legendBlock).toContain("Fonte pubblica");
    // Il testo VISIBILE della legenda (dentro il div renderizzato, esclusa
    // la condizione `it.markerKind === "curated_..."` che la mostra/nasconde
    // — quella è codice, non copy) non deve mai contenere terminologia
    // tecnica: isoliamo il <div> della legenda dalla guardia che lo precede.
    const legendVisibleText = legendBlock.slice(legendBlock.indexOf('<div className="mt-2'));
    for (const technical of ["source-only", "curated_", "lead.id", "DiscoveryLeadRecord"]) {
      expect(legendVisibleText).not.toContain(technical);
    }
  });

  test("MAP-18: empty map state — quando activityResultsCount>0 e mappedActivitiesCount===0, mostra il messaggio esplicito + 'Torna alla lista'", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(source).toContain("activityResultsCount > 0 && mappedActivitiesCount === 0");
    expect(source).toContain("Nessuna di queste attività ha ancora una sede precisa sulla mappa.");
    expect(source).toContain("Torna alla lista");
  });

  test("MAP-19: 'Torna alla lista' riporta davvero alla vista Lista (setViewMode(\"lista\"))", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    const block = source.slice(source.indexOf("Nessuna di queste attività"), source.indexOf("Torna alla lista") + 30);
    expect(block).toContain('setViewMode("lista")');
  });

  test("MAP-20: la microcopy 'N di M attività visibili sulla mappa' compare solo quando Lista e Mappa divergono (mappedActivitiesCount < activityResultsCount)", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(source).toContain("mappedActivitiesCount < activityResultsCount");
    expect(source).toContain("attività visibili sulla mappa");
    expect(source).toContain("non ");
    expect(source).toContain("ancora una sede precisa (visibili in Lista)");
  });

  test("MAP-21: il count generale ('X attività trovate') non cambia MAI in base a quante sono mappabili — resta totalResultsCount ovunque", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(source).toContain("{totalResultsCount} attività trovate");
    expect(source).not.toContain("{mappableResultsCount} attività trovate");
    expect(source).not.toContain("{mappedActivitiesCount} attività trovate");
  });

  // TRAMA — DISCOVERY MAP FINALIZATION (22/09/2026), §5 "MULTI-SEDE — TRE
  // COUNT DISTINTI".
  test("MAP-31: mapMarkersCount e mappedActivitiesCount sono due variabili distinte nel sorgente (mai collassate in una sola)", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(source).toContain("const mapMarkersCount = mapMarkerItems.length");
    expect(source).toContain("const mappedActivitiesCount = partnerMapItems.length + countMappedCuratedActivities(compatibleRealDiscoveryLeads)");
  });

  test("MAP-32: quando mapMarkersCount supera mappedActivitiesCount, la UI mostra una nota separata sul numero di sedi (mai confusa col count attività)", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(source).toContain("mapMarkersCount > mappedActivitiesCount");
    expect(source).toContain("sedi sulla mappa — alcune attività hanno più di un punto");
  });
});

// TRAMA — DISCOVERY MAP FINALIZATION (22/09/2026), §9 "COVERAGE FILTER —
// CORREZIONE SEMANTICA". MAP-22 (versione precedente) asseriva che
// `isDiscoveryLeadCompatibleWithCoverage` NON dovesse esistere — quella era
// la scelta deliberata del pass 21/09/2026, corretta ORA su richiesta
// esplicita di Fabrizio dopo il test live "Giorni singoli" → 0 marker (tutti
// i 13 Curated UNKNOWN sopravvivevano). La funzione ora esiste ed è
// verificata sotto, non più la sua assenza.
test.describe("DISCOVERY MAP FINALIZATION — coverage filter semantics per Curated (logica pura + statico)", () => {
  test("MAP-22: isDiscoveryLeadCompatibleWithCoverage esiste ed è esportata da real-dataset.ts", () => {
    const source = readSource("../../lib/discovery/real-dataset.ts");
    expect(source).toContain("export function isDiscoveryLeadCompatibleWithCoverage");
  });

  test("MAP-23: nessuna card/popup Curated dichiara mai 'Giorni spot disponibili' o disponibilità spot (UNKNOWN non diventa mai TRUE)", () => {
    for (const file of ["../../components/nextgen/DiscoveryLeadCard.tsx", "../../components/nextgen/DiscoveryMapPopupCard.tsx"]) {
      const source = readSource(file);
      expect(source).not.toContain("Giorni spot disponibili");
    }
  });

  test("MAP-33: NESSUN filtro Copertura esplicito attivo → un lead con bookingMode sconosciuto (null) resta compatibile (comportamento invariato)", () => {
    const unknownLead = makeFakeLead({ bookingMode: null });
    expect(
      isDiscoveryLeadCompatibleWithCoverage(unknownLead, { selectedCoverageModes: [], onlyDaySpots: false })
    ).toBe(true);
  });

  test("MAP-34: filtro Copertura ESPLICITO attivo (selectedCoverageModes non vuoto) → un lead con bookingMode sconosciuto (null) viene escluso", () => {
    const unknownLead = makeFakeLead({ bookingMode: null });
    expect(
      isDiscoveryLeadCompatibleWithCoverage(unknownLead, { selectedCoverageModes: ["week_only"], onlyDaySpots: false })
    ).toBe(false);
  });

  test("MAP-35: bookingMode 'weekly' compatibile SOLO quando 'week_only' è tra le modalità selezionate", () => {
    const weeklyLead = makeFakeLead({ bookingMode: "weekly" });
    expect(isDiscoveryLeadCompatibleWithCoverage(weeklyLead, { selectedCoverageModes: ["week_only"], onlyDaySpots: false })).toBe(true);
    expect(isDiscoveryLeadCompatibleWithCoverage(weeklyLead, { selectedCoverageModes: ["day_only"], onlyDaySpots: false })).toBe(false);
  });

  test("MAP-36: bookingMode 'daily' compatibile SOLO quando 'day_only' è tra le modalità selezionate — un lead senza bookingMode 'daily'/'mixed' viene escluso da 'Giorni singoli'", () => {
    const dailyLead = makeFakeLead({ bookingMode: "daily" });
    expect(isDiscoveryLeadCompatibleWithCoverage(dailyLead, { selectedCoverageModes: ["day_only"], onlyDaySpots: false })).toBe(true);
    expect(isDiscoveryLeadCompatibleWithCoverage(dailyLead, { selectedCoverageModes: ["week_only"], onlyDaySpots: false })).toBe(false);
  });

  test("MAP-37: bookingMode 'mixed' compatibile SOLO quando 'mixed' è esplicitamente selezionato (stessa semantica di appartenenza già usata per i Partner, mai un sottoinsieme implicito)", () => {
    const mixedLead = makeFakeLead({ bookingMode: "mixed" });
    expect(isDiscoveryLeadCompatibleWithCoverage(mixedLead, { selectedCoverageModes: ["mixed"], onlyDaySpots: false })).toBe(true);
    expect(isDiscoveryLeadCompatibleWithCoverage(mixedLead, { selectedCoverageModes: ["week_only"], onlyDaySpots: false })).toBe(false);
  });

  test("MAP-38: 'Solo Giorni spot disponibili ora' esclude SEMPRE ogni lead curato, qualunque sia il bookingMode (nessuna disponibilità live nota per nessun Curated)", () => {
    for (const mode of ["weekly", "daily", "mixed", null] as const) {
      const lead = makeFakeLead({ bookingMode: mode });
      expect(isDiscoveryLeadCompatibleWithCoverage(lead, { selectedCoverageModes: [], onlyDaySpots: true })).toBe(false);
    }
  });

  test("MAP-39: il test live regressivo 'Copertura → Giorni singoli' non produce più 0 marker per il solo fatto che tutti i Curated sono UNKNOWN — un dataset interamente UNKNOWN produce ora 0 Curated compatibili con un filtro esplicito, non 13", () => {
    const allUnknown = REAL_DISCOVERY_LEADS.filter((l) => (l.bookingMode ?? null) === null);
    const compatible = allUnknown.filter((l) =>
      isDiscoveryLeadCompatibleWithCoverage(l, { selectedCoverageModes: ["day_only"], onlyDaySpots: false })
    );
    expect(compatible.length).toBe(0);
  });

  test("MAP-40: SearchDiscoveryClient applica isDiscoveryLeadCompatibleWithCoverage a compatibleRealDiscoveryLeads (wiring reale, non solo la funzione pura isolata)", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    const block = source.slice(source.indexOf("const compatibleRealDiscoveryLeads = useMemo"), source.indexOf("const [radiusKm"));
    expect(block).toContain("isDiscoveryLeadCompatibleWithCoverage(lead, { selectedCoverageModes, onlyDaySpots })");
  });
});

test.describe("DISCOVERY MAP FINALIZATION — multi-sede (§4-5, logica pura)", () => {
  test("MAP-41: un lead con locations[] genera UN marker per ogni sede con lat/lng noti, mai un marker riassuntivo aggiuntivo da lead.lat/lead.lng", () => {
    const multiLead = makeFakeLead({
      id: "test-multi",
      invitable: false,
      lat: null,
      lng: null,
      locations: [
        { label: "Sede A", address: "Via A 1", lat: 45.1, lng: 9.1, geoPrecision: "venue" },
        { label: "Sede B", address: "Via B 2", lat: 45.2, lng: 9.2, geoPrecision: "venue" },
      ],
    });
    const result = buildDiscoveryMapItems([], [multiLead]);
    expect(result.length).toBe(2);
    expect(result.every((r) => r.kind === "curated_source")).toBe(true);
    expect(result.map((r) => (r as { locationLabel?: string }).locationLabel)).toEqual(["Sede A", "Sede B"]);
  });

  test("MAP-42: dentro locations[], una sede con lat/lng null non genera marker (le altre sedi valide continuano a generarne)", () => {
    const multiLead = makeFakeLead({
      id: "test-multi-partial",
      invitable: true,
      lat: null,
      lng: null,
      locations: [
        { label: "Sede nota", address: "Via A 1", lat: 45.1, lng: 9.1, geoPrecision: "venue" },
        { label: "Sede ignota", address: "Via B 2", lat: null, lng: null, geoPrecision: null },
      ],
    });
    const result = buildDiscoveryMapItems([], [multiLead]);
    expect(result.length).toBe(1);
    expect((result[0] as { locationLabel?: string }).locationLabel).toBe("Sede nota");
  });

  test("MAP-43: countMappedCuratedActivities conta un'attività multi-sede come 1, mai come il numero di marker", () => {
    const multiLead = makeFakeLead({
      id: "test-multi-count",
      lat: null,
      lng: null,
      locations: [
        { label: "Sede A", address: "Via A 1", lat: 45.1, lng: 9.1, geoPrecision: "venue" },
        { label: "Sede B", address: "Via B 2", lat: 45.2, lng: 9.2, geoPrecision: "venue" },
      ],
    });
    const singleLead = makeFakeLead({ id: "test-single", lat: 45.5, lng: 9.5, geoPrecision: "exact" });
    const noGeoLead = makeFakeLead({ id: "test-none", lat: null, lng: null });
    const count = countMappedCuratedActivities([multiLead, singleLead, noGeoLead]);
    expect(count).toBe(2); // multiLead (1 attività, 2 marker) + singleLead — noGeoLead esclusa
  });

  test("MAP-44: il dataset reale ha esattamente un record con locations[] (milano-centri-estivi-scuole-primarie-comunali), coerente con l'audit — nessun altro record introduce multi-sede senza fonte", () => {
    const withLocations = REAL_DISCOVERY_LEADS.filter((l) => l.locations && l.locations.length > 0);
    expect(withLocations.map((l) => l.id)).toEqual(["milano-centri-estivi-scuole-primarie-comunali"]);
  });

  test("MAP-45: mapMarkersCount può superare mappedActivitiesCount nel dataset reale filtrato senza filtri attivi (multi-sede reale produce più marker della singola attività)", () => {
    const multi = REAL_DISCOVERY_LEADS.find((l) => l.id === "milano-centri-estivi-scuole-primarie-comunali")!;
    const mapped = countMappedCuratedActivities([multi]);
    const markers = buildDiscoveryMapItems([], [multi]).length;
    expect(mapped).toBe(1);
    expect(markers).toBeGreaterThan(mapped);
  });
});

test.describe("DISCOVERY MAP FINALIZATION — invariante geo estesa a locations[] (nessuna coordinata inventata, nessun centroide)", () => {
  test("MAP-46: ogni voce di locations[] nel dataset reale ha lat/lng entrambi noti o entrambi null (mai una coordinata parziale)", () => {
    for (const lead of REAL_DISCOVERY_LEADS) {
      for (const loc of lead.locations ?? []) {
        expect(loc.lat === null).toBe(loc.lng === null);
        if (loc.geoPrecision !== null) expect(["exact", "venue"]).toContain(loc.geoPrecision);
      }
    }
  });

  test("MAP-47: nessun record del dataset reale usa una coordinata duplicata tra Comuni diversi (proxy anti-centroide: un centroide di Comune sarebbe condiviso da più record dello stesso Comune, qui ogni coordinata nota è unica)", () => {
    const seen = new Map<string, string>();
    for (const lead of REAL_DISCOVERY_LEADS) {
      const points: { lat: number; lng: number }[] = [];
      if (lead.lat !== null && lead.lng !== null) points.push({ lat: lead.lat, lng: lead.lng });
      for (const loc of lead.locations ?? []) {
        if (loc.lat !== null && loc.lng !== null) points.push({ lat: loc.lat, lng: loc.lng });
      }
      for (const p of points) {
        const key = `${p.lat},${p.lng}`;
        expect(seen.has(key)).toBe(false);
        seen.set(key, lead.id);
      }
    }
  });

  test("MAP-48: un'attività genuinamente municipale/rotante senza sede nominata dalla fonte resta non mappabile (cornaredo, pero, bareggio-infanzia, noicattaro) — mai un marker inventato per 'coprire' il Comune", () => {
    for (const id of [
      "cornaredo-centri-estivi-comunali",
      "pero-centro-estivo-primaria",
      "bareggio-centro-estivo-comunale-infanzia",
      "noicattaro-centri-estivi-comunali",
    ]) {
      const lead = REAL_DISCOVERY_LEADS.find((l) => l.id === id)!;
      expect(lead.lat).toBeNull();
      expect(lead.lng).toBeNull();
      expect(lead.locations ?? []).toEqual([]);
    }
  });
});

test.describe("DISCOVERY MAP + POLISH — card polish + regressioni cross-cutting (statico)", () => {
  test("MAP-24: DiscoveryLeadCard hero è alto 140px, stessa altezza esatta dell'hero di ActivityCard (allineamento visivo §15)", () => {
    const cardSource = readSource("../../components/nextgen/DiscoveryLeadCard.tsx");
    const activityCardSource = readSource("../../components/ActivityCard.tsx");
    expect(cardSource).toContain("h-[140px]");
    expect(activityCardSource).toContain("h-[140px]");
  });

  test("MAP-25: DiscoveryLeadCard continua a non contenere MAI 'Prenota'/Match%/rating (nessuna capability inventata dal polish)", () => {
    const source = readSource("../../components/nextgen/DiscoveryLeadCard.tsx");
    const codeOnly = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(codeOnly.toLowerCase()).not.toContain("prenota");
    expect(codeOnly).not.toMatch(/Match\s*\{/);
  });

  test("MAP-26: School Calendar resta non toccato da questo pass (nessun file school-calendar modificato)", () => {
    for (const file of [
      "../../lib/discovery/real-dataset.ts",
      "../../lib/discovery/result-model.ts",
      "../../components/ActivityMap.tsx",
      "../../components/nextgen/DiscoveryLeadCard.tsx",
      "../../components/nextgen/DiscoveryMapPopupCard.tsx",
      "../../app/nextgen/search/SearchDiscoveryClient.tsx",
      // TRAMA — DISCOVERY FINAL UX PASS (22/09/2026): file toccati da questo
      // pass, stesso controllo esteso.
      "../../components/nextgen/NotificationCenter.tsx",
      "../../components/nextgen/BetaFeedbackButton.tsx",
      "../../components/nextgen/NextgenScrollActivity.tsx",
    ]) {
      const source = readSource(file).toLowerCase();
      expect(source).not.toContain("school_calendar");
      expect(source).not.toContain("schoolcalendar");
    }
  });

  test("MAP-27: il flow 'Proponi invito' verificato live resta invariato — DiscoveryLeadCard e DiscoveryMapPopupCard chiamano la STESSA Server Action, nessuna nuova scrittura", () => {
    const cardSource = readSource("../../components/nextgen/DiscoveryLeadCard.tsx");
    const popupSource = readSource("../../components/nextgen/DiscoveryMapPopupCard.tsx");
    expect(cardSource).toContain("proposeDiscoveryLeadInviteAction(lead.id, lead.organizerName, lead.comune)");
    expect(popupSource).toContain("proposeDiscoveryLeadInviteAction(lead.id, lead.organizerName, lead.comune)");
    const discoveryActionSource = readSource("../../app/actions/discovery.ts");
    expect(discoveryActionSource).toContain("suggestCenterLeadAction(organizerName, comune, undefined, demandContext)");
  });

  test("MAP-28: ActivityMap resta retrocompatibile — markerKind/popupContent sono facoltativi, PlannerMapView non li passa e non è impattato", () => {
    const mapSource = readSource("../../components/ActivityMap.tsx");
    expect(mapSource).toContain("markerKind?:");
    expect(mapSource).toContain("popupContent?:");
    const plannerSource = readSource("../../components/nextgen/PlannerMapView.tsx");
    expect(plannerSource).not.toContain("markerKind");
    expect(plannerSource).not.toContain("popupContent");
  });

  test("MAP-29: 'approximate' non è un valore ammesso per geoPrecision (marker potenzialmente fuorviante, escluso deliberatamente — §7)", () => {
    const source = readSource("../../lib/discovery/real-dataset.ts");
    // Il TIPO ammette solo exact/venue/null — "approximate" può comparire
    // solo nella prosa dei commenti (per spiegare PERCHÉ è stato escluso),
    // mai nell'unione di tipo effettiva.
    expect(source).toContain('geoPrecision: "exact" | "venue" | null;');
    const typeLine = source.split("\n").find((l) => l.includes('geoPrecision: "exact" | "venue" | null;'));
    expect(typeLine).toBeDefined();
    expect(typeLine).not.toContain("approximate");
  });

  test("MAP-30: nessuna migration introdotta da questo pass (governance: zero migration salvo impossibilità tecnica dimostrata — nessuna qui)", () => {
    for (const file of ["../../lib/discovery/real-dataset.ts", "../../lib/discovery/result-model.ts"]) {
      const source = readSource(file).toLowerCase();
      expect(source).not.toContain("create table");
      expect(source).not.toContain("alter table");
    }
  });
});

// ============ DISCOVERY FINAL UX PASS (22/09/2026) ============
//
// Bugfix pass dopo il deploy: tile layer CARTO rotto ("API KEY REQUIRED"),
// marker FULL TRAMA blu invece di viola, floating controls (bell/chat) che
// possono sovrapporsi alla Mappa, mancanza di una X per svuotare la
// ricerca. Nessuna migration, nessun tocco a School Calendar/Center
// Leads/Proponi invito/dataset-coordinate.

test.describe("DISCOVERY FINAL UX PASS — tile layer (statico sul sorgente)", () => {
  test("UX-01: il tile layer NON punta più a basemaps.cartocdn.com (CARTO, ora richiede una API key — root cause di 'API KEY REQUIRED')", () => {
    const source = readSource("../../components/ActivityMap.tsx");
    // Il dominio vecchio può comparire nel COMMENTO che spiega la root
    // cause/la migrazione, ma non deve mai comparire nella prop `url=` reale
    // di un TileLayer.
    const urlLine = source.split("\n").find((l) => l.trim().startsWith("url="));
    expect(urlLine).toBeDefined();
    expect(urlLine).not.toContain("basemaps.cartocdn.com");
  });

  test("UX-02: il tile layer usa un provider senza API key (Wikimedia Maps osm-intl), nessuna chiave hardcoded nel client", () => {
    const source = readSource("../../components/ActivityMap.tsx");
    expect(source).toContain("maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png");
    // Nessun parametro `key=`/`apikey=` in nessuna TileLayer url — se in
    // futuro si tornasse a un provider con chiave, deve arrivare da env var
    // via config server-side, mai come stringa letterale qui.
    expect(source.toLowerCase()).not.toMatch(/[?&](api_?key|token)=/);
  });

  test("UX-03: l'attribution del tile layer resta presente e corretta (OpenStreetMap + Wikimedia)", () => {
    const source = readSource("../../components/ActivityMap.tsx");
    expect(source).toContain("Wikimedia maps beta");
    expect(source).toContain("openstreetmap.org/copyright");
  });
});

test.describe("DISCOVERY FINAL UX PASS — colore marker FULL TRAMA (statico sul sorgente)", () => {
  test("UX-04: esiste un'icona dedicata viola per i marker 'partner', stesso colore della legenda (#6F63C5)", () => {
    const source = readSource("../../components/ActivityMap.tsx");
    expect(source).toContain("tramaPartnerIcon");
    const iconBlock = source.slice(source.indexOf("const tramaPartnerIcon"), source.indexOf("const tramaPartnerIcon") + 300);
    expect(iconBlock).toContain("#6F63C5");
  });

  test("UX-05: il ramo markerKind === 'partner' usa tramaPartnerIcon (non più il default Leaflet blu)", () => {
    const source = readSource("../../components/ActivityMap.tsx");
    const iconTernaryStart = source.indexOf('it.markerKind === "curated_invitable"');
    const block = source.slice(iconTernaryStart, source.indexOf("<Popup>", iconTernaryStart));
    expect(block).toContain('it.markerKind === "partner"');
    expect(block).toContain("{ icon: tramaPartnerIcon }");
  });

  test("UX-06: il ramo SENZA markerKind (PlannerMapView/LEGACY, undefined) resta sul default Leaflet invariato — la ricolorazione riguarda SOLO i marker 'partner' di Discovery", () => {
    const source = readSource("../../components/ActivityMap.tsx");
    const iconTernaryStart = source.indexOf('it.markerKind === "curated_invitable"');
    const block = source.slice(iconTernaryStart, source.indexOf("<Popup>", iconTernaryStart));
    // L'ultimo ramo del ternario (else finale) deve restare un oggetto vuoto,
    // mai tramaPartnerIcon: altrimenti PlannerMapView (che non passa mai
    // markerKind) cambierebbe colore per un pass che non lo riguarda.
    const lastElse = block.slice(block.lastIndexOf(": {}"));
    expect(lastElse.startsWith(": {}")).toBe(true);
  });

  test("UX-07: le icone Curated (arancione/grigio) restano invariate da questo pass", () => {
    const source = readSource("../../components/ActivityMap.tsx");
    expect(source).toContain("#F2994A"); // Da invitare
    expect(source).toContain("#8B93A3"); // Fonte pubblica
  });
});

test.describe("DISCOVERY FINAL UX PASS — floating controls in Map view (statico sul sorgente)", () => {
  test("UX-08: NextgenScrollActivity espone hideFloatingControls di default false (nessun impatto su pagine che non lo impostano mai)", () => {
    const source = readSource("../../components/nextgen/NextgenScrollActivity.tsx");
    expect(source).toContain("hideFloatingControls: false");
    expect(source).toContain("export function useNextgenHideFloatingControls");
    expect(source).toContain("export function useSetNextgenHideFloatingControls");
  });

  test("UX-09: BetaFeedbackButton e NotificationCenter si nascondono quando hideFloating è attivo, MA mai mentre il proprio dialog è già aperto", () => {
    for (const file of ["../../components/nextgen/BetaFeedbackButton.tsx", "../../components/nextgen/NotificationCenter.tsx"]) {
      const source = readSource(file);
      expect(source).toContain("useNextgenHideFloatingControls");
      expect(source).toContain("if (hideFloating && !open) return null;");
    }
  });

  test("UX-10: SearchDiscoveryClient imposta hideFloatingControls SOLO quando viewMode è 'mappa', e lo ripristina in cleanup", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    const block = source.slice(source.indexOf("const setHideFloatingControls"), source.indexOf("const setHideFloatingControls") + 400);
    expect(block).toContain('setHideFloatingControls(viewMode === "mappa")');
    expect(block).toContain("return () => setHideFloatingControls(false)");
  });
});

test.describe("DISCOVERY FINAL UX PASS — search clear button (statico sul sorgente)", () => {
  test("UX-11: la X compare SOLO quando query è valorizzata (render condizionato su `query`, mai sempre visibile)", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    const block = source.slice(source.indexOf('placeholder="Cerca per nome'), source.indexOf('placeholder="Cerca per nome') + 900);
    expect(block).toContain("{query && (");
    expect(block).toContain('aria-label="Cancella ricerca"');
  });

  test("UX-12: il tap sulla X resetta SOLO `query` (setQuery(\"\")), mai un altro filtro", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    const block = source.slice(source.indexOf('placeholder="Cerca per nome'), source.indexOf('placeholder="Cerca per nome') + 900);
    const clearButtonBlock = block.slice(block.indexOf("{query && ("));
    expect(clearButtonBlock).toContain('onClick={() => setQuery("")}');
    // Nessun'altra chiamata setXxx dentro il bottone di clear.
    const onClickLine = clearButtonBlock.slice(clearButtonBlock.indexOf("onClick="), clearButtonBlock.indexOf("aria-label"));
    expect(onClickLine).not.toMatch(/set(MinAge|MaxAge|MaxPrice|Zone|SelectedTagIds|SelectedWeekStarts|SelectedCoverageModes|OnlyDaySpots|SelectedKid)/);
  });

  test("UX-13: lo stesso input `query` alimenta sia la Lista sia la Mappa (un solo campo, sopra il toggle Lista/Mappa — non duplicato per vista)", () => {
    const source = readSource("../../app/nextgen/search/SearchDiscoveryClient.tsx");
    const occurrences = source.split('placeholder="Cerca per nome…"').length - 1;
    expect(occurrences).toBe(1);
    // Il campo precede nel sorgente sia compatibleRealDiscoveryLeads (Curated)
    // sia il primo uso di viewMode nella JSX del toggle Lista/Mappa —
    // un'unica fonte di query per entrambe le viste.
    const inputIdx = source.indexOf('placeholder="Cerca per nome…"');
    const toggleIdx = source.indexOf('onClick={() => setViewMode("mappa")}');
    expect(inputIdx).toBeGreaterThan(-1);
    expect(toggleIdx).toBeGreaterThan(inputIdx);
  });
});

test.describe("DISCOVERY FINAL UX PASS — map fit / initial view (statico sul sorgente, audit)", () => {
  test("UX-14: FitBounds include SEMPRE tutti i punti passati in `items` (partner + curated_invitable + curated_source indistintamente) — nessun filtro per tipo nel calcolo dei bounds", () => {
    const source = readSource("../../components/ActivityMap.tsx");
    const block = source.slice(source.indexOf("function FitBounds"), source.indexOf("export default function ActivityMap"));
    expect(block).not.toMatch(/markerKind/);
    expect(source).toContain("<FitBounds points={points} />");
    expect(source).toContain("items.map((it) => [it.lat, it.lng])");
  });

  test("UX-15: un solo marker → zoom fisso ragionevole (13), non uno zoom massimo/eccessivo", () => {
    const source = readSource("../../components/ActivityMap.tsx");
    const block = source.slice(source.indexOf("function FitBounds"), source.indexOf("export default function ActivityMap"));
    expect(block).toContain("map.setView(points[0], 13)");
  });

  test("UX-16: fitBounds ricalcola SOLO quando l'insieme dei punti cambia (dep su JSON.stringify(points), mai su un pan/zoom manuale dell'utente)", () => {
    const source = readSource("../../components/ActivityMap.tsx");
    const block = source.slice(source.indexOf("function FitBounds"), source.indexOf("export default function ActivityMap"));
    expect(block).toContain("[map, JSON.stringify(points)]");
  });

  test("UX-17: fitBounds ha un maxZoom di sicurezza (nessuno zoom eccessivo su un cluster molto stretto, es. multi-sede Municipio 7)", () => {
    const source = readSource("../../components/ActivityMap.tsx");
    const block = source.slice(source.indexOf("function FitBounds"), source.indexOf("export default function ActivityMap"));
    expect(block).toContain("maxZoom: 15");
  });
});

test.describe("DISCOVERY FINAL UX PASS — popup consistency (regressione statica)", () => {
  test("UX-18: i tre casi popup restano quelli verificati live — partner (Apri scheda), invitabile (Proponi invito), source-only (Vedi la fonte) — nessuna nuova voce introdotta", () => {
    const mapSource = readSource("../../components/ActivityMap.tsx");
    expect(mapSource).toContain("Apri scheda");
    const popupSource = readSource("../../components/nextgen/DiscoveryMapPopupCard.tsx");
    expect(popupSource).toContain("Proponi invito");
    expect(popupSource).toContain("secondaryLinkLabelForLead");
    const codeOnly = popupSource.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").toLowerCase();
    for (const forbidden of ["match%", "rating", "posti disponibili", "spotsleft"]) {
      expect(codeOnly).not.toContain(forbidden);
    }
  });
});
