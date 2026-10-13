import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  COMMUNITY_BADGE_LABEL,
  communityDetailHref,
  communityExternalUrl,
  communityFavoriteId,
  filterCommunityDiscoveries,
  formatCommunityAge,
  formatCommunityDates,
  formatCommunityPrice,
  isCommunityDiscoveryCompatible,
  parseCommunityFavoriteId,
  type CommunityDiscoveryRecord,
  type CommunityFilterState,
} from "../../lib/radar/community";
import { countDiscoveryResults, interleaveDiscoveryResults } from "../../lib/discovery/result-model";
import { buildUnifiedFavorites } from "../../lib/discovery/unified-favorites";
import { REAL_DISCOVERY_LEADS } from "../../lib/discovery/real-dataset";
import type { SmartMatch } from "../../lib/nextgen/smart-search";

// TRAMA — RADAR / COMMUNITY DISCOVERY (13/10/2026), patch 2: esperienza.
// [no browser]: logica pura (filtri, lista unificata, preferiti, etichette)
// + lettura statica di pagina Scopri, pannello "Aggiungi una scoperta",
// scheda, Planner, Preferiti, manifest (share_target) e pagina admin.
// I flussi nel browser restano "pending local verification" (Fabrizio, con
// RADAR_ENABLED acceso per cohort:internal-preview).
//
// Comando: npx playwright test tests/one/radar-experience.spec.ts

const ROOT = path.join(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function discovery(extra: Partial<CommunityDiscoveryRecord> = {}): CommunityDiscoveryRecord {
  return {
    id: UUID_A,
    title: "Campus di basket",
    organizerName: "ASD Rho Basket",
    category: "sportivo",
    shortDescription: "Settimane di basket e giochi",
    ageMin: null,
    ageMax: null,
    startDate: null,
    endDate: null,
    dateTextRaw: null,
    scheduleText: null,
    locationName: null,
    address: null,
    comune: "Rho",
    price: null,
    priceUnit: null,
    contactPhone: null,
    contactEmail: null,
    websiteUrl: null,
    socialUrl: null,
    registrationInfo: null,
    fieldProvenance: {},
    createdAt: "2026-10-13T10:00:00Z",
    ...extra,
  };
}

const NO_FILTERS: CommunityFilterState = {
  minAge: 0,
  maxAge: 18,
  maxPrice: 500,
  zone: "",
  query: "",
  selectedTagIds: [],
  selectedWeekRanges: [],
  coverageFilterActive: false,
};

const partner = (id: string) => ({ activity: { id } }) as unknown as SmartMatch;

test.describe("RADAR esperienza — filtri di Scopri sulle scoperte community", () => {
  test("EXP-01: un dato non indicato non esclude mai la scoperta", () => {
    const d = discovery();
    expect(isCommunityDiscoveryCompatible(d, NO_FILTERS)).toBe(true);
    expect(isCommunityDiscoveryCompatible(d, { ...NO_FILTERS, minAge: 6, maxAge: 8 })).toBe(true);
    expect(isCommunityDiscoveryCompatible(d, { ...NO_FILTERS, maxPrice: 50 })).toBe(true);
    expect(isCommunityDiscoveryCompatible(d, { ...NO_FILTERS, selectedWeekRanges: [{ start: "2027-06-21", end: "2027-06-25" }] })).toBe(true);
  });

  test("EXP-02: età, prezzo settimanale, settimane, zona e testo escludono solo con dati noti e incompatibili", () => {
    const d = discovery({ ageMin: 6, ageMax: 10, price: 180, priceUnit: "per_settimana", startDate: "2027-06-22", endDate: "2027-06-26", locationName: "Palazzetto" });
    expect(isCommunityDiscoveryCompatible(d, { ...NO_FILTERS, minAge: 12, maxAge: 14 })).toBe(false);
    expect(isCommunityDiscoveryCompatible(d, { ...NO_FILTERS, maxPrice: 150 })).toBe(false);
    expect(isCommunityDiscoveryCompatible({ ...d, priceUnit: "totale" }, { ...NO_FILTERS, maxPrice: 150 })).toBe(true);
    expect(isCommunityDiscoveryCompatible(d, { ...NO_FILTERS, selectedWeekRanges: [{ start: "2027-07-05", end: "2027-07-09" }] })).toBe(false);
    expect(isCommunityDiscoveryCompatible(d, { ...NO_FILTERS, selectedWeekRanges: [{ start: "2027-06-21", end: "2027-06-25" }] })).toBe(true);
    expect(isCommunityDiscoveryCompatible(d, { ...NO_FILTERS, zone: "palazz" })).toBe(true);
    expect(isCommunityDiscoveryCompatible(d, { ...NO_FILTERS, zone: "Bari" })).toBe(false);
    expect(isCommunityDiscoveryCompatible(d, { ...NO_FILTERS, query: "basket" })).toBe(true);
    expect(isCommunityDiscoveryCompatible(d, { ...NO_FILTERS, query: "teatro" })).toBe(false);
  });

  test("EXP-03: con un filtro Copertura esplicito la scoperta community è esclusa (modalità non nota)", () => {
    expect(filterCommunityDiscoveries([discovery()], { ...NO_FILTERS, coverageFilterActive: true })).toHaveLength(0);
  });
});

test.describe("RADAR esperienza — lista unica in Scopri", () => {
  test("EXP-04: le scoperte community entrano nello slot non-Partner, dopo le Scoperte TRAMA, e contano nel totale", () => {
    const curated = REAL_DISCOVERY_LEADS.slice(0, 1);
    const community = [discovery(), discovery({ id: UUID_B, title: "Laboratorio di teatro" })];
    const partners = [partner("p1"), partner("p2"), partner("p3"), partner("p4")];
    const results = interleaveDiscoveryResults(partners, curated, 2, community);
    expect(results.map((r) => r.kind)).toEqual(["partner", "partner", "curated", "partner", "partner", "community", "community"]);
    expect(countDiscoveryResults(partners, curated, community)).toBe(7);
  });

  test("EXP-05: senza scoperte community il comportamento è identico a prima", () => {
    const curated = REAL_DISCOVERY_LEADS.slice(0, 2);
    const partners = [partner("p1"), partner("p2"), partner("p3")];
    expect(interleaveDiscoveryResults(partners, curated)).toEqual(interleaveDiscoveryResults(partners, curated, 2, []));
    expect(countDiscoveryResults(partners, curated)).toBe(5);
  });
});

test.describe("RADAR esperienza — preferiti ed etichette", () => {
  test("EXP-06: id preferito community:<uuid>, riconosciuto solo se valido", () => {
    expect(communityFavoriteId(UUID_A)).toBe(`community:${UUID_A}`);
    expect(parseCommunityFavoriteId(`community:${UUID_A}`)).toBe(UUID_A);
    expect(parseCommunityFavoriteId("milano-centri-estivi")).toBeNull();
    expect(parseCommunityFavoriteId("community:../../etc")).toBeNull();
    expect(communityDetailHref(UUID_A)).toBe(`/nextgen/scoperta/${UUID_A}`);
    expect(communityDetailHref(UUID_A, true)).toBe(`/nextgen/scoperta/${UUID_A}?from=radar`);
  });

  test("EXP-07: Preferiti risolve le scoperte community visibili e omette quelle nascoste, senza toccare le Scoperte TRAMA", () => {
    const lead = REAL_DISCOVERY_LEADS[0];
    const favorites = [
      { curatedLeadId: communityFavoriteId(UUID_A), lead: null, promotedToActivityId: null, createdAt: "2026-10-13" },
      { curatedLeadId: communityFavoriteId(UUID_B), lead: null, promotedToActivityId: null, createdAt: "2026-10-13" },
      { curatedLeadId: lead.id, lead, promotedToActivityId: null, createdAt: "2026-10-12" },
    ];
    const items = buildUnifiedFavorites([], favorites, new Map(), new Map([[UUID_A, discovery()]]));
    expect(items.map((i) => i.kind)).toEqual(["community", "curated"]);
    // Senza mappa community (chiamate esistenti) le voci community spariscono in silenzio.
    expect(buildUnifiedFavorites([], favorites, new Map()).map((i) => i.kind)).toEqual(["curated"]);
  });

  test("EXP-08: etichette oneste — date incerte come scritte, prezzo con unità, niente link non http", () => {
    expect(formatCommunityDates(discovery({ dateTextRaw: "dal 22 al 26 giugno" }))).toBe("dal 22 al 26 giugno");
    expect(formatCommunityDates(discovery())).toBeNull();
    expect(formatCommunityDates(discovery({ startDate: "2027-06-22", endDate: "2027-06-26" }))).toContain("2027");
    expect(formatCommunityPrice(180, "per_settimana")).toBe("€180 / settimana");
    expect(formatCommunityPrice(12.5, null)).toBe("€12,50");
    expect(formatCommunityPrice(null, "per_settimana")).toBeNull();
    expect(formatCommunityAge(6, 10)).toBe("6-10 anni");
    expect(formatCommunityAge(null, null)).toBeNull();
    expect(communityExternalUrl(discovery({ websiteUrl: "javascript:alert(1)", socialUrl: "https://instagram.com/x" }))).toBe("https://instagram.com/x");
  });
});

test.describe("RADAR esperienza — controlli statici", () => {
  test("STA-01: Scopri risolve RADAR_ENABLED lato server e passa dati e CTA solo se attivo", () => {
    const page = read("app/nextgen/search/page.tsx");
    expect(page).toContain('flagName: "RADAR_ENABLED"');
    expect(page).toMatch(/radarEnabled = Boolean\(user\) && radarDetail\.enabled/);
    expect(page).toMatch(/if \(radarEnabled\) \{\s*communityDiscoveries = await getVisibleCommunityDiscoveries/);
    const client = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(client).toContain("radarEnabled = false");
    expect(client).toMatch(/\{radarEnabled && \(\s*<button/);
    expect(client).toContain("Aggiungi una scoperta");
    expect(client).toContain("<CommunityDiscoveryCard");
    // Nessuna scoperta community in "Nella tua zona" (nessuna coordinata).
    expect(client).toContain("interleaveDiscoveryResults(nearby, [])");
  });

  test("STA-02: card e scheda mostrano sempre il badge community e mai un 'Prenota'", () => {
    expect(COMMUNITY_BADGE_LABEL).toBe("Segnalato dalla community");
    for (const file of ["components/nextgen/CommunityDiscoveryCard.tsx", "app/nextgen/scoperta/[id]/CommunityDiscoveryDetailClient.tsx"]) {
      const src = read(file);
      expect(src).toContain("COMMUNITY_BADGE_LABEL");
      const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
      expect(code).not.toMatch(/Prenota/);
      expect(src).toMatch(/non (ha\s+)?verificat/);
    }
  });

  test("STA-03: il pannello usa la route di analisi, non carica file altrove e copre i tre esiti", () => {
    const sheet = read("components/nextgen/RadarAddDiscoverySheet.tsx");
    expect(sheet).toContain('fetch("/api/radar/analyze"');
    expect(sheet).not.toMatch(/storage|\.upload\(/);
    expect(sheet).toContain("Segnala comunque");
    expect(sheet).toContain('confirmedRelevant", "1"');
    expect(sheet).toContain("previousSubmissionId");
    expect(sheet).toContain("Correggi");
    expect(sheet).toContain("Salva scoperta");
    expect(sheet).toContain("abandonSubmissionAction");
    expect(sheet).toContain('"radar_opened"');
    expect(sheet).toContain('"radar_favorite_after_import"');
  });

  test("STA-04: scheda protetta dal flag; Da organizzare usa source_type community_discovery con date confermate", () => {
    const page = read("app/nextgen/scoperta/[id]/page.tsx");
    expect(page).toContain('flagName: "RADAR_ENABLED"');
    expect(page).toContain("if (!radarEnabled) return notFound();");
    const actions = read("app/actions/external-planner-items.ts");
    expect(actions).toContain("addCommunityDiscoveryToPlannerAction");
    expect(actions).toContain('sourceType: "community_discovery"');
    expect(actions).toContain("radar_planner_after_import");
    expect(actions).toMatch(/if \(!dates\?\.startDate \|\| !dates\?\.endDate\)/);
    expect(read("lib/planner/external-planner-items-core.ts")).toContain('"community_discovery"');
    expect(read("components/nextgen/PlannerCalendarView.tsx")).toContain("Segnalato dalla community");
  });

  test("STA-05: Android share_target verso Scopri; il pannello legge i parametri condivisi", () => {
    const manifest = JSON.parse(read("public/manifest-nextgen.json"));
    expect(manifest.share_target).toEqual({
      action: "/nextgen/search",
      method: "GET",
      params: { title: "radar_title", text: "radar_text", url: "radar_url" },
    });
    const client = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(client).toContain('searchParams.get("radar_url")');
    expect(client).toContain('searchParams.get("radar_text")');
  });

  test("STA-06: pagina admin Radar con nascondi/rimostra solo per platform_admin", () => {
    expect(read("app/admin/layout.tsx")).toContain('href: "/admin/radar"');
    const actions = read("app/actions/radar.ts");
    expect(actions).toContain("setCommunityDiscoveryStatusAction");
    expect(actions).toMatch(/role !== "platform_admin"/);
    expect(read("app/admin/radar/RadarAdminClient.tsx")).toContain("Nascondi");
    expect(read("lib/data/radar.ts")).toContain("getRadarAdminOverview");
  });

  test("STA-07: dopo un collegamento o un salvataggio l'utente viene portato alla scheda giusta (attività per slug)", () => {
    const actions = read("app/actions/radar.ts");
    expect(actions).toContain("hrefForTarget");
    expect(actions).toMatch(/from\("activities"\)\.select\("slug"\)/);
    expect(actions).toContain("href: communityDetailHref(id, true)");
  });
});
