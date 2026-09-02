import { test, expect } from "../fixtures/roles";
import { loginAs, isRealDeployment } from "../fixtures/roles";
import { test as pureTest, expect as pureExpect } from "@playwright/test";
import {
  getUpcomingWeeks,
  computePriorityWeekIndex,
  computeHeroWeeksSummary,
  formatItalianDayMonth,
} from "@/lib/nextgen/planner-insights";
import { responsibilityToneFor } from "@/lib/nextgen/responsibility-tone";
import type { SeasonWeek } from "@/lib/data/planner";

// TRAMA BETA v1.1.1 — FINAL VISUAL CONFORMANCE PASS (punto 15).
// Copre VIS111-01..10. Stesso pattern già stabilito da
// planner-beta-v1-1-1-ui-refinement.spec.ts: i test e2e (fixtures/roles,
// loginAs) richiedono un deploy reale con Supabase configurato — vedi
// isRealDeployment — e vengono skippati (non falliti) in questo sandbox,
// dove non esiste un browser/deploy reale (vedi anche "VISUAL QA NOT
// EXECUTED" nel report finale). I test "pure" (pureTest/pureExpect,
// importati direttamente da "@playwright/test") girano invece in QUALUNQUE
// ambiente perché esercitano funzioni pure di lib/ senza DOM né Supabase:
// getUpcomingWeeks/computePriorityWeekIndex (già esistenti, invariate da
// questa pass) e responsibilityToneFor (nuovo helper estratto dal punto 8,
// vedi lib/nextgen/responsibility-tone.ts).

function makeWeek(overrides: Partial<SeasonWeek> & { index: number }): SeasonWeek {
  return {
    label: `SETT ${overrides.index}`,
    dateRange: "1-5/6",
    startDate: `2026-06-${String(overrides.index).padStart(2, "0")}`,
    endDate: `2026-06-${String(overrides.index).padStart(2, "0")}`,
    covered: false,
    coveredKids: [],
    dismissed: false,
    awaitingPartnerConfirmation: false,
    dayBookingOnly: false,
    ...overrides,
  };
}

pureTest.describe("TRAMA BETA v1.1.1 — VIS111-02: getUpcomingWeeks/computePriorityWeekIndex (regressione pura, punto 2)", () => {
  // Riproduce lo stato REALE verificato via query Supabase read-only durante
  // l'indagine del punto 2 (parent_id 19fb4a74-...ce36d9351ecf, oggi in
  // Settimana 14): le uniche 3 settimane non passate (14/15/16) sono TUTTE
  // già covered=true -> zero settimane qualificano per upcomingWeeks, che è
  // il comportamento CORRETTO del filtro, non un bug. Questo test blocca
  // qualunque regressione futura che rompesse silenziosamente quella logica.
  pureTest("VIS111-02a - nessuna settimana futura scoperta -> upcomingWeeks/priorityWeek vuoti (stato reale riprodotto)", () => {
    const today = "2026-09-02";
    const weeks: SeasonWeek[] = [
      ...Array.from({ length: 13 }, (_, i) => makeWeek({ index: i + 1, endDate: "2026-08-01", covered: false })),
      makeWeek({ index: 14, startDate: "2026-08-31", endDate: "2026-09-04", covered: true }),
      makeWeek({ index: 15, startDate: "2026-09-07", endDate: "2026-09-11", covered: true }),
      makeWeek({ index: 16, startDate: "2026-09-14", endDate: "2026-09-18", covered: true }),
    ];
    const priorityIndex = computePriorityWeekIndex(weeks, today);
    pureExpect(priorityIndex).toBeNull();
    pureExpect(getUpcomingWeeks(weeks, today, 3, 1, priorityIndex)).toHaveLength(0);
  });

  // Caso complementare, richiesto esplicitamente dal punto 15
  // ("Upcoming Weeks presente con almeno una settimana futura scoperta"):
  // se ESISTE una settimana futura non coperta, deve comparire sia in
  // upcomingWeeks sia come priorityWeek — verifica che il filtro
  // (!covered && !dismissed && !isPast) funzioni anche nel verso positivo,
  // non solo in quello (corretto) che esclude tutto per l'account di test
  // reale.
  pureTest("VIS111-02b - una settimana 16 futura e scoperta -> compare in upcomingWeeks ed è la priorityWeek", () => {
    const today = "2026-09-02";
    const weeks: SeasonWeek[] = [
      ...Array.from({ length: 13 }, (_, i) => makeWeek({ index: i + 1, endDate: "2026-08-01", covered: false })),
      makeWeek({ index: 14, startDate: "2026-08-31", endDate: "2026-09-04", covered: true }),
      makeWeek({ index: 15, startDate: "2026-09-07", endDate: "2026-09-11", covered: true }),
      makeWeek({ index: 16, startDate: "2026-09-14", endDate: "2026-09-18", covered: false }),
    ];
    const priorityIndex = computePriorityWeekIndex(weeks, today);
    pureExpect(priorityIndex).toBe(16);
    const upcoming = getUpcomingWeeks(weeks, today, 3, 1, priorityIndex);
    pureExpect(upcoming.map((w) => w.index)).toContain(16);
  });

  // Le settimane passate e mai coperte (1-13 nel caso reale) restano
  // escluse anche se "scoperte" in senso letterale: sono chiuse, non c'è
  // più nulla da organizzare per loro (vedi WeekStatus "past").
  pureTest("VIS111-02c - settimane passate e scoperte restano escluse da upcomingWeeks (isPast)", () => {
    const today = "2026-09-02";
    const weeks: SeasonWeek[] = [makeWeek({ index: 1, startDate: "2026-06-01", endDate: "2026-06-05", covered: false })];
    pureExpect(getUpcomingWeeks(weeks, today, 3, 1, null)).toHaveLength(0);
  });
});

// TRAMA BETA v1.1.1 — FINAL HERO SEMANTIC FIX. computeHeroWeeksSummary è
// una funzione pura (nessun DOM/Supabase): copre HERO-SEM-01..03 senza
// bisogno di un browser/deploy reale.
pureTest.describe("TRAMA BETA v1.1.1 — HERO-SEM-01..03: computeHeroWeeksSummary (Coverage Hero, FINAL HERO SEMANTIC FIX)", () => {
  pureTest("HERO-SEM-01 - 13 settimane passate non coperte + 3 future coperte -> hero mostra 3/3 future + 'Tutto organizzato'", () => {
    const today = "2026-09-02";
    const weeks: SeasonWeek[] = [
      ...Array.from({ length: 13 }, (_, i) => makeWeek({ index: i + 1, endDate: "2026-08-01", covered: false })),
      makeWeek({ index: 14, startDate: "2026-08-31", endDate: "2026-09-04", covered: true }),
      makeWeek({ index: 15, startDate: "2026-09-07", endDate: "2026-09-11", covered: true }),
      makeWeek({ index: 16, startDate: "2026-09-14", endDate: "2026-09-18", covered: true }),
    ];
    const summary = computeHeroWeeksSummary(weeks, today);
    pureExpect(summary.hasFutureRelevant).toBe(true);
    pureExpect(summary.futureCovered).toBe(3);
    pureExpect(summary.futureTotal).toBe(3);
    pureExpect(summary.futurePercent).toBe(100);
    pureExpect(summary.lastFutureEndDate).toBe("2026-09-18");
    pureExpect(formatItalianDayMonth(summary.lastFutureEndDate!)).toBe("18 settembre");
    // priorityWeek deve essere null in questo scenario (nessuna settimana
    // futura scoperta) -> il Coverage Hero mostra "Tutto organizzato fino
    // al 18 settembre", non "Prossimo passo" (nessuna CTA artificiale).
    pureExpect(computePriorityWeekIndex(weeks, today)).toBeNull();
  });

  pureTest("HERO-SEM-02 - 2 future coperte + 1 future scoperta -> hero mostra 2/3 + prossimo passo", () => {
    const today = "2026-09-02";
    const weeks: SeasonWeek[] = [
      ...Array.from({ length: 13 }, (_, i) => makeWeek({ index: i + 1, endDate: "2026-08-01", covered: false })),
      makeWeek({ index: 14, startDate: "2026-08-31", endDate: "2026-09-04", covered: true }),
      makeWeek({ index: 15, startDate: "2026-09-07", endDate: "2026-09-11", covered: true }),
      makeWeek({ index: 16, startDate: "2026-09-14", endDate: "2026-09-18", covered: false }),
    ];
    const summary = computeHeroWeeksSummary(weeks, today);
    pureExpect(summary.hasFutureRelevant).toBe(true);
    pureExpect(summary.futureCovered).toBe(2);
    pureExpect(summary.futureTotal).toBe(3);
    pureExpect(summary.futurePercent).toBe(67);
    // priorityWeek esiste (Settimana 16, l'unica futura scoperta) -> il
    // Coverage Hero mostra "Prossimo passo: completa la Settimana 16".
    pureExpect(computePriorityWeekIndex(weeks, today)).toBe(16);
  });

  pureTest("HERO-SEM-03 - nessuna settimana futura rilevante -> stato conclusivo, nessuna CTA artificiale", () => {
    const today = "2026-09-02";
    // Tutte le settimane sono passate (endDate < today) oppure escluse dal
    // perimetro organizzabile (dismissed) -> nessuna settimana "futura
    // rilevante", stagione di fatto conclusa.
    const weeks: SeasonWeek[] = [
      ...Array.from({ length: 15 }, (_, i) => makeWeek({ index: i + 1, endDate: "2026-08-01", covered: i < 10 })),
      makeWeek({ index: 16, startDate: "2026-09-14", endDate: "2026-09-18", covered: false, dismissed: true }),
    ];
    const summary = computeHeroWeeksSummary(weeks, today);
    pureExpect(summary.hasFutureRelevant).toBe(false);
    pureExpect(summary.futureTotal).toBe(0);
    pureExpect(summary.futureCovered).toBe(0);
    pureExpect(summary.lastFutureEndDate).toBeNull();
    // Nessuna settimana futura rilevante -> nessuna CTA "Prossimo passo"
    // possibile in questo scenario (priorityWeek richiede sempre
    // !isPast, coerentemente vuoto qui).
    pureExpect(computePriorityWeekIndex(weeks, today)).toBeNull();
  });
});

pureTest.describe("TRAMA BETA v1.1.1 — VIS111-07/08/10: responsibilityToneFor (regressione pura, punto 8)", () => {
  pureTest("VIS111-07a - responsabile 'io' -> tono 'mine' (verde, stato positivo)", () => {
    pureExpect(responsibilityToneFor("io")).toBe("mine");
  });

  // Punto 8: qualunque persona DIVERSA da "io" deve ricadere sullo STESSO
  // tono informativo "other" — il colore comunica lo stato dell'assegnazione
  // ("qualcun altro se ne occupa"), non l'identità di chi è stato scelto.
  pureTest("VIS111-07b - qualunque responsabile diverso da 'io' -> tono 'other' (stesso tono per tutti, non per identità)", () => {
    const others: Array<"partner" | "nonno" | "nonna" | "tata" | "altro"> = ["partner", "nonno", "nonna", "tata", "altro"];
    for (const value of others) {
      pureExpect(responsibilityToneFor(value)).toBe("other");
    }
    // Nessuna differenza di stato tra "partner" e "nonna": stesso tono.
    pureExpect(responsibilityToneFor("partner")).toBe(responsibilityToneFor("nonna"));
  });

  pureTest("VIS111-08 - nessun responsabile (null/undefined) -> tono 'unassigned' (neutro, CTA 'Assegna')", () => {
    pureExpect(responsibilityToneFor(null)).toBe("unassigned");
    pureExpect(responsibilityToneFor(undefined)).toBe("unassigned");
  });

  pureTest("VIS111-10 - i tre toni sono valori distinti e testuali (lo stato non dipende solo da un colore)", () => {
    // Il valore di ritorno è una stringa semantica ("mine"/"other"/
    // "unassigned"), non un codice colore: chi consuma questo helper può
    // sempre abbinarci anche un'etichetta testuale, non solo una tinta.
    const tones = new Set([responsibilityToneFor("io"), responsibilityToneFor("partner"), responsibilityToneFor(null)]);
    pureExpect(tones.size).toBe(3);
  });
});

test.describe("TRAMA BETA v1.1.1 — Overview/Tabs/Timeline/Calendario/Chi fa cosa/Floating actions (e2e, punto 15)", () => {
  test("VIS111-01 - l'Overview mostra un Coverage Hero (titolo + progresso + riga di stato), non più il box descrittivo nudo", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    // FINAL HERO SEMANTIC FIX (punto successivo di questa stessa wave): la
    // metrica primaria è ora "X su Y organizzate" (settimane future
    // rilevanti) quando ne esistono, oppure "X di Y settimane organizzate"
    // (rapporto stagionale) nello stato conclusivo — vedi
    // computeHeroWeeksSummary e HERO-SEM-01/02/03 più sotto per la
    // copertura puntuale della logica.
    await expect(page.getByText(/organizzate/)).toBeVisible();
    await expect(page.getByText(/Prossimo passo|Tutto organizzato|Stagione conclusa/)).toBeVisible();
  });

  test("VIS111-03 - 'Riempi settimana'/CTA primaria compare al più una volta, legata a priorityWeek", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    const primaryCtas = page.locator("main button.bg-trama-violet, main a.bg-trama-violet", { hasText: /Riempi/ });
    const count = await primaryCtas.count();
    expect(count).toBeLessThanOrEqual(1);
  });

  test("VIS111-04 - i 4 tab Planner Mode non sono troncati a 390px", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test.");
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    for (const label of ["Organizzazione", "Mappa", "Budget", "Gruppi"]) {
      const tab = page.getByRole("button", { name: label });
      await expect(tab).toBeVisible();
      const box = await tab.boundingBox();
      // Ogni tab deve avere una larghezza reale (>0, non compresso a zero) —
      // lo scroll orizzontale intenzionale resta ammesso (vedi commento in
      // PlannerModeTabs.tsx), quindi non verifichiamo che stiano TUTTI nella
      // viewport, solo che nessuno sia visivamente collassato/tagliato.
      expect(box?.width ?? 0).toBeGreaterThan(20);
    }
  });

  test("VIS111-05 - una riga della Timeline completa è compatta (~48-56px), non una card grande", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Vedi tutte le settimane" }).click();
    const row = page.locator('[id^="week-row-"]').first();
    if (!(await row.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna riga di settimana visibile per l'account di test.");
    }
    const box = await row.boundingBox();
    expect(box?.height ?? 0).toBeLessThan(64);
  });

  test("VIS111-06 - l'intestazione 'Andata'/'Ritorno' è visibile sopra le righe di Chi fa cosa (non solo implicita nell'ordine)", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test con una settimana coperta.");
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    await page.getByRole("button", { name: "Calendario" }).click();
    const coveredDay = page.locator("button:has(span.rounded-full)").first();
    if (!(await coveredDay.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna settimana coperta nel mese corrente per l'account di test.");
    }
    await coveredDay.click();
    await expect(page.getByText("Andata", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Ritorno", { exact: true }).first()).toBeVisible();
  });

  test("VIS111-09 - a 390px i floating button (bell/chat) non coprono righe/CTA/bottom-nav sull'Overview con scroll in fondo", async ({ page }) => {
    test.skip(!isRealDeployment, "Richiede un deploy con Supabase configurato e un account genitore di test.");
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "parent");
    await page.goto("/nextgen/planner");
    // Scrolla il contenitore scrollabile fino in fondo (padding-bottom
    // introdotto in app/nextgen/layout.tsx, punto 10).
    await page.evaluate(() => {
      const scroller = document.querySelector(".no-scrollbar.flex-1.overflow-y-auto");
      scroller?.scrollTo(0, scroller.scrollHeight);
    });
    const lastRow = page.locator('[id^="week-row-"]').last();
    if (!(await lastRow.isVisible().catch(() => false))) {
      test.skip(true, "Nessuna riga di settimana visibile per l'account di test.");
    }
    const rowBox = await lastRow.boundingBox();
    const fixedBoxes = await page.evaluate(() => {
      const boxes: { x: number; y: number; width: number; height: number }[] = [];
      document.querySelectorAll("body *").forEach((el) => {
        const style = window.getComputedStyle(el);
        if (style.position === "fixed" || style.position === "absolute") {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.bottom > window.innerHeight - 200) boxes.push({ x: r.x, y: r.y, width: r.width, height: r.height });
        }
      });
      return boxes;
    });
    if (!rowBox) return;
    for (const fb of fixedBoxes) {
      const overlaps =
        rowBox.x < fb.x + fb.width && rowBox.x + rowBox.width > fb.x && rowBox.y < fb.y + fb.height && rowBox.y + rowBox.height > fb.y;
      expect(overlaps).toBe(false);
    }
  });
});
