import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { ACTION_DEF, DEFAULT_THRESHOLDS, countOf, resolveThresholds } from "../../lib/beta-cockpit/definitions";
import { addDays, diffDays, previousPeriod, reportWindows, resolvePeriod, romeDay, rangeLabel } from "../../lib/beta-cockpit/dates";
import {
  applyFamilyFilter,
  buildTimeline,
  computeAlerts,
  computeFamilyRow,
  computeFamilyRows,
  computeFunnel,
  computeTtv,
  computeUsage,
  filterToParam,
  firstUnorganizedClosure,
  median,
  parseFilterParam,
  type CockpitRaw,
  type RawAction,
  type RawFamily,
} from "../../lib/beta-cockpit/model";
import { computeDemand, normalizeDemandKey, topOpportunities, type DemandSignal } from "../../lib/beta-cockpit/demand";
import { inFeedbackView, parseTags, summarizeFeedback, toLegacyFeedbackStatus, type CockpitFeedbackRow } from "../../lib/beta-cockpit/feedback";
import { dueSurvey, getSurvey, isNegativeSurveyAnswer, resolveSurveyConfig, validateSurveyAnswers } from "../../lib/beta-cockpit/survey";
import { buildCockpitView } from "../../lib/beta-cockpit/view";

// TRAMA — ADMIN BETA COCKPIT (20/10/2026). Test della logica pura del
// cockpit (nessun browser, nessun database) e controlli sul sorgente per
// l'accesso Admin. Comando:
//   npx playwright test tests/one/beta-cockpit.spec.ts --grep "no browser"

const ROOT = path.join(__dirname, "../..");
const T = DEFAULT_THRESHOLDS;

function fam(key: string, over: Partial<RawFamily> = {}): RawFamily {
  return {
    key,
    label: key.toUpperCase(),
    invitedAt: null,
    members: [{ userId: `${key}-u1`, registeredAt: "2026-11-20T09:00:00Z", onboarding: "completed", onboardingAt: "2026-11-20T09:05:00Z", pushDevices: 1 }],
    kids: 1,
    kidsWithSchool: 1,
    zones: ["Milano"],
    pendingPartnerInvites: [],
    openCenterRequests: [],
    savedNotPlaced: 0,
    unorganizedClosure: null,
    ...over,
  };
}

function act(familyKey: string, at: string, kind: RawAction["kind"], active?: boolean): RawAction {
  return { familyKey, userId: `${familyKey}-u1`, at, kind, ...(active === false ? { active } : {}) };
}

/** Famiglia attivata il 20/11: figlio + 3 impegni. */
function activated(key: string): RawAction[] {
  return [
    act(key, "2026-11-20T09:10:00Z", "kid_added"),
    act(key, "2026-11-20T09:20:00Z", "commitment_created"),
    act(key, "2026-11-20T09:25:00Z", "commitment_created"),
    act(key, "2026-11-20T09:30:00Z", "commitment_created"),
  ];
}

test.describe("Beta cockpit — date e periodi (no browser)", () => {
  test("BC-D01 [no browser] il giorno è quello di Roma, non UTC", () => {
    expect(romeDay("2026-11-20T23:30:00Z")).toBe("2026-11-21");
    expect(romeDay("2026-11-20T22:59:00Z")).toBe("2026-11-20");
    expect(romeDay("2026-07-01T22:30:00Z")).toBe("2026-07-02"); // ora legale
  });

  test("BC-D02 [no browser] preset del periodo e periodo precedente", () => {
    const p7 = resolvePeriod("7g", "2026-11-26", "2026-11-18");
    expect([p7.from, p7.to]).toEqual(["2026-11-20", "2026-11-26"]);
    expect(previousPeriod(p7)).toEqual({ from: "2026-11-13", to: "2026-11-19" });
    expect(resolvePeriod("oggi", "2026-11-26", "2026-11-18").from).toBe("2026-11-26");
    expect(resolvePeriod("beta", "2026-11-26", "2026-11-18").from).toBe("2026-11-18");
    expect(resolvePeriod("beta", "2026-11-10", "2026-11-18").from).toBe("2026-11-10");
  });

  test("BC-D03 [no browser] periodo personalizzato: date invertite, mai oltre oggi, ripiego a 7 giorni", () => {
    const c = resolvePeriod("custom", "2026-11-26", "2026-11-18", { from: "2026-12-10", to: "2026-11-21" });
    expect([c.from, c.to]).toEqual(["2026-11-21", "2026-11-26"]);
    expect(resolvePeriod("custom", "2026-11-26", "2026-11-18", { from: "boh", to: null }).preset).toBe("7g");
  });

  test("BC-D04 [no browser] report settimanale: finestre dall'inizio beta, chiuse all'ora indicata", () => {
    const sched = { frequency: "weekly" as const, weekday: 5, time: "09:00", betaStart: "2026-11-18" };
    // venerdì 27/11 alle 08:00 di Roma: la finestra 20–26 non è ancora chiusa
    let w = reportWindows(sched, new Date("2026-11-27T07:00:00Z"));
    expect(w.map((x) => x.key)).toEqual(["2026-11-27_2026-12-03", "2026-11-20_2026-11-26", "2026-11-18_2026-11-19"]);
    expect(w.find((x) => x.key === "2026-11-20_2026-11-26")!.closed).toBe(false);
    // alle 10:00 sì
    w = reportWindows(sched, new Date("2026-11-27T09:00:00Z"));
    expect(w.find((x) => x.key === "2026-11-20_2026-11-26")!.closed).toBe(true);
    expect(rangeLabel("2026-11-20", "2026-11-26")).toBe("20–26 nov");
    expect(rangeLabel("2026-11-27", "2026-12-03")).toBe("27 nov – 3 dic");
  });

  test("BC-D05 [no browser] report giornaliero e manuale", () => {
    const daily = reportWindows({ frequency: "daily", weekday: 1, time: "07:00", betaStart: "2026-11-18" }, new Date("2026-11-20T10:00:00Z"));
    expect(daily.map((x) => x.from)).toEqual(["2026-11-20", "2026-11-19", "2026-11-18"]);
    expect(daily[0].closed).toBe(false);
    expect(daily[1].closed).toBe(true);
    expect(reportWindows({ frequency: "manual", weekday: 1, time: "07:00", betaStart: "2026-11-18" }, new Date())).toEqual([]);
  });
});

test.describe("Beta cockpit — definizioni (no browser)", () => {
  test("BC-A01 [no browser] le azioni significative non comprendono navigazione", () => {
    for (const kind of Object.keys(ACTION_DEF)) {
      expect(kind).not.toMatch(/login|view|open|tab|scroll|click|page/);
    }
  });

  test("BC-A02 [no browser] soglie: valori non validi tornano al default; a rischio < dormiente", () => {
    expect(resolveThresholds({ atRiskAfterDays: 0, dormantAfterDays: "7" }).atRiskAfterDays).toBe(4);
    const bad = resolveThresholds({ atRiskAfterDays: 9, dormantAfterDays: 5 });
    expect([bad.atRiskAfterDays, bad.dormantAfterDays]).toEqual([4, 7]);
    expect(resolveThresholds({ activationMinCommitments: 2 }).activationMinCommitments).toBe(2);
  });

  test("BC-A03 [no browser] numeri prima delle percentuali con campioni piccoli", () => {
    expect(countOf(7, 15)).toBe("7 su 15");
    expect(countOf(10, 20)).toBe("10 su 20 (50%)");
  });
});

test.describe("Beta cockpit — stato famiglia e attivazione (no browser)", () => {
  const asOf = (d: string, f: RawFamily, a: RawAction[], open: { familyKey: string; day: string }[] | null = null) =>
    computeFamilyRow(f, a, open, d, T);

  test("BC-S01 [no browser] invitata, non partita, in avvio", () => {
    expect(asOf("2026-11-22", fam("w", { members: [] }), []).status).toBe("invitata");
    expect(asOf("2026-11-22", fam("a"), []).status).toBe("non_partita");
    expect(asOf("2026-11-22", fam("a"), [act("a", "2026-11-21T10:00:00Z", "kid_added")]).status).toBe("in_avvio");
  });

  test("BC-S02 [no browser] attivazione = figlio + 3 impegni; data = il più tardo dei due", () => {
    const r = asOf("2026-11-21", fam("a"), activated("a"));
    expect(r.activatedAt).toBe("2026-11-20T09:30:00Z");
    expect(r.ttvActivationHours).toBe(1);
    expect(r.ttvFirstActionHours).toBe(0);
    const late = asOf("2026-11-25", fam("b"), [...activated("b").filter((x) => x.kind !== "kid_added"), act("b", "2026-11-24T10:00:00Z", "kid_added")]);
    expect(late.activatedAt).toBe("2026-11-24T10:00:00Z");
  });

  test("BC-S03 [no browser] prenotazioni annullate e impegni cancellati non contano come impegni", () => {
    const a = [act("a", "2026-11-20T09:10:00Z", "kid_added"), act("a", "2026-11-20T10:00:00Z", "booking_requested", false), act("a", "2026-11-20T10:01:00Z", "commitment_created", false), act("a", "2026-11-20T10:02:00Z", "commitment_created")];
    const r = asOf("2026-11-21", fam("a"), a);
    expect(r.commitments).toBe(1);
    expect(r.activatedAt).toBeNull();
  });

  test("BC-S04 [no browser] attiva → a rischio → dormiente con le soglie", () => {
    const f = fam("a");
    const a = activated("a");
    expect(asOf("2026-11-23", f, a).status).toBe("attiva"); // 3 giorni
    expect(asOf("2026-11-24", f, a).status).toBe("a_rischio"); // 4 giorni
    expect(asOf("2026-11-26", f, a).status).toBe("a_rischio"); // 6 giorni
    expect(asOf("2026-11-27", f, a).status).toBe("dormiente"); // 7 giorni
  });

  test("BC-S05 [no browser] un'azione futura rispetto alla data di calcolo non conta", () => {
    const a = [...activated("a"), act("a", "2026-11-30T10:00:00Z", "coordination_set")];
    const r = asOf("2026-11-22", fam("a"), a);
    expect(r.coordinationUsed).toBe(false);
    expect(r.lastActionLabel).toBe("Impegno inserito");
  });

  test("BC-S06 [no browser] giorni attivi 7/14 e 'legge' (app aperta senza azioni)", () => {
    const a = [act("a", "2026-11-20T10:00:00Z", "kid_added"), act("a", "2026-11-20T18:00:00Z", "commitment_created"), act("a", "2026-11-25T10:00:00Z", "coordination_set")];
    const r = asOf("2026-12-01", fam("a"), a, [{ familyKey: "a", day: "2026-11-30" }]);
    expect(r.activeDays7).toBe(1); // 25/11
    expect(r.activeDays14).toBe(2); // 20 e 25
    expect(r.openDays7).toBe(1);
    const reader = asOf("2026-12-05", fam("a"), a, [{ familyKey: "a", day: "2026-12-04" }]);
    expect(reader.activeDays7).toBe(0);
    expect(reader.readsOnly).toBe(true);
    expect(asOf("2026-12-05", fam("a"), a, null).openDays7).toBeNull();
  });

  test("BC-S07 [no browser] secondo adulto e coordinamento", () => {
    const two = fam("a", { members: [...fam("a").members, { userId: "a-u2", registeredAt: "2026-11-21T09:00:00Z", onboarding: "not_started", onboardingAt: null, pushDevices: 0 }] });
    expect(asOf("2026-11-20", two, []).secondAdult).toBe(false); // il secondo non c'era ancora
    expect(asOf("2026-11-22", two, []).secondAdult).toBe(true);
    expect(asOf("2026-11-22", fam("b"), [act("b", "2026-11-21T10:00:00Z", "coordination_set")]).coordinationUsed).toBe(true);
  });
});

test.describe("Beta cockpit — funnel, tempo al valore, utilizzo (no browser)", () => {
  test("BC-F01 [no browser] funnel sequenziale, con ritorni non ancora misurabili", () => {
    const raw: CockpitRaw = {
      families: [fam("a"), fam("b", { members: [] }), fam("c", { members: [{ ...fam("c").members[0], onboarding: "in_progress" }] }), fam("d")],
      actions: [
        ...activated("a"),
        act("a", "2026-11-22T10:00:00Z", "coordination_set"),
        act("a", "2026-11-29T10:00:00Z", "commitment_updated"),
        ...activated("d"),
      ],
      openDays: null,
      technicalErrors: [],
    };
    const rows = computeFamilyRows(raw, "2026-12-05", T);
    const f = computeFunnel(rows);
    const step = (s: string) => f.find((x) => x.step === s)!;
    expect(step("invitata").reached).toBe(4);
    expect(step("registrata").stopped).toBe(1); // b
    expect(step("onboarding").stopped).toBe(1); // c
    expect(step("secondo_adulto_o_coordinamento").stopped).toBe(1); // d
    expect(step("ritorno_settimana_2").reached).toBe(1); // a: azioni il 22 e il 29
    // Al 23/11 il ritorno di "a" in settimana 2 non è ancora misurabile
    const early = computeFamilyRows(raw, "2026-11-23", T).find((r) => r.key === "a")!;
    expect(early.stoppedAt).toBe("ritorno_settimana_2");
    expect(early.stoppedPending).toBe(true);
  });

  test("BC-F02 [no browser] mediana e famiglie più lente", () => {
    expect(median([1, 9, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(3);
    expect(median([])).toBeNull();
    const rows = computeFamilyRows({ families: [fam("a"), fam("b")], actions: activated("a"), openDays: null, technicalErrors: [] }, "2026-11-22", T);
    const [first, activation] = computeTtv(rows);
    expect(first.measured).toBe(1);
    expect(activation.notYet.map((x) => x.key)).toEqual(["b"]);
  });

  test("BC-F03 [no browser] utilizzo per area: solo azioni del periodo, ritorno = 2 giorni diversi", () => {
    const raw: CockpitRaw = {
      families: [fam("a"), fam("b")],
      actions: [
        act("a", "2026-11-20T10:00:00Z", "commitment_created"),
        act("a", "2026-11-21T10:00:00Z", "commitment_created"),
        act("b", "2026-11-21T10:00:00Z", "commitment_created"),
        act("b", "2026-11-21T11:00:00Z", "commitment_updated"),
        act("b", "2026-11-10T10:00:00Z", "saved"), // fuori periodo
      ],
      openDays: [{ familyKey: "a", day: "2026-11-22" }],
      technicalErrors: [],
    };
    const u = computeUsage(raw, { from: "2026-11-20", to: "2026-11-26" }, new Set(["a", "b"]));
    const planner = u.find((x) => x.area === "planner")!;
    expect([planner.families, planner.actions, planner.repeatFamilies]).toEqual([2, 4, 1]);
    expect(u.find((x) => x.area === "salvati")!.families).toBe(0);
    expect(u[0].area).toBe("app");
  });
});

test.describe("Beta cockpit — frizioni, alert, filtri, timeline (no browser)", () => {
  test("BC-R01 [no browser] alert con soglie e famiglie collegate", () => {
    const now = new Date("2026-11-25T10:00:00Z");
    const rows = computeFamilyRows(
      {
        families: [
          fam("a", { pendingPartnerInvites: ["2026-11-19T10:00:00Z"], openCenterRequests: ["2026-11-24T10:00:00Z"] }),
          fam("b", { openCenterRequests: ["2026-11-21T10:00:00Z"] }),
        ],
        actions: [act("b", "2026-11-17T10:00:00Z", "kid_added")],
        openDays: null,
        technicalErrors: [],
      },
      "2026-11-25",
      T
    );
    const alerts = computeAlerts(rows, T, now, 2);
    const by = (k: string) => alerts.find((a) => a.key === k);
    expect(by("not_activated")!.families.sort()).toEqual(["a", "b"]);
    expect(by("partner_invite")!.families).toEqual(["a"]);
    expect(by("center_reply")!.families).toEqual(["b"]); // a aspetta da 1 giorno: non ancora
    expect(by("new_feedback")!.count).toBe(2);
    expect(by("dormant")!.families).toEqual(["b"]);
    expect(by("at_risk")).toBeUndefined(); // gli alert a zero non compaiono
  });

  test("BC-R02 [no browser] filtri: andata e ritorno dall'URL, e applicazione alla tabella", () => {
    for (const p of ["stato:a_rischio", "fermate:tre_impegni", "frizione:push_off", "alert:dormant", "area:planner", "area:app", "activated", "second_adult"]) {
      expect(filterToParam(parseFilterParam(p))).toBe(p);
    }
    expect(parseFilterParam("stato:boh")).toBeNull();
    const rows = computeFamilyRows({ families: [fam("a"), fam("b")], actions: activated("a"), openDays: null, technicalErrors: [] }, "2026-11-21", T);
    const ctx = { activeInPeriod: new Set(["a"]), frictions: {} as never, alerts: [], areaFamilies: { planner: new Set(["a"]) } };
    expect(applyFamilyFilter(rows, { kind: "activated" }, ctx).map((r) => r.key)).toEqual(["a"]);
    expect(applyFamilyFilter(rows, { kind: "status", status: "non_partita" }, ctx).map((r) => r.key)).toEqual(["b"]);
    expect(applyFamilyFilter(rows, { kind: "area", area: "planner" }, ctx).map((r) => r.key)).toEqual(["a"]);
  });

  test("BC-R03 [no browser] timeline: una riga per giorno e tipo; app aperta solo a richiesta", () => {
    const f = fam("a", { invitedAt: "2026-11-18T10:00:00Z" });
    const t = buildTimeline(f, activated("a"), null);
    expect(t.map((e) => e.text)).toEqual(["invito", "registrazione", "onboarding completato", "Figlio aggiunto", "Impegno inserito (×3)"]);
    const all = buildTimeline(f, activated("a"), [{ familyKey: "a", day: "2026-11-20" }, { familyKey: "a", day: "2026-11-23" }]);
    expect(all.filter((e) => !e.significant).map((e) => e.day)).toEqual(["2026-11-23"]); // il 20 aveva già azioni
  });

  test("BC-R04 [no browser] chiusura della scuola non organizzata entro 14 giorni", () => {
    const periods = [{ startDate: "2026-12-07", endDate: "2026-12-08", kidIds: ["k1"], weekdaysByKid: { k1: ["2026-12-07", "2026-12-08"] } }];
    expect(firstUnorganizedClosure(periods, [], "2026-11-30")).toEqual({ from: "2026-12-07", to: "2026-12-08" });
    expect(firstUnorganizedClosure(periods, [{ kidIds: [], dates: ["2026-12-07", "2026-12-08"] }], "2026-11-30")).toBeNull();
    expect(firstUnorganizedClosure(periods, [], "2026-11-01")).toBeNull(); // oltre 14 giorni
  });
});

test.describe("Beta cockpit — domanda verso i centri (no browser)", () => {
  const s = (familyKey: string, name: string, type: DemandSignal["type"], locality: string | null = null): DemandSignal => ({
    familyKey,
    name,
    locality,
    type,
    at: "2026-11-21T10:00:00Z",
  });

  test("BC-C01 [no browser] famiglie distinte, non segnali: stessa normalizzazione dei centri suggeriti", () => {
    expect(normalizeDemandKey("Piscina Cozzi!", "Milano")).toBe("piscina cozzi|milano");
    const rows = computeDemand(
      [
        s("a", "Piscina Cozzi", "partner_salvato", "Milano"),
        s("a", "piscina cozzi", "impegno_manuale"),
        s("b", "Piscina  Cozzì", "centro_suggerito", "Milano"),
        s("c", "Piscina Cozzi", "scoperta_salvata", "milano"),
        s("c", "Calcio", "impegno_manuale"),
        s("d", "calcio", "impegno_manuale"),
        s("e", "Piscina", "impegno_manuale"), // troppo generico
      ],
      new Map([
        ["a", ["Milano"]],
        ["b", ["Sesto San Giovanni"]],
      ])
    );
    const cozzi = rows[0];
    expect([cozzi.label, cozzi.families, cozzi.signals, cozzi.tier]).toEqual(["Piscina Cozzi", 3, 4, 3]);
    expect(cozzi.zones).toEqual(["Milano", "Sesto San Giovanni"]);
    const calcio = rows.find((r) => r.key === "calcio")!;
    expect([calcio.families, calcio.freeTextOnly]).toEqual([2, true]);
    expect(rows.some((r) => r.key === "piscina")).toBe(false);
    expect(topOpportunities(rows).map((r) => r.label)).toEqual(["Piscina Cozzi"]);
  });
});

test.describe("Beta cockpit — feedback e survey (no browser)", () => {
  const fb = (over: Partial<CockpitFeedbackRow>): CockpitFeedbackRow => ({
    id: Math.random().toString(36),
    familyKey: "a",
    familyLabel: "A",
    at: "2026-11-21T10:00:00Z",
    category: "problema",
    area: "Planner",
    pagePath: "/nextgen/planner",
    message: "x",
    status: "nuovo",
    tags: [],
    adminNote: null,
    source: "genitori",
    surveyId: null,
    ...over,
  });

  test("BC-B01 [no browser] cinque stati, tre per le famiglie", () => {
    expect(toLegacyFeedbackStatus("da_capire")).toBe("in_gestione");
    expect(toLegacyFeedbackStatus("non_ora")).toBe("risolto");
    expect(toLegacyFeedbackStatus("boh")).toBe("nuovo");
  });

  test("BC-B02 [no browser] tag, viste e ricorrenze", () => {
    expect(parseTags("Onboarding, #push ;  push, Chi accompagna")).toEqual(["onboarding", "push", "chi-accompagna"]);
    const rows = [fb({ tags: ["push"] }), fb({ familyKey: "b", tags: ["push"] }), fb({ category: "idea" }), fb({ surveyId: "survey_1", category: null })];
    expect(rows.filter((r) => inFeedbackView(r, "problema"))).toHaveLength(2);
    expect(rows.filter((r) => inFeedbackView(r, "survey"))).toHaveLength(1);
    expect(rows.filter((r) => inFeedbackView(r, "altro"))).toHaveLength(0);
    const sum = summarizeFeedback(rows);
    expect(sum.recurring.find((r) => r.label === "#push")).toMatchObject({ items: 2, families: 2 });
  });

  test("BC-B03 [no browser] survey: giorno 3, 'più tardi', survey 2 dal giorno 14", () => {
    const config = resolveSurveyConfig(null);
    const now = new Date("2026-11-25T10:00:00Z");
    const base = { answered: new Set<string>(), snoozedAt: new Map<string, string>(), now, config };
    expect(dueSurvey({ ...base, registeredDaysAgo: 2 })).toBeNull();
    expect(dueSurvey({ ...base, registeredDaysAgo: 3 })?.id).toBe("survey_1");
    expect(dueSurvey({ ...base, registeredDaysAgo: 5, snoozedAt: new Map([["survey_1", "2026-11-24T10:00:00Z"]]) })).toBeNull();
    expect(dueSurvey({ ...base, registeredDaysAgo: 5, snoozedAt: new Map([["survey_1", "2026-11-22T10:00:00Z"]]) })?.id).toBe("survey_1");
    expect(dueSurvey({ ...base, registeredDaysAgo: 5, answered: new Set(["survey_1"]) })).toBeNull();
    expect(dueSurvey({ ...base, registeredDaysAgo: 15 })?.id).toBe("survey_2");
    expect(dueSurvey({ ...base, registeredDaysAgo: 15, config: resolveSurveyConfig({ survey_2: { enabled: false } }) })?.id).toBe("survey_1");
  });

  test("BC-B04 [no browser] risposte: scelte obbligatorie e tra le opzioni, testi tagliati", () => {
    const s1 = getSurvey("survey_1")!;
    expect(validateSurveyAnswers(s1, { piu_utile: "settimana" }).ok).toBe(false);
    expect(validateSurveyAnswers(s1, { piu_utile: "boh", se_sparisse: "molto" }).ok).toBe(false);
    const ok = validateSurveyAnswers(s1, { piu_utile: "settimana", se_sparisse: "poco", faticoso: "x".repeat(900), extra: "no" });
    expect(ok.ok).toBe(true);
    expect(ok.answers.faticoso).toHaveLength(600);
    expect(ok.answers).not.toHaveProperty("extra");
    expect(isNegativeSurveyAnswer("survey_1", ok.answers)).toBe(true);
    expect(isNegativeSurveyAnswer("survey_2", { consiglieresti: "si" })).toBe(false);
  });
});

test.describe("Beta cockpit — vista completa e report (no browser)", () => {
  test("BC-V01 [no browser] sintesi deterministica e confronto solo se sensato", () => {
    const families = ["a", "b", "c"].map((k) => fam(k));
    const input = {
      raw: { families, actions: [...activated("a"), act("b", "2026-11-21T10:00:00Z", "kid_added")], openDays: null, technicalErrors: ["2026-11-21T10:00:00Z"] },
      feedback: [],
      surveyResponses: [],
      demandSignals: [],
      zonesByFamily: new Map<string, string[]>(),
      thresholds: T,
      betaStart: "2026-11-18",
    };
    const period = resolvePeriod("7g", "2026-11-22", "2026-11-18");
    const view = buildCockpitView(input, period, new Date("2026-11-22T12:00:00Z"));
    expect(view.summary.lines.slice(0, 3)).toEqual(["3 famiglie invitate", "3 registrate", "1 attivate"]);
    expect(view.kpis.find((k) => k.key === "attive_periodo")!.value).toBe(2);
    expect(view.comparisonShown).toBe(false); // 3 famiglie e periodo precedente fuori dalla beta
    expect(view.technicalErrors).toBe(1);
    expect(view.summary.signals.some((s) => s.includes("prima dei 3 impegni"))).toBe(true);
    // Stesso input, stessa sintesi: nessuna parte casuale
    expect(buildCockpitView(input, period, new Date("2026-11-22T12:00:00Z")).summary).toEqual(view.summary);
  });

  test("BC-V02 [no browser] un report passato conta solo i dati fino alla sua fine", () => {
    const input = {
      raw: { families: [fam("a")], actions: [...activated("a"), act("a", "2026-12-01T10:00:00Z", "coordination_set")], openDays: null, technicalErrors: [] },
      feedback: [],
      surveyResponses: [],
      demandSignals: [],
      zonesByFamily: new Map<string, string[]>(),
      thresholds: T,
      betaStart: "2026-11-18",
    };
    const past = buildCockpitView(input, resolvePeriod("custom", "2026-12-05", "2026-11-18", { from: "2026-11-20", to: "2026-11-26" }), new Date("2026-12-05T10:00:00Z"));
    expect(past.kpis.find((k) => k.key === "coordinamento")!.value).toBe(0);
    expect(past.isCurrent).toBe(false);
    expect(diffDays("2026-11-20", addDays("2026-11-20", 6))).toBe(6);
  });
});

test.describe("Beta cockpit — accesso Admin e privacy (no browser, controlli sul sorgente)", () => {
  const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

  test("BC-X01 [no browser] i dati passano sempre dal controllo platform_admin lato server", () => {
    const data = read("lib/data/beta-cockpit.ts");
    const fn = data.slice(data.indexOf("export async function getBetaCockpitData"));
    expect(fn.indexOf("requirePlatformAdmin()")).toBeGreaterThan(-1);
    expect(fn.indexOf("requirePlatformAdmin()")).toBeLessThan(fn.indexOf("createServiceClient()"));
    expect(data).toContain('profile?.role !== "platform_admin"');
    for (const page of ["app/admin/beta/page.tsx", "app/admin/beta/report/page.tsx", "app/admin/beta/famiglia/[key]/page.tsx"]) {
      expect(read(page)).toContain("getBetaCockpitData()");
    }
  });

  test("BC-X02 [no browser] ogni azione Admin rifà il controllo", () => {
    const src = read("app/actions/beta-cockpit.ts");
    const adminActions = ["saveCockpitSettingsAction", "setCockpitUserExcludedAction", "addInvitedFamilyAction", "updateFeedbackTriageAction", "createDecisionAction", "setDecisionStatusAction"];
    for (const name of adminActions) {
      const body = src.slice(src.indexOf(`export async function ${name}`)).split("export async function")[1];
      expect(body, name).toContain("requirePlatformAdmin()");
    }
  });

  test("BC-X03 [no browser] migration 46: tutto solo admin, nessun dato nuovo sulle famiglie", () => {
    const sql = read("supabase/migration_46_beta_cockpit.sql");
    expect(sql).toContain("-- STATO: PREPARATA, NON APPLICATA");
    expect(sql).toMatch(/admin_beta_open_days[\s\S]*where public\.is_platform_admin\(\)/);
    expect(sql).toContain("revoke all on function public.admin_beta_open_days(uuid[], timestamptz) from public, anon;");
    expect((sql.match(/using \(public\.is_platform_admin\(\)\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(sql).not.toMatch(/create table[^;]*(family_activity|events_by_user)/i);
  });

  test("BC-X04 [no browser] nessuna analytics di terze parti", () => {
    const pkg = read("package.json");
    for (const lib of ["mixpanel", "amplitude", "@segment", "posthog", "react-ga", "gtag", "@vercel/analytics"]) expect(pkg).not.toContain(lib);
    const cockpitFiles = ["lib/beta-cockpit/model.ts", "lib/data/beta-cockpit.ts", "app/admin/beta/page.tsx", "components/nextgen/BetaSurveyCard.tsx"].map(read).join("\n");
    expect(cockpitFiles).not.toMatch(/googletagmanager|google-analytics|mixpanel|segment\.com/);
  });

  test("BC-X05 [no browser] le letture non prendono nomi dei figli né testi delle note", () => {
    const data = read("lib/data/beta-cockpit.ts");
    expect(data).toContain('by("kids", "id, parent_id, created_at")');
    expect(data).not.toMatch(/by\("kids", "[^"]*name/);
    expect(data).not.toMatch(/"[^"]*\bnotes\b[^"]*"/);
  });
});
