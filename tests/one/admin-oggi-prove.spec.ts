// TRAMA — ADMIN OPERATIVO, retest del 12/11/2026. Iniziativa:
// claude/INIZIATIVA_admin_operativo.md. Richiesta di Fabrizio: "La home
// dichiara che i dati di prova non sono contati, ma nelle anteprime di
// Candidature, Segnalazioni centri e Onboarding compaiono record [TEST] …
// Allinea contatore, anteprima e coda di destinazione; mantieni le prove
// raggiungibili con un filtro esplicito. Correggi anche '5 codae' e i plurali
// '1 occupati / 1 liberi'." Più: accesso dei non-Admin tramite URL diretto e
// avviso del Planner con flag acceso/spento.
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { isDemoCenter, isDemoCertification, isDemoLead, withDemo } from "../../lib/admin-ops/demo";
import { buildQueue } from "../../lib/admin-ops/queues";
import { countOf, daySummary, oggiSummary } from "../../lib/admin-ops/text";
import { buildDayLedger } from "../../lib/admin-ops/day-ledger";
import { adminBucket } from "../../lib/centers/activation";
import KidOverlapNotice from "../../components/nextgen/KidOverlapNotice";
import { evaluateFlag } from "../../lib/feature-flags/evaluate";
import { PLANNER_OVERLAP_WARNING_FLAG } from "../../lib/nextgen/kid-overlaps";
import type { AgendaEntry } from "../../lib/nextgen/today-agenda";

const ROOT = path.join(__dirname, "../..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");

test.describe("Prove fuori da Oggi e dalle code di destinazione", () => {
  test("AP-01 candidature, segnalazioni e certificazioni di prova riconosciute; link alle prove", () => {
    expect(isDemoLead({ suggestedName: "[TEST] Centro Autocandidatura 1786025606585" })).toBe(true);
    expect(isDemoLead({ suggestedName: "[TEST] Centro Segnalato 1785750632389" })).toBe(true);
    expect(isDemoLead({ suggestedName: "Test suggerimento 2" })).toBe(true);
    expect(isDemoLead({ suggestedName: "Stripes Cooperativa Sociale ONLUS" })).toBe(false);
    expect(isDemoLead({ suggestedName: "Associazione LYCEUM — Impresa Sociale" })).toBe(false);
    expect(isDemoCenter({ name: "[TEST] Centro BuddyKids", isTestFixture: true })).toBe(true);
    expect(isDemoCenter({ name: "Ludoteca Il Girasole", isTestFixture: true })).toBe(true);
    expect(isDemoCertification({ centerName: "Centro Demo", activityName: "Natale" })).toBe(true);
    expect(withDemo("/admin/center-leads?tipo=candidature")).toBe("/admin/center-leads?tipo=candidature&demo=1");
    expect(withDemo("/admin/certifications")).toBe("/admin/certifications?demo=1");
    expect(withDemo("/admin/richieste?stato=aperta#casi")).toBe("/admin/richieste?stato=aperta&demo=1#casi");
  });

  test("AP-02 dati del 12/11: contatore = elenco della coda, prove contate a parte (onboarding 0+1, candidature 0+3, segnalazioni 4+12)", () => {
    const onb = [
      { name: "[TEST] Centro BuddyKids", isTestFixture: true, status: "SUBMITTED" as const },
      { name: "Centro Demo", isTestFixture: false, status: "APPROVED" as const },
      { name: "Centro di Prova", isTestFixture: false, status: "LEAD" as const },
    ];
    const leads = [
      ...Array.from({ length: 3 }, (_, i) => ({ suggestedName: `[TEST] Centro Autocandidatura ${i}`, leadType: "self_candidacy", status: "suggested" })),
      ...Array.from({ length: 11 }, (_, i) => ({ suggestedName: `[TEST] Centro Segnalato ${i}`, leadType: "parent_referral", status: "suggested" })),
      { suggestedName: "Test suggerimento 2", leadType: "parent_referral", status: "suggested" },
      { suggestedName: "Centro suggerito 2", leadType: "parent_referral", status: "qualified" },
      { suggestedName: "Associazione LYCEUM — Impresa Sociale", leadType: "parent_referral", status: "suggested" },
      { suggestedName: "Stripes Cooperativa Sociale ONLUS", leadType: "parent_referral", status: "suggested" },
      { suggestedName: "Il Sogno di Don Bosco — Società Cooperativa Sociale", leadType: "parent_referral", status: "suggested" },
    ];
    const toVerifyAll = onb.filter((c) => adminBucket(c.status) === "trama");
    const toVerify = toVerifyAll.filter((c) => !isDemoCenter(c));
    // La pagina di destinazione applica la stessa regola (?demo assente) e poi lo stesso bucket.
    const destination = onb.filter((c) => !isDemoCenter(c)).filter((c) => adminBucket(c.status) === "trama");
    expect([toVerify.length, toVerifyAll.length - toVerify.length]).toEqual([0, 1]);
    expect(destination.length).toBe(toVerify.length);
    const active = (s: string) => ["suggested", "qualified", "contacted"].includes(s);
    const cand = leads.filter((l) => l.leadType === "self_candidacy" && active(l.status));
    const ref = leads.filter((l) => l.leadType !== "self_candidacy" && active(l.status));
    expect([cand.filter((l) => !isDemoLead(l)).length, cand.filter(isDemoLead).length]).toEqual([0, 3]);
    expect([ref.filter((l) => !isDemoLead(l)).length, ref.filter(isDemoLead).length]).toEqual([4, 12]);
    const q = buildQueue(
      { key: "center-leads", label: "x", actor: "trama", href: "/a", nextStep: "", hiddenDemo: 12, demoHref: withDemo("/a"), items: ref.filter((l) => !isDemoLead(l)).map((l, i) => ({ id: String(i), title: l.suggestedName, createdAt: null, href: "/a" })) },
      "2026-11-12"
    );
    expect(q.count).toBe(4);
    expect(q.preview.some((p) => p.title.includes("[TEST]"))).toBe(false);
    expect(q).toMatchObject({ hiddenDemo: 12, demoHref: "/a?demo=1" });
  });

  test("AP-03 ogni coda dei centri in Oggi esclude le prove e porta il link per vederle", () => {
    const src = read("lib/data/command-center.ts");
    expect(src).toContain("const toVerify = toVerifyAll.filter((c) => !isDemoCenter({ name: c.name, isTestFixture: c.isTestFixture }));");
    expect(src).toContain("const candidacies = candidaciesAll.filter((l) => !isDemoLead(l));");
    expect(src).toContain("const referrals = referralsAll.filter((l) => !isDemoLead(l));");
    expect(src).toContain("const certsPending = certsPendingAll.filter((c) => !isDemoCertification(c));");
    for (const href of ['withDemo("/admin/centri-attivazione?f=trama")', 'withDemo("/admin/center-leads?tipo=candidature")', 'withDemo("/admin/center-leads?tipo=segnalazioni")', 'withDemo("/admin/certifications")']) {
      expect(src).toContain(`demoHref: ${href}`);
    }
    const oggi = read("app/admin/page.tsx");
    expect(oggi).toContain("<Link href={q.demoHref}");
    expect(oggi).toContain("segnalazioni BETA, lista d&apos;attesa e flag sono contati tutti");
  });

  test("AP-04 le pagine di destinazione usano la stessa regola, ?demo=1 come filtro esplicito", () => {
    const leads = read("app/admin/center-leads/page.tsx");
    expect(leads).toContain("const leads = showDemo ? allLeads : allLeads.filter((l) => !isDemoLead(l));");
    expect(leads).toContain("<DemoToggle");
    const act = read("app/admin/centri-attivazione/page.tsx");
    expect(act).toContain("allCenters.filter((c) => !isDemoCenter({ name: c.name, isTestFixture: c.isTestFixture }))");
    expect(read("app/admin/centri-attivazione/ActivationAdminClient.tsx")).toContain('${demo ? "&demo=1" : ""}');
    expect(read("app/admin/certifications/page.tsx")).toContain("all.filter((c) => !isDemoCertification(c))");
    expect(read("lib/data/center-activation.ts")).toContain("isTestFixture: fixtures.has(r.centerId)");
    const toggle = read("components/admin/DemoToggle.tsx");
    expect(toggle).toContain("Mostrale");
    expect(toggle).toContain("Nascondile");
  });
});

test.describe("Plurali", () => {
  test("AP-05 riga di sintesi di Oggi: niente più 'codae'", () => {
    expect(oggiSummary(5, 1)).toBe("5 elementi in sospeso su tutte le code, 1 coda in priorità alta");
    expect(oggiSummary(1, 2)).toBe("1 elemento in sospeso su tutte le code, 2 code in priorità alta");
    expect(oggiSummary(0, 0)).toBe("0 elementi in sospeso su tutte le code");
    expect(read("app/admin/page.tsx")).not.toContain('coda${summary.criticalQueueCount === 1 ? "" : "e"}');
  });

  test("AP-06 giornata: '1 occupato · 1 libero', '1 bambino'", () => {
    expect(daySummary(2, 1, 1)).toBe("2 posti totali · 1 occupato · 1 libero per le famiglie");
    expect(daySummary(1, 0, 1)).toBe("1 posto totale · 0 occupati · 1 libero per le famiglie");
    expect(countOf(1, "bambino", "bambini")).toBe("1 bambino");
    const day = read("app/admin/centers/[id]/attivita/[activityId]/giorno/[date]/page.tsx");
    expect(day).toContain("{daySummary(ledger.capacity, ledger.occupied, ledger.spotsLeft)}");
    expect(day).not.toContain("{ledger.occupied} occupati");
    const l = buildDayLedger({ capacity: 2, spotsLeft: 2 }, [{ bookingId: "b", ref: "#B", bookingStatus: "confirmed", decision: "accepted", capacityDecremented: true, units: 1, kidsCount: 1, label: "x" }]);
    expect(l.issues[0].message).toContain("con 1 posto preso su 2");
  });
});

test.describe("Accesso dei non-Admin tramite URL diretto", () => {
  test("AP-07 candidature e segnalazioni: niente dati Admin (note) a chi non è platform_admin, controllo prima della query", () => {
    const src = read("lib/data/center-leads.ts");
    const fn = src.slice(src.indexOf("export async function getAllCenterLeadsForAdmin"));
    const check = fn.indexOf('if (me?.role !== "platform_admin") return [];');
    const query = fn.indexOf('.from("center_leads")');
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(query);
  });

  test("AP-08 Famiglie: membri delle famiglie letti dopo il controllo Admin (la RLS non ha il bypass Admin)", () => {
    const src = read("lib/data/admin-ops.ts");
    const fn = src.slice(src.indexOf("export async function getAdminFamilyFunnel"));
    expect(fn.indexOf("await adminSession()")).toBeLessThan(fn.indexOf('from("family_members")'));
    expect(fn).toContain('(createServiceClient() ?? supabase).from("family_members").select("family_id, parent_id")');
  });
});

test.describe("Avviso del Planner con flag acceso e spento", () => {
  const e = (over: Partial<AgendaEntry>): AgendaEntry => ({
    id: "a",
    startTime: "16:00",
    endTime: "17:30",
    title: "Ritmica",
    place: null,
    kids: [{ id: "k1", name: "Lino" }],
    source: "trama",
    status: null,
    ...over,
  });
  const entries = [e({}), e({ id: "b", title: "Piscina", startTime: "17:00", endTime: "18:00", source: "manuale" })];

  // Il runner trasforma il JSX in oggetti { type, props }: si leggono testo e
  // attributi dall'albero restituito dal componente (nessun browser).
  type Node = { type?: unknown; props?: Record<string, unknown> } | string | number | null | undefined | Node[];
  const texts = (n: Node): string[] =>
    n === null || n === undefined ? [] : typeof n === "string" || typeof n === "number" ? [String(n)] : Array.isArray(n) ? n.flatMap(texts) : texts((n.props?.children ?? null) as Node);

  test("AP-09 acceso: l'avviso compare con la frase; spento: niente nel foglio", () => {
    const on = KidOverlapNotice({ entries, enabled: true }) as unknown as { props: Record<string, unknown> };
    expect(on.props["data-testid"]).toBe("kid-overlap-notice");
    expect(on.props.role).toBe("status");
    expect(texts(on as Node).join("")).toContain("Lino ha due impegni negli stessi orari (17:00–17:30): Ritmica e Piscina.");
    expect(KidOverlapNotice({ entries, enabled: false })).toBeNull();
    expect(KidOverlapNotice({ entries: [e({})], enabled: true })).toBeNull();
  });

  test("AP-10 flag: spento senza override (default), acceso con l'override della coorte beta, spento di nuovo se scade", () => {
    const ctx = { userId: "u1", role: "parent", tenant: "family", cohortKeys: ["trama-one-controlled-beta"] };
    expect(evaluateFlag(PLANNER_OVERLAP_WARNING_FLAG, ctx, [])).toBe(false);
    const on = [{ scopeType: "cohort" as const, scopeValue: "trama-one-controlled-beta", enabled: true, expiresAt: null }];
    expect(evaluateFlag(PLANNER_OVERLAP_WARNING_FLAG, ctx, on)).toBe(true);
    expect(evaluateFlag(PLANNER_OVERLAP_WARNING_FLAG, { ...ctx, cohortKeys: [] }, on)).toBe(false);
    expect(evaluateFlag(PLANNER_OVERLAP_WARNING_FLAG, ctx, [{ ...on[0], expiresAt: "2026-01-01T00:00:00Z" }])).toBe(false);
  });
});
