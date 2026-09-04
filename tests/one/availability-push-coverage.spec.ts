// NOTA DI ESECUZIONE (04/09/2026): questo file importa (transitivamente)
// lib/notifications/availability-push.ts, marcato "server-only" — il
// pacchetto reale "server-only" lancia SEMPRE un errore se risolto senza la
// condition "react-server" (che Next imposta internamente, ma il runner
// Node di Playwright no). Va eseguito con:
//   NODE_OPTIONS=--conditions=react-server npx playwright test tests/one/availability-push-coverage.spec.ts --project=chromium
// Non impostato di default in package.json "test" per non rischiare di
// alterare la risoluzione moduli del webServer (`npm run dev`) usato dagli
// altri ~880 test E2E dello stesso comando — vedi stessa nota in
// tests/one/capacity-concurrency.spec.ts e capacity-release-notify-trigger.spec.ts.
import { test, expect } from "@playwright/test";
import { getKidsAlreadyCoveredForPeriod } from "@/lib/notifications/availability-push";

// TRAMA FINAL HARDENING §4-8 (feature push "è tornato un posto", 04/09/2026)
// — getKidsAlreadyCoveredForPeriod() è il controllo che unifica "settimana
// ancora scoperta in Planner" e "nessuna prenotazione attiva per quel
// bambino in quel periodo" (vedi punto 4 nel commento di testa del file):
// un bambino con QUALUNQUE prenotazione attiva che si sovrappone al periodo
// non deve mai ricevere la push "è tornato un posto" per quel periodo. Test
// locali con un client Supabase fittizio minimale (stesso principio di
// tests/one/capacity-concurrency.spec.ts): replica solo la catena
// from("bookings").select(...).in("parent_id", ...).neq("status", "cancelled").

interface FakeBookingRow {
  booking_kids: { kid_id: string }[];
  booking_weeks: { activity_weeks: { start_date: string; end_date: string } | null }[];
  booking_days: { activity_days: { date: string } | null }[];
  status: string;
  parent_id: string;
}

function createFakeService(rows: FakeBookingRow[]) {
  return {
    from(table: string) {
      if (table !== "bookings") throw new Error(`fake service non prevede la tabella ${table}`);
      let neqCol: string | null = null;
      let neqVal: string | null = null;
      return {
        select() {
          return {
            in(_col: string, _ids: string[]) {
              void _col;
              void _ids;
              return {
                neq(col: string, val: string) {
                  neqCol = col;
                  neqVal = val;
                  const filtered = rows.filter((r) => !(neqCol === "status" && r[neqCol as "status"] === neqVal));
                  return Promise.resolve({
                    data: filtered.map((r) => ({
                      booking_kids: r.booking_kids,
                      booking_weeks: r.booking_weeks,
                      booking_days: r.booking_days,
                    })),
                    error: null,
                  });
                },
              };
            },
          };
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

test.describe("AVAIL — getKidsAlreadyCoveredForPeriod", () => {
  test("AVAIL-01 - kid con una settimana che si sovrappone al periodo -> risulta coperto", async () => {
    const service = createFakeService([
      {
        parent_id: "p1",
        status: "confirmed",
        booking_kids: [{ kid_id: "kid-A" }],
        booking_weeks: [{ activity_weeks: { start_date: "2026-07-06", end_date: "2026-07-10" } }],
        booking_days: [],
      },
    ]);
    const covered = await getKidsAlreadyCoveredForPeriod(service, ["p1"], "2026-07-06", "2026-07-10");
    expect(covered.has("kid-A")).toBe(true);
  });

  test("AVAIL-02 - prenotazione CANCELLATA per lo stesso periodo -> non conta come copertura", async () => {
    const service = createFakeService([
      {
        parent_id: "p1",
        status: "cancelled",
        booking_kids: [{ kid_id: "kid-A" }],
        booking_weeks: [{ activity_weeks: { start_date: "2026-07-06", end_date: "2026-07-10" } }],
        booking_days: [],
      },
    ]);
    const covered = await getKidsAlreadyCoveredForPeriod(service, ["p1"], "2026-07-06", "2026-07-10");
    expect(covered.has("kid-A")).toBe(false);
  });

  test("AVAIL-03 - prenotazione a giorno spot dentro il periodo -> risulta coperto (ramo booking_days)", async () => {
    const service = createFakeService([
      {
        parent_id: "p1",
        status: "confirmed",
        booking_kids: [{ kid_id: "kid-B" }],
        booking_weeks: [],
        booking_days: [{ activity_days: { date: "2026-07-08" } }],
      },
    ]);
    const covered = await getKidsAlreadyCoveredForPeriod(service, ["p1"], "2026-07-06", "2026-07-10");
    expect(covered.has("kid-B")).toBe(true);
  });

  test("AVAIL-04 - prenotazione per un periodo NON sovrapposto -> non risulta coperto", async () => {
    const service = createFakeService([
      {
        parent_id: "p1",
        status: "confirmed",
        booking_kids: [{ kid_id: "kid-C" }],
        booking_weeks: [{ activity_weeks: { start_date: "2026-08-03", end_date: "2026-08-07" } }],
        booking_days: [],
      },
    ]);
    const covered = await getKidsAlreadyCoveredForPeriod(service, ["p1"], "2026-07-06", "2026-07-10");
    expect(covered.has("kid-C")).toBe(false);
  });

  test("AVAIL-05 - nessun parentId candidato -> set vuoto, nessuna query eseguita (short-circuit)", async () => {
    const service = createFakeService([]);
    const covered = await getKidsAlreadyCoveredForPeriod(service, [], "2026-07-06", "2026-07-10");
    expect(covered.size).toBe(0);
  });
});
