import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  bookingChip,
  bookingWhen,
  bookingsToFix,
  bookingsSummaryLine,
  splitBookings,
  groupByMonth,
  dateTile,
  bookingStatusExplainer,
  type BookingV2Input,
} from "../../lib/nextgen/bookings-v2";
import { buildDiscoverPeriods, periodForWeek, activityOpenIn, discoveryOpenIn, shortClosureName } from "../../lib/nextgen/discover-v2";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { RELEASE_CATALOG } from "../../lib/releases/catalog";

// TRAMA — SCOPRI E PRENOTAZIONI V2 (14/10/2026). Logica pura + controlli statici.
// Comando: npx playwright test tests/one/scopri-prenotazioni-v2.spec.ts --project=chromium
// Verifica visiva dal vivo: pending local verification (Fabrizio).

const ROOT = path.join(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const TODAY = "2026-10-14";

const b = (over: Partial<BookingV2Input> = {}): BookingV2Input => ({
  id: "b",
  status: "confirmed",
  partnerDecision: "accepted",
  activityName: "Winter Camp Isola",
  weeks: [],
  dayDates: ["2026-12-07", "2026-12-08"],
  isDayBased: true,
  kidIds: ["l"],
  kidNames: ["Lino"],
  totalAmount: 90,
  discountAmount: 0,
  acceptedDayCount: 0,
  totalDayCount: 2,
  waitlistedDayCount: 0,
  partnerProposalNote: null,
  ...over,
});

test.describe("PRENOTAZIONI-V2", () => {
  test("SPV2-01: stati con le parole di Home e Planner", () => {
    expect(bookingChip(b()).label).toBe("Confermata");
    expect(bookingChip(b({ status: "pending", partnerDecision: "pending" }))).toEqual({ label: "In attesa del centro", tone: "amber" });
    expect(bookingChip(b({ partnerDecision: "partial" })).label).toBe("Confermata in parte");
    expect(bookingChip(b({ partnerDecision: "rejected" })).tone).toBe("red");
    expect(bookingChip(b({ partnerDecision: "proposed" })).label).toBe("Proposta del centro");
    expect(bookingChip(b({ status: "cancelled" })).label).toBe("Annullata");
    expect(bookingChip(b({ partnerDecision: "pending", waitlistedDayCount: 1 })).label).toBe("In lista d'attesa");
  });

  test("SPV2-02: quando, compatto", () => {
    expect(bookingWhen(b())).toBe("7–8 dicembre");
    expect(bookingWhen(b({ partnerDecision: "partial", acceptedDayCount: 2, totalDayCount: 3 }))).toBe("2 giorni su 3");
    expect(bookingWhen(b({ isDayBased: false, dayDates: [], weeks: [{ startDate: "2027-06-28", endDate: "2027-07-02" }] }))).toBe("28 giugno – 2 luglio");
    expect(bookingWhen(b({ dayDates: ["2026-12-07", "2026-12-10"] }))).toBe("2 giorni tra 7–10 dicembre");
  });

  test("SPV2-03: In arrivo / Passate, annullate tra le passate, per mese", () => {
    const list = [
      b({ id: "dic" }),
      b({ id: "gen", dayDates: ["2027-01-04"] }),
      b({ id: "set", dayDates: ["2026-09-07"] }),
      b({ id: "ann", status: "cancelled", dayDates: ["2026-12-20"] }),
    ];
    const { upcoming, past } = splitBookings(list, TODAY);
    expect(upcoming.map((x) => x.id)).toEqual(["dic", "gen"]);
    expect(past.map((x) => x.id)).toEqual(["ann", "set"]);
    expect(groupByMonth(upcoming, TODAY).map((g) => g.label)).toEqual(["dicembre", "gennaio 2027"]);
    expect(dateTile("2026-12-07")).toEqual({ wd: "LUN", day: 7, month: "DIC" });
    // le non accettate non sono "in arrivo": stanno in Da sistemare e tra le passate
    const rej = splitBookings([b({ id: "rej", partnerDecision: "rejected" })], TODAY);
    expect(rej.upcoming).toHaveLength(0);
    expect(rej.past.map((x) => x.id)).toEqual(["rej"]);
  });

  test("SPV2-04: Da sistemare con le stesse parole del Da fare in Home", () => {
    const fix = bookingsToFix([b({ id: "p", partnerDecision: "partial", acceptedDayCount: 1 }), b({ id: "r", partnerDecision: "rejected" })]);
    expect(fix.map((f) => [f.kind, f.title, f.ctaLabel])).toEqual([
      ["rejected", "Richiesta non accettata", "Alternative"],
      ["partial", "Confermata in parte", "Controlla"],
    ]);
    expect(fix[0].detail).toBe("Winter Camp Isola · Lino, 7–8 dicembre");
  });

  test("SPV2-05: riga di riepilogo e stato spiegato", () => {
    const line = bookingsSummaryLine([b(), b({ id: "x", dayDates: ["2026-03-02"], totalAmount: 200 })], TODAY);
    expect(line).toBe("1 in arrivo · €290 spesi quest'anno");
    expect(bookingStatusExplainer(b({ status: "pending", partnerDecision: "pending" }))).toContain("Ti avvisiamo");
    expect(bookingStatusExplainer(b())).toBeNull();
  });

  test("SPV2-06: pagina con ripiego e azioni esistenti", () => {
    const page = read("app/nextgen/prenotazioni/page.tsx");
    expect(page).toContain('flagName: "BOOKINGS_V2_ENABLED"');
    expect(page).toContain("<PrenotazioniClient");
    expect(page).toContain("<PrenotazioniV2Client");
    const client = read("app/nextgen/prenotazioni/PrenotazioniV2Client.tsx");
    expect(client).toContain("cancelBookingAction(");
    expect(client).toContain('label="Scrivi al centro"');
    expect(client).not.toContain("CoverageStrip");
  });
});

test.describe("SCOPRI-V2", () => {
  const closures = [
    { startDate: "2026-12-07", endDate: "2026-12-08", labels: ["Sant'Ambrogio", "Immacolata"], weekdayCount: 2 },
    { startDate: "2026-12-23", endDate: "2027-01-06", labels: ["Vacanze di Natale"], weekdayCount: 11 },
    { startDate: "2027-04-01", endDate: "2027-04-07", labels: ["Vacanze di Pasqua"], weekdayCount: 5 },
  ];

  test("SPV2-07: Per quando — chiusure vicine, prossime settimane, estate", () => {
    const p = buildDiscoverPeriods({ todayIso: TODAY, closures, summer: { start: "2027-06-14", end: "2027-09-10" }, summerYear: 2027 });
    expect(p.map((x) => x.label)).toEqual(["Ponte 7–8 dic", "Natale", "Prossime settimane", "Estate 2027"]);
    expect(p[0].title).toBe("Per il ponte del 7–8 dicembre");
    expect(p[1].title).toBe("Per le vacanze di Natale");
    const after = buildDiscoverPeriods({ todayIso: TODAY, closures: [], summer: { start: "2026-06-08", end: "2026-09-11" }, summerYear: 2026 });
    expect(after.map((x) => x.key)).toEqual(["prossime"]); // estate finita: non proposta
  });

  test("SPV2-08: filtro per data su attività e scoperte", () => {
    const ponte = { start: "2026-12-07", end: "2026-12-08" };
    expect(activityOpenIn([{ start: "2026-12-07", end: "2026-12-07" }], ponte)).toBe(true);
    expect(activityOpenIn([{ start: "2027-06-14", end: "2027-06-18" }], ponte)).toBe(false);
    expect(activityOpenIn(undefined, ponte)).toBe(false);
    expect(discoveryOpenIn({ startDate: null, endDate: null }, ponte)).toBe(true);
    expect(discoveryOpenIn({ startDate: "2026-12-01", endDate: "2026-12-24" }, ponte)).toBe(true);
    expect(discoveryOpenIn({ startDate: "2027-01-10", endDate: null }, ponte)).toBe(false);
    expect(periodForWeek("2026-12-07")).toMatchObject({ label: "Settimana 7–13 dic", start: "2026-12-07", end: "2026-12-13", kind: "week" });
  });

  test("SPV2-09: Scopri attuale come ripiego, stessi filtri e stessa mappa", () => {
    const page = read("app/nextgen/search/page.tsx");
    expect(page).toContain('flagName: "DISCOVER_V2_ENABLED"');
    expect(page).toMatch(/catch \{\s*discoverV2 = null;/);
    const client = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(client).toContain('{!v2 && <PageHeader title="Scopri attività" backHref="/nextgen" showBrandIcon />}');
    expect(client).toContain("activityOpenIn(v2?.activityRanges[a.dbId], activePeriod)");
    expect(client).toContain("<DiscoverResultCard");
    expect(read("components/nextgen/DiscoverResultCard.tsx")).not.toMatch(/Match \{/);
  });

  test("SPV2-10: flag spenti, una release per Scopri e Prenotazioni", () => {
    for (const f of ["BOOKINGS_V2_ENABLED", "DISCOVER_V2_ENABLED"] as const) {
      expect(FEATURE_FLAG_REGISTRY[f].defaultValue).toBe(false);
      expect(FEATURE_FLAG_REGISTRY[f].allowedScopes).toContain("cohort");
    }
    expect(FEATURE_CATALOG.find((f) => f.key === "bookings_v2")?.releaseEligible).toBe(true);
    expect(FEATURE_CATALOG.find((f) => f.key === "discover_v2")?.releaseEligible).toBe(true);
    expect(RELEASE_CATALOG.find((r) => r.id === "scopri-prenotazioni-v2")?.featureKeys).toEqual(["bookings_v2", "discover_v2"]);
  });

  test("SPV2-11: nessuna scrittura nuova nel lettore degli intervalli", () => {
    const src = read("lib/data/activities.ts");
    const fn = src.slice(src.indexOf("export async function getActivityOpenRanges"), src.indexOf("export async function getActivitiesWithOpenDaySpots"));
    expect(fn).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  });
});

// Ritocchi del 14/10/2026 dopo la prova live (mappa sopra il +, forme
// diverse di Elenco/Mappa, nome lungo delle vacanze, filtri viola).
test.describe("TRAMA — Scopri V2: ritocchi grafici [no browser]", () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

  test("SPV2-12 nome breve delle chiusure nei bottoni 'Per quando'", () => {
    expect(shortClosureName("Vacanze di Natale 2026/2027 (incl. Natale, Santo Stefano)")).toBe("Vacanze di Natale");
    expect(shortClosureName("Vacanze di Pasqua 2027")).toBe("Vacanze di Pasqua");
    expect(shortClosureName("Carnevale ambrosiano")).toBe("Carnevale ambrosiano");
    const p = buildDiscoverPeriods({
      todayIso: "2026-10-14",
      closures: [{ startDate: "2026-12-23", endDate: "2027-01-06", labels: ["Vacanze di Natale 2026/2027 (incl. Natale, Santo Stefano)"], weekdayCount: 11 }],
      summer: null,
      summerYear: null,
    });
    expect(p[0].label).toBe("Natale");
    expect(p[0].title).toBe("Per le vacanze di Natale");
  });

  test("SPV2-13 la mappa non copre la barra in basso (livelli Leaflet chiusi nel suo riquadro)", () => {
    expect(read("components/ActivityMap.tsx")).toContain('className="relative z-0 w-full overflow-hidden rounded-lg');
  });

  test("SPV2-14 schede a due voci con la stessa forma dentro e fuori (pillola) in Scopri, Planner, Prenotazioni", () => {
    expect(read("app/nextgen/search/SearchDiscoveryClient.tsx")).toContain('className="grid grid-cols-2 gap-[3px] rounded-full bg-[#EEF0F4] p-[3px]"');
    for (const p of ["app/nextgen/planner/PlannerV2Client.tsx", "app/nextgen/prenotazioni/PrenotazioniV2Client.tsx"]) {
      const src = read(p);
      expect(src).toContain('className="grid grid-cols-2 gap-1 rounded-full bg-[#EEF0F4] p-1"');
      expect(src).toContain("`min-h-[40px] rounded-full text-[14px] ${");
    }
  });

  test("SPV2-15 in V2 i filtri selezionati sono blu notte come 'Per quando', fuori V2 restano viola", () => {
    const src = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(src.match(/v2 \? "border-trama-navy bg-trama-navy text-white" : "border-trama-violet bg-trama-violet text-white"/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });
});

// "Allinea tutto al nuovo stile" + segno TRAMA sotto i titoli (14/10/2026).
test.describe("TRAMA — V2: card Scoperte, pannelli filtro, segno TRAMA [no browser]", () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

  test("SPV2-16 card Scoperte TRAMA e community in versione V2 solo con Scopri V2", () => {
    const search = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(search.match(/v2=\{!!v2\}/g)?.length).toBe(2);
    for (const p of ["components/nextgen/DiscoveryLeadCard.tsx", "components/nextgen/CommunityDiscoveryCard.tsx"]) {
      const src = read(p);
      expect(src).toContain("v2 = false,");
      expect(src).toContain('rounded-[20px] border border-[#ECEEF2]');
      expect(src).toContain('aria-label={fav ? "Togli dai salvati" : "Salva"}');
      // la versione attuale resta com'era (hero 140px)
      expect(src).toContain("h-[140px]");
    }
    expect(read("components/nextgen/DiscoveryLeadCard.tsx")).toContain(">Scoperta TRAMA</span>");
  });

  test("SPV2-17 pannelli filtro e ricerca in stile V2 senza toccare la versione attuale", () => {
    const src = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(src).toContain("const panelBox = (extra = \"\") =>");
    expect(src).toContain(": `mb-3 ${extra} rounded-lg border border-[#E8EBF0] bg-bg p-3`;");
    expect(src).not.toContain('className="mb-3 rounded-lg border border-[#E8EBF0] bg-bg p-3"');
    expect(src).toContain("`min-h-[48px] w-full rounded-full border border-[#E3E6EC] bg-white pl-11 pr-4");
  });

  test("SPV2-18 segno TRAMA: quattro fili con i colori del logo, decorativo", () => {
    const src = read("components/nextgen/TramaThread.tsx");
    for (const c of ["#F66B5E", "#F6A623", "#2DBA8C", "#6F63C5"]) expect(src).toContain(c);
    expect(src).toContain('aria-hidden="true"');
  });

  test("SPV2-19 segno TRAMA sotto i titoli di Home, Planner, Scopri, Prenotazioni, Cos'è TRAMA", () => {
    for (const p of [
      "app/nextgen/HomeDashboardV2Client.tsx",
      "app/nextgen/planner/PlannerV2Client.tsx",
      "app/nextgen/search/SearchDiscoveryClient.tsx",
      "app/nextgen/prenotazioni/PrenotazioniV2Client.tsx",
      "app/nextgen/trama/page.tsx",
    ]) {
      expect(read(p)).toContain("<TramaThread");
    }
  });

  test("SPV2-20 nelle intestazioni condivise (PageHeader) il segno compare solo con la nuova barra accesa", () => {
    expect(read("components/PageHeader.tsx")).toContain("{showBrandIcon && <TramaThread auto");
    expect(read("app/nextgen/layout.tsx")).toContain('data-nav-v2={navV2Enabled ? "" : undefined}');
    const css = read("app/globals.css");
    expect(css).toMatch(/\.trama-thread-auto \{\s*display: none;/);
    expect(css).toMatch(/\[data-nav-v2\] \.trama-thread-auto \{\s*display: flex;/);
  });
});
