// NOTA DI ESECUZIONE (04/09/2026): lib/capacity/service.ts importa (dalla
// Fix #135 di questa wave) lib/notifications/availability-push.ts, marcato
// "server-only" — va eseguito con:
//   NODE_OPTIONS=--conditions=react-server npx playwright test tests/one/capacity-release-notify-trigger.spec.ts --project=chromium
// Stessa nota in tests/one/capacity-concurrency.spec.ts (stesso import
// diventato transitivo con questa wave) e availability-push-coverage.spec.ts.
import { test, expect } from "@playwright/test";
import { releaseWeekCapacity } from "@/lib/capacity/service";

// TRAMA FINAL HARDENING §4-8 (feature push "è tornato un posto", 04/09/2026)
// — STATUS-01..03: CapacityMutationResult.wasZeroBeforeRelease è il segnale
// esatto che decide se lib/notifications/availability-push.ts viene
// invocato da releaseWeekCapacity. Deve essere true SOLO quando spots_left
// era ESATTAMENTE 0 nell'istante immediatamente precedente il release
// vincente — mai per un release "normale" (es. 3 posti liberi -> 4), che
// non è una vera transizione "da esaurito a disponibile".
//
// notifyAvailabilityBackInStock() non viene mockato qui: è già best-effort
// per costruzione (mai un'eccezione, no-op silenzioso se
// SUPABASE_SERVICE_ROLE_KEY non è configurata nell'ambiente di test — vedi
// lib/notifications/availability-push.ts) — questi test verificano solo il
// valore restituito da releaseWeekCapacity, che è il contratto che innesca
// (o non innesca) quella chiamata, non il suo effetto a valle.

interface FakeActivityWeekRow {
  spots_left: number;
  capacity: number;
  activity_id: string;
}

function createFakeSupabase(weekRow: FakeActivityWeekRow, bookingWeekDecremented = true) {
  const activityWeeks: Record<string, FakeActivityWeekRow> = { "week-1": { ...weekRow } };
  const bookingWeeks: Record<string, { capacity_decremented: boolean }> = {
    "booking-1:week-1": { capacity_decremented: bookingWeekDecremented },
  };

  const client = {
    from(table: string) {
      if (table === "booking_weeks") {
        return {
          select() {
            return {
              eq(_c1: string, bookingId: string) {
                void _c1;
                return {
                  eq(_c2: string, weekId: string) {
                    void _c2;
                    return {
                      single: async () => ({ data: bookingWeeks[`${bookingId}:${weekId}`] ?? null, error: null }),
                    };
                  },
                };
              },
            };
          },
          update(patch: { capacity_decremented: boolean }) {
            return {
              eq(_c1: string, bookingId: string) {
                void _c1;
                return {
                  eq(_c2: string, weekId: string) {
                    void _c2;
                    const key = `${bookingId}:${weekId}`;
                    if (bookingWeeks[key]) bookingWeeks[key] = { ...bookingWeeks[key], ...patch };
                    return Promise.resolve({ data: null, error: null });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "activity_weeks") {
        return {
          select(cols: string) {
            return {
              eq(_c: string, id: string) {
                void _c;
                return {
                  single: async () => {
                    const row = activityWeeks[id];
                    if (!row) return { data: null, error: null };
                    if (cols.includes("activity_id") && !cols.includes("spots_left")) {
                      return { data: { activity_id: row.activity_id }, error: null };
                    }
                    return { data: { spots_left: row.spots_left, capacity: row.capacity }, error: null };
                  },
                };
              },
            };
          },
          update(patch: { spots_left: number }) {
            let idFilter: string | null = null;
            let casValue: number | null = null;
            const builder = {
              eq(col: string, value: string | number) {
                if (col === "id") idFilter = String(value);
                if (col === "spots_left") casValue = Number(value);
                return builder;
              },
              select() {
                if (!idFilter) return Promise.resolve({ data: [], error: null });
                const current = activityWeeks[idFilter];
                if (!current || (casValue !== null && current.spots_left !== casValue)) {
                  return Promise.resolve({ data: [], error: null });
                }
                activityWeeks[idFilter] = { ...current, ...patch };
                return Promise.resolve({ data: [{ spots_left: activityWeeks[idFilter].spots_left }], error: null });
              },
            };
            return builder;
          },
        };
      }

      throw new Error(`fake service non prevede la tabella ${table}`);
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, activityWeeks };
}

test.describe("STATUS — releaseWeekCapacity: wasZeroBeforeRelease come trigger esatto della push disponibilità", () => {
  test("STATUS-01 - release da spots_left=0 -> wasZeroBeforeRelease=true (vera transizione 0->disponibile)", async () => {
    const { client } = createFakeSupabase({ spots_left: 0, capacity: 10, activity_id: "act-1" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await releaseWeekCapacity(client as any, "booking-1", "week-1");
    expect(result.applied).toBe(true);
    expect(result.wasZeroBeforeRelease).toBe(true);
    expect(result.spotsLeft).toBe(1);
  });

  test("STATUS-02 - release da spots_left=3 (non esaurito) -> wasZeroBeforeRelease=false (nessuna push da innescare)", async () => {
    const { client } = createFakeSupabase({ spots_left: 3, capacity: 10, activity_id: "act-1" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await releaseWeekCapacity(client as any, "booking-1", "week-1");
    expect(result.applied).toBe(true);
    expect(result.wasZeroBeforeRelease).toBe(false);
    expect(result.spotsLeft).toBe(4);
  });

  test("STATUS-03 - booking_weeks.capacity_decremented=false (mai riservato) -> release è un no-op, nessun trigger", async () => {
    const { client } = createFakeSupabase({ spots_left: 0, capacity: 10, activity_id: "act-1" }, false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await releaseWeekCapacity(client as any, "booking-1", "week-1");
    expect(result.applied).toBe(false);
    expect(result.wasZeroBeforeRelease).toBeUndefined();
  });
});
