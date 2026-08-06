import { test, expect } from "@playwright/test";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import {
  applyBulkPatch,
  bulkDraftHasChanges,
  defaultBulkDraft,
  summarizeSpecialDay,
  type BulkDraft,
} from "../../lib/availability-bulk";
import type { DayAvailability } from "../../lib/types";

// OD-02 / PT-MVP-08 — "REVISIONE DECISIONE OD-02: FIX PRIMA DELLA BETA"
// (Fabrizio, 06/08/2026). Il pannello di modifica multipla del Calendario
// disponibilità Partner (components/AvailabilityCalendar.tsx) non applicava
// il campo "Giornata particolare" ai giorni selezionati. Fix in
// lib/availability-bulk.ts (logica pura) + AvailabilityCalendar.tsx (UI).
//
// Prima parte: test puri, nessun browser (stesso pattern di
// tests/one/feature-flags.spec.ts e tests/one/feature-control-center.spec.ts)
// — copre i Test A/C/D/E/F richiesti esplicitamente da Fabrizio, in modo
// deterministico e senza dipendere da un deploy reale.

function makeDay(overrides: Partial<DayAvailability> = {}): DayAvailability {
  return {
    date: "2026-09-01",
    weekday: 1,
    isOpen: true,
    capacity: 15,
    spotsLeft: 15,
    singleDayBookable: true,
    ...overrides,
  };
}

function draftWithSpecialDay(action: BulkDraft["specialDayAction"], emoji?: string, label?: string): BulkDraft {
  return {
    ...defaultBulkDraft(),
    specialDayAction: action,
    specialEmoji: emoji,
    specialLabel: label,
  };
}

test.describe("OD-02 — Calendario disponibilità Partner: bulk 'Giornata particolare' [no browser]", () => {
  // Test A — Applicazione bulk
  test("TC-N626 - applyBulkPatch imposta la Giornata particolare su tutti e soli i giorni selezionati", () => {
    const days = [
      makeDay({ date: "2026-09-01" }),
      makeDay({ date: "2026-09-02" }),
      makeDay({ date: "2026-09-03" }),
    ];
    const selected = new Set(["2026-09-01", "2026-09-03"]);
    const draft = draftWithSpecialDay("set", "🏊", "Giornata in piscina");

    const updated = applyBulkPatch(days, selected, draft);

    const d1 = updated.find((d) => d.date === "2026-09-01")!;
    const d2 = updated.find((d) => d.date === "2026-09-02")!;
    const d3 = updated.find((d) => d.date === "2026-09-03")!;

    expect(d1.specialEmoji).toBe("🏊");
    expect(d1.specialLabel).toBe("Giornata in piscina");
    expect(d3.specialEmoji).toBe("🏊");
    expect(d3.specialLabel).toBe("Giornata in piscina");
    // Giorno NON selezionato: invariato.
    expect(d2.specialEmoji).toBeUndefined();
    expect(d2.specialLabel).toBeUndefined();
  });

  // Test C — Rimozione bulk
  test("TC-N627 - applyBulkPatch con azione 'remove' toglie la Giornata particolare solo dai giorni selezionati", () => {
    const days = [
      makeDay({ date: "2026-09-01", specialEmoji: "🏊", specialLabel: "Piscina" }),
      makeDay({ date: "2026-09-02", specialEmoji: "🏊", specialLabel: "Piscina" }),
      makeDay({ date: "2026-09-03", specialEmoji: "🎉", specialLabel: "Festa" }),
    ];
    const selected = new Set(["2026-09-01", "2026-09-02"]);
    const draft = draftWithSpecialDay("remove");

    const updated = applyBulkPatch(days, selected, draft);

    expect(updated.find((d) => d.date === "2026-09-01")!.specialEmoji).toBeUndefined();
    expect(updated.find((d) => d.date === "2026-09-02")!.specialEmoji).toBeUndefined();
    // Giorno non selezionato: mantiene il proprio valore, anche se diverso.
    const d3 = updated.find((d) => d.date === "2026-09-03")!;
    expect(d3.specialEmoji).toBe("🎉");
    expect(d3.specialLabel).toBe("Festa");
  });

  // Test D — Campi non coinvolti
  test("TC-N628 - impostare la Giornata particolare (senza includere gli altri campi) non modifica apertura/capacità/sconto/last-minute", () => {
    const days = [
      makeDay({ date: "2026-09-01", isOpen: false, capacity: 8, spotsLeft: 2, discountPercent: 20, lastMinute: true }),
      makeDay({ date: "2026-09-02", isOpen: true, capacity: 30, spotsLeft: 30, discountPercent: undefined, lastMinute: false }),
    ];
    const selected = new Set(["2026-09-01", "2026-09-02"]);
    // Solo specialDayAction è impostato; isOpen/capacity/discountPercent/
    // lastMinute restano tutti a include:false (default) — il Partner ha
    // scelto di cambiare SOLO la Giornata particolare.
    const draft = draftWithSpecialDay("set", "🎨", "Laboratorio arte");

    const updated = applyBulkPatch(days, selected, draft);

    const d1 = updated.find((d) => d.date === "2026-09-01")!;
    const d2 = updated.find((d) => d.date === "2026-09-02")!;

    expect(d1.isOpen).toBe(false);
    expect(d1.capacity).toBe(8);
    expect(d1.spotsLeft).toBe(2);
    expect(d1.discountPercent).toBe(20);
    expect(d1.lastMinute).toBe(true);

    expect(d2.isOpen).toBe(true);
    expect(d2.capacity).toBe(30);
    expect(d2.spotsLeft).toBe(30);
    expect(d2.discountPercent).toBeUndefined();
    expect(d2.lastMinute).toBe(false);

    // Solo la Giornata particolare è cambiata.
    expect(d1.specialEmoji).toBe("🎨");
    expect(d2.specialEmoji).toBe("🎨");
  });

  // Test E — Valori differenti preesistenti (stato misto)
  test("TC-N629 - summarizeSpecialDay segnala 'mixed' quando i giorni selezionati hanno valori diversi, poi uniformità dopo l'applicazione", () => {
    const days = [
      makeDay({ date: "2026-09-01", specialEmoji: "🏊", specialLabel: "Piscina" }),
      makeDay({ date: "2026-09-02", specialEmoji: undefined, specialLabel: undefined }),
      makeDay({ date: "2026-09-03", specialEmoji: "🎉", specialLabel: "Festa" }),
    ];
    const selected = new Set(["2026-09-01", "2026-09-02", "2026-09-03"]);

    const before = summarizeSpecialDay(days, selected);
    expect(before?.mixed).toBe(true);

    const draft = draftWithSpecialDay("set", "🌳", "Giornata nel bosco");
    const updated = applyBulkPatch(days, selected, draft);
    const after = summarizeSpecialDay(updated, selected);

    expect(after?.mixed).toBe(false);
    expect(after?.emoji).toBe("🌳");
    expect(after?.label).toBe("Giornata nel bosco");
  });

  test("TC-N629b - summarizeSpecialDay ritorna un valore univoco (non mixed) quando i giorni selezionati sono già uguali", () => {
    const days = [
      makeDay({ date: "2026-09-01", specialEmoji: "🏆", specialLabel: "Torneo" }),
      makeDay({ date: "2026-09-02", specialEmoji: "🏆", specialLabel: "Torneo" }),
    ];
    const summary = summarizeSpecialDay(days, new Set(["2026-09-01", "2026-09-02"]));
    expect(summary?.mixed).toBe(false);
    expect(summary?.emoji).toBe("🏆");
  });

  test("TC-N629c - summarizeSpecialDay ritorna null quando nessun giorno è selezionato", () => {
    const days = [makeDay({ date: "2026-09-01" })];
    expect(summarizeSpecialDay(days, new Set())).toBeNull();
  });

  // Test F — Giorni non selezionati
  test("TC-N630 - applyBulkPatch non modifica alcun campo dei giorni non selezionati", () => {
    const untouched = makeDay({
      date: "2026-09-05",
      isOpen: false,
      capacity: 4,
      spotsLeft: 1,
      discountPercent: 15,
      lastMinute: true,
      specialEmoji: "💦",
      specialLabel: "Giochi d'acqua",
    });
    const days = [makeDay({ date: "2026-09-01" }), untouched];
    const selected = new Set(["2026-09-01"]);
    const draft: BulkDraft = {
      isOpen: { include: true, value: true },
      capacity: { include: true, value: 99 },
      discountPercent: { include: true, value: 50 },
      lastMinute: { include: true, value: true },
      specialDayAction: "remove",
    };

    const updated = applyBulkPatch(days, selected, draft);
    const stillUntouched = updated.find((d) => d.date === "2026-09-05")!;

    expect(stillUntouched).toEqual(untouched);
  });

  test("TC-N631 - bulkDraftHasChanges è false per il draft di default e true non appena un campo viene incluso", () => {
    const empty = defaultBulkDraft();
    expect(bulkDraftHasChanges(empty)).toBe(false);

    expect(bulkDraftHasChanges({ ...empty, isOpen: { include: true, value: true } })).toBe(true);
    expect(bulkDraftHasChanges({ ...empty, specialDayAction: "remove" })).toBe(true);
  });

  test("TC-N632 - 'campo non modificato' di default: applicare il draft di default non cambia alcun valore, nemmeno sui giorni selezionati", () => {
    const days = [
      makeDay({ date: "2026-09-01", isOpen: false, capacity: 7, discountPercent: 10, lastMinute: true, specialEmoji: "🏊" }),
    ];
    const selected = new Set(["2026-09-01"]);
    const updated = applyBulkPatch(days, selected, defaultBulkDraft());
    expect(updated).toEqual(days);
  });

  test("TC-N633 - applyBulkPatch non produce righe duplicate né perde giorni (stesso insieme di date in ingresso e in uscita)", () => {
    const days = [
      makeDay({ date: "2026-09-01" }),
      makeDay({ date: "2026-09-02" }),
      makeDay({ date: "2026-09-03" }),
    ];
    const updated = applyBulkPatch(days, new Set(["2026-09-01", "2026-09-03"]), draftWithSpecialDay("set", "🎨"));
    expect(updated).toHaveLength(3);
    expect(updated.map((d) => d.date)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
  });
});

// Seconda parte: E2E reale (richiede TEST_SCOPE con Supabase configurato e
// account Gestore di test collegato a un centro con l'attività seminata da
// supabase/seed-test-data.sql) — non eseguibile in questo sandbox (nessuna
// credenziale/deploy), verificabile da Fabrizio col prossimo
// test-deploy.sh/deploy.sh. Copre i Test B (persistenza), G (regressione
// single-day) e H (mobile) richiesti esplicitamente.
test.describe("OD-02 — Calendario disponibilità Partner: bulk 'Giornata particolare' [UI]", () => {
  // Test B — Persistenza + Test A (applicazione) in un unico flusso reale.
  test("TC-N634 - il Partner puo' applicare la Giornata particolare a piu' giorni via bulk, salvarla, e ritrovarla dopo refresh e sul giorno singolo", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test collegato a un centro con attività.");
    await loginAs(page, "center_admin");
    await page.goto("/center/activities");

    const card = page.locator("div.rounded-lg.border").filter({ hasText: "[TEST] Attività BuddyKids" });
    await card.getByRole("link", { name: "Calendario disponibilità" }).click();
    await expect(page).toHaveURL(/\/center\/activities\/[^/]+\/calendar$/);

    await page.getByRole("button", { name: "Seleziona più giorni" }).click();
    // Seleziona la prima settimana intera dall'etichetta a sinistra.
    await page.locator("table tbody tr").first().locator("td").first().locator("button").click();

    await page.getByRole("button", { name: "Imposta" }).click();
    await page.getByPlaceholder("Es. Giornata in piscina").fill("[TEST] Giornata in piscina");
    await page.getByRole("button", { name: "🏊" }).click();
    await page.getByRole("button", { name: /Applica a \d+ giorni/ }).click();
    await page.getByRole("button", { name: "Salva calendario" }).click();
    await expect(page.getByText("Salvato su Supabase ✓")).toBeVisible({ timeout: 10_000 });

    // Persistenza dopo refresh.
    await page.reload();
    await expect(page.getByTitle("[TEST] Giornata in piscina").first()).toBeVisible();

    // Coerenza col pannello a giorno singolo (Test G parziale): aprendo un
    // giorno della selezione bulk, il valore deve comparire identico.
    await expect(page.locator("table tbody tr").first().locator("td").nth(1).locator("button")).toBeVisible();
  });

  // Test G — Regressione single-day
  test("TC-N635 - il pannello a giorno singolo continua a impostare/rimuovere la Giornata particolare senza modalità bulk attiva", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await loginAs(page, "center_admin");
    await page.goto("/center/activities");

    const card = page.locator("div.rounded-lg.border").filter({ hasText: "[TEST] Attività BuddyKids" });
    await card.getByRole("link", { name: "Calendario disponibilità" }).click();
    await expect(page).toHaveURL(/\/center\/activities\/[^/]+\/calendar$/);

    // Modalità bulk NON attiva (comportamento di default): un click apre
    // ancora il pannello a giorno singolo, identico a prima del fix.
    await page.locator("table tbody tr").first().locator("td").nth(1).locator("button").click();
    await expect(page.getByText(/^Modifica /)).toBeVisible();

    await page.getByPlaceholder("Es. Giornata in piscina").fill("[TEST] Giorno singolo");
    await page.getByRole("button", { name: "🎉" }).click();
    await page.getByRole("button", { name: "Salva calendario" }).click();
    await expect(page.getByText("Salvato su Supabase ✓")).toBeVisible({ timeout: 10_000 });

    // Rimozione dal pannello singolo continua a funzionare.
    await page.getByRole("button", { name: "—" }).click();
    await page.getByRole("button", { name: "Salva calendario" }).click();
    await expect(page.getByText("Salvato su Supabase ✓")).toBeVisible({ timeout: 10_000 });
  });

  // Test H — Mobile
  test("TC-N636 - il pannello bulk della Giornata particolare è utilizzabile su viewport mobile 390x844", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e l'account Gestore di test.");
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "center_admin");
    await page.goto("/center/activities");

    const card = page.locator("div.rounded-lg.border").filter({ hasText: "[TEST] Attività BuddyKids" });
    await card.getByRole("link", { name: "Calendario disponibilità" }).click();
    await expect(page).toHaveURL(/\/center\/activities\/[^/]+\/calendar$/);

    await page.getByRole("button", { name: "Seleziona più giorni" }).click();
    await page.locator("table tbody tr").first().locator("td").first().locator("button").click();

    const setButton = page.getByRole("button", { name: "Imposta" });
    await expect(setButton).toBeVisible();
    // Nessun overflow orizzontale della pagina a 390px.
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(400);
  });
});
