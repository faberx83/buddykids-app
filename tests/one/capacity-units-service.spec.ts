// QA in produzione 04/11/2026, EXTRA-02: il servizio canonico dei posti
// (lib/capacity/service.ts) con un database finto in memoria: un posto per
// bambino, idempotenza, rilascio esatto, righe vecchie, senza migration 60.
// Come tests/one/capacity-concurrency.spec.ts il servizio importa un modulo
// "server-only": il test gira con
//   NODE_OPTIONS=--conditions=react-server npx playwright test tests/one/capacity-units-service.spec.ts
// e senza quella condizione si salta da solo (con il motivo), invece di fallire.
import { test, expect } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Fake PostgREST minimale: tabelle in memoria, filtri eq, select con count/head, update con select.
type Row = Record<string, any>;
function fakeDb(tables: Record<string, Row[]>, opts: { noUnits?: boolean } = {}) {
  const missingCol = (cols: string) => opts.noUnits && /capacity_units/.test(cols);
  function q(table: string) {
    const filters: [string, any][] = [];
    let mode: "select" | "update" = "select";
    let patch: Row = {};
    let cols = "*";
    let countOpt: any = null;
    let returning = false;
    const match = () => (tables[table] ?? []).filter((r) => filters.every(([c, v]) => r[c] === v));
    const exec = () => {
      if (mode === "select") {
        if (missingCol(cols)) return { data: null, error: { code: "42703", message: "column does not exist" } };
        const rows = match();
        if (countOpt) return { data: null, count: rows.length, error: null };
        return { data: rows.map((r) => ({ ...r })), error: null };
      }
      if (missingCol(Object.keys(patch).join(","))) return { data: null, error: { code: "42703", message: "column does not exist" } };
      const rows = match();
      rows.forEach((r) => Object.assign(r, patch));
      return { data: returning ? rows.map((r) => ({ ...r })) : null, error: null };
    };
    const b: any = {
      select(c?: string, o?: any) { if (mode === "update") { returning = true; return b; } cols = c ?? "*"; countOpt = o?.count ? o : null; return b; },
      update(p: Row) { mode = "update"; patch = p; return b; },
      eq(c: string, v: any) { filters.push([c, v]); return b; },
      single() { const r = exec(); if (r.error) return Promise.resolve(r); return Promise.resolve({ data: (r.data ?? [])[0] ?? null, error: (r.data ?? []).length ? null : { code: "PGRST116" } }); },
      then(res: any, rej: any) { return Promise.resolve(exec()).then(res, rej); },
    };
    return b;
  }
  return { from: q };
}

test("QA-S1 posti per bambino nel servizio canonico (database finto)", async () => {
  let svc: typeof import("@/lib/capacity/service");
  try {
    svc = await import("@/lib/capacity/service");
  } catch (e) {
    test.skip(true, `servizio non caricabile senza NODE_OPTIONS=--conditions=react-server (${String(e).slice(0, 80)})`);
    return;
  }
  const { reserveDayCapacity, releaseDayCapacity, reserveWeekCapacity } = svc;
  const check = (c: boolean, m: string) => expect(c, m).toBe(true);

  // 1) due bambini, 2 posti → 0, units 2; rilascio → 2
  let t: any = {
    activity_days: [{ id: "d8", spots_left: 2, capacity: 2 }],
    booking_days: [{ booking_id: "b1", activity_day_id: "d8", capacity_decremented: false, capacity_units: 0 }],
    booking_kids: [{ booking_id: "b1", kid_id: "g" }, { booking_id: "b1", kid_id: "l" }],
  };
  let db: any = fakeDb(t);
  let r = await reserveDayCapacity(db, "b1", "d8");
  check(r.applied && t.activity_days[0].spots_left === 0, "2 bambini: 2 → 0 posti");
  check(t.booking_days[0].capacity_decremented === true && t.booking_days[0].capacity_units === 2, "riga segnata con 2 posti");
  r = await reserveDayCapacity(db, "b1", "d8");
  check(!r.applied && t.activity_days[0].spots_left === 0, "idempotente: secondo accept non toglie altro");
  r = await releaseDayCapacity(db, "b1", "d8");
  check(r.applied && t.activity_days[0].spots_left === 2 && t.booking_days[0].capacity_units === 0, "rilascio restituisce 2");
  // 2) due bambini, 1 posto → rifiutata, nulla cambia
  t = { activity_days: [{ id: "d7", spots_left: 1, capacity: 2 }], booking_days: [{ booking_id: "b2", activity_day_id: "d7", capacity_decremented: false, capacity_units: 0 }], booking_kids: [{ booking_id: "b2", kid_id: "g" }, { booking_id: "b2", kid_id: "l" }] };
  db = fakeDb(t);
  r = await reserveDayCapacity(db, "b2", "d7");
  check(!r.applied && t.activity_days[0].spots_left === 1 && !t.booking_days[0].capacity_decremented, "2 bambini con 1 posto: rifiutata, niente cambia");
  // 3) riga vecchia (1 posto tolto, units 1) con 2 bambini → rilascio 1
  t = { activity_days: [{ id: "d9", spots_left: 1, capacity: 2 }], booking_days: [{ booking_id: "b3", activity_day_id: "d9", capacity_decremented: true, capacity_units: 1 }], booking_kids: [{ booking_id: "b3", kid_id: "g" }, { booking_id: "b3", kid_id: "l" }] };
  db = fakeDb(t);
  r = await releaseDayCapacity(db, "b3", "d9");
  check(r.applied && t.activity_days[0].spots_left === 2, "riga vecchia: restituisce 1 (quello tolto)");
  // 4) senza migration 60: un bambino, comportamento di prima
  t = { activity_days: [{ id: "d1", spots_left: 3, capacity: 3 }], booking_days: [{ booking_id: "b4", activity_day_id: "d1", capacity_decremented: false }], booking_kids: [{ booking_id: "b4", kid_id: "g" }] };
  db = fakeDb(t, { noUnits: true });
  r = await reserveDayCapacity(db, "b4", "d1");
  check(r.applied && t.activity_days[0].spots_left === 2 && t.booking_days[0].capacity_decremented === true, "senza migration 60: riserva e flag come prima");
  r = await releaseDayCapacity(db, "b4", "d1");
  check(r.applied && t.activity_days[0].spots_left === 3 && t.booking_days[0].capacity_decremented === false, "senza migration 60: rilascio come prima");
  // 5) settimane: 3 bambini, 5 posti → 2
  t = { activity_weeks: [{ id: "w1", spots_left: 5, capacity: 10 }], booking_weeks: [{ booking_id: "b5", week_id: "w1", capacity_decremented: false, capacity_units: 0 }], booking_kids: [{ booking_id: "b5", kid_id: "a" }, { booking_id: "b5", kid_id: "b" }, { booking_id: "b5", kid_id: "c" }] };
  db = fakeDb(t);
  r = await reserveWeekCapacity(db, "b5", "w1");
  check(r.applied && t.activity_weeks[0].spots_left === 2 && t.booking_weeks[0].capacity_units === 3, "settimana: 3 bambini tolgono 3 posti");
});
