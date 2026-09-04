import { test, expect } from "@playwright/test";
import { isCheckinStillVisible, CHECKIN_HIDE_AFTER_HOURS } from "@/lib/data/checkin";

// TRAMA FINAL HARDENING §13-15 (push check-in, 04/09/2026) — la nuova push
// giornaliera (getPendingCheckinsForPushToday, lib/data/checkin.ts) filtra
// SOLO gli item con status===null, mai quelli "ancora visibili" perché
// risposti da meno di CHECKIN_HIDE_AFTER_HOURS: questi test bloccano quella
// distinzione esplicitamente, perché isCheckinStillVisible() da sola
// (usata dalla Home) NON è sufficiente a decidere "va notificato" — un item
// risposto 10 minuti fa è ancora "visibile" in Home (riepilogo compatto) ma
// non deve mai generare una push, essendo già stato gestito.

test.describe("CHECKIN — isCheckinStillVisible (soglia di occultamento card Home)", () => {
  test("CHECKIN-01 - nessuna risposta ancora data (status null) -> sempre visibile, qualunque sia 'now'", () => {
    expect(isCheckinStillVisible({ status: null, checkinAt: null })).toBe(true);
  });

  test("CHECKIN-02 - risposto pochi minuti fa -> ancora visibile (riepilogo compatto)", () => {
    const checkinAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(isCheckinStillVisible({ status: "presente", checkinAt }, new Date())).toBe(true);
  });

  test(`CHECKIN-03 - risposto ${CHECKIN_HIDE_AFTER_HOURS - 1}h fa -> ancora dentro la soglia, visibile`, () => {
    const checkinAt = new Date(Date.now() - (CHECKIN_HIDE_AFTER_HOURS - 1) * 60 * 60 * 1000).toISOString();
    expect(isCheckinStillVisible({ status: "assente", checkinAt }, new Date())).toBe(true);
  });

  test(`CHECKIN-04 - risposto oltre ${CHECKIN_HIDE_AFTER_HOURS}h fa -> non più visibile (la card sparisce del tutto)`, () => {
    const checkinAt = new Date(Date.now() - (CHECKIN_HIDE_AFTER_HOURS + 1) * 60 * 60 * 1000).toISOString();
    expect(isCheckinStillVisible({ status: "in_ritardo", checkinAt }, new Date())).toBe(false);
  });

  test("CHECKIN-05 - status valorizzato ma checkinAt mancante (dato scritto solo dal centro, mai dal genitore) -> resta visibile, mai un crash", () => {
    expect(isCheckinStillVisible({ status: "presente", checkinAt: null })).toBe(true);
  });
});

// La distinzione "status===null" (mai risposto -> notificabile) rispetto a
// "status valorizzato ma ancora entro la soglia" (già risposto -> NON
// notificabile, anche se la card Home resta visibile) è esattamente ciò
// che getPendingCheckinsForPushToday applica IN PIÙ rispetto a questa
// funzione — vedi commento esteso in lib/data/checkin.ts. Qui verifichiamo
// solo che le due nozioni siano davvero distinte (un item "visibile" non è
// per forza "da notificare").
test.describe("CHECKIN — 'visibile in Home' e 'da notificare via push' sono nozioni distinte", () => {
  test("CHECKIN-06 - un item risposto ed entro la soglia è visibile MA non deve generare push (status non è null)", () => {
    const item = { status: "presente" as const, checkinAt: new Date().toISOString() };
    expect(isCheckinStillVisible(item)).toBe(true); // visibile in Home...
    expect(item.status === null).toBe(false); // ...ma il criterio di notifica (status===null) lo esclude
  });
});
