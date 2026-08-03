import { test, expect } from "@playwright/test";
import { computeCutoutRect, computePopoverPosition, matchesSpotlightRoute } from "../../lib/spotlight/position";

// CONTROLLED BETA EXPERIENCE GATE (§7-14) — unit test puri per
// lib/spotlight/position.ts, stesso principio "no browser" già usato in
// tests/one/feature-flags.spec.ts: nessun "page" fixture, funzioni pure
// eseguite direttamente, eseguibili in qualunque ambiente Node incluso il
// sandbox Claude (nessun browser reale disponibile).
//
// Comando: npx playwright test tests/one/spotlight-position.spec.ts

test.describe("Spotlight — computePopoverPosition [no browser]", () => {
  test("target in alto nella viewport -> popover sotto (spazio sufficiente sotto)", () => {
    const target = { top: 50, left: 100, width: 120, height: 40 };
    const viewport = { width: 1280, height: 900 };
    const result = computePopoverPosition(target, viewport, 180);
    expect(result.placement).toBe("bottom");
    expect(result.top).toBe(50 + 40 + 12); // target.top + target.height + GAP
  });

  test("target in basso nella viewport, poco spazio sotto ma molto sopra -> popover sopra", () => {
    const target = { top: 800, left: 100, width: 120, height: 40 };
    const viewport = { width: 1280, height: 900 };
    // spaceBelow = 900 - 840 = 60 (< 180+12), spaceAbove = 800 (>> spaceBelow)
    const result = computePopoverPosition(target, viewport, 180);
    expect(result.placement).toBe("top");
    expect(result.top).toBe(800 - 180 - 12);
  });

  test("target vicinissimo al bordo superiore con poco spazio sia sopra che sotto -> resta 'bottom' (spaceBelow >= spaceAbove)", () => {
    const target = { top: 10, left: 100, width: 120, height: 20 };
    const viewport = { width: 1280, height: 100 };
    // spaceBelow = 100 - 30 = 70, spaceAbove = 10 -> spaceBelow >= spaceAbove -> bottom
    const result = computePopoverPosition(target, viewport, 180);
    expect(result.placement).toBe("bottom");
  });

  test("popover orizzontale: centrato sul target quando c'è spazio", () => {
    const target = { top: 50, left: 590, width: 100, height: 40 };
    const viewport = { width: 1280, height: 900 };
    const result = computePopoverPosition(target, viewport, 180);
    // idealLeft = 590 + 50 - 160 = 480, dentro i limiti [12, 1280-320-12]
    expect(result.left).toBe(480);
  });

  test("popover orizzontale: clampato al bordo sinistro quando il target è vicino a left:0", () => {
    const target = { top: 50, left: 0, width: 20, height: 40 };
    const viewport = { width: 1280, height: 900 };
    const result = computePopoverPosition(target, viewport, 180);
    expect(result.left).toBe(12); // GAP
  });

  test("popover orizzontale: clampato al bordo destro quando il target è vicino al bordo destro della viewport", () => {
    const target = { top: 50, left: 1260, width: 20, height: 40 };
    const viewport = { width: 1280, height: 900 };
    const result = computePopoverPosition(target, viewport, 180);
    expect(result.left).toBe(1280 - 320 - 12); // viewport.width - POPOVER_WIDTH - GAP
  });

  test("popoverHeight custom viene rispettato nel calcolo della soglia sotto/sopra", () => {
    const target = { top: 700, left: 100, width: 120, height: 40 };
    const viewport = { width: 1280, height: 900 };
    // spaceBelow = 900 - 740 = 160
    const withDefault = computePopoverPosition(target, viewport, 180); // 160 < 180+12 e 160 < spaceAbove(700) -> top
    expect(withDefault.placement).toBe("top");
    const withSmaller = computePopoverPosition(target, viewport, 100); // 160 >= 100+12 -> bottom
    expect(withSmaller.placement).toBe("bottom");
  });
});

test.describe("Spotlight — computeCutoutRect [no browser]", () => {
  test("applica il padding di default (8px) su tutti i lati", () => {
    const target = { top: 100, left: 200, width: 50, height: 30 };
    const result = computeCutoutRect(target);
    expect(result).toEqual({ top: 92, left: 192, width: 66, height: 46 });
  });

  test("padding custom viene rispettato", () => {
    const target = { top: 100, left: 200, width: 50, height: 30 };
    const result = computeCutoutRect(target, 4);
    expect(result).toEqual({ top: 96, left: 196, width: 58, height: 38 });
  });
});

test.describe("Spotlight — matchesSpotlightRoute [no browser]", () => {
  test("pattern senza wildcard -> match esatto", () => {
    expect(matchesSpotlightRoute("/center/activities", "/center/activities")).toBe(true);
    expect(matchesSpotlightRoute("/center/activities", "/center/activities/new")).toBe(false);
  });

  test("wildcard finale (prefisso) -> matcha qualunque suffisso", () => {
    expect(matchesSpotlightRoute("/center/activities/*", "/center/activities/abc")).toBe(true);
    expect(matchesSpotlightRoute("/center/activities/*", "/center/activities/new")).toBe(true);
    expect(matchesSpotlightRoute("/center/activities/*", "/center/other")).toBe(false);
  });

  test("wildcard centrale (prefisso+suffisso) -> matcha solo path con entrambi", () => {
    expect(matchesSpotlightRoute("/center/activities/*/calendar", "/center/activities/abc/calendar")).toBe(true);
    expect(matchesSpotlightRoute("/center/activities/*/calendar", "/center/activities/abc")).toBe(false);
    expect(matchesSpotlightRoute("/center/activities/*/calendar", "/center/activities/abc/calendar/extra")).toBe(false);
  });

  test("pattern '*' da solo -> matcha qualunque path (usato per il target 'dashboard', sempre presente)", () => {
    expect(matchesSpotlightRoute("*", "/center")).toBe(true);
    expect(matchesSpotlightRoute("*", "/center/activities/abc/calendar")).toBe(true);
    expect(matchesSpotlightRoute("*", "/")).toBe(true);
  });
});
