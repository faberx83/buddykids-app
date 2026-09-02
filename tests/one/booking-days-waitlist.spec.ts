import { test, expect } from "@playwright/test";
import { applyDayDecision } from "@/lib/booking-response/apply-day-decision";

// Segnalazione beta (genitore, /center/prenotazioni, 01/09/2026, verbatim):
// "Nella accettazione delle richieste di prenotazione bisogna prevedere
// anche il seleziona tutto su più giorni. Domanda: come si verifica se ho
// ancora disponibilità in quei giorni? Da considerare anche ipotesi di
// messa in lista d'attesa".
//
// Analizzando la domanda sulla disponibilità è emerso un bug REALE,
// indipendente dalla feature: app/actions/booking-response.ts scriveva
// partner_decision='accepted' su booking_days PRIMA di verificare se
// reserveDayCapacity riusciva davvero — un giorno già pieno (spots_left=0)
// risultava comunque "Accettato" in UI, overbooking silenzioso mai
// segnalato. applyDayDecision (estratta come helper condiviso da
// respondToBookingDayAction/respondToBookingDaysAction/
// promoteWaitlistedDayAction) corregge l'ordine: verifica PRIMA, scrive
// DOPO. Questi test dimostrano l'invariante — MAI "accepted" su un giorno
// pieno — e il comportamento della nuova lista d'attesa (migrazione 34,
// supabase/migration_34_booking_days_waitlist.sql, NON applicata da questa
// sessione), incluso il fallback sicuro quando quella migrazione non è
// ancora applicata in un dato ambiente.
//
// Stesso principio di tests/one/capacity-concurrency.spec.ts: un client
// Supabase FITTIZIO in memoria invece di Supabase reale (girare contro
// Supabase reale è un'azione che questa sessione non esegue — solo
// Fabrizio applica migrazioni/scrive su produzione), abbastanza fedele alla
// forma reale delle chiamate (.from().select().eq().eq().single(),
// .from().update().eq().eq()) da esercitare la logica vera, non una sua
// riscrittura.

interface BookingDayRow {
  booking_id: string;
  activity_day_id: string;
  partner_decision: string;
  capacity_decremented: boolean;
  waitlisted_at: string | null;
}
interface BookingRow {
  id: string;
  read_by_parent: boolean;
  read_by_center: boolean;
  responded_at: string | null;
  [key: string]: unknown;
}
interface ActivityDayRow {
  id: string;
  date: string;
  spots_left: number;
  capacity: number;
}

interface FakeTables {
  booking_days: BookingDayRow[];
  bookings: BookingRow[];
  activity_days: ActivityDayRow[];
}

/**
 * Client Supabase fittizio minimale, generico sulle tre tabelle usate da
 * applyDayDecision (booking_days, bookings, activity_days — quest'ultima
 * anche da lib/capacity/service.ts::reserveDayCapacity, chiamata da
 * applyDayDecision). `allowWaitlistedValue=false` riproduce un ambiente
 * dove supabase/migration_34_booking_days_waitlist.sql NON è ancora stata
 * applicata: la scrittura di partner_decision='waitlisted' fallisce con lo
 * stesso tipo di errore di un vincolo CHECK violato, esattamente come
 * accadrebbe in produzione prima che Fabrizio esegua la migrazione.
 */
function makeFakeSupabase(tables: FakeTables, opts?: { allowWaitlistedValue?: boolean }) {
  const allowWaitlisted = opts?.allowWaitlistedValue ?? true;

  function matches(row: Record<string, unknown>, filters: Record<string, unknown>): boolean {
    return Object.entries(filters).every(([k, v]) => row[k] === v);
  }

  function selectChain(table: keyof FakeTables, filters: Record<string, unknown>) {
    return {
      eq(col: string, val: unknown) {
        return selectChain(table, { ...filters, [col]: val });
      },
      async single() {
        const rows = tables[table] as unknown as Record<string, unknown>[];
        const row = rows.find((r) => matches(r, filters));
        return { data: row ? { ...row } : null, error: row ? null : { message: `${String(table)}: riga non trovata` } };
      },
    };
  }

  function updateChain(table: keyof FakeTables, patch: Record<string, unknown>, filters: Record<string, unknown>) {
    async function exec() {
      if (table === "booking_days" && patch.partner_decision === "waitlisted" && !allowWaitlisted) {
        return {
          data: null,
          error: { message: 'new row for relation "booking_days" violates check constraint "booking_days_partner_decision_check"' },
        };
      }
      const rows = tables[table] as unknown as Record<string, unknown>[];
      const idx = rows.findIndex((r) => matches(r, filters));
      if (idx === -1) return { data: [], error: null };
      rows[idx] = { ...rows[idx], ...patch };
      return { data: [rows[idx]], error: null };
    }
    const chain = {
      eq(col: string, val: unknown) {
        filters = { ...filters, [col]: val };
        return chain;
      },
      select() {
        return { then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => exec().then(resolve, reject) };
      },
      then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
        return exec().then(resolve, reject);
      },
    };
    return chain;
  }

  return {
    from(table: keyof FakeTables) {
      return {
        select(_cols?: string) {
          void _cols;
          return selectChain(table, {});
        },
        update(patch: Record<string, unknown>) {
          return updateChain(table, patch, {});
        },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function baseTables(overrides?: { spotsLeft?: number; capacityDecremented?: boolean }): FakeTables {
  return {
    booking_days: [
      {
        booking_id: "booking-1",
        activity_day_id: "day-1",
        partner_decision: "pending",
        capacity_decremented: overrides?.capacityDecremented ?? false,
        waitlisted_at: null,
      },
    ],
    bookings: [{ id: "booking-1", read_by_parent: true, read_by_center: false, responded_at: null, parent_id: null }],
    activity_days: [{ id: "day-1", date: "2026-09-10", spots_left: overrides?.spotsLeft ?? 3, capacity: 10 }],
  };
}

test.describe("app/actions/booking-response — applyDayDecision (lista d'attesa + fix overbooking, 02/09/2026)", () => {
  test("TC-WL01 - giorno con posto libero: accettato, capacità decrementata", async () => {
    const tables = baseTables({ spotsLeft: 3 });
    const supabase = makeFakeSupabase(tables);

    const result = await applyDayDecision(supabase, "booking-1", "day-1", "accepted");

    expect(result.status).toBe("accepted");
    expect(tables.booking_days[0].partner_decision).toBe("accepted");
    expect(tables.booking_days[0].capacity_decremented).toBe(true);
    expect(tables.activity_days[0].spots_left).toBe(2);
  });

  test("TC-WL02 - giorno PIENO (spots_left=0), lista d'attesa disponibile: waitlisted, MAI accettato, capacità invariata", async () => {
    const tables = baseTables({ spotsLeft: 0 });
    const supabase = makeFakeSupabase(tables, { allowWaitlistedValue: true });

    const result = await applyDayDecision(supabase, "booking-1", "day-1", "accepted");

    // L'invariante centrale del fix: un giorno pieno non diventa MAI
    // "accepted" — prima del fix questo era esattamente il bug (overbooking
    // silenzioso).
    expect(result.status).not.toBe("accepted");
    expect(result.status).toBe("waitlisted");
    expect(tables.booking_days[0].partner_decision).toBe("waitlisted");
    expect(tables.booking_days[0].waitlisted_at).not.toBeNull();
    expect(tables.booking_days[0].capacity_decremented).toBe(false);
    expect(tables.activity_days[0].spots_left).toBe(0); // invariata, nessun posto consumato per un giorno pieno
  });

  test("TC-WL03 - giorno pieno, migrazione 34 NON applicata: degrado sicuro a 'pending', nessun overbooking, nessun errore opaco", async () => {
    const tables = baseTables({ spotsLeft: 0 });
    const supabase = makeFakeSupabase(tables, { allowWaitlistedValue: false });

    const result = await applyDayDecision(supabase, "booking-1", "day-1", "accepted");

    expect(result.status).toBe("waitlisted_unavailable");
    // Fallback esplicito a 'pending' — MAI lasciato in uno stato intermedio
    // inconsistente, e MAI 'accepted' nonostante il giorno sia pieno.
    expect(tables.booking_days[0].partner_decision).toBe("pending");
    expect(tables.booking_days[0].capacity_decremented).toBe(false);
    expect(tables.activity_days[0].spots_left).toBe(0);
  });

  test("TC-WL04 - rifiuto esplicito: nessuna verifica di capacità, nessuna chiamata a reserveDayCapacity", async () => {
    const tables = baseTables({ spotsLeft: 3 });
    const supabase = makeFakeSupabase(tables);

    const result = await applyDayDecision(supabase, "booking-1", "day-1", "rejected");

    expect(result.status).toBe("rejected");
    expect(tables.booking_days[0].partner_decision).toBe("rejected");
    expect(tables.activity_days[0].spots_left).toBe(3); // invariata
  });

  test("TC-WL05 - idempotenza: giorno già capacity_decremented=true, riaccettato non decrementa una seconda volta", async () => {
    const tables = baseTables({ spotsLeft: 3, capacityDecremented: true });
    tables.booking_days[0].partner_decision = "accepted";
    const supabase = makeFakeSupabase(tables);

    const result = await applyDayDecision(supabase, "booking-1", "day-1", "accepted");

    expect(result.status).toBe("accepted");
    expect(tables.activity_days[0].spots_left).toBe(3); // invariata: nessun doppio decremento
  });

  test("TC-WL06 - giorno inesistente: errore esplicito, nessuna scrittura", async () => {
    const tables = baseTables();
    const supabase = makeFakeSupabase(tables);

    const result = await applyDayDecision(supabase, "booking-1", "day-inesistente", "accepted");

    expect(result.status).toBe("error");
    expect(tables.activity_days[0].spots_left).toBe(3); // invariata
  });
});
