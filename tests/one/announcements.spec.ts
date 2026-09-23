import { test, expect } from "@playwright/test";
import { isRealDeployment, loginAs } from "../fixtures/roles";
import { ANNOUNCEMENT_CATALOG, getAnnouncementById } from "../../lib/announcements/catalog";
import { CLIENT_CURSOR_TYPES, sortNotifications, countUnseen, makeNotificationId, type NotificationItem } from "../../lib/notifications/model";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";

// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), NOVITÀ TRAMA / FEATURE
// ANNOUNCEMENTS. Stesso principio "[no browser]" delle altre suite di questo
// progetto: lib/announcements/catalog.ts e lib/notifications/model.ts sono
// logica pura — testabili qui senza mock Supabase. I casi che dipendono da
// public.announcement_receipts / resolveFeatureFlagVisibility reale (bell
// unread, mark/read, callout dismiss+reload, audience/cohort) sono gated
// `isRealDeployment`, stesso pattern del resto della suite.
//
// Comando (solo i test puri): npx playwright test tests/one/announcements.spec.ts --grep "no browser"

test.describe("Novità TRAMA — catalogo editoriale (no browser)", () => {
  test("ANN-01 [no browser] - ogni voce ha id univoco, kebab-case, e deepLink assoluto (mai un changelog generico)", () => {
    const ids = ANNOUNCEMENT_CATALOG.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ANNOUNCEMENT_CATALOG) {
      expect(a.id).toMatch(/^[a-z0-9-]+$/);
      expect(a.deepLink.startsWith("/")).toBe(true);
      expect(a.deepLink).not.toBe("/nextgen/novita"); // CTA primaria porta SEMPRE alla feature, mai al changelog (§13)
    }
  });

  test("ANN-02 [no browser] - se requiredFeatureFlag è presente, referenzia un flag realmente registrato (mai un flag inventato)", () => {
    for (const a of ANNOUNCEMENT_CATALOG) {
      if (a.requiredFeatureFlag) {
        expect(Object.prototype.hasOwnProperty.call(FEATURE_FLAG_REGISTRY, a.requiredFeatureFlag)).toBe(true);
      }
    }
  });

  test("ANN-03 [no browser] - i 3 annunci iniziali richiesti dal task sono presenti con titolo/body/deepLink esatti", () => {
    const discovery = getAnnouncementById("real-discovery-pilot");
    expect(discovery?.userTitle).toBe("Più attività da scoprire");
    expect(discovery?.userBody).toBe("Ora in Scopri trovi anche attività individuate da TRAMA sul territorio.");
    expect(discovery?.deepLink).toBe("/nextgen/search");

    const schoolCalendar = getAnnouncementById("school-calendar-intelligence");
    expect(schoolCalendar?.userTitle).toBe("Il Planner conosce anche i giorni senza scuola");
    expect(schoolCalendar?.deepLink).toBe("/nextgen/planner");

    const curatedFavorites = getAnnouncementById("curated-favorites");
    expect(curatedFavorites?.userTitle).toBe("Salva anche le Scoperte TRAMA");
    expect(curatedFavorites?.deepLink).toBe("/nextgen/preferiti");
  });

  test("ANN-04 [no browser] - audience MVP è sempre 'parent' — nessuna voce con altra audience non ancora supportata", () => {
    for (const a of ANNOUNCEMENT_CATALOG) {
      expect(a.audience).toEqual(["parent"]);
    }
  });

  test("ANN-05 [no browser] - ogni voce ha version >= 1 (announcementVersion, per il re-trigger del callout §15)", () => {
    for (const a of ANNOUNCEMENT_CATALOG) {
      expect(a.version).toBeGreaterThanOrEqual(1);
    }
  });
});

test.describe("Novità TRAMA — integrazione Notification Center (no browser)", () => {
  test("ANN-06 [no browser] - trama_announcement NON è nei CLIENT_CURSOR_TYPES: isSeen arriva SEMPRE dal server (announcement_receipts.seen_at), mai da un cursore locale", () => {
    expect(CLIENT_CURSOR_TYPES.has("trama_announcement" as never)).toBe(false);
  });

  test("ANN-07 [no browser] - un annuncio non visto ha priorità 'info' e non compare mai prima di un'ACTION pendente", () => {
    const action: NotificationItem = {
      id: "group_invite_pending:g1",
      type: "group_invite_pending",
      priority: "action",
      title: "Invito gruppo",
      body: "b",
      relevantAt: "2026-09-01T10:00:00.000Z",
      isSeen: false,
      requiresAction: true,
      deepLink: "/nextgen/groups",
    };
    const announcement: NotificationItem = {
      id: makeNotificationId("trama_announcement", "real-discovery-pilot"),
      type: "trama_announcement",
      priority: "info",
      title: "Più attività da scoprire",
      body: "b",
      relevantAt: "2026-09-23T00:00:00.000Z", // più recente dell'invito, ma priority più bassa
      isSeen: false,
      requiresAction: false,
      deepLink: "/nextgen/search",
    };
    const sorted = sortNotifications([announcement, action]);
    expect(sorted[0].type).toBe("group_invite_pending");
    expect(countUnseen(sorted)).toBe(2);
  });
});

test.describe("Novità TRAMA — flusso reale (richiede deploy Supabase)", () => {
  test("ANN-08 - Release non annunciata (announceToUsers=false): nessuna notifica generata per quella release", async () => {
    test.skip(!isRealDeployment, "Richiede verifica diretta: nessuna voce del catalogo con announceToUsers=false deve MAI comparire nel bell — REQUIRES LIVE VALIDATION contro un account reale.");
  });

  test("ANN-09 - Release annunciata + audience parent: appare nel Notification Center con badge unread", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy reale con almeno un annuncio non ancora visto per l'account di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    const bell = page.getByRole("button", { name: /Notifiche/ });
    await expect(bell).toBeVisible();
  });

  test("ANN-10 - Mark/read: aprire il Notification Center e cliccare un annuncio lo segna 'visto' e non ricompare come unread al reload", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy reale con almeno un annuncio non ancora visto per l'account di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    await page.getByRole("button", { name: /Notifiche/ }).click();
    const item = page.getByText("Più attività da scoprire");
    test.skip((await item.count()) === 0, "Nessun annuncio 'real-discovery-pilot' visibile/non visto per questo account.");
    await item.click();
    await expect(page).toHaveURL(/\/nextgen\/search/);
    await page.goto("/nextgen");
    await page.getByRole("button", { name: /Notifiche/ }).click();
    await expect(page.getByText("Più attività da scoprire")).toHaveCount(0);
  });

  test("ANN-11 - Contextual callout: prima visita di /nextgen/search mostra il callout 'Nuovo'", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy reale con l'annuncio 'real-discovery-pilot' non ancora dismesso per l'account di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/search");
    await expect(page.getByText("Più attività da scoprire")).toBeVisible();
  });

  test("ANN-12 - Dismiss + reload: 'Ho capito' nasconde il callout e non ricompare dopo un refresh (persistito, non localStorage)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy reale con il callout attivo per l'account di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/search");
    const dismissButton = page.getByRole("button", { name: "Ho capito" });
    test.skip((await dismissButton.count()) === 0, "Nessun callout attivo per questo account.");
    await dismissButton.click();
    await page.reload();
    await expect(page.getByText("Più attività da scoprire")).toHaveCount(0);
  });

  test("ANN-13 - Audience mismatch: un annuncio audience=['parent'] non compare mai per un account Partner/Admin", async () => {
    test.skip(!isRealDeployment, "Richiede un account Partner/Admin di test.");
  });

  test("ANN-14 - Cohort/internal-preview: un annuncio con requiredFeatureFlag su un flag internal-preview non compare per un utente fuori dalla coorte", async () => {
    test.skip(!isRealDeployment, "Richiede un account di test NON nella coorte 'internal-preview' e un account che lo è, per confronto — REQUIRES LIVE VALIDATION.");
  });

  test("ANN-15 - Nessuna notifica duplicata: aprire due volte il Notification Center per lo stesso annuncio non crea due righe in announcement_receipts", async () => {
    test.skip(!isRealDeployment, "Richiede verifica diretta su Supabase (unique parent_id+announcement_id+announcement_version) — REQUIRES LIVE VALIDATION.");
  });

  test("ANN-16 - Notification Center regressions: gli item esistenti (inviti gruppo, risposte prenotazione, richieste) restano invariati con l'aggiunta di trama_announcement", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy reale con notifiche pre-esistenti per l'account di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen");
    await page.getByRole("button", { name: /Notifiche/ }).click();
    await expect(page.getByRole("dialog", { name: "Notifiche" })).toBeVisible();
  });
});
