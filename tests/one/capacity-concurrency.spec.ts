import { test, expect } from "@playwright/test";
import { reserveWeekCapacity, releaseWeekCapacity } from "@/lib/capacity/service";

// PRE-LAUNCH REMEDIATION WAVE 1 — R-07 (decisione Fabrizio, 24/08/2026):
// reserveSpot/releaseSpot (lib/capacity/service.ts) leggevano spots_left e
// scrivevano il nuovo valore in due passi separati, senza verificare che la
// riga fosse ancora nello stato letto — due reserve quasi simultanee
// sull'ultimo posto potevano entrambe "vincere". Il fix (Compare-And-Swap
// applicativo, vedi commento nel file) elimina questo overbooking senza
// nuove tabelle/migrazioni. Fabrizio ha chiesto esplicitamente un test di
// concorrenza che dimostri che, su due prenotazioni simultanee per l'ultimo
// posto, solo una delle due riesce.
//
// Un test contro Supabase reale che dimostri UNA vera race condition di
// rete è intrinsecamente non deterministico (dipende dal timing esatto di
// due richieste HTTP) — qui usiamo invece un client Supabase FITTIZIO che
// riproduce deterministicamente lo scenario peggiore: due lettori che
// vedono la STESSA riga PRIMA che uno dei due scriva (il caso che il CAS
// deve rifiutare), controllando esplicitamente l'ordine read→read→write→write
// invece di sperare che accada per timing. Questo NON sostituisce un test
// dal vivo contro Supabase (fuori scope per questo sandbox, Fabrizio esegue
// i test live) — dimostra che la LOGICA del CAS è corretta nel caso che
// prima la causava, in modo ripetibile al 100% e senza infrastruttura.

interface FakeRow {
  spots_left: number;
  capacity: number;
}

/**
 * Client Supabase fittizio minimale — implementa solo la catena di chiamate
 * usata da reserveSpot/releaseSpot: from().select().eq().single() e
 * from().update().eq().eq().select(). Il flag `pauseWriteUntilBothRead`
 * permette di controllare l'ordine: la prima chiamata a select() attende
 * che ANCHE la seconda abbia letto, prima di procedere alla propria
 * update() — riproducendo così, in modo deterministico, il caso in cui
 * entrambi i lettori hanno già in mano lo stesso spots_left prima che
 * qualcuno scriva.
 */
function createFakeSupabase(initialRow: FakeRow) {
  const store: Record<string, FakeRow> = { "row-1": { ...initialRow } };
  let selectCallCount = 0;
  let releaseFirstSelect: (() => void) | null = null;
  const bothReadGate = new Promise<void>((resolve) => {
    releaseFirstSelect = resolve;
  });

  const client = {
    from(table: string) {
      void table;
      return {
        select() {
          return {
            eq(_col: string, id: string) {
              void _col;
              return {
                async single() {
                  selectCallCount++;
                  if (selectCallCount === 1) {
                    // Il primo lettore attende che il secondo abbia letto
                    // anche lui, PRIMA di restituire il valore — così
                    // entrambi partono dalla stessa fotografia dello stato,
                    // esattamente come due richieste HTTP quasi simultanee
                    // che arrivano al database prima che nessuna delle due
                    // abbia ancora scritto.
                    await bothReadGate;
                  } else if (selectCallCount === 2 && releaseFirstSelect) {
                    releaseFirstSelect();
                    releaseFirstSelect = null;
                  }
                  return { data: { ...store[id] }, error: null };
                },
              };
            },
          };
        },
        update(patch: Partial<FakeRow>) {
          let idFilter: string | null = null;
          let casCheckValue: number | null = null;
          const builder = {
            eq(col: string, value: string | number) {
              if (col === "id") idFilter = String(value);
              if (col === "spots_left") casCheckValue = Number(value);
              return builder;
            },
            select() {
              // Applica l'update SOLO se la condizione CAS (spots_left
              // ancora uguale a quello letto da questo chiamante) è vera —
              // stesso comportamento reale di `.eq("spots_left", ...)` in
              // una query Postgres/PostgREST.
              if (!idFilter) return Promise.resolve({ data: [], error: null });
              const current = store[idFilter];
              if (!current || (casCheckValue !== null && current.spots_left !== casCheckValue)) {
                return Promise.resolve({ data: [], error: null }); // CAS fallito: 0 righe
              }
              store[idFilter] = { ...current, ...patch };
              return Promise.resolve({ data: [{ spots_left: store[idFilter].spots_left }], error: null });
            },
          };
          return builder;
        },
      };
    },
  };

  return { client, store };
}

test.describe("lib/capacity/service — CAS concorrenza (R-07, Wave 1)", () => {
  test("TC-N673 - due reserve simultanee sull'ULTIMO posto: solo una riesce, nessun overbooking", async () => {
    const { client, store } = createFakeSupabase({ spots_left: 1, capacity: 10 });

    // reserveWeekCapacity ha bisogno di una riga booking_weeks non ancora
    // decrementata — la funzione fittizia sopra copre solo activity_weeks
    // (dove vive spots_left), quindi qui invochiamo direttamente lo stesso
    // meccanismo tramite reserveWeekCapacity con due bookingId diversi ma
    // la STESSA weekId (stesso scenario reale: due famiglie diverse
    // prenotano l'ultimo posto della stessa settimana). Per isolare il CAS
    // puro (senza il livello booking_weeks, non rilevante per questo bug),
    // estendiamo il fake per rispondere anche alle query booking_weeks.
    const supabaseWithBookingWeeks = {
      from(table: string) {
        if (table === "booking_weeks") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return { single: async () => ({ data: { capacity_decremented: false }, error: null }) };
                    },
                  };
                },
              };
            },
            update() {
              return { eq: () => ({ eq: async () => ({ data: null, error: null }) }) };
            },
          };
        }
        return client.from(table);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const [resultA, resultB] = await Promise.all([
      reserveWeekCapacity(supabaseWithBookingWeeks, "booking-A", "row-1", "corr-a"),
      reserveWeekCapacity(supabaseWithBookingWeeks, "booking-B", "row-1", "corr-b"),
    ]);

    const succeeded = [resultA, resultB].filter((r) => r.applied);
    const rejected = [resultA, resultB].filter((r) => !r.applied);

    // L'invariante che il bug violava: su un solo posto disponibile e due
    // richieste concorrenti, ESATTAMENTE una deve riuscire, mai entrambe.
    expect(succeeded.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(succeeded[0].spotsLeft).toBe(0);

    // Stato finale del "database": mai negativo, coerente con l'unica
    // riserva realmente applicata.
    expect(store["row-1"].spots_left).toBe(0);
  });
});
