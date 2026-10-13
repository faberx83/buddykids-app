import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { buildHomeInbox, selectUrgentTodayAlert, HOME_INBOX_VISIBLE_MAX, HOME_INBOX_PRIORITY } from "../../lib/nextgen/home-inbox";
import { buildTodayAgenda, summarizeDayCoordination, parseHoursRange, joinPeople } from "../../lib/nextgen/today-agenda";
import { buildSeasonSummary, computeWeekState, periodTitleForSeason } from "../../lib/nextgen/season-summary";
import { findNextSchoolClosure } from "../../lib/school-calendar/next-closure";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { RELEASE_CATALOG } from "../../lib/releases/catalog";

// TRAMA — HOME V2 (Fase 1, 13/10/2026). Logica pura + controlli statici.
// Comando: npx playwright test tests/one/home-v2.spec.ts --project=chromium
// La verifica visiva dal vivo resta "pending local verification" (Fabrizio,
// con HOME_V2_ENABLED acceso per la coorte internal-preview).

const ROOT = path.join(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const booking = (over: Partial<Parameters<typeof buildHomeInbox>[0]["bookings"][number]> = {}) => ({
  id: "b1",
  status: "confirmed",
  partnerDecision: "accepted",
  activityName: "Campus Sport Isola",
  kidNames: ["Giulia"],
  weeksLabel: "14–18 giu",
  ...over,
});

const emptyInbox = {
  bookings: [],
  upcomingCoordination: null,
  groupInvites: [],
  profileIncomplete: false,
  pushInactive: false,
};

test.describe("HOME-V2 — Da fare", () => {
  test("HV2-01: ordine di priorità rifiuti > coordinamento > parziali > inviti > profilo > push", () => {
    const res = buildHomeInbox({
      bookings: [booking({ id: "p", partnerDecision: "partial" }), booking({ id: "r", partnerDecision: "rejected" })],
      upcomingCoordination: { missingCount: 2, firstKidName: "Sofia", firstMoment: "ritorno", firstDate: "2026-10-14", weekStartDate: "2026-10-12" },
      groupInvites: [{ id: "g", groupName: "Classe 3B", inviterName: "Chiara", activityName: null }],
      profileIncomplete: true,
      pushInactive: true,
    });
    expect(res.all.map((i) => i.kind)).toEqual([...HOME_INBOX_PRIORITY]);
  });

  test("HV2-02: massimo 3 voci visibili, il resto in 'Vedi tutte'", () => {
    const res = buildHomeInbox({
      ...emptyInbox,
      bookings: [1, 2, 3, 4].map((n) => booking({ id: `r${n}`, partnerDecision: "rejected" })),
      profileIncomplete: true,
    });
    expect(HOME_INBOX_VISIBLE_MAX).toBe(3);
    expect(res.visible).toHaveLength(3);
    expect(res.all).toHaveLength(5);
  });

  test("HV2-03: una sola CTA per voce, prenotazioni annullate escluse, lista vuota senza segnali", () => {
    const res = buildHomeInbox({ ...emptyInbox, bookings: [booking({ status: "cancelled", partnerDecision: "rejected" })] });
    expect(res.all).toHaveLength(0);
    const one = buildHomeInbox({ ...emptyInbox, profileIncomplete: true });
    expect(one.all[0].ctaLabel.length).toBeGreaterThan(0);
    expect(one.all[0].href).toBe("/nextgen/profile?complete=1");
  });
});

test.describe("HOME-V2 — alert sopra Oggi", () => {
  const slots = [
    { date: "2026-10-13", kidId: "s", kidName: "Sofia", moment: "ritorno" as const, label: null },
    { date: "2026-10-14", kidId: "g", kidName: "Giulia", moment: "andata" as const, label: null },
  ];

  test("HV2-04: compare solo per un problema di OGGI", () => {
    const alert = selectUrgentTodayAlert(slots, "2026-10-13", "2026-10-12");
    expect(alert?.text).toBe("Manca chi ritira Sofia oggi");
    expect(alert?.missingCount).toBe(1);
  });

  test("HV2-05: nessun alert se oggi è tutto deciso (i giorni successivi non contano)", () => {
    const decided = slots.map((s) => (s.date === "2026-10-13" ? { ...s, label: "Mamma" } : s));
    expect(selectUrgentTodayAlert(decided, "2026-10-13", "2026-10-12")).toBeNull();
  });

  test("HV2-06: profilo, inviti, conferme parziali e push non generano mai l'alert", () => {
    const src = read("lib/nextgen/home-inbox.ts");
    const fn = src.slice(src.indexOf("export function selectUrgentTodayAlert"));
    expect(fn).not.toMatch(/profile|invite|partial|push/i);
  });
});

test.describe("HOME-V2 — Oggi: timeline mista e coordinamento", () => {
  test("HV2-07: TRAMA, Scoperte e impegni manuali nella stessa timeline, in ordine di orario", () => {
    const agenda = buildTodayAgenda({
      todayIso: "2026-10-13",
      bookings: [
        {
          id: "b1",
          status: "confirmed",
          partnerDecision: "accepted",
          activityName: "Doposcuola Il Melograno",
          activityDbId: "a1",
          centerName: "Il Melograno",
          isDayBased: false,
          dayDates: [],
          weeks: [{ startDate: "2026-10-12", endDate: "2026-10-16" }],
          kidIds: ["g"],
          kidNames: ["Giulia"],
        },
        {
          id: "b2",
          status: "confirmed",
          partnerDecision: "rejected",
          activityName: "Rifiutata",
          activityDbId: null,
          centerName: "",
          isDayBased: true,
          dayDates: ["2026-10-13"],
          weeks: [],
          kidIds: ["g"],
          kidNames: ["Giulia"],
        },
      ],
      externalItems: [
        { id: "e1", title: "Nuoto", startDate: "2026-10-13", endDate: "2026-10-13", allDay: false, startTime: "16:45:00", endTime: "17:30:00", location: "Piscina Cozzi", sourceType: "manual", kidIds: ["s"] },
        { id: "e2", title: "Laboratorio di fumetto", startDate: "2026-10-13", endDate: "2026-10-13", allDay: false, startTime: "17:45", endTime: "19:00", location: null, sourceType: "curated_discovery", kidIds: ["g"] },
        { id: "e3", title: "Ieri", startDate: "2026-10-12", endDate: "2026-10-12", allDay: true, startTime: null, endTime: null, location: null, sourceType: "manual", kidIds: ["s"] },
      ],
      hoursByActivityDbId: { a1: "13:00 - 16:30" },
      kidNameById: { g: "Giulia", s: "Sofia" },
    });
    expect(agenda.map((e) => e.title)).toEqual(["Doposcuola Il Melograno", "Nuoto", "Laboratorio di fumetto"]);
    expect(agenda.map((e) => e.source)).toEqual(["trama", "manuale", "scoperta"]);
    expect(agenda[0].startTime).toBe("13:00");
    expect(agenda[1].startTime).toBe("16:45");
  });

  test("HV2-08: prenotazione a settimana intera non compare nel weekend", () => {
    const agenda = buildTodayAgenda({
      todayIso: "2026-10-17",
      bookings: [
        {
          id: "b1",
          status: "confirmed",
          partnerDecision: "accepted",
          activityName: "Campus",
          activityDbId: null,
          centerName: "",
          isDayBased: false,
          dayDates: [],
          weeks: [{ startDate: "2026-10-12", endDate: "2026-10-18" }],
          kidIds: ["g"],
          kidNames: ["Giulia"],
        },
      ],
      externalItems: [],
      hoursByActivityDbId: {},
      kidNameById: { g: "Giulia" },
    });
    expect(agenda).toHaveLength(0);
  });

  test("HV2-09: orari dal testo del gestore, null se non riconoscibili", () => {
    expect(parseHoursRange("08:00 - 17:30")).toEqual({ start: "08:00", end: "17:30" });
    expect(parseHoursRange("dalle 9 alle 17")).toEqual({ start: "09:00", end: "17:00" });
    expect(parseHoursRange("tutto il giorno")).toBeNull();
    expect(parseHoursRange(null)).toBeNull();
  });

  test("HV2-10: coordinamento compatto quando tutto è deciso", () => {
    const s = summarizeDayCoordination([
      { kidId: "g", kidName: "Giulia", moment: "andata", label: "Papà" },
      { kidId: "g", kidName: "Giulia", moment: "ritorno", label: "Mamma" },
    ]);
    expect(s.mode).toBe("compact");
    expect(joinPeople(s.people)).toBe("Papà e Mamma");
  });

  test("HV2-11: coordinamento esteso quando manca qualcuno", () => {
    const s = summarizeDayCoordination([
      { kidId: "s", kidName: "Sofia", moment: "andata", label: "Nonna" },
      { kidId: "s", kidName: "Sofia", moment: "ritorno", label: null },
    ]);
    expect(s.mode).toBe("detailed");
    expect(s.missingCount).toBe(1);
    expect(s.kids[0]).toEqual({ kidId: "s", kidName: "Sofia", andata: "Nonna", ritorno: null });
  });

  test("HV2-12: nessun passaggio oggi → nessun blocco coordinamento", () => {
    expect(summarizeDayCoordination([]).mode).toBe("none");
  });
});

test.describe("HOME-V2 — riepilogo del periodo", () => {
  const isoPlus = (iso: string, days: number) => {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const week = (index: number, over: Partial<Parameters<typeof computeWeekState>[0]> = {}) => ({
    index,
    startDate: isoPlus("2027-06-07", index * 7),
    endDate: isoPlus("2027-06-11", index * 7),
    dateRange: `sett ${index}`,
    dismissed: false,
    awaitingPartnerConfirmation: false,
    coveredKidIds: ["g", "s"],
    missingCoordinationSlots: 0,
    ...over,
  });

  test("HV2-13: stati organizzata / da completare / da organizzare / non serve", () => {
    const kids = ["g", "s"];
    expect(computeWeekState(week(1), kids)).toBe("organized");
    expect(computeWeekState(week(1, { missingCoordinationSlots: 2 }), kids)).toBe("to_complete");
    expect(computeWeekState(week(1, { coveredKidIds: ["g"] }), kids)).toBe("to_complete");
    expect(computeWeekState(week(1, { awaitingPartnerConfirmation: true }), kids)).toBe("to_complete");
    expect(computeWeekState(week(1, { coveredKidIds: [] }), kids)).toBe("to_organize");
    expect(computeWeekState(week(1, { dismissed: true }), kids)).toBe("not_needed");
  });

  test("HV2-14: conteggi e prima settimana da organizzare", () => {
    const m = buildSeasonSummary({
      title: "Estate 2027",
      kidIds: ["g", "s"],
      todayIso: "2026-10-13",
      isNewFamily: false,
      weeks: [week(1), week(2, { coveredKidIds: [] }), week(3, { missingCoordinationSlots: 1 }), week(4, { dismissed: true })],
    });
    expect(m.state).toBe("progress");
    expect(m.organizedCount).toBe(1);
    expect(m.neededCount).toBe(3);
    expect(m.toCompleteCount).toBe(1);
    expect(m.toOrganizeCount).toBe(1);
    expect(m.firstAttention?.index).toBe(2);
    expect(m.firstAttention?.state).toBe("to_organize");
  });

  test("HV2-15: famiglia nuova → stato di benvenuto, mai '0%'", () => {
    const m = buildSeasonSummary({ title: "Estate 2027", kidIds: [], todayIso: "2026-10-13", isNewFamily: true, weeks: [week(1, { coveredKidIds: [] })] });
    expect(m.state).toBe("welcome");
    const card = read("components/nextgen/SeasonSummaryCard.tsx");
    expect(card).toContain("Iniziamo a costruire il vostro piano");
    expect(read("app/nextgen/HomeDashboardV2Client.tsx")).not.toMatch(/Organizzata al|0%/);
  });

  test("HV2-16: periodo non ancora iniziato → stato neutro, non un fallimento", () => {
    const m = buildSeasonSummary({
      title: "Estate 2027",
      kidIds: ["g"],
      todayIso: "2026-10-13",
      isNewFamily: false,
      weeks: [week(1, { coveredKidIds: [] }), week(2, { coveredKidIds: [] })],
    });
    expect(m.state).toBe("not_started");
  });

  test("HV2-17: titolo del periodo dalla stagione, budget assente dal riepilogo", () => {
    expect(periodTitleForSeason([{ startDate: "2027-06-14" }])).toBe("Estate 2027");
    const code = read("components/nextgen/SeasonSummaryCard.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/budget|€/i);
  });
});

test.describe("HOME-V2 — prossima chiusura e gating calendario scolastico", () => {
  test("HV2-18: prima chiusura futura con giorni feriali, contigue unite, estate esclusa", () => {
    const res = findNextSchoolClosure(
      [
        {
          kidId: "g",
          closures: [
            { startDate: "2026-12-07", endDate: "2026-12-07", kind: "regional_closure", label: "Sant'Ambrogio" },
            { startDate: "2026-12-08", endDate: "2026-12-08", kind: "public_holiday", label: "Immacolata" },
            { startDate: "2026-12-23", endDate: "2027-01-06", kind: "christmas_break", label: "Vacanze di Natale" },
            { startDate: "2027-06-09", endDate: "2027-09-13", kind: "summer_break", label: "Estate" },
          ],
        },
        { kidId: "s", closures: [{ startDate: "2026-12-07", endDate: "2026-12-08", kind: "bridge", label: "Ponte" }] },
      ],
      "2026-10-13"
    );
    expect(res?.startDate).toBe("2026-12-07");
    expect(res?.endDate).toBe("2026-12-08");
    expect(res?.kidIds.sort()).toEqual(["g", "s"]);
    expect(res?.weekdayCount).toBe(2);
  });

  test("HV2-19: una chiusura solo nel weekend non è 'da organizzare'", () => {
    const res = findNextSchoolClosure(
      [{ kidId: "g", closures: [{ startDate: "2026-11-01", endDate: "2026-11-01", kind: "public_holiday", label: "Ognissanti" }] }],
      "2026-10-13"
    );
    expect(res).toBeNull();
  });

  test("HV2-20: la prossima chiusura si legge solo con SCHOOL_CALENDAR_INTELLIGENCE_ENABLED", () => {
    const src = read("app/nextgen/home-v2-data.ts");
    expect(src).toContain('flagOn("SCHOOL_CALENDAR_INTELLIGENCE_ENABLED", userId)');
    expect(src).toMatch(/schoolEnabled\s*\?\s*await getKidClosureIntervalsForParent/);
    expect(src).toMatch(/externalEnabled\s*\?\s*getExternalPlannerItemsForParent/);
    expect(read("app/nextgen/HomeDashboardV2Client.tsx")).toContain("Prossima chiusura");
  });
});

test.describe("HOME-V2 — flag, ripiego e release", () => {
  test("HV2-21: HOME_V2_ENABLED nasce spento e ammette lo scope cohort", () => {
    expect(FEATURE_FLAG_REGISTRY.HOME_V2_ENABLED.defaultValue).toBe(false);
    expect(FEATURE_FLAG_REGISTRY.HOME_V2_ENABLED.allowedScopes).toContain("cohort");
  });

  test("HV2-22: la Home attuale resta il ripiego (flag spento o errore)", () => {
    const page = read("app/nextgen/page.tsx");
    expect(page).toContain('flagName: "HOME_V2_ENABLED"');
    expect(page).toMatch(/catch\s*\{\s*homeV2Enabled = false;/);
    expect(page).toMatch(/if \(user && homeV2Enabled\)/);
    expect(page).toContain("<HomeDashboardClient");
    expect(fs.existsSync(path.join(ROOT, "app/nextgen/HomeDashboardClient.tsx"))).toBe(true);
  });

  test("HV2-23: home_v2 è releaseEligible e sta nella release 'home-v2'", () => {
    const feature = FEATURE_CATALOG.find((f) => f.key === "home_v2");
    expect(feature?.releaseEligible).toBe(true);
    expect(feature?.flagName).toBe("HOME_V2_ENABLED");
    const releases = RELEASE_CATALOG.filter((r) => r.featureKeys.includes("home_v2"));
    expect(releases.map((r) => r.id)).toEqual(["home-v2"]);
  });

  test("HV2-24: una sola campanella: il pulsante flottante si nasconde solo con quella della Home V2", () => {
    const nc = read("components/nextgen/NotificationCenter.tsx");
    expect(nc).toContain("{!headerBellPresent && (");
    expect(nc).toContain("HEADER_BELL_EVENT");
    const v2 = read("app/nextgen/HomeDashboardV2Client.tsx");
    expect(v2).toContain("announceHeaderBell(true)");
    expect(v2).toContain("announceHeaderBell(false)");
  });

  test("HV2-25: nessuna migration e Planner non toccato da questa fase", () => {
    const src = read("app/nextgen/home-v2-data.ts");
    expect(src).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  });
});
