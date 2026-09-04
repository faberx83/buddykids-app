import { test, expect } from "@playwright/test";
import { isAgeEligible, matchPercentForKid } from "@/lib/matching";
import type { Activity, Kid } from "@/lib/types";

// TRAMA FINAL HARDENING §18 (Fix 7, 04/09/2026) — segnalazione live: un
// bambino di 4 anni su un'attività dichiarata 6-12 anni mostrava "Match 65%"
// + "Piace a [bambino]", perché il vecchio punteggio età era un decadimento
// morbido (mai zero netto). isAgeEligible() è ora il SINGOLO taglio hard
// riusato sia da matchPercentForKid sia dai suggerimenti "Riempi questa
// settimana" (PlannerView.tsx) sia dal filtro candidati di
// lib/notifications/availability-push.ts — questi test coprono solo la
// funzione pura, MATCH-01..08.

test.describe("MATCH — isAgeEligible (taglio hard, nessun punteggio parziale)", () => {
  test("MATCH-01 - bambino dentro il range -> eligible", () => {
    expect(isAgeEligible(8, "6-12")).toBe(true);
  });

  test("MATCH-02 - bambino sotto il range -> NON eligible (era il bug segnalato: 4 anni su 6-12)", () => {
    expect(isAgeEligible(4, "6-12")).toBe(false);
  });

  test("MATCH-03 - bambino sopra il range -> NON eligible", () => {
    expect(isAgeEligible(13, "6-12")).toBe(false);
  });

  test("MATCH-04 - bambino esattamente al limite inferiore/superiore -> eligible (range inclusivo)", () => {
    expect(isAgeEligible(6, "6-12")).toBe(true);
    expect(isAgeEligible(12, "6-12")).toBe(true);
  });

  test("MATCH-05 - range non leggibile/assente -> eligible per default (nessun dato su cui basare un'esclusione)", () => {
    expect(isAgeEligible(4, "")).toBe(true);
    expect(isAgeEligible(4, "n/d")).toBe(true);
  });
});

function makeKid(age: number): Kid {
  return {
    id: "kid-1",
    name: "Test",
    age,
    emoji: "🙂",
    color: "blue",
    note: "",
    interests: [],
  } as unknown as Kid;
}

function makeActivity(ageRange: string): Activity {
  return {
    id: "act-1",
    name: "Estate Avventura",
    description: "campo estivo",
    ageRange,
    tags: [],
    rating: 4.5,
  } as unknown as Activity;
}

test.describe("MATCH — matchPercentForKid azzera il TOTALE (non solo la componente età) per un bambino ineligible", () => {
  test("MATCH-06 - bambino fuori range -> match% sempre 0, anche con interessi/rating alti (replica esatta del bug live)", () => {
    const kid = { ...makeKid(4), interests: ["avventura", "sport"] } as Kid;
    const activity = { ...makeActivity("6-12"), tags: [{ label: "avventura" }, { label: "sport" }], rating: 5 } as unknown as Activity;
    expect(matchPercentForKid(kid, activity)).toBe(0);
  });

  test("MATCH-07 - bambino dentro range -> match% resta > 0 (nessuna regressione per il caso eligible)", () => {
    const kid = { ...makeKid(8), interests: ["avventura"] } as Kid;
    const activity = { ...makeActivity("6-12"), tags: [{ label: "avventura" }], rating: 4 } as unknown as Activity;
    expect(matchPercentForKid(kid, activity)).toBeGreaterThan(0);
  });

  test("MATCH-08 - range non leggibile -> nessuna esclusione forzata (coerente con isAgeEligible)", () => {
    const kid = makeKid(4);
    const activity = makeActivity("n/d");
    expect(matchPercentForKid(kid, activity)).toBeGreaterThanOrEqual(0);
  });
});
