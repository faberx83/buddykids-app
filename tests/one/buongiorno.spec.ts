// TRAMA — IL BUONGIORNO DI TRAMA (20/10/2026, Fabrizio: "briefing giornaliero
// alle 8, come notifica… vorrei anche vedere una mail… come personalizzazione
// nel profilo"). [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { buildDailyBriefing, dateLabelIt, isBriefingHour, nextClosure, romeNow } from "../../lib/nextgen/daily-briefing";
import type { AgendaEntry } from "../../lib/nextgen/today-agenda";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { getReleaseById } from "../../lib/releases/catalog";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { isKnownProductEvent } from "../../lib/telemetry/known-events";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");
const entry = (title: string, start: string | null, kid = "Lino"): AgendaEntry => ({
  id: title,
  startTime: start,
  endTime: null,
  title,
  place: null,
  kids: [{ id: "k1", name: kid }],
  source: "manuale",
  status: null,
});
const closure = { startDate: "2026-10-30", endDate: "2026-11-02", labels: ["Ponte dei Santi"], kidIds: ["k1"], weekdaysByKid: { k1: ["2026-10-30", "2026-11-02"] }, weekdayCount: 2 };

test.describe("TRAMA — Il buongiorno [no browser]", () => {
  test("BG-01 arriva alle 8 di Roma, con l'ora legale e con quella solare", () => {
    expect(isBriefingHour(new Date("2026-10-20T06:15:00Z"))).toBe(true); // CEST: 8:15
    expect(isBriefingHour(new Date("2026-10-20T07:15:00Z"))).toBe(false); // CEST: 9:15
    expect(isBriefingHour(new Date("2026-11-10T07:40:00Z"))).toBe(true); // CET: 8:40
    expect(isBriefingHour(new Date("2026-11-10T06:40:00Z"))).toBe(false); // CET: 7:40
    expect(romeNow(new Date("2026-10-20T22:30:00Z")).dateIso).toBe("2026-10-21");
    expect(dateLabelIt("2026-10-20")).toBe("martedì 20 ottobre");
  });

  test("BG-02 notifica: impegni, passaggi da decidere, chiusura vicina; link dritto alla scelta", () => {
    const b = buildDailyBriefing({
      todayIso: "2026-10-27",
      firstName: "Giovanni",
      entries: [entry("Calcio", "17:00"), entry("Inglese", null)],
      slots: [
        { kidId: "k1", kidName: "Lino", moment: "andata", label: "Mamma" },
        { kidId: "k1", kidName: "Lino", moment: "ritorno", label: null },
      ],
      closurePeriods: [closure],
      kidNameById: { k1: "Lino" },
    })!;
    expect(b.title).toBe("Buongiorno Giovanni, ecco la tua giornata");
    expect(b.body).toBe("Oggi 2 impegni, il primo: Calcio · manca chi ritira Lino · scuola chiusa 30 ottobre – 2 novembre.");
    expect(b.deepLink).toBe("/nextgen/planner?week=2026-10-26&assegna=2026-10-27");
    expect(b.subject).toBe("Il buongiorno di TRAMA · martedì 27 ottobre: 2 impegni, 1 passaggio da decidere");
    expect(b.html).toContain("Decidi chi accompagna");
    expect(b.html).toContain("Ponte dei Santi");
    expect(b.text).toContain("- Lino · Ritira: da decidere");
  });

  test("BG-03 giornata vuota: non si manda niente; testi dell'email al sicuro", () => {
    expect(buildDailyBriefing({ todayIso: "2026-10-20", firstName: null, entries: [], slots: [], closurePeriods: [], kidNameById: {} })).toBeNull();
    const b = buildDailyBriefing({ todayIso: "2026-10-20", firstName: null, entries: [entry("<b>x</b>", "09:00")], slots: [], closurePeriods: [], kidNameById: {} })!;
    expect(b.title).toBe("Buongiorno, ecco la tua giornata");
    expect(b.deepLink).toBe("/nextgen");
    expect(b.html).not.toContain("<b>x</b>");
    expect(b.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(nextClosure([closure], "2026-10-10")).toBeNull(); // oltre 14 giorni
    expect(nextClosure([closure], "2026-10-20")?.startDate).toBe("2026-10-30");
  });

  test("BG-04 cron: protetto, due voci giornaliere (06 e 07 UTC), invia solo alle 8 di Roma", () => {
    const route = read("app/api/cron/daily-briefing/route.ts");
    expect(route).toContain('if (!expected || !timingSafeEqual(auth, `Bearer ${expected}`)) {');
    expect(route).toContain("if (!isBriefingHour(now)) {");
    const vercel = JSON.parse(read("vercel.json")) as { crons: { path: string; schedule: string }[] };
    expect(vercel.crons.filter((c) => c.path === "/api/cron/daily-briefing").map((c) => c.schedule)).toEqual(["0 6 * * *", "0 7 * * *"]);
  });

  test("BG-05 invio: solo chi l'ha attivato e ha la release; rispetta Notifiche email; conteggio senza dati personali", () => {
    const d = read("lib/data/daily-briefing.ts");
    expect(d).toContain('.or("daily_briefing_push.eq.true,daily_briefing_email.eq.true")');
    expect(d).toContain("resolveFeatureFlag({ flagName: DAILY_BRIEFING_FLAG, userId: r.id");
    expect(d).toContain("if (r.daily_briefing_email && r.email && r.notify_email !== false && isEmailConfigured) {");
    expect(d).toContain('event_name: "daily_briefing_run"');
    expect(isKnownProductEvent("daily_briefing_run")).toBe(true);
  });

  test("BG-06 Profilo → Preferenze: telefono, email, 'Mandamelo adesso' (solo a sé stessi); migrazione additiva", () => {
    const page = read("app/nextgen/profile/impostazioni/preferenze/page.tsx");
    expect(page).toContain('flagName: "DAILY_BRIEFING_ENABLED"');
    expect(page).toContain("<DailyBriefingSettings initialPush={briefing.push} initialEmail={briefing.email} email={briefing.address} />");
    const a = read("app/actions/daily-briefing.ts");
    expect(a).toContain('runDailyBriefing(service, new Date(), { onlyUserId: ctx.user.id, source: "prova" })');
    expect(a).toContain('.update(update).eq("id", ctx.user.id)');
    const m = read("supabase/migration_45_daily_briefing.sql");
    expect(m).toContain("-- STATO: PREPARATA, NON APPLICATA");
    expect(m).toContain("add column if not exists daily_briefing_push boolean not null default false");
    expect(m).toContain("add column if not exists daily_briefing_email boolean not null default false");
  });

  test("BG-07 dalla card Release, spento di default", () => {
    expect(FEATURE_FLAG_REGISTRY.DAILY_BRIEFING_ENABLED.defaultValue).toBe(false);
    expect(FEATURE_CATALOG.find((e) => e.key === "daily_briefing")?.releaseEligible).toBe(true);
    expect(getReleaseById("buongiorno-trama")?.featureKeys).toEqual(["daily_briefing"]);
  });
});
