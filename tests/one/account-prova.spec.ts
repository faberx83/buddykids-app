// TRAMA — Account di prova esclusi dai report Admin (17/11/2026).
// Iniziativa: claude/INIZIATIVA_account_prova.md. Richiesta di Fabrizio:
// "flagghiamo tutti i parent e partner presenti ad oggi come DEMO [...]
// cosicché lato ADMIN possa filtrare e non considerarli nei report?"
// Decisione: fuori solo luca.d.magi, mariafpoli e ppirulli.
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { isDemoRecord } from "../../lib/admin-ops/demo";
import { NO_TEST_ACCOUNTS, isTestAccount, withoutTestAccounts } from "../../lib/admin-ops/test-accounts";
import { DEFAULT_BOOKING_FILTERS, filterAdminBookings, viewAdminBooking, type AdminBookingRow } from "../../lib/admin-ops/bookings";
import { filterInquiries, viewInquiry, type AdminInquiryRow } from "../../lib/admin-ops/inquiries";
import { waitlistQueue, type WaitlistLike } from "../../lib/admin-ops/invitations";
import { computePreFunnel } from "../../lib/beta-cockpit/pre-funnel";

const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const TODAY = "2026-11-17";
const TEST_ID = "c1f68eb3-0ae5-4d7a-86e6-debb9847a5bc"; // uxtest
const REAL_ID = "real-family-0001";
const testIds = new Set([TEST_ID]);

function booking(over: Partial<AdminBookingRow> = {}): AdminBookingRow {
  return {
    id: "b-1",
    status: "pending",
    partnerDecisionRaw: "pending",
    createdAt: "2026-11-10T08:00:00Z",
    respondedAt: null,
    cancelledBy: null,
    totalAmount: 30,
    discountAmount: 0,
    centerId: "c-real",
    centerName: "Ludoteca Arcobaleno",
    centerIsTestFixture: false,
    activityId: "a-1",
    activitySlug: "natale",
    activityName: "Natale in ludoteca",
    bookingMode: "day_only",
    pricePerWeek: 150,
    parentId: REAL_ID,
    parentName: "Famiglia vera",
    parentEmail: "vera@example.it",
    kidNames: ["Luca"],
    days: [{ activityDayId: "d-1", date: "2026-12-08", decision: "pending", capacityDecremented: false, units: null, price: 30 }],
    weeks: [],
    ...over,
  };
}

function inquiry(over: Partial<AdminInquiryRow> = {}): AdminInquiryRow {
  return {
    id: "i-1",
    status: "aperta",
    createdAt: "2026-11-15T08:00:00Z",
    repliedAt: null,
    lastMessageAt: null,
    centerId: "c-real",
    centerName: "Ludoteca Arcobaleno",
    centerIsTestFixture: false,
    activityId: "a-1",
    activityName: "Natale in ludoteca",
    parentId: REAL_ID,
    parentName: "Famiglia vera",
    message: "Ci sono posti?",
    reply: null,
    ...over,
  };
}

test.describe("AP — account di prova", () => {
  test("AP-01 un record di un account di prova è 'prova' anche in un centro vero", () => {
    expect(isDemoRecord({ centerName: "Ludoteca Arcobaleno", accountIsTest: true })).toBe(true);
    expect(isDemoRecord({ centerName: "Ludoteca Arcobaleno", accountIsTest: false })).toBe(false);
    expect(isDemoRecord({ centerName: "Centro Demo" })).toBe(true); // regola di prima invariata
    expect(isTestAccount(TEST_ID, testIds)).toBe(true);
    expect(isTestAccount(null, testIds)).toBe(false);
  });

  test("AP-02 Prenotazioni e Oggi: la prenotazione di prova esce dai conteggi, resta con 'mostra anche le prove'", () => {
    const views = [booking(), booking({ id: "b-2", parentId: TEST_ID })].map((b) => viewAdminBooking(b, TODAY, testIds));
    expect(views.map((v) => v.isDemo)).toEqual([false, true]);
    const f = { ...DEFAULT_BOOKING_FILTERS, stato: "da_rispondere" as const };
    expect(filterAdminBookings(views, f).map((v) => v.row.id)).toEqual(["b-1"]);
    expect(filterAdminBookings(views, { ...f, demo: true })).toHaveLength(2);
    // Senza lista (o prima dello script) nessuno è nascosto: comportamento di prima.
    expect(viewAdminBooking(booking({ parentId: TEST_ID }), TODAY).isDemo).toBe(false);
    expect(viewAdminBooking(booking({ parentId: TEST_ID }), TODAY, NO_TEST_ACCOUNTS).isDemo).toBe(false);
  });

  test("AP-03 Messaggi e SLA: la richiesta di un account di prova è 'prova'", () => {
    const views = [inquiry(), inquiry({ id: "i-2", parentId: TEST_ID })].map((r) => viewInquiry(r, TODAY, testIds));
    expect(filterInquiries(views, { centro: "", stato: "aperta", demo: false }).map((v) => v.row.id)).toEqual(["i-1"]);
    expect(filterInquiries(views, { centro: "", stato: "aperta", demo: true })).toHaveLength(2);
  });

  test("AP-04 elenchi (Segnalazioni BETA, Pilota, Famiglie): fuori di default, dentro con ?demo=1", () => {
    const items = [{ id: "f1", parentId: TEST_ID }, { id: "f2", parentId: REAL_ID }, { id: "f3", parentId: null }];
    expect(withoutTestAccounts(items, (i) => i.parentId, testIds).map((i) => i.id)).toEqual(["f2", "f3"]);
    expect(withoutTestAccounts(items, (i) => i.parentId, testIds, true)).toHaveLength(3);
    expect(withoutTestAccounts(items, (i) => i.parentId, new Set())).toHaveLength(3);
  });

  test("AP-05 Oggi, lista d'attesa: un account di prova non entra nella nota 'registrate senza invio'", () => {
    const w: WaitlistLike = {
      id: "w",
      email: "uxtest@example.com",
      status: "nuovo",
      createdAt: "2026-10-22T08:00:00Z",
      invitedAt: null,
      account: { id: TEST_ID, createdAt: "2026-10-22T08:30:00Z", betaCode: "TRAMABETA26", isTest: true },
    };
    const real: WaitlistLike = { ...w, id: "w2", account: { ...w.account!, id: REAL_ID, isTest: false } };
    expect(waitlistQueue([w]).registeredNotMarked).toHaveLength(0);
    expect(waitlistQueue([w, real]).registeredNotMarked.map((x) => x.id)).toEqual(["w2"]);
    expect(waitlistQueue([w]).queue).toHaveLength(0);
  });

  test("AP-06 Funnel: le richieste degli account di prova sono dichiarate escluse", () => {
    const rows = computePreFunnel(
      { landingViews: [], requests: [], accounts: [], excludedAccounts: 13, excludedRequests: 1 },
      { preset: "custom", from: "2026-11-01", to: "2026-11-17", label: "1–17 nov" }
    );
    expect(rows.find((r) => r.key === "richieste")!.rule).toContain("(1 in tutto)");
  });

  test("AP-07 script dati: 14 id esatti, non i 3 tenuti fuori, rieseguibile, nessun altro dato toccato", () => {
    const sql = read("supabase/dati_account_prova_20261117.sql");
    const lines = sql.split("\n");
    expect(lines[1]).toContain("NON ESEGUIRE IN AUTOMATICO");
    // deploy.sh propone solo i file con questa seconda riga esatta: qui non c'è.
    expect(lines[1].trim()).not.toBe("-- STATO: PREPARATA, NON APPLICATA");
    const updateBlock = sql.slice(sql.indexOf("-- ── Passo 2"), sql.indexOf("-- ── Passo 3"));
    const ids = updateBlock.match(/'[0-9a-f-]{36}'/g) ?? [];
    expect(ids).toHaveLength(14);
    expect(new Set(ids).size).toBe(14);
    expect(updateBlock).toContain(`'${TEST_ID}'`);
    for (const kept of ["luca.d.magi", "mariafpoli", "ppirulli"]) expect(sql).not.toContain(`-- parent        ${kept}`);
    expect(sql).toContain("select distinct u from unnest(");
    expect(sql).toContain("on conflict (id) do nothing");
    const writes = sql.replace(/--.*$/gm, "");
    expect(writes).not.toMatch(/\bdelete\b/i);
    expect(writes).not.toMatch(/update\s+public\.(profiles|bookings|kids|beta_feedback)/i);
    // Anteprima e passo 2 elencano gli stessi id.
    const previewIds = (sql.slice(sql.indexOf("-- ── Passo 1"), sql.indexOf("-- ── Passo 2")).match(/'[0-9a-f-]{36}'/g) ?? []).sort();
    expect(previewIds).toEqual([...ids].sort());
  });

  test("AP-08 tutti i report Admin leggono la stessa lista", () => {
    expect(read("lib/data/admin-ops.ts")).toContain("export async function getTestAccountIds()");
    const cc = read("lib/data/command-center.ts");
    expect(cc).toContain("viewAdminBooking(b, today, testAccounts)");
    expect(cc).toContain("viewInquiry(r, today, testAccounts)");
    expect(cc).toContain("withoutTestAccounts(feedbackNewAll, (f) => f.parentId, testAccounts)");
    expect(read("app/admin/bookings/page.tsx")).toContain("viewAdminBooking(r, today, testAccounts)");
    expect(read("app/admin/bookings/[id]/page.tsx")).toContain("await getTestAccountIds()");
    expect(read("app/admin/richieste/page.tsx")).toContain("viewInquiry(r, today, testAccounts)");
    expect(read("app/admin/segnalazioni-beta/page.tsx")).toContain("withoutTestAccounts(all, (f) => f.parentId, testAccounts, showTest)");
    expect(read("app/admin/one/pilot/page.tsx")).toContain("withoutTestAccounts(allUsers, (u) => u.id, testAccounts, showTest)");
    expect(read("app/admin/famiglie/page.tsx")).toContain("withoutTestAccounts(liveAll, (r) => r.accountId, testIds, showTest)");
    expect(read("app/admin/crescita/page.tsx")).toContain('getWalkthroughAdminSummary("welcome_parent", testAccounts)');
    expect(read("app/admin/preferiti/page.tsx")).toContain("getFavoritesDemandSignal(await getTestAccountIds())");
    expect(read("lib/data/waitlist.ts")).toContain("isTest: testIds.has(p.id)");
    expect(read("lib/data/beta-feedback.ts")).toContain("id, parent_id, app_source");
    expect(read("app/admin/beta/report/ReportSettingsForm.tsx")).toContain("Account di prova (esclusi dai conteggi)");
  });
});
