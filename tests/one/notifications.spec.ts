import { test, expect } from "@playwright/test";
import { isRealDeployment, loginAs } from "../fixtures/roles";
import {
  NotificationItem,
  applyClientCursor,
  countUnseen,
  makeNotificationId,
  sortNotifications,
} from "../../lib/notifications/model";

// TRAMA — Wave 3 "Actionable In-App Notifications" (audit
// TRAMA_PILOT_ARCHITECTURE_REVIEW.md, implementazione: docs/trama-one/
// analysis/TRAMA_PILOT_NOTIFICATIONS_IMPLEMENTATION.md).
// lib/notifications/model.ts vive SENZA "import server-only" apposta (stesso
// principio già stabilito per lib/pilot/status.ts) — testabile qui senza
// fixture `page` e senza bisogno di un browser reale.
//
// Comando: npx playwright test tests/one/notifications.spec.ts --grep "no browser"

function item(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    id: "group_invite_pending:test",
    type: "group_invite_pending",
    priority: "action",
    title: "t",
    body: "b",
    relevantAt: "2026-08-01T10:00:00.000Z",
    isSeen: false,
    requiresAction: true,
    deepLink: "/nextgen/groups?tab=inviti",
    ...overrides,
  };
}

test.describe("Wave 3 - Notifiche: priorità e ordinamento (no browser)", () => {
  test("NOTIF-P07 [no browser] - ACTION precede IMPORTANT precede INFO", () => {
    const items = [
      item({ id: "a", type: "group_request_accepted", priority: "important" }),
      item({ id: "b", type: "group_invite_pending", priority: "action" }),
      item({ id: "c", type: "group_request_accepted", priority: "info" }),
    ];
    const sorted = sortNotifications(items);
    expect(sorted.map((i) => i.priority)).toEqual(["action", "important", "info"]);
  });

  test("NOTIF-P07 [no browser] - a parità di priorità vince il più recente", () => {
    const older = item({ id: "older", relevantAt: "2026-08-01T10:00:00.000Z" });
    const newer = item({ id: "newer", relevantAt: "2026-08-05T10:00:00.000Z" });
    const sorted = sortNotifications([older, newer]);
    expect(sorted[0].id).toBe("newer");
  });
});

test.describe("Wave 3 - Notifiche: badge (no browser)", () => {
  test("NOTIF-P08 [no browser] - countUnseen conta solo isSeen=false, non il totale", () => {
    const items = [item({ id: "a", isSeen: true }), item({ id: "b", isSeen: false }), item({ id: "c", isSeen: false })];
    expect(countUnseen(items)).toBe(2);
  });
});

test.describe("Wave 3 - Notifiche: seen ≠ resolved (no browser)", () => {
  test("NOTIF-P09 [no browser] - group_invite_pending resta SEMPRE non visto, anche con un cursore nel futuro", () => {
    const pendingInvite = item({ id: "x", type: "group_invite_pending", relevantAt: "2026-08-01T10:00:00.000Z", isSeen: false });
    const futureCursor = "2030-01-01T00:00:00.000Z";
    const result = applyClientCursor([pendingInvite], futureCursor);
    expect(result[0].isSeen).toBe(false);
  });

  test("NOTIF-P09 [no browser] - group_request_accepted/carpool_* diventano visti SOLO se relevantAt <= cursore", () => {
    const accepted = item({
      id: "y",
      type: "group_request_accepted",
      priority: "important",
      relevantAt: "2026-08-01T10:00:00.000Z",
      isSeen: false,
    });
    const beforeCursor = applyClientCursor([accepted], "2026-07-31T00:00:00.000Z"); // cursore PRIMA della notifica
    expect(beforeCursor[0].isSeen).toBe(false);
    const afterCursor = applyClientCursor([accepted], "2026-08-02T00:00:00.000Z"); // cursore DOPO
    expect(afterCursor[0].isSeen).toBe(true);
  });

  test("NOTIF-P09 [no browser] - inquiry_reply/booking_response non sono mai toccati dal cursore client (isSeen reale dal server)", () => {
    const reply = item({ id: "z", type: "inquiry_reply", priority: "important", isSeen: false, relevantAt: "2026-01-01T00:00:00.000Z" });
    const result = applyClientCursor([reply], "2030-01-01T00:00:00.000Z");
    expect(result[0].isSeen).toBe(false); // il cursore NON si applica a questo tipo
  });
});

test.describe("Wave 3 - Notifiche: deduplica (no browser)", () => {
  test("NOTIF-P10 [no browser] - makeNotificationId è deterministico: stesso type+entityId -> stesso id sempre", () => {
    const id1 = makeNotificationId("group_invite_pending", "abc-123");
    const id2 = makeNotificationId("group_invite_pending", "abc-123");
    expect(id1).toBe(id2);
    expect(id1).toBe("group_invite_pending:abc-123");
  });

  test("NOTIF-P10 [no browser] - due letture dello stesso stato di dominio producono la STESSA lista, mai duplicati", () => {
    // Simula due letture consecutive della stessa condizione (es. lo stesso
    // invito pending letto due volte): l'id deterministico garantisce che
    // unendo le due liste (come farebbe un merge ingenuo) non compaiano due
    // righe per lo stesso invito.
    const reading1 = [item({ id: makeNotificationId("group_invite_pending", "inv-1") })];
    const reading2 = [item({ id: makeNotificationId("group_invite_pending", "inv-1") })];
    const merged = new Map([...reading1, ...reading2].map((i) => [i.id, i]));
    expect(merged.size).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────
// Verifica end-to-end su deploy reale. Nessuna fixture dedicata "genitore
// con invito/risposta/carpool pendente" esiste in questo progetto: dove lo
// stato reale dell'account di test non è garantito, il test si auto-esclude
// (test.skip) invece di fallire un run legittimo — stesso pattern già usato
// in tests/one/pilot-observability.spec.ts.
// ────────────────────────────────────────────────────────────────

test.describe("Wave 3 - Notification Center UI", () => {
  test("NOTIF-P00 - Il bottone Notifiche è presente e apre il center senza errori", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account parent.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    const bell = page.getByRole("button", { name: /Notifiche/ });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(page.getByRole("dialog", { name: "Notifiche" })).toBeVisible();
  });

  test("NOTIF-P01 - Nessuna notifica -> empty state corretto", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    await page.getByRole("button", { name: /Notifiche/ }).click();
    const emptyState = page.getByText("Nessuna notifica al momento.");
    const hasItems = await page.getByRole("listitem").count();
    if (hasItems > 0) {
      test.skip(true, "L'account di test ha già almeno una notifica reale: empty state non verificabile in questo run.");
    }
    await expect(emptyState).toBeVisible();
  });

  test("NOTIF-P02/P03 - Invito gruppo pendente: notification visibile e deep link corretto", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un genitore con un invito di gruppo pendente.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    await page.getByRole("button", { name: /Notifiche/ }).click();
    const inviteItem = page.getByText(/Sei stato invitato al gruppo/);
    test.skip((await inviteItem.count()) === 0, "Nessun invito di gruppo pendente per questo account di test.");
    await inviteItem.click();
    // NOTIF-P12 (implicito qui): mai un redirect Legacy — resta sotto /nextgen.
    await expect(page).toHaveURL(/\/nextgen\/groups\?tab=inviti/);
  });

  test("NOTIF-P04/P05 - Risposta del centro a una prenotazione: notification visibile, il tap NON altera lo stato business", async ({
    page,
  }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un genitore con una risposta del centro non letta.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    await page.getByRole("button", { name: /Notifiche/ }).click();
    const bookingItem = page.getByText(/Prenotazione confermata|Prenotazione non confermata|ha una proposta per te/);
    test.skip((await bookingItem.count()) === 0, "Nessuna risposta prenotazione non letta per questo account di test.");
    // NOTIF-P05: markBookingsReadAction (riusata dal tap) tocca SOLO
    // read_by_parent — partner_decision/status restano quelli decisi dal
    // centro, invariati dal click del genitore. Garanzia strutturale già
    // vera per l'azione esistente e non modificata in questa wave (vedi
    // app/actions/booking-response.ts#markBookingsReadAction): qui
    // verifichiamo solo che il click porti alla prenotazione corretta senza
    // errori applicativi.
    await bookingItem.click();
    await expect(page).toHaveURL(/\/nextgen\/prenotazioni\?bookingId=/);
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("NOTIF-P06 - Carpool: un abbinamento rilevante produce una notification visibile", async ({ page }) => {
    test.skip(
      !isRealDeployment,
      "Richiede un deploy con Supabase configurato e un genitore con una richiesta/offerta carpool compatibile in un gruppo."
    );
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    await page.getByRole("button", { name: /Notifiche/ }).click();
    const carpoolItem = page.getByText(/passaggio (disponibile|nel gruppo)/i);
    test.skip((await carpoolItem.count()) === 0, "Nessun abbinamento carpool per questo account di test — REQUIRES LIVE VALIDATION con fixture dedicata.");
    await expect(carpoolItem.first()).toBeVisible();
  });

  test("NOTIF-P11 - Un Partner/Admin non vede il notification center del Genitore", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account platform_admin.");
    await loginAs(page, "platform_admin");
    await page.goto("/nextgen");
    await expect(page.getByRole("button", { name: /Notifiche/ })).toHaveCount(0);
  });

  test("NOTIF-P12 - Nessun deep link porta al Legacy", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un genitore con almeno una notifica.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    await page.getByRole("button", { name: /Notifiche/ }).click();
    const firstItem = page.getByRole("listitem").first();
    test.skip((await firstItem.count()) === 0, "Nessuna notifica per questo account di test.");
    await firstItem.locator("button").click();
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/nextgen\//);
  });

  test("NOTIF-P13 - Home continua a mostrare al massimo un Coordination Signal (preservation)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    const bannerCount =
      (await page.getByText(/accetta o rifiuta/).count()) +
      (await page.getByText(/ha accettato la richiesta del gruppo/).count()) +
      (await page.getByText(/stanno valutando/).count());
    expect(bannerCount).toBeLessThanOrEqual(1);
  });

  test("NOTIF-P14 - mobile: il bottone Notifiche resta dentro lo schermo, nessun overflow orizzontale", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account parent.");
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    const bell = page.getByRole("button", { name: /Notifiche/ });
    await expect(bell).toBeVisible();
    const box = await bell.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    await bell.click();
    const dialog = page.getByRole("dialog", { name: "Notifiche" });
    await expect(dialog).toBeVisible();
    const dialogBox = await dialog.boundingBox();
    expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(375 + 1);
  });

  test("NOTIF-P15 - tastiera: Escape chiude il center e il focus torna al bottone", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account parent.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    const bell = page.getByRole("button", { name: /Notifiche/ });
    await bell.click();
    await expect(page.getByRole("dialog", { name: "Notifiche" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Notifiche" })).toHaveCount(0);
    await expect(bell).toBeFocused();
  });
});
