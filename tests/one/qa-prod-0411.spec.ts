// QA in produzione del 04/11/2026 (Parent + Partner).
// EXTRA-02 (HIGH): due bambini consumavano un solo posto.
// EXTRA-01 (HIGH): la stessa prenotazione era €57 nel portale centri e €54
// per la famiglia.
// Più le difformità della checklist: chip del prezzo in Scopri V2, giorno
// rosso nel calendario, sconto 0% nei testi del gruppo.
// Cause verificate su codice e dati di produzione in sola lettura (vedi
// docs PIPELINE nel Project). Logica pura + controlli sul sorgente; percorsi
// nel browser: pending local verification.
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { confirmedByDate, planRelease, planReserve, unitsForKids, unitsToRelease } from "../../lib/capacity/units";
import { amountBeforeDiscount, amountDue, amountsAfterDayRemoval, dayBookingTotals } from "../../lib/booking-amounts";
import { bookingsSummaryLine, netPrice, priceBeforeDiscount, type BookingV2Input } from "../../lib/nextgen/bookings-v2";
import { buildFamilyTiers } from "../../lib/family-discount";
import { inventoryBlockingSummary, validateDayInventory } from "../../lib/capacity/day-inventory";
import { groupDiscountSuffix } from "../../lib/groups/group-proposal";

const ROOT = path.join(__dirname, "../..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
const TIERS = buildFamilyTiers(null); // 0, 10, 15, 20

// ─────────────────────────────────────────────
// EXTRA-02 — un posto per ogni bambino
// ─────────────────────────────────────────────
test.describe("EXTRA-02 posti: un posto per ogni bambino", () => {
  test("QA-01 posti da togliere = bambini (almeno 1)", () => {
    expect(unitsForKids(2)).toBe(2);
    expect(unitsForKids(3)).toBe(3);
    expect(unitsForKids(1)).toBe(1);
    expect(unitsForKids(0)).toBe(1);
    expect(unitsForKids(null)).toBe(1);
  });

  test("QA-02 caso del QA: 2 posti, 2 bambini → 0 liberi; con 1 libero la riserva non riesce (mai metà famiglia)", () => {
    expect(planReserve(2, 2, 2)).toEqual({ ok: true, next: 0 });
    expect(planReserve(1, 2, 2)).toEqual({ ok: false, next: 1 });
    expect(planReserve(5, 10, 3)).toEqual({ ok: true, next: 2 });
    expect(planReserve(0, 2, 1).ok).toBe(false);
  });

  test("QA-03 restituzione: esattamente i posti presi, mai oltre i totali; righe vecchie restituiscono 1", () => {
    expect(planRelease(0, 2, 2)).toBe(2);
    expect(planRelease(1, 2, 2)).toBe(2);
    expect(unitsToRelease({ capacity_decremented: true, capacity_units: 2 })).toBe(2);
    expect(unitsToRelease({ capacity_decremented: true, capacity_units: 0 })).toBe(1);
    expect(unitsToRelease({ capacity_decremented: true })).toBe(1);
    expect(unitsToRelease({ capacity_decremented: false, capacity_units: 2 })).toBe(0);
  });

  test("QA-04 'già confermati' conta i posti, non le righe", () => {
    const dates = new Map([["d7", "2026-12-07"], ["d8", "2026-12-08"]]);
    const out = confirmedByDate(
      [
        { activity_day_id: "d7", capacity_decremented: true, capacity_units: 2 },
        { activity_day_id: "d8", capacity_decremented: true, capacity_units: 2 },
        { activity_day_id: "d8", capacity_decremented: true, capacity_units: 1 },
        { activity_day_id: "d8", capacity_decremented: false, capacity_units: 0 },
      ],
      dates
    );
    expect(out).toEqual({ "2026-12-07": 2, "2026-12-08": 3 });
    // Con 2 confermati su 2 posti: i totali non scendono sotto 2 e i liberi sono 0.
    expect(validateDayInventory({ date: "2026-12-07", capacity: 2, spotsLeft: 0 }, out["2026-12-07"])).toEqual([]);
    expect(validateDayInventory({ date: "2026-12-07", capacity: 1, spotsLeft: 0 }, out["2026-12-07"])[0].field).toBe("capacity");
  });

  test("QA-05 il servizio canonico usa i bambini per riservare e capacity_units per restituire", () => {
    const src = read("lib/capacity/service.ts");
    expect(src).toContain('from("booking_kids")');
    expect(src).toContain("planReserve(row.spots_left, row.capacity, units)");
    expect(src).toContain("planRelease(row.spots_left, row.capacity, units)");
    expect(src.match(/const units = await bookingUnits\(supabase, bookingId\);/g)?.length).toBe(2); // giorni e settimane
    expect(src.match(/unitsToRelease\((bd|bw)\)/g)?.length).toBe(2);
    expect(src).not.toContain("row.spots_left - 1,");
    expect(read("lib/data/day-confirmed.ts")).toContain("confirmedByDate(");
  });

  test("QA-06 migration 60 preparata; la riconciliazione NON parte da sola con deploy.sh", () => {
    const sql = read("supabase/migration_60_posti_per_bambino.sql");
    expect(sql).toMatch(/^-- STATO: PREPARATA, NON APPLICATA$/m);
    expect(sql).toContain("capacity_units");
    expect(sql).toContain("set capacity_units = 1 where capacity_decremented");
    expect(sql).not.toMatch(/update public\.activity_(days|weeks)/i); // la migration non tocca i posti
    const plan = read("supabase/riconciliazione_60_posti_per_bambino.sql");
    expect(plan).not.toMatch(/^-- STATO: PREPARATA, NON APPLICATA/m);
    expect(plan).toContain("DA DECIDERE");
    expect(plan).toContain("ad.spots_left >= k.kids - greatest(bd.capacity_units, 1)");
  });
});

// ─────────────────────────────────────────────
// EXTRA-01 — stesso importo in entrambi i portali
// ─────────────────────────────────────────────
const booking = (o: Partial<BookingV2Input> = {}): BookingV2Input => ({
  id: "b",
  status: "confirmed",
  partnerDecision: "accepted",
  activityName: "UX DEMO",
  weeks: [],
  dayDates: ["2026-12-08"],
  isDayBased: true,
  kidIds: ["g", "l"],
  kidNames: ["Giulia Test", "Luca Test"],
  totalAmount: 57,
  discountAmount: 3,
  acceptedDayCount: 1,
  totalDayCount: 1,
  waitlistedDayCount: 0,
  partnerProposalNote: null,
  ...o,
});

test.describe("EXTRA-01 importi: total_amount è già scontato", () => {
  test("QA-07 il caso del QA: €30 al giorno, 2 bambini, sconto fratelli 10% → €57 dovuti, €60 barrato", () => {
    const t = dayBookingTotals([30], 2, TIERS);
    expect(t).toEqual({ subtotal: 60, familyDiscount: 3, total: 57 });
    const stored = { totalAmount: t.total, discountAmount: t.familyDiscount };
    expect(amountDue(stored)).toBe(57);
    expect(amountBeforeDiscount(stored)).toBe(60);
    expect(netPrice(booking())).toBe(57);
    expect(priceBeforeDiscount(booking())).toBe(60);
  });

  test("QA-08 riepilogo famiglia: 30 + 30 + 57 = €117 (non 114)", () => {
    const line = bookingsSummaryLine(
      [
        booking({ id: "1", totalAmount: 30, discountAmount: 0, kidIds: ["l"], kidNames: ["Luca"], dayDates: ["2026-12-01"] }),
        booking({ id: "2", totalAmount: 30, discountAmount: 0, kidIds: ["l"], kidNames: ["Luca"], dayDates: ["2026-12-02"] }),
        booking({ id: "3" }),
      ],
      "2026-11-04"
    );
    expect(line).toContain("€117 di prenotazioni confermate nel 2026");
  });

  test("QA-09 1, 2 e 3 figli, giorni e settimane: dovuto = pieno − sconti", () => {
    expect(dayBookingTotals([30, 30], 1, TIERS)).toEqual({ subtotal: 60, familyDiscount: 0, total: 60 });
    expect(dayBookingTotals([30, 30], 2, TIERS)).toEqual({ subtotal: 120, familyDiscount: 6, total: 114 });
    expect(dayBookingTotals([30, 30], 3, TIERS)).toEqual({ subtotal: 180, familyDiscount: 15, total: 165 });
    // Settimane: il valore salvato da BookingClient è già al netto; la lettura non toglie altro.
    expect(amountDue({ totalAmount: 285, discountAmount: 15 })).toBe(285);
  });

  test("QA-10 annullare un giorno: si toglie il prezzo per TUTTI i bambini e lo sconto si ricalcola", () => {
    const before = dayBookingTotals([30, 30], 2, TIERS); // 120 − 6 = 114
    const after = amountsAfterDayRemoval({
      previous: { totalAmount: before.total, discountAmount: before.familyDiscount },
      previousDayPrices: [30, 30],
      remainingDayPrices: [30],
      kidsCount: 2,
      familyTiers: TIERS,
    });
    expect(after).toEqual({ totalAmount: 57, discountAmount: 3 }); // prima: 114 − 30 = 84 con sconto 6
    // Un altro sconto già presente (invito 10%) resta, in proporzione.
    const withInvite = amountsAfterDayRemoval({
      previous: { totalAmount: 120 - 6 - 12, discountAmount: 18 },
      previousDayPrices: [30, 30],
      remainingDayPrices: [30],
      kidsCount: 2,
      familyTiers: TIERS,
    });
    expect(withInvite).toEqual({ totalAmount: 60 - 3 - 6, discountAmount: 9 });
    // Ultimo giorno tolto: zero.
    expect(
      amountsAfterDayRemoval({ previous: { totalAmount: 57, discountAmount: 3 }, previousDayPrices: [30], remainingDayPrices: [], kidsCount: 2, familyTiers: TIERS })
    ).toEqual({ totalAmount: 0, discountAmount: 0 });
  });

  test("QA-11 nessun portale toglie di nuovo lo sconto; annullamento giorno con la regola comune", () => {
    for (const f of ["lib/nextgen/bookings-v2.ts", "app/(main)/prenotazioni/PrenotazioniClient.tsx", "app/nextgen/prenotazioni/PrenotazioniV2Client.tsx"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/totalAmount\s*-\s*b?\.?discountAmount/);
      expect(src, f).not.toContain('line-through">€{b.totalAmount}');
    }
    const resp = read("app/actions/booking-response.ts");
    expect(resp).not.toContain("booking.total_amount - day.price");
    expect(resp).toContain("amountsAfterDayRemoval(");
    expect(resp).toContain("discount_amount: newAmounts.discountAmount");
    expect(read("app/actions/bookings.ts")).toContain("dayBookingTotals(");
    expect(read("components/center/BookingSheet.tsx")).toContain("r.totalAmount ??");
  });
});

// ─────────────────────────────────────────────
// Difformità della checklist
// ─────────────────────────────────────────────
test.describe("Checklist 04/11", () => {
  test("QA-12 F1b: in Scopri V2 il tetto di prezzo si vede fuori dal foglio, con l'unità, e si toglie", () => {
    const src = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    const i = src.indexOf('data-testid="price-cap-chip"');
    expect(i).toBeGreaterThan(-1);
    const block = src.slice(i - 400, i + 500);
    expect(block).toContain("maxPrice < PRICE_ANY");
    expect(block).toContain("setMaxPrice(PRICE_ANY)");
    expect(block).toContain("priceCapChipLabel(maxPrice, priceUnit)");
  });

  test("QA-13 P1a: giorno con errore rosso anche se selezionato; la riga dice che non si salva niente", () => {
    expect(inventoryBlockingSummary([{ date: "2026-12-08", field: "spotsLeft", message: "x" }], () => "8 dic")).toBe(
      "Da correggere prima di salvare: 8 dic. Finché c'è un errore non si salva niente."
    );
    const cal = read("components/AvailabilityCalendar.tsx");
    expect(cal).toContain('isInvalid ? "ring-2 ring-[#B4361F]" : isSelected ? "ring-2 ring-sky" : ""');
    expect(cal).toContain("⚠ Da correggere");
    expect(cal).toContain("inventoryBlockingSummary(issues, formatDate)");
  });

  test("QA-14 sconto di gruppo 0%: non si scrive", () => {
    expect(groupDiscountSuffix(0)).toBe("");
    expect(groupDiscountSuffix("0.0")).toBe("");
    expect(groupDiscountSuffix(10)).toBe(" — sconto 10%");
    expect(groupDiscountSuffix(7.5, " · ")).toBe(" · sconto 7,5%");
    expect(read("lib/data/notifications.ts")).toContain("groupDiscountSuffix(req.discountPercent)");
    expect(read("app/nextgen/HomeDashboardClient.tsx")).toContain("groupDiscountSuffix(coordinationSignal.discountPercent)");
  });
});
