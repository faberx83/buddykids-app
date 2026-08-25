import { test, expect } from "@playwright/test";
import {
  computeCutoutRect,
  computePopoverPosition,
  isPathRelevantToRoute,
  matchesSpotlightRoute,
  padBorderRadius,
  pickVisibleTargetIndex,
} from "../../lib/spotlight/position";

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

  test("clamp verticale: target non ancora scrollato in vista (top oltre la viewport) -> il popover resta comunque dentro i bordi", () => {
    // Bug reale trovato da Fabrizio (Visual Acceptance Gate §15, righe 14/15,
    // DEC-68): un target molto più in basso della viewport corrente (pagina
    // non ancora scrollata) produceva un `top` calcolato oltre
    // viewport.height, rendendo il popover "fixed" invisibile a qualunque
    // scroll. Il chiamante deve comunque scrollare il target in vista PRIMA
    // di chiamare questa funzione (fix primario) — questo test copre solo la
    // rete di sicurezza aggiuntiva nella funzione pura.
    const target = { top: 1200, left: 100, width: 120, height: 40 };
    const viewport = { width: 1280, height: 800 };
    const result = computePopoverPosition(target, viewport, 180);
    expect(result.top).toBeGreaterThanOrEqual(12); // GAP
    expect(result.top + 180).toBeLessThanOrEqual(viewport.height - 12); // GAP
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

// DEC-73 — regressione diretta del bug reale trovato da Fabrizio: "il
// riquadro intorno ai pulsanti è ancora squadrato, ci sono gli angoli". Il
// ring del cutout applicava il border-radius GREZZO del target (letto da
// getComputedStyle) a un rettangolo che computeCutoutRect ha già ingrandito
// di `padding` px per lato — senza aumentare anche il raggio della stessa
// quantità, la curvatura appariva quasi piatta. padBorderRadius corregge:
// raggio_nuovo = raggio_originale + padding.
test.describe("Spotlight — padBorderRadius [no browser]", () => {
  test("valore singolo in px -> incrementato del padding di default (8px)", () => {
    // Il caso reale del bug: "Salva modifiche" usa rounded-md (6px) — prima
    // del fix il ring restava a 6px sul cutout ingrandito, visivamente
    // quasi squadrato; ora diventa 14px, proporzionato al box più grande.
    expect(padBorderRadius("6px")).toBe("14px");
  });

  test("padding esplicito diverso dal default viene rispettato", () => {
    expect(padBorderRadius("6px", 4)).toBe("10px");
  });

  test("border-radius molto grande (pulsante 'pillola', rounded-full -> 9999px) resta comunque un pillola", () => {
    expect(padBorderRadius("9999px")).toBe("10007px"); // CSS clampa comunque a metà altezza: resta visivamente una pillola
  });

  test("shorthand a più valori (angoli non uniformi) -> ogni token incrementato singolarmente", () => {
    expect(padBorderRadius("6px 6px 0px 0px")).toBe("14px 14px 8px 8px");
  });

  test("token non in px (es. '%') lasciato invariato: sommare px a una percentuale non ha senso", () => {
    expect(padBorderRadius("50%")).toBe("50%");
  });

  test("stringa vuota -> ritornata invariata", () => {
    expect(padBorderRadius("")).toBe("");
  });
});

test.describe("Spotlight — pickVisibleTargetIndex [no browser]", () => {
  // DEC-70 — regressione diretta del bug reale trovato da Fabrizio: la voce
  // di menu "dashboard" esiste due volte nel DOM (sidebar desktop + cassetto
  // mobile), e su mobile la prima (nascosta via display:none) veniva scelta
  // per errore da un semplice querySelector, producendo un rect (0,0,0,0).
  test("nessun candidato -> -1 (nessun elemento con questo data-spotlight sulla pagina)", () => {
    expect(pickVisibleTargetIndex([])).toBe(-1);
  });

  test("un solo candidato nascosto (rect degenere 0x0, es. display:none) -> -1", () => {
    expect(pickVisibleTargetIndex([{ top: 0, left: 0, width: 0, height: 0 }])).toBe(-1);
  });

  test("primo candidato nascosto, secondo visibile (caso reale: sidebar desktop nascosta + drawer mobile aperto) -> indice 1", () => {
    const candidates = [
      { top: 0, left: 0, width: 0, height: 0 }, // sidebar desktop, display:none su mobile
      { top: 240, left: 16, width: 340, height: 44 }, // voce reale nel drawer mobile aperto
    ];
    expect(pickVisibleTargetIndex(candidates)).toBe(1);
  });

  test("primo candidato già visibile (caso desktop/tablet, >=768px) -> indice 0, non serve guardare oltre", () => {
    const candidates = [
      { top: 40, left: 16, width: 220, height: 44 },
      { top: 0, left: 0, width: 0, height: 0 },
    ];
    expect(pickVisibleTargetIndex(candidates)).toBe(0);
  });

  test("tutti i candidati nascosti (es. drawer mobile chiuso E sidebar desktop nascosta) -> -1", () => {
    const candidates = [
      { top: 0, left: 0, width: 0, height: 0 },
      { top: 0, left: 0, width: 0, height: 0 },
    ];
    expect(pickVisibleTargetIndex(candidates)).toBe(-1);
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

// Segnalazione 24/08/2026 (Fabrizio, screenshot) — regressione diretta:
// il badge "target non trovato" per lo step "Configura i Giorni spot"
// (spotlightRoute "/center/activities/*/calendar") restava visibile anche
// su /center/account (Impostazioni), pagina del tutto estranea al contesto
// di creazione/modifica attività. isPathRelevantToRoute è la funzione che
// SpotlightEngine ora consulta per decidere se la pagina corrente
// appartiene almeno all'AREA dello step, prima di mostrare il badge.
test.describe("Spotlight — isPathRelevantToRoute [no browser]", () => {
  test("TC-N679 - pattern prefisso+suffisso: pagina nell'area del prefisso -> rilevante", () => {
    expect(isPathRelevantToRoute("/center/activities/*/calendar", "/center/activities/abc")).toBe(true);
    expect(isPathRelevantToRoute("/center/activities/*/calendar", "/center/activities/abc/calendar")).toBe(true);
  });

  test("TC-N680 - pattern prefisso+suffisso: pagina del tutto estranea (bug reale segnalato) -> NON rilevante", () => {
    expect(isPathRelevantToRoute("/center/activities/*/calendar", "/center/account")).toBe(false);
    expect(isPathRelevantToRoute("/center/activities/*/calendar", "/center/richieste")).toBe(false);
  });

  test("TC-N681 - pattern esatto senza wildcard: solo quella pagina è rilevante", () => {
    expect(isPathRelevantToRoute("/nextgen/search", "/nextgen/search")).toBe(true);
    expect(isPathRelevantToRoute("/nextgen/search", "/nextgen")).toBe(false);
    expect(isPathRelevantToRoute("/nextgen/search", "/center/account")).toBe(false);
  });

  test("TC-N682 - pattern '*' (es. step 'dashboard', DEC-73): sempre rilevante ovunque, comportamento invariato", () => {
    expect(isPathRelevantToRoute("*", "/center/account")).toBe(true);
    expect(isPathRelevantToRoute("*", "/center/richieste")).toBe(true);
  });

  test("TC-N683 - pattern vuoto/assente: sempre rilevante (fallback sicuro)", () => {
    expect(isPathRelevantToRoute("", "/center/account")).toBe(true);
  });
});
