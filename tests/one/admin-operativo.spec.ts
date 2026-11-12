// TRAMA — ADMIN OPERATIVO (12/11/2026). Iniziativa:
// claude/INIZIATIVA_admin_operativo.md. Richiesta di Fabrizio: "rendere Admin
// utilizzabile per gestire la beta: vedere cosa richiede un intervento,
// trovare il caso preciso, capire chi deve agire e ricostruire lo storico".
// Logica pura (code di Oggi, filtri, libro del giorno, inviti, sovrapposizioni)
// + capacità con un client Supabase finto (conferma, ripetizione,
// annullamento, concorrenza) + controlli sul sorgente (menu, link, ruoli,
// flag). Percorsi nel browser: pending local verification (TC-N611/N418/N613
// aggiornati per la nuova home).
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  DEFAULT_BOOKING_FILTERS,
  bookingRef,
  bookingsHref,
  filterAdminBookings,
  normalizeRefQuery,
  paginate,
  parseBookingFilters,
  participationDates,
  sortAdminBookings,
  viewAdminBooking,
  type AdminBookingRow,
} from "../../lib/admin-ops/bookings";
import { isDemoCenter, isDemoRecord } from "../../lib/admin-ops/demo";
import { buildDayLedger, type LedgerRow } from "../../lib/admin-ops/day-ledger";
import { buildQueue, buildOggiQueues } from "../../lib/admin-ops/queues";
import { aggregateByCenter, filterInquiries, inquiriesHref, viewInquiry, type AdminInquiryRow } from "../../lib/admin-ops/inquiries";
import { codeUsage, countPeopleAndFamilies, invitePipeline } from "../../lib/admin-ops/invitations";
import { ledgerRowsForDay, summarizeDays } from "../../lib/admin-ops/activity-days";
import { blockReason } from "../../lib/admin-ops/activation";
import { pickActiveHref } from "../../lib/navigation/active-nav";
import { kidTimeOverlaps, overlapSentence } from "../../lib/nextgen/kid-overlaps";
import { activityPrice } from "../../lib/nextgen/activity-price";
import { confirmedByDate } from "../../lib/capacity/units";
import { releaseDayCapacity, reserveDayCapacity } from "../../lib/capacity/service";
import type { AgendaEntry } from "../../lib/nextgen/today-agenda";

const ROOT = path.join(__dirname, "../..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
const TODAY = "2026-11-12";

function booking(over: Partial<AdminBookingRow> = {}): AdminBookingRow {
  return {
    id: "370f7e44-aaaa-bbbb-cccc-000000000001",
    status: "confirmed",
    partnerDecisionRaw: "pending",
    createdAt: "2026-11-04T08:41:44Z",
    respondedAt: null,
    cancelledBy: null,
    totalAmount: 57,
    discountAmount: 3,
    centerId: "c-1",
    centerName: "Ludoteca Arcobaleno",
    centerIsTestFixture: false,
    activityId: "a-1",
    activitySlug: "natale",
    activityName: "Natale in ludoteca",
    bookingMode: "day_only",
    pricePerWeek: 150,
    parentName: "Giulia Rossi",
    parentEmail: "giulia@example.it",
    kidNames: ["Luca", "Sara"],
    days: [{ activityDayId: "d-8", date: "2026-12-08", decision: "pending", capacityDecremented: false, units: null, price: 30 }],
    weeks: [],
    ...over,
  };
}

// ─────────────────────────────────────────────
// Prenotazioni: stato effettivo, filtri, conteggi = righe
// ─────────────────────────────────────────────
test.describe("Prenotazioni Admin: riferimento, stato, filtri URL", () => {
  test("AO-01 riferimento stabile e ricerca per riferimento (#, TR-, minuscole)", () => {
    expect(bookingRef("370f7e44-aaaa-bbbb-cccc-000000000001")).toBe("#370F7E44");
    expect(normalizeRefQuery("#370f7e44")).toBe("370F7E44");
    expect(normalizeRefQuery("TR-370F")).toBe("370F");
    expect(normalizeRefQuery("Giulia")).toBeNull();
    const v = viewAdminBooking(booking(), TODAY);
    expect(filterAdminBookings([v], { ...DEFAULT_BOOKING_FILTERS, q: "#370F7E44" })).toHaveLength(1);
    expect(filterAdminBookings([v], { ...DEFAULT_BOOKING_FILTERS, q: "luca" })).toHaveLength(1);
    expect(filterAdminBookings([v], { ...DEFAULT_BOOKING_FILTERS, q: "#99999999" })).toHaveLength(0);
  });

  test("AO-02 stato effettivo: giorni tutti accettati = confermata anche se bookings.partner_decision resta 'pending' (bug del contatore)", () => {
    const accepted = booking({ days: [{ activityDayId: "d-8", date: "2026-12-08", decision: "accepted", capacityDecremented: true, units: 2, price: 30 }] });
    const v = viewAdminBooking(accepted, TODAY);
    expect(v.state).toBe("confermata");
    expect(v.actor).toBeNull();
    const pending = viewAdminBooking(booking(), TODAY);
    expect(pending.state).toBe("da_rispondere");
    expect(pending.actor).toBe("centro");
    expect(pending.nextStep).toContain("Sollecitare il centro");
    expect(viewAdminBooking(booking({ status: "cancelled" }), TODAY).state).toBe("annullata");
    expect(viewAdminBooking(booking({ days: [], weeks: [], partnerDecisionRaw: "proposed" }), TODAY).actor).toBe("famiglia");
  });

  test("AO-03 anzianità, prossima data, imminente entro 7 giorni", () => {
    const soon = viewAdminBooking(booking({ days: [{ activityDayId: "d", date: "2026-11-16", decision: "pending", capacityDecremented: false, units: null, price: 30 }] }), TODAY);
    expect(soon.ageDays).toBe(8);
    expect(soon.dueInDays).toBe(4);
    expect(soon.imminent).toBe(true);
    const far = viewAdminBooking(booking(), TODAY);
    expect(far.imminent).toBe(false);
  });

  test("AO-04 filtri URL: parse ↔ query, valori invalidi ignorati, pagina", () => {
    const f = parseBookingFilters({ q: "rossi", centro: "c-1", attivita: "a-1", data: "2026-12-08", stato: "da_rispondere", imminenti: "1", demo: "1", pagina: "2" });
    expect(f).toEqual({ q: "rossi", centro: "c-1", attivita: "a-1", data: "2026-12-08", stato: "da_rispondere", imminenti: true, demo: true, pagina: 2 });
    expect(bookingsHref(f)).toBe("/admin/bookings?q=rossi&centro=c-1&attivita=a-1&data=2026-12-08&stato=da_rispondere&imminenti=1&demo=1&pagina=2");
    expect(parseBookingFilters(new URLSearchParams(bookingsHref(f).split("?")[1]))).toEqual(f);
    expect(parseBookingFilters({ stato: "boh", data: "8/12", pagina: "-3" })).toEqual(DEFAULT_BOOKING_FILTERS);
    expect(bookingsHref({})).toBe("/admin/bookings");
    expect(paginate(Array.from({ length: 30 }, (_, i) => i), 2).items).toEqual([25, 26, 27, 28, 29]);
  });

  test("AO-05 il contatore di Oggi conta le stesse righe dell'elenco filtrato (prove escluse di default)", () => {
    const rows = [
      booking({ id: "11111111-0000-0000-0000-000000000001" }),
      booking({ id: "22222222-0000-0000-0000-000000000002", centerName: "Centro Demo" }),
      booking({ id: "33333333-0000-0000-0000-000000000003", centerIsTestFixture: true }),
      booking({ id: "44444444-0000-0000-0000-000000000004", days: [{ activityDayId: "d", date: "2026-12-08", decision: "accepted", capacityDecremented: true, units: 2, price: 30 }] }),
    ];
    const views = rows.map((r) => viewAdminBooking(r, TODAY));
    const filter = { ...DEFAULT_BOOKING_FILTERS, stato: "da_rispondere" as const };
    const listed = filterAdminBookings(views, parseBookingFilters(new URLSearchParams(bookingsHref(filter).split("?")[1])));
    const q = buildQueue({ key: "bookings", label: "x", actor: "centro", href: bookingsHref(filter), nextStep: "", items: filterAdminBookings(views, filter).map((v) => ({ id: v.row.id, title: v.ref, createdAt: v.row.createdAt, dueDate: v.nextDate, href: "" })) }, TODAY);
    expect(q.count).toBe(listed.length);
    expect(q.count).toBe(1);
    expect(filterAdminBookings(views, { ...filter, demo: true })).toHaveLength(3);
  });

  test("AO-06 filtro per centro, attività e data di partecipazione; settimane espanse nei giorni feriali", () => {
    const week = booking({ days: [], weeks: [{ weekId: "w", startDate: "2026-12-21", endDate: "2026-12-27", capacityDecremented: true, units: 1 }], partnerDecisionRaw: "accepted" });
    expect(participationDates(week)).toEqual(["2026-12-21", "2026-12-22", "2026-12-23", "2026-12-24", "2026-12-25"]);
    const v = [viewAdminBooking(booking(), TODAY), viewAdminBooking(week, TODAY)];
    expect(filterAdminBookings(v, { ...DEFAULT_BOOKING_FILTERS, data: "2026-12-23" })).toHaveLength(1);
    expect(filterAdminBookings(v, { ...DEFAULT_BOOKING_FILTERS, centro: "c-2" })).toHaveLength(0);
    expect(filterAdminBookings(v, { ...DEFAULT_BOOKING_FILTERS, attivita: "a-1" })).toHaveLength(2);
    expect(sortAdminBookings(v)[0].state).toBe("da_rispondere");
  });

  test("AO-07 dati di prova: is_test_fixture o nome (Centro Demo, [TEST], centro di prova, UX DEMO)", () => {
    expect(isDemoCenter({ name: "Centro Demo" })).toBe(true);
    expect(isDemoCenter({ name: "[TEST] Centro BuddyKids" })).toBe(true);
    expect(isDemoCenter({ name: "Campo Brera · centro di prova" })).toBe(true);
    expect(isDemoCenter({ name: "Ludoteca Il Girasole", isTestFixture: true })).toBe(true);
    expect(isDemoCenter({ name: "Ludoteca Arcobaleno" })).toBe(false);
    expect(isDemoCenter({ name: "Teatro Demostene" })).toBe(false);
    expect(isDemoRecord({ centerName: "Ludoteca Arcobaleno", activityName: "UX DEMO 3 novembre — collaudo pubblicazione" })).toBe(true);
  });
});

// ─────────────────────────────────────────────
// Libro del giorno: posti, partecipanti, portali
// ─────────────────────────────────────────────
const row = (over: Partial<LedgerRow>): LedgerRow => ({
  bookingId: "b",
  ref: "#B",
  bookingStatus: "confirmed",
  decision: "accepted",
  capacityDecremented: true,
  units: 1,
  kidsCount: 1,
  label: "x",
  ...over,
});

test.describe("Giornata: posti occupati e da quali prenotazioni", () => {
  test("AO-08 caso del QA (UX DEMO, 8/12): 2 bambini, 1 posto preso → avviso 'storico da riconciliare', i portali non concordano", () => {
    const l = buildDayLedger({ capacity: 2, spotsLeft: 1 }, [row({ ref: "#370F7E44", units: 1, kidsCount: 2 })]);
    expect(l.occupied).toBe(1);
    expect(l.confirmedParticipants).toBe(2);
    expect(l.portals).toMatchObject({ parentFree: 1, partnerConfirmed: 1, partnerRegister: 2 });
    expect(l.consistent).toBe(false);
    expect(l.issues[0].kind).toBe("units_mismatch");
    expect(l.issues[0].message).toContain("riconciliazione_60");
  });

  test("AO-09 dopo la regola del 04/11 (o la riconciliazione): 2 posti, 2 bambini confermati → 0 liberi su tutti i portali", () => {
    const l = buildDayLedger({ capacity: 2, spotsLeft: 0 }, [row({ units: 2, kidsCount: 2 })]);
    expect(l.consistent).toBe(true);
    expect(l.portals).toEqual({ parentFree: 0, partnerConfirmed: 2, partnerRegister: 2, adminFree: 0 });
    const two = buildDayLedger({ capacity: 2, spotsLeft: 0 }, [row({ bookingId: "a" }), row({ bookingId: "b" })]);
    expect(two.consistent).toBe(true);
    expect(two.occupied).toBe(2);
  });

  test("AO-10 richieste in attesa non occupano posti; rifiutate e annullate a parte; posti trattenuti a mano = info", () => {
    const l = buildDayLedger({ capacity: 3, spotsLeft: 1 }, [
      row({ bookingId: "ok" }),
      row({ bookingId: "wait", decision: "pending", capacityDecremented: false, kidsCount: 2 }),
      row({ bookingId: "no", decision: "rejected", capacityDecremented: false }),
    ]);
    expect(l.occupying.map((r) => r.bookingId)).toEqual(["ok"]);
    expect(l.pending.map((r) => r.bookingId)).toEqual(["wait"]);
    expect(l.other.map((r) => r.bookingId)).toEqual(["no"]);
    expect(l.pendingParticipants).toBe(2);
    expect(l.issues.map((i) => i.kind)).toEqual(["manual_hold"]);
    expect(l.consistent).toBe(true);
  });

  test("AO-11 anomalie: annullata che tiene posti, accettata senza posto, liberi oltre il possibile", () => {
    expect(buildDayLedger({ capacity: 2, spotsLeft: 1 }, [row({ bookingStatus: "cancelled" })]).issues.map((i) => i.kind)).toContain("cancelled_holding_seat");
    expect(buildDayLedger({ capacity: 2, spotsLeft: 2 }, [row({ capacityDecremented: false })]).issues.map((i) => i.kind)).toContain("accepted_without_seat");
    expect(buildDayLedger({ capacity: 2, spotsLeft: 2 }, [row({})]).issues.map((i) => i.kind)).toContain("overbooked_store");
  });

  test("AO-12 righe del giorno dalle prenotazioni dell'attività; riepilogo per giorno", () => {
    const b = booking({ days: [{ activityDayId: "d-8", date: "2026-12-08", decision: "accepted", capacityDecremented: true, units: 2, price: 30 }] });
    const rows = ledgerRowsForDay([b, booking({ id: "x", days: [] })], "d-8");
    expect(rows).toHaveLength(1);
    expect(rows[0].ref).toBe("#370F7E44");
    const s = summarizeDays([{ id: "d-8", date: "2026-12-08", isOpen: true, capacity: 2, spotsLeft: 0 }], [b]);
    expect(s[0].ledger.consistent).toBe(true);
  });
});

// ─────────────────────────────────────────────
// Capacità con il servizio vero e un client finto
// ─────────────────────────────────────────────
type Rec = Record<string, unknown>;
function fakeDb(init: { days: Record<string, { spots_left: number; capacity: number }>; links: { booking_id: string; activity_day_id: string; capacity_decremented: boolean; capacity_units: number | null }[]; kids: Record<string, number> }) {
  const days = init.days;
  const links = init.links;
  const tick = () => new Promise((r) => setTimeout(r, 0));
  function q(table: string) {
    const filters: [string, unknown][] = [];
    let op: "select" | "update" = "select";
    let payload: Rec = {};
    let returning = false;
    let head = false;
    const api: Rec = {
      select(_cols?: string, opts?: { head?: boolean }) {
        if (op === "update") returning = true;
        if (opts?.head) head = true;
        return api;
      },
      update(p: Rec) {
        op = "update";
        payload = p;
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        return api;
      },
      single: () => run(true),
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
        return run(false).then(res, rej);
      },
    };
    const match = (r: Rec) => filters.every(([c, v]) => r[c] === v);
    async function run(single: boolean): Promise<Rec> {
      await tick();
      if (table === "booking_kids") {
        const id = filters.find(([c]) => c === "booking_id")?.[1] as string;
        return { count: init.kids[id] ?? 0, error: null, data: head ? null : [] };
      }
      if (table === "activity_days") {
        const id = filters.find(([c]) => c === "id")?.[1] as string;
        const d = days[id];
        if (op === "select") return { data: d ? { ...d } : null, error: null };
        const cas = filters.find(([c]) => c === "spots_left");
        if (d && (!cas || d.spots_left === cas[1])) {
          Object.assign(d, payload);
          return { data: returning ? [{ spots_left: d.spots_left }] : null, error: null };
        }
        return { data: returning ? [] : null, error: null };
      }
      if (table === "booking_days") {
        const rows = links.filter((l) => match(l as unknown as Rec));
        if (op === "select") return { data: single ? (rows[0] ? { ...rows[0] } : null) : rows, error: single && !rows[0] ? { code: "PGRST116" } : null };
        rows.forEach((r) => Object.assign(r, payload));
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }
    return api;
  }
  return { client: { from: q } as never, days, links };
}

test.describe("Capacità: conferma, ripetizione, annullamento, concorrenza (servizio canonico)", () => {
  test("AO-13 2 posti, prenotazione con 2 bambini confermata → 0 liberi; Partner conta 2 confermati, registro 2 bambini", async () => {
    const db = fakeDb({ days: { d8: { spots_left: 2, capacity: 2 } }, links: [{ booking_id: "b1", activity_day_id: "d8", capacity_decremented: false, capacity_units: null }], kids: { b1: 2 } });
    const r = await reserveDayCapacity(db.client, "b1", "d8");
    expect(r).toMatchObject({ applied: true, spotsLeft: 0 });
    expect(db.links[0]).toMatchObject({ capacity_decremented: true, capacity_units: 2 });
    expect(confirmedByDate(db.links, new Map([["d8", "2026-12-08"]]))).toEqual({ "2026-12-08": 2 });
    const l = buildDayLedger({ capacity: 2, spotsLeft: db.days.d8.spots_left }, [row({ units: db.links[0].capacity_units, kidsCount: 2 })]);
    expect(l.consistent).toBe(true);
    expect(l.portals.parentFree).toBe(0);
  });

  test("AO-14 conferma ripetuta: la seconda non toglie altri posti", async () => {
    const db = fakeDb({ days: { d8: { spots_left: 2, capacity: 2 } }, links: [{ booking_id: "b1", activity_day_id: "d8", capacity_decremented: false, capacity_units: null }], kids: { b1: 1 } });
    await reserveDayCapacity(db.client, "b1", "d8");
    const again = await reserveDayCapacity(db.client, "b1", "d8");
    expect(again.applied).toBe(false);
    expect(db.days.d8.spots_left).toBe(1);
  });

  test("AO-15 annullamento di un giorno: restituisce esattamente i posti presi (2 per 2 bambini), mai oltre la capienza; ripetuto non fa nulla", async () => {
    const db = fakeDb({ days: { d8: { spots_left: 0, capacity: 2 } }, links: [{ booking_id: "b1", activity_day_id: "d8", capacity_decremented: true, capacity_units: 2 }], kids: { b1: 2 } });
    const r = await releaseDayCapacity(db.client, "b1", "d8");
    expect(r).toMatchObject({ applied: true, spotsLeft: 2 });
    expect(db.links[0]).toMatchObject({ capacity_decremented: false, capacity_units: 0 });
    expect((await releaseDayCapacity(db.client, "b1", "d8")).applied).toBe(false);
    expect(db.days.d8.spots_left).toBe(2);
  });

  test("AO-16 riga storica (1 posto per 2 bambini): l'annullamento restituisce 1, non 2 (nessun posto inventato)", async () => {
    const db = fakeDb({ days: { d8: { spots_left: 1, capacity: 2 } }, links: [{ booking_id: "b1", activity_day_id: "d8", capacity_decremented: true, capacity_units: 1 }], kids: { b1: 2 } });
    await releaseDayCapacity(db.client, "b1", "d8");
    expect(db.days.d8.spots_left).toBe(2);
  });

  test("AO-17 conferma concorrente sull'ultimo posto: una sola riesce", async () => {
    const db = fakeDb({
      days: { d8: { spots_left: 1, capacity: 2 } },
      links: [
        { booking_id: "b1", activity_day_id: "d8", capacity_decremented: false, capacity_units: null },
        { booking_id: "b2", activity_day_id: "d8", capacity_decremented: false, capacity_units: null },
      ],
      kids: { b1: 1, b2: 1 },
    });
    const [a, b] = await Promise.all([reserveDayCapacity(db.client, "b1", "d8"), reserveDayCapacity(db.client, "b2", "d8")]);
    expect([a.applied, b.applied].filter(Boolean)).toHaveLength(1);
    expect(db.days.d8.spots_left).toBe(0);
    expect(db.links.filter((l) => l.capacity_decremented)).toHaveLength(1);
  });

  test("AO-18 famiglia con 2 bambini e 1 posto libero: la conferma non riesce (mai metà famiglia)", async () => {
    const db = fakeDb({ days: { d8: { spots_left: 1, capacity: 2 } }, links: [{ booking_id: "b1", activity_day_id: "d8", capacity_decremented: false, capacity_units: null }], kids: { b1: 2 } });
    const r = await reserveDayCapacity(db.client, "b1", "d8");
    expect(r.applied).toBe(false);
    expect(db.days.d8.spots_left).toBe(1);
  });
});

// ─────────────────────────────────────────────
// Oggi: code, chi agisce, scadenza
// ─────────────────────────────────────────────
test.describe("Oggi: code con chi deve agire, anzianità, scadenza, prossimo passo", () => {
  test("AO-19 una data entro 3 giorni rende la coda alta priorità anche se la richiesta è recente", () => {
    const q = buildQueue({ key: "k", label: "L", actor: "centro", href: "/x", nextStep: "n", items: [{ id: "1", title: "t", createdAt: "2026-11-12T08:00:00Z", dueDate: "2026-11-14", href: "/y" }] }, TODAY);
    expect(q).toMatchObject({ count: 1, priority: "alta", oldestDays: 0, nearestDueInDays: 2, actorLabel: "Tocca al centro" });
    expect(q.detail).toBe("più vecchia: oggi · prima data: tra 2 giorni");
  });

  test("AO-20 code vuote in fondo; i flag con allarme sono sempre alti", () => {
    const qs = buildOggiQueues(
      [
        { key: "vuota", label: "V", actor: "trama", href: "/v", nextStep: "", items: [] },
        { key: "flag", label: "F", actor: "trama", href: "/f", nextStep: "", alwaysHigh: true, items: [{ id: "x", title: "X", createdAt: null, href: "/f" }] },
      ],
      TODAY
    );
    expect(qs.map((q) => q.key)).toEqual(["flag", "vuota"]);
    expect(qs[0].priority).toBe("alta");
  });

  test("AO-21 il data layer di Oggi usa per ogni coda la stessa regola e lo stesso link della pagina di destinazione", () => {
    const src = read("lib/data/command-center.ts");
    expect(src).toContain('href: bookingsHref(pendingFilter)');
    expect(src).toContain('items: pending.map(bookingItem)');
    expect(src).toContain('href: inquiriesHref({ stato: "aperta" })');
    expect(src).toContain('href: "/admin/centri-attivazione?f=trama"');
    expect(src).toContain('adminBucket(c.facts.status) === "trama"');
    expect(src).toContain('href: "/admin/segnalazioni-beta?stato=nuovo"');
    expect(src).toContain('ACTIVE_LEAD_STATUSES = ["suggested", "qualified", "contacted"]');
    expect(read("app/admin/center-leads/CenterLeadsAdminClient.tsx")).toContain('l.status === "suggested" || l.status === "qualified" || l.status === "contacted"');
    // Etichette di sempre (tests/one/command-center.spec.ts TC-N611).
    for (const label of ["Onboarding centri in revisione", "Prenotazioni in attesa di risposta Partner", "Richieste genitore aperte", "Segnalazioni centro non iscritto da qualificare", "Certificazioni servizio da approvare", "Segnalazioni BETA nuove", "Allarmi feature flag (override scaduti/in scadenza)"]) {
      expect(src).toContain(`label: "${label}"`);
    }
  });
});

// ─────────────────────────────────────────────
// Messaggi e segnalazioni: aggregati → casi
// ─────────────────────────────────────────────
test.describe("Messaggi famiglia → centro: aggregati e casi dalle stesse righe", () => {
  const inq = (over: Partial<AdminInquiryRow>): AdminInquiryRow => ({
    id: "i1",
    status: "aperta",
    createdAt: "2026-11-09T10:00:00Z",
    repliedAt: null,
    lastMessageAt: null,
    centerId: "c-1",
    centerName: "Ludoteca Arcobaleno",
    centerIsTestFixture: false,
    activityId: "a-1",
    activityName: "Natale",
    parentName: "Giulia",
    message: "Avete posto?",
    reply: null,
    ...over,
  });
  test("AO-22 aperte per centro = elenco filtrato per centro e stato; prove escluse", () => {
    const views = [inq({}), inq({ id: "i2", status: "risposta", repliedAt: "2026-11-09T12:00:00Z" }), inq({ id: "i3", centerName: "[TEST] Centro" , centerId: "c-9" })].map((r) => viewInquiry(r, TODAY));
    const scope = filterInquiries(views, { centro: "", stato: "tutte", demo: false });
    const agg = aggregateByCenter(scope);
    expect(agg).toHaveLength(1);
    expect(agg[0]).toMatchObject({ open: 1, total: 2, oldestOpenDays: 3, avgResponseHours: 2 });
    expect(filterInquiries(views, { centro: "c-1", stato: "aperta", demo: false })).toHaveLength(agg[0].open);
    expect(inquiriesHref({ centro: "c-1", stato: "aperta" })).toBe("/admin/richieste?centro=c-1&stato=aperta#casi");
    expect(views[0].actor).toBe("centro");
    expect(views[0].nextStep).toContain("Sollecitare");
  });

  test("AO-23 Segnalazioni BETA: filtri da URL, aggregati cliccabili, stati e pipeline invariati", () => {
    const c = read("app/admin/segnalazioni-beta/SegnalazioniBetaAdminClient.tsx");
    expect(c).toContain('router.replace(`/admin/segnalazioni-beta${q ? `?${q}` : ""}`');
    expect(c).toContain("onClick={() => setAreaFilter(a.area)}");
    expect(c).toContain("confirmBetaFeedbackForPipelineAction");
    expect(read("app/admin/segnalazioni-beta/page.tsx")).toContain("initialStatus={typeof sp.stato === \"string\"");
  });
});

// ─────────────────────────────────────────────
// Famiglie: inviti e registrazioni
// ─────────────────────────────────────────────
test.describe("Famiglie: richiesta, invito inviato, usato, registrazione", () => {
  test("AO-24 copiare o preparare non è inviare; registrata se esiste l'account con la stessa email", () => {
    const rows = invitePipeline(
      [
        { id: "w1", email: "a@x.it", status: "nuovo", createdAt: "2026-11-01", invitedAt: null },
        { id: "w2", email: "B@x.it", status: "invitato", createdAt: "2026-11-01", invitedAt: "2026-11-02" },
        { id: "w3", email: "c@x.it", status: "invitato", createdAt: "2026-11-01", invitedAt: "2026-11-02" },
      ],
      [{ id: "p3", email: "C@X.IT", createdAt: "2026-11-03", betaCode: "AMICI" }]
    );
    expect(rows.map((r) => r.stage)).toEqual(["richiesta", "inviato", "registrata"]);
    expect(rows[2].usedCode).toBe("AMICI");
  });

  test("AO-25 persone e famiglie separate; esclusi fuori dai conteggi; uso dei codici", () => {
    const parents = [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }];
    const fm = [
      { userId: "p1", familyId: "f1" },
      { userId: "p2", familyId: "f1" },
    ];
    expect(countPeopleAndFamilies(parents, fm, new Set())).toEqual({ people: 4, families: 3, excludedPeople: 0 });
    expect(countPeopleAndFamilies(parents, fm, new Set(["p4"]))).toEqual({ people: 3, families: 2, excludedPeople: 1 });
    const u = codeUsage([{ code: "AMICI", label: "Beta amici", active: true, redeemedCount: 3, maxRedemptions: 10, expiresAt: null }], [{ id: "x", email: null, createdAt: "", betaCode: "amici" }]);
    expect(u[0]).toMatchObject({ redeemed: 3, accounts: 1 });
  });

  test("AO-26 Lista d'attesa: 'Scrivi l'invito' prepara, 'Segna come inviato' dopo l'invio; invii manuali conservati", () => {
    const c = read("app/admin/lista-attesa/ListaAttesaAdminClient.tsx");
    expect(c).toContain("Segna come inviato");
    expect(c).toContain("inviteMailto(i, inviteCode)");
    expect(read("app/admin/beta-invites/BetaInvitesAdminClient.tsx")).toContain("Copiato: ora invialo tu");
  });
});

// ─────────────────────────────────────────────
// Centri: coda unica di attivazione
// ─────────────────────────────────────────────
test.describe("Centri da attivare: stesso processo dell'onboarding TRAMA ONE", () => {
  test("AO-27 motivo del blocco e chi deve agire", () => {
    const base = { checks: [{ label: "Descrizione", done: false }, { label: "Indirizzo", done: true }], changesNote: null, referentConfirmed: false, activitiesChecked: true };
    expect(blockReason({ ...base, bucket: "trama", status: "SUBMITTED" })).toBe("TRAMA deve confermare il referente, poi approvare");
    expect(blockReason({ ...base, bucket: "centro", status: "CLAIMED" })).toBe("Al profilo mancano: descrizione");
    expect(blockReason({ ...base, bucket: "centro", status: "CHANGES_REQUESTED", changesNote: "manca il prezzo" })).toBe("Modifica richiesta al centro: manca il prezzo");
    expect(blockReason({ ...base, bucket: "centro", status: "LEAD" })).toContain("non ha ancora creato l'accesso");
  });

  test("AO-28 filtro e centro nell'URL; vista di prima rimanda alla coda unica", () => {
    const c = read("app/admin/centri-attivazione/ActivationAdminClient.tsx");
    // Retest 12/11/2026: l'URL conserva anche ?demo=1 (prove visibili).
    expect(c).toContain("router.replace(`/admin/centri-attivazione?f=${f}${c ? `&c=${c}` : \"\"}${demo ? \"&demo=1\" : \"\"}`");
    expect(c).toContain("Ultima azione:");
    expect(c).toContain('"Tocca a TRAMA"');
    expect(read("app/admin/one/onboarding/page.tsx")).toContain('href="/admin/centri-attivazione?f=trama"');
  });
});

// ─────────────────────────────────────────────
// Prezzo: stessa regola di Parent e Partner
// ─────────────────────────────────────────────
test.describe("Prezzo nel dettaglio Admin", () => {
  test("AO-29 attività solo giorni: '€30 al giorno' (non '€150/settimana'); tariffa mancante dichiarata", () => {
    expect(activityPrice({ pricePerWeek: 150, bookingMode: "day_only" }).label).toBe("€30 al giorno");
    expect(activityPrice({ pricePerWeek: null, bookingMode: "day_only" }).label).toBe("Prezzo da chiedere");
    const src = read("app/admin/centers/[id]/page.tsx");
    expect(src).toContain("activityPrice({");
    expect(src).not.toContain("/settimana</div>");
    expect(read("app/admin/centers/[id]/attivita/[activityId]/page.tsx")).toContain("(tariffa non configurata dal centro)");
  });
});

// ─────────────────────────────────────────────
// Menu e voce corrente
// ─────────────────────────────────────────────
test.describe("Menu Admin: 7 gruppi, una voce accesa, link conservati", () => {
  const items = [
    { href: "/admin", matchPrefixes: ["/admin/one"] },
    { href: "/admin/beta" },
    { href: "/admin/beta-invites" },
    { href: "/admin/one/pilot" },
    { href: "/admin/centri-attivazione", matchPrefixes: ["/admin/one/onboarding"] },
    { href: "/admin/crescita", matchPrefixes: ["/admin/demo", "/admin/analytics", "/admin/activities"] },
    { href: "/admin/centers" },
  ];
  test("AO-30 una sola voce corrente, anche con percorsi annidati e alias", () => {
    expect(pickActiveHref("/admin", items, "/admin")).toBe("/admin");
    expect(pickActiveHref("/admin/one", items, "/admin")).toBe("/admin");
    expect(pickActiveHref("/admin/one/pilot/abc", items, "/admin")).toBe("/admin/one/pilot");
    expect(pickActiveHref("/admin/one/onboarding", items, "/admin")).toBe("/admin/centri-attivazione");
    expect(pickActiveHref("/admin/beta/report", items, "/admin")).toBe("/admin/beta");
    expect(pickActiveHref("/admin/beta-invites", items, "/admin")).toBe("/admin/beta-invites");
    expect(pickActiveHref("/admin/demo", items, "/admin")).toBe("/admin/crescita");
    expect(pickActiveHref("/admin/centers/x/attivita/y/giorno/2026-12-08", items, "/admin")).toBe("/admin/centers");
    expect(pickActiveHref("/admin/sconosciuta", items, "/admin")).toBeNull();
    // Partner: radice solo esatta, sotto-rotte sulla voce giusta (comportamento di prima).
    const partner = [{ href: "/center" }, { href: "/center/activities" }];
    expect(pickActiveHref("/center/activities/1", partner, "/center")).toBe("/center/activities");
    expect(pickActiveHref("/center/xyz", partner, "/center")).toBeNull();
  });

  test("AO-31 menu in Oggi, Famiglie, Centri, Prenotazioni, Segnalazioni, Analisi e crescita, Impostazioni; nessuna pagina persa", () => {
    const layout = read("app/admin/layout.tsx");
    const groups = [...layout.matchAll(/\.\.\.group\("([^"]+)"/g)].map((m) => m[1]);
    expect(groups).toEqual(["Oggi", "Famiglie", "Centri", "Prenotazioni", "Segnalazioni", "Analisi e crescita", "Impostazioni"]);
    for (const href of ["/admin/beta", "/admin/lista-attesa", "/admin/beta-invites", "/admin/centers", "/admin/centri-attivazione", "/admin/center-leads", "/admin/certifications", "/admin/presenze", "/admin/partner-offers", "/admin/bookings", "/admin/group-requests", "/admin/richieste", "/admin/segnalazioni-beta", "/admin/radar", "/admin/preferiti", "/admin/feature-flags", "/admin/tags", "/admin/school-calendar", "/admin/legal", "/admin/sistema"]) {
      expect(layout, href).toContain(`href: "${href}"`);
    }
    // Dati finti fuori dal menu ma raggiungibili da Analisi e crescita.
    expect(layout).not.toContain('{ href: "/admin/analytics", label');
    expect(layout).not.toContain('{ href: "/admin/activities", label');
    const crescita = read("app/admin/crescita/page.tsx");
    for (const href of ["/admin/analytics", "/admin/demo", "/admin/activities", "/admin/preferiti"]) expect(crescita).toContain(`href: "${href}"`);
    expect(read("app/admin/demo/page.tsx")).toContain('from "@/lib/mock-data"');
    expect(read("app/admin/one/page.tsx")).toContain('export { default } from "../page";');
    // Il banner dell'ultimo deploy esce dal layout: in Oggi e in Stato sistema.
    expect(layout).not.toContain("<DeployStatusBanner");
    expect(read("app/admin/page.tsx")).toContain("<DeployStatusBanner event={deployEvent} />");
    expect(read("app/admin/sistema/page.tsx")).toContain("getRecentDeployEvents(20)");
  });

  test("AO-32 DashboardLayout accende una sola voce (pickActiveHref)", () => {
    const d = read("components/dashboard/DashboardLayout.tsx");
    expect(d).toContain("const activeHref = pickActiveHref(");
    expect(d).toContain("const active = activeHref === item.href;");
  });
});

// ─────────────────────────────────────────────
// Ruoli: ogni lettura Admin passa dal controllo platform_admin
// ─────────────────────────────────────────────
test.describe("Ruoli e sola lettura", () => {
  test("AO-33 letture Admin dietro adminSession(); nessuna scrittura nel data layer", () => {
    const src = read("lib/data/admin-ops.ts");
    expect(src.startsWith('import "server-only";')).toBe(true);
    expect(src).toContain('return profile?.role === "platform_admin" ? supabase : null;');
    for (const fn of ["getAdminBookings", "getAdminInquiries", "getAdminActivityDetail", "getAdminFamilyFunnel"]) {
      const body = src.slice(src.indexOf(`export async function ${fn}`));
      expect(body.slice(0, 600), fn).toContain("await adminSession()");
    }
    expect(src).not.toMatch(/\.(insert|update|upsert|delete)\(/);
  });

  test("AO-34 le pagine nuove leggono solo dal data layer Admin e non usano dati finti", () => {
    for (const f of ["app/admin/page.tsx", "app/admin/bookings/page.tsx", "app/admin/bookings/[id]/page.tsx", "app/admin/centers/[id]/attivita/[activityId]/page.tsx", "app/admin/centers/[id]/attivita/[activityId]/giorno/[date]/page.tsx", "app/admin/famiglie/page.tsx", "app/admin/richieste/page.tsx"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/from "@\/lib\/mock-data"/);
      expect(src, f).not.toContain("createServiceClient");
    }
    expect(read("app/admin/bookings/[id]/page.tsx")).toContain('rawBack.startsWith("?")');
  });

  test("AO-35 importi di prenotazione mai presentati come incassi", () => {
    expect(read("app/admin/bookings/page.tsx")).toContain("non è un incasso");
    expect(read("app/admin/bookings/[id]/page.tsx")).toContain("non è un incasso");
    expect(read("app/admin/page.tsx")).not.toContain("Fatturato");
  });
});

// ─────────────────────────────────────────────
// Retest Parent: orari sovrapposti nel Planner
// ─────────────────────────────────────────────
const entry = (over: Partial<AgendaEntry>): AgendaEntry => ({
  id: "e",
  startTime: "16:00",
  endTime: "17:30",
  title: "Ritmica",
  place: null,
  kids: [{ id: "k1", name: "Lino" }],
  source: "trama",
  status: null,
  ...over,
});

test.describe("Planner: avviso orari sovrapposti prima di Chi accompagna", () => {
  test("AO-36 due attività confermate dello stesso bambino che si sovrappongono → avviso", () => {
    const o = kidTimeOverlaps([entry({ id: "a" }), entry({ id: "b", title: "Piscina", startTime: "17:00", endTime: "18:00", source: "manuale" })]);
    expect(o).toHaveLength(1);
    expect(o[0].window).toBe("17:00–17:30");
    expect(overlapSentence(o[0])).toBe("Lino ha due impegni negli stessi orari (17:00–17:30): Ritmica e Piscina. Controllate prima di decidere chi accompagna.");
  });

  test("AO-37 nessun avviso: orari che si toccano soltanto, figli diversi, in attesa del centro, scuola, senza orario", () => {
    expect(kidTimeOverlaps([entry({ id: "a" }), entry({ id: "b", startTime: "17:30", endTime: "18:30" })])).toHaveLength(0);
    expect(kidTimeOverlaps([entry({ id: "a" }), entry({ id: "b", kids: [{ id: "k2", name: "Sara" }] })])).toHaveLength(0);
    expect(kidTimeOverlaps([entry({ id: "a" }), entry({ id: "b", status: "In attesa del centro" })])).toHaveLength(0);
    expect(kidTimeOverlaps([entry({ id: "a" }), entry({ id: "b", school: true, startTime: "08:00", endTime: "16:30" })])).toHaveLength(0);
    expect(kidTimeOverlaps([entry({ id: "a" }), entry({ id: "b", startTime: null, endTime: null })])).toHaveLength(0);
    // "Confermata in parte" conta come confermata; un istante dentro un intervallo conta.
    expect(kidTimeOverlaps([entry({ id: "a" }), entry({ id: "b", status: "Confermata in parte", startTime: "16:30", endTime: null })])).toHaveLength(1);
  });

  test("AO-38 solo avviso (nessun blocco), dietro flag spento di default con card Release", () => {
    const notice = read("components/nextgen/KidOverlapNotice.tsx");
    expect(notice).toContain("if (!enabled) return null;");
    expect(notice).not.toMatch(/disabled|onClick/);
    const client = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(client.match(/<KidOverlapNotice entries=\{day\.entries\} enabled=\{overlapWarning\} \/>/g)).toHaveLength(3);
    expect(read("app/nextgen/planner/planner-v2-data.ts")).toContain("flagOn(PLANNER_OVERLAP_WARNING_FLAG, userId, role)");
    expect(read("lib/feature-flags/registry.ts")).toMatch(/PLANNER_OVERLAP_WARNING_ENABLED: \{[\s\S]*?defaultValue: false/);
    expect(read("lib/feature-registry/catalog.ts")).toContain('flagName: "PLANNER_OVERLAP_WARNING_ENABLED"');
    expect(read("lib/releases/catalog.ts")).toContain('featureKeys: ["planner_overlap_warning"]');
  });
});
