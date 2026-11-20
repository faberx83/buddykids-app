// TRAMA — Avvisi Admin per la beta (20/11/2026). Iniziativa:
// claude/INIZIATIVA_avvisi_admin_beta.md. Richiesta di Fabrizio: "Attiva
// notifiche per nuovi utenti che entrano, segnalazioni, qualsiasi cosa utile
// per la fase beta."
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { buildAlertMessage, buildDailyDigest, isAlertFromTestAccount, type AdminAlert } from "../../lib/admin-alerts/messages";

const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const ORIGIN = "https://admin.tramapp.it";
const TEST_ID = "c1f68eb3-0ae5-4d7a-86e6-debb9847a5bc";

const newAccount = (confirmed: boolean): AdminAlert => ({
  kind: "new_account",
  userId: "u-1",
  role: "parent",
  email: "famiglia@example.it",
  betaCode: "TRAMABETA26",
  inBeta: true,
  confirmed,
});

test.describe("AA — avvisi Admin", () => {
  test("AA-01 nuovo account: 'da completare' e 'confermato' sono due avvisi distinti, uno per stato", () => {
    const pending = buildAlertMessage(newAccount(false), ORIGIN);
    const ok = buildAlertMessage(newAccount(true), ORIGIN);
    expect(pending.push.title).toBe("Registrazione da completare");
    expect(ok.push.title).toBe("Nuovo account su TRAMA");
    expect(pending.dedupeKey).toBe("new_account:u-1:in_attesa");
    expect(ok.dedupeKey).toBe("new_account:u-1:confermato");
    expect(ok.push.deepLink).toBe("/admin/one/pilot/u-1");
    expect(ok.email!.text).toContain("famiglia@example.it");
    expect(ok.email!.text).toContain("con il codice TRAMABETA26");
    expect(ok.email!.text).toContain(`${ORIGIN}/admin/one/pilot/u-1`);
  });

  test("AA-02 la push non contiene email né testi liberi (schermo bloccato)", () => {
    const alerts: AdminAlert[] = [
      newAccount(true),
      { kind: "beta_feedback", actorId: "u-2", area: "Planner", pagePath: "/nextgen/planner", excerpt: "Mia figlia Sara non compare", category: "bug" },
      { kind: "booking_request", actorId: "u-2", bookingId: "b-1", activityName: "Natale in ludoteca", centerName: "Ludoteca" },
      { kind: "inquiry", actorId: "u-2", inquiryId: "i-1", activityName: "Natale", centerName: "Ludoteca" },
    ];
    for (const a of alerts) {
      const m = buildAlertMessage(a, ORIGIN);
      const pushText = `${m.push.title} ${m.push.body}`;
      expect(pushText).not.toContain("@");
      expect(pushText).not.toContain("Sara");
    }
    const fb = buildAlertMessage(alerts[1], ORIGIN);
    expect(fb.email!.text).toContain("Mia figlia Sara non compare"); // l'email agli Admin sì
    expect(fb.dedupeKey).toBeNull();
  });

  test("AA-03 lista d'attesa, problemi di accesso e candidature: solo push (l'email c'era già)", () => {
    for (const a of [{ kind: "waitlist" }, { kind: "access_problem" }, { kind: "center_lead", centerName: "Centro X" }] as AdminAlert[]) {
      expect(buildAlertMessage(a, ORIGIN).email).toBeNull();
    }
  });

  test("AA-04 nessun avviso per gli account di prova", () => {
    const ids = new Set([TEST_ID]);
    expect(isAlertFromTestAccount({ ...newAccount(true), userId: TEST_ID } as AdminAlert, ids)).toBe(true);
    expect(isAlertFromTestAccount({ kind: "booking_request", actorId: TEST_ID, bookingId: "b", activityName: null, centerName: null }, ids)).toBe(true);
    expect(isAlertFromTestAccount({ kind: "beta_feedback", actorId: TEST_ID, area: "", pagePath: "", excerpt: "", category: null }, ids)).toBe(true);
    expect(isAlertFromTestAccount(newAccount(true), ids)).toBe(false);
    expect(isAlertFromTestAccount({ kind: "waitlist" }, ids)).toBe(false);
  });

  test("AA-05 riepilogo delle 7: solo se è successo qualcosa, con i plurali giusti", () => {
    expect(buildDailyDigest({ newAccounts: 0, feedback: 0, bookings: 0, inquiries: 0, waitlist: 0 }, ORIGIN)).toBeNull();
    const d = buildDailyDigest({ newAccounts: 2, feedback: 1, bookings: 0, inquiries: 3, waitlist: 0 }, ORIGIN)!;
    expect(d.push.body).toBe("2 nuovi account · 1 segnalazione · 3 richieste ai centri");
    expect(d.email.text).toContain("account di prova esclusi");
  });

  test("AA-06 agganci: callback, registrazione, segnalazioni, prenotazioni, richieste, lista d'attesa, accesso, candidature, cron", () => {
    expect(read("app/auth/callback/route.ts")).toContain("await alertNewAccountIfRecent(userId)");
    expect(read("app/actions/legal.ts")).toContain("await alertNewAccountIfRecent(userId)");
    expect(read("app/actions/beta-feedback.ts")).toContain('kind: "beta_feedback"');
    const booking = read("app/booking/[id]/actions.ts");
    // dopo il ritorno anticipato delle attività demo
    expect(booking.indexOf("await notifyBookingToAdmins(")).toBeGreaterThan(booking.indexOf("if (demoAccess.demo) return { bookingId };"));
    expect(read("app/actions/inquiries.ts")).toContain("if (!demoAccess.demo) await notifyInquiryToAdmins(");
    expect(read("app/actions/waitlist.ts")).toContain('if (!already) await notifyAdmins({ kind: "waitlist" })');
    expect(read("app/actions/access-problem.ts")).toContain('await notifyAdmins({ kind: "access_problem" })');
    expect(read("lib/centers/notify-center.ts")).toContain('kind: "center_lead"');
    expect(read("app/api/cron/daily-briefing/route.ts")).toContain("await runAdminDailyAlerts(now)");
  });

  test("AA-07 invio: best effort, interruttore, una volta sola, account di prova esclusi", () => {
    const src = read("lib/admin-alerts/send.ts");
    expect(src).toContain('(env.ADMIN_ALERTS ?? "").trim().toLowerCase() !== "off"');
    expect(src).toContain('.eq("event_name", "admin_alert_sent")');
    expect(src).toContain("isAlertFromTestAccount(alert, testIds)");
    expect(src).toContain("process.env.ADMIN_ALERTS_EMAIL || process.env.WAITLIST_NOTIFY_EMAIL");
    expect(src).toContain('console.error("[admin-alerts] avviso non inviato:", e)');
    expect(src).toContain("isRecentAccount(profile.created_at, now)");
  });
});
