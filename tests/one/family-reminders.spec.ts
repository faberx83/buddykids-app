// TRAMA — PROMEMORIA PER LE FAMIGLIE (15/10/2026) [no browser]
// "Domani: chi accompagna?", "Scuola chiusa tra una settimana / dopodomani",
// "Nuova proposta in Classe e scuola". Logica pura + controlli statici;
// l'invio reale resta "pending local verification" (cron di Vercel).

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { buildFamilyReminders } from "../../lib/nextgen/family-reminders";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { RELEASE_CATALOG } from "../../lib/releases/catalog";
import { KNOWN_PRODUCT_EVENTS } from "../../lib/telemetry/known-events";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");
const names = { l: "Lino", f: "Franchidea" };
const base = {
  bookings: [] as { status: string; kidIds: string[]; kidNames: string[]; weeks: { startDate: string; endDate: string }[]; dayDates: string[] }[],
  externalItems: [{ startDate: "2026-10-14", endDate: "2026-10-14", kidIds: ["l"] }], // mercoledì: Nuoto di Lino
  responsibilities: [] as never[],
  kidNameById: names,
  labelFor: () => "Papà",
  closurePeriods: [],
  coverage: [],
};

test.describe("TRAMA — Promemoria famiglie [no browser]", () => {
  test("FR-01 la sera prima: manca chi porta e chi ritira Lino → una notifica col link al foglio della settimana", () => {
    const out = buildFamilyReminders({ ...base, todayIso: "2026-10-13" });
    expect(out).toEqual([
      {
        kind: "coordination_tomorrow",
        title: "Domani: chi accompagna?",
        body: "Mancano 2 passaggi per Lino.",
        deepLink: "/nextgen/planner?week=2026-10-12&panel=chi",
      },
    ]);
    // già tutto assegnato → niente
    const assigned = ["andata", "ritorno"].map((moment) => ({
      kidId: "l", weekStartDate: "2026-10-12", weekday: "mer" as const, moment: moment as "andata" | "ritorno",
      responsible: "io" as const, responsibleLabel: null,
    }));
    expect(buildFamilyReminders({ ...base, responsibilities: assigned as never[], todayIso: "2026-10-13" })).toEqual([]);
    // un solo passaggio mancante → frase al singolare
    const one = buildFamilyReminders({ ...base, responsibilities: [assigned[0]] as never[], todayIso: "2026-10-13" });
    expect(one[0].body).toBe("Manca chi ritira Lino.");
  });

  test("FR-02 venerdì sera e sabato sera: niente Porta/Ritira (weekend fuori)", () => {
    const sat = { ...base, externalItems: [{ startDate: "2026-10-17", endDate: "2026-10-18", kidIds: ["l"] }] };
    expect(buildFamilyReminders({ ...sat, todayIso: "2026-10-16" })).toEqual([]);
    expect(buildFamilyReminders({ ...sat, todayIso: "2026-10-17" })).toEqual([]);
  });

  test("FR-03 scuola chiusa tra 7 giorni o dopodomani, solo per chi non ha niente; mai negli altri giorni", () => {
    const period = {
      startDate: "2026-12-07", endDate: "2026-12-08", labels: ["Ponte di Sant'Ambrogio"], kidIds: ["l", "f"],
      weekdaysByKid: { l: ["2026-12-07", "2026-12-08"], f: ["2026-12-07", "2026-12-08"] }, weekdayCount: 2,
    };
    const coverage = [{ kidIds: ["f"], dates: ["2026-12-07", "2026-12-08"] }]; // Franchidea ha la gara
    const week = buildFamilyReminders({ ...base, externalItems: [], closurePeriods: [period], coverage, todayIso: "2026-11-30" });
    expect(week).toEqual([
      {
        kind: "closure_soon",
        title: "Scuola chiusa tra una settimana",
        body: "Ponte di Sant'Ambrogio, 7–8 dicembre: per Lino non c'è ancora niente.",
        deepLink: "/nextgen/planner?week=2026-12-07",
      },
    ]);
    const soon = buildFamilyReminders({ ...base, externalItems: [], closurePeriods: [period], coverage, todayIso: "2026-12-05" });
    expect(soon[0].title).toBe("Scuola chiusa dopodomani");
    expect(buildFamilyReminders({ ...base, externalItems: [], closurePeriods: [period], coverage, todayIso: "2026-12-01" })).toEqual([]);
    // tutti coperti → niente
    const all = [{ kidIds: [], dates: ["2026-12-07", "2026-12-08"] }];
    expect(buildFamilyReminders({ ...base, externalItems: [], closurePeriods: [period], coverage: all, todayIso: "2026-11-30" })).toEqual([]);
  });

  test("FR-04 testi brevi, senza emoji", () => {
    for (const f of ["lib/nextgen/family-reminders.ts", "lib/data/family-reminders.ts"]) {
      expect(read(f)).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
  });

  test("FR-05 flag spento di default, in una release, cron e proposta collegati, osservabilità senza dati personali", () => {
    const flag = FEATURE_FLAG_REGISTRY.FAMILY_REMINDERS_PUSH_ENABLED;
    expect(flag.defaultValue).toBe(false);
    expect(flag.allowedScopes).toContain("cohort");
    const entry = FEATURE_CATALOG.find((f) => f.key === "family_reminders_push");
    expect(entry?.releaseEligible).toBe(true);
    expect(RELEASE_CATALOG.find((r) => r.id === "promemoria-famiglie")?.featureKeys).toEqual(["family_reminders_push"]);
    const cron = read("app/api/cron/travel-reminders/route.ts");
    expect(cron).toContain("await runFamilyReminders(service, dateIso).catch(");
    const data = read("lib/data/family-reminders.ts");
    expect(data).toContain("if (!(await flagOnFor(parentId, FAMILY_REMINDERS_FLAG))) continue;");
    expect(data).toContain("filter((id) => id !== input.proposerId)");
    expect(data).toContain("detail: `parents=${parentIds.length} enabled=${enabled} sent=${sent}`");
    expect(read("app/actions/communities.ts")).toContain("await notifyClassProposal({ communityId, activityDbId, proposerId: user.id });");
    expect(KNOWN_PRODUCT_EVENTS).toContain("family_reminders_cron_run");
    // nessun nuovo cron: il piano Hobby ne permette uno al giorno per voce, si riusa quello esistente
    const vercel = JSON.parse(read("vercel.json"));
    expect(vercel.crons).toHaveLength(2);
  });
});
