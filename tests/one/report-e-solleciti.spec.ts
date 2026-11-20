import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { barHtml, buildBetaReportEmail, buildReportActions } from "../../lib/beta-cockpit/report-email";
import {
  NUDGE_CAMPAIGNS,
  NUDGE_COOLDOWN_DAYS,
  WHATSAPP_NUDGES,
  familiesForCampaign,
  isInCooldown,
  nudgeByKey,
  nudgeEmailHtml,
  selectNudgeRecipients,
} from "../../lib/beta-cockpit/nudges";
import { KNOWN_PRODUCT_EVENTS } from "../../lib/telemetry/known-events";
import type { CockpitView } from "../../lib/beta-cockpit/view";

// TRAMA — BETA REPORT DETTAGLIATO + SOLLECITI (20/11/2026). Fabrizio: "report
// strutturato... da ricevere sempre il lunedì" → "Email da TRAMA con report
// dettagliato grafici motivi e azioni"; "campagna di push per sollecitare".
// [no browser] — arrivo reale di email e push: pending local verification.
// Comando: npx playwright test tests/one/report-e-solleciti.spec.ts

const ROOT = path.join(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

function fakeView(extra: Partial<CockpitView> = {}): CockpitView {
  return {
    period: { preset: "custom", from: "2026-11-16", to: "2026-11-23", label: "16–23 nov" },
    kpis: [
      { key: "registrate", label: "Famiglie registrate", value: 7, of: 12, delta: 3, filter: null, hint: "" },
      { key: "attive", label: "Famiglie attive", value: 4, of: 7, delta: -1, filter: null, hint: "" },
    ],
    alerts: [
      { key: "new_feedback", text: "2 feedback nuovi da leggere", count: 2, families: [] },
      { key: "dormant", text: "1 famiglia dormiente", count: 1, families: ["f3"] },
    ],
    funnel: [
      { step: "registrata", label: "Registrata", rule: "", reached: 7, stopped: 2, pending: 0 },
      { step: "attivata", label: "Attivata", rule: "", reached: 4, stopped: 0, pending: 0 },
    ],
    preFunnel: [{ key: "visite", label: "Visite alla pagina di benvenuto", value: 40, unit: "visite", scope: "", rule: "" }],
    usage: [{ area: "planner", label: "Planner (impegni)", families: 4, actions: 12, repeatFamilies: 2 }],
    frictions: [
      { key: "onboarding_incomplete", label: "3 famiglie non hanno concluso l'onboarding", families: ["f1", "f2", "w:9"], trend: 1 },
      { key: "no_commitment", label: "1 famiglia registrata non ha ancora nessun impegno", families: ["f4"], trend: null },
      { key: "push_off", label: "0 famiglie senza notifiche push attive", families: [], trend: null },
    ],
    frictionMap: { onboarding_incomplete: ["f1", "f2", "w:9"], no_commitment: ["f4"], no_second_adult: [] } as never,
    feedbackInPeriod: [],
    feedbackSummary: { counts: {} as never, byStatus: { nuovo: 2 } as never, recurring: [{ label: "Planner", kind: "area", items: 3, families: 2 }], families: 2, lastAt: null },
    topDemand: [],
    summary: { lines: ["7 famiglie registrate su 12 invitate."], signals: [] },
    comparisonShown: true,
    ...extra,
  } as unknown as CockpitView;
}

test.describe("Beta Report via email — grafici, motivi, azioni", () => {
  test("RE-01: azioni consigliate una per frizione presente, le più diffuse prima, più feedback e dormienti", () => {
    const actions = buildReportActions(fakeView());
    expect(actions[0].why).toContain("onboarding");
    expect(actions[0].action).toContain("Ti mancano 2 minuti");
    expect(actions.map((a) => a.why)).not.toContain("0 famiglie senza notifiche push attive");
    expect(actions.some((a) => a.where === "Beta Famiglie → Feedback")).toBe(true);
    expect(actions.some((a) => a.action.includes("Com'è andata la settimana"))).toBe(true);
    expect(actions.length).toBeLessThanOrEqual(6);
  });

  test("RE-02: barre email-safe in percentuale, mai oltre il 100%", () => {
    expect(barHtml(5, 10)).toContain("width:50%");
    expect(barHtml(20, 10)).toContain("width:100%");
    expect(barHtml(0, 0)).toContain("width:100%;background:#ECEAFB");
    expect(barHtml(3, 10)).not.toMatch(/<script|<img/);
  });

  test("RE-03: l'email ha sintesi, numeri, azioni, funnel, uso, motivi e link; il testo è escapato", () => {
    const view = fakeView({ summary: { lines: ["<b>prova</b>"], signals: [] } } as Partial<CockpitView>);
    const { subject, html, text } = buildBetaReportEmail({ view, rangeLabel: "16–23 nov", link: "https://admin.tramapp.it/admin/beta/report", weekLines: ["3 account nuovi"] });
    expect(subject).toBe("TRAMA — Beta Report 16–23 nov");
    for (const s of ["Numeri chiave", "Azioni consigliate", "Dove si fermano le famiglie", "Prima della registrazione", "Cosa usano", "Motivi da capire", "Segnalazioni", "Ultimi 7 giorni", "Apri il report completo"]) {
      expect(html).toContain(s);
    }
    expect(html).toContain("&lt;b&gt;prova&lt;/b&gt;");
    expect(html).toContain("▲ +3");
    expect(text).toContain("AZIONI CONSIGLIATE");
  });

  test("RE-04: il resoconto settimanale già in produzione usa il nuovo contenuto e passa anche i dati prima della registrazione", () => {
    const src = read("lib/data/beta-report-notice.ts");
    expect(src).toContain("buildBetaReportEmail({ view, rangeLabel: rangeLabel(win.from, win.to), link, weekLines })");
    expect(src).toContain("preRegistration: data.preRegistration");
    // Una volta per finestra, come prima.
    expect(src).toContain('.eq("event_name", "beta_report_notice_sent")');
  });
});

test.describe("Solleciti alle famiglie poco attive", () => {
  test("SO-01: quattro solleciti con push ed email, ognuno legato a un fatto del cockpit", () => {
    expect(NUDGE_CAMPAIGNS.map((c) => c.key)).toEqual(["completa_onboarding", "primo_impegno", "altro_genitore", "torna"]);
    for (const c of NUDGE_CAMPAIGNS) {
      expect(c.push.title.length).toBeGreaterThan(0);
      expect(c.push.body.length).toBeLessThanOrEqual(120);
      expect(c.push.deepLink.startsWith("/nextgen")).toBe(true);
    }
    expect(nudgeByKey("inesistente")).toBeNull();
  });

  test("SO-02: destinatari solo famiglie registrate (mai le invitate non registrate)", () => {
    const view = fakeView();
    expect(familiesForCampaign(nudgeByKey("completa_onboarding")!, view.frictionMap, view.alerts)).toEqual(["f1", "f2"]);
    expect(familiesForCampaign(nudgeByKey("torna")!, view.frictionMap, view.alerts)).toEqual(["f3"]);
  });

  test("SO-03: niente account di prova, niente doppioni, pausa di 7 giorni per persona", () => {
    const now = new Date("2026-11-23T08:00:00Z");
    const { recipients, skippedCooldown } = selectNudgeRecipients({
      familyKeys: ["f1", "f2"],
      membersByFamily: new Map([
        ["f1", ["u1", "u2"]],
        ["f2", ["u2", "u3", "uTest"]],
      ]),
      testUserIds: new Set(["uTest"]),
      lastSentByUser: new Map([["u3", "2026-11-20T08:00:00Z"]]),
      now,
    });
    expect(recipients.map((r) => r.userId)).toEqual(["u1", "u2"]);
    expect(skippedCooldown).toBe(1);
    expect(NUDGE_COOLDOWN_DAYS).toBe(7);
    expect(isInCooldown("2026-11-15T08:00:00Z", now)).toBe(false);
  });

  test("SO-04: email con il modo per spegnerle; messaggi WhatsApp con il link", () => {
    const html = nudgeEmailHtml(nudgeByKey("primo_impegno")!, "https://tramapp.it/nextgen/planner", "Anna");
    expect(html).toContain("Ciao Anna");
    expect(html).toContain("Profilo → Impostazioni → Notifiche");
    expect(WHATSAPP_NUDGES).toHaveLength(3);
    for (const m of WHATSAPP_NUDGES) expect(m.text).toContain("{link}");
  });

  test("SO-05: invio solo a mano da un Admin, registrato prima della push, mai dal cron", () => {
    const action = read("app/actions/beta-nudges.ts");
    expect(action).toContain("const admin = await requirePlatformAdmin();");
    const data = read("lib/data/beta-nudges.ts");
    expect(data.indexOf("event_name: NUDGE_SENT_EVENT")).toBeLessThan(data.indexOf("await sendPushToUser("));
    expect(data).toContain('if (!p || p.role !== "parent") continue;');
    expect(data).toContain("p.notify_email !== false");
    for (const cron of fs.readdirSync(path.join(ROOT, "app/api/cron"))) {
      expect(read(`app/api/cron/${cron}/route.ts`)).not.toContain("sendNudgeCampaign");
    }
    expect(read("app/admin/beta/page.tsx")).toContain("<NudgesClient rows={await loadNudgeOverview()}");
    expect(KNOWN_PRODUCT_EVENTS).toContain("beta_nudge_sent");
  });
});
