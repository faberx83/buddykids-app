import { test as pureTest, expect as pureExpect } from "@playwright/test";
import {
  buildSharedPlanEntriesFromRows,
  statusFromDecision,
  type RawEntryBookingRow,
} from "@/lib/plan-shares/build-entries";

// TRAMA BETA v1.1.1 — FINAL FUNCTIONAL + UI CONSISTENCY FIXES (punto 16).
// Copre SHARE-01..06. Funzione pura (lib/plan-shares/build-entries.ts, NESSUN
// import "server-only"/Supabase/rete) — gira in QUALUNQUE ambiente, incluso
// questo sandbox, senza deploy reale né service_role. Stesso principio già
// stabilito in questa sessione per responsibility-tone.ts/planner-insights.ts:
// la logica di dominio va estratta a parte per essere testabile senza
// browser.
//
// Fixture SHARE-01/03/05 ricalcano ESATTAMENTE lo scenario reale verificato
// via query Supabase read-only durante la ROOT CAUSE ANALYSIS (parent_id
// 19fb4a74…, kid "Lino", attività "Prova FP"/"test", Settembre 2026): Sett.14
// (1-4/9) interamente accettata, Sett.15 (7-8/9, parziale) e Sett.16
// (14-18/9) ancora "in attesa di conferma del centro" — stesso identico
// pattern che generava l'empty state prima del fix.

function dayRow(overrides: Partial<RawEntryBookingRow> & { booking_days: RawEntryBookingRow["booking_days"] }): RawEntryBookingRow {
  return {
    partner_decision: "pending",
    activities: { name: "Prova FP" },
    booking_weeks: null,
    booking_kids: [{ kid_id: "kid-lino", kids: { name: "Lino" } }],
    ...overrides,
  };
}

pureTest.describe("TRAMA BETA v1.1.1 — SHARE-01..06: buildSharedPlanEntriesFromRows (ROOT CAUSE FIX, punto 1-3)", () => {
  pureTest("SHARE-01 - week share con booking a giorni pending visibile nel Planner NON restituisce empty state", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({
        booking_days: [
          { partner_decision: "pending", activity_days: { date: "2026-09-07" } },
          { partner_decision: "pending", activity_days: { date: "2026-09-08" } },
        ],
      }),
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-09-07", "2026-09-11", 2026);
    pureExpect(entries.length).toBeGreaterThan(0);
  });

  pureTest("SHARE-02 - week share include l'attività corretta nel range (Settimana 14, tutti i giorni accettati)", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({
        booking_days: [
          { partner_decision: "accepted", activity_days: { date: "2026-09-01" } },
          { partner_decision: "accepted", activity_days: { date: "2026-09-02" } },
          { partner_decision: "accepted", activity_days: { date: "2026-09-03" } },
          { partner_decision: "accepted", activity_days: { date: "2026-09-04" } },
        ],
      }),
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-08-31", "2026-09-04", 2026);
    pureExpect(entries).toHaveLength(1);
    pureExpect(entries[0]).toMatchObject({
      kidName: "Lino",
      activityName: "Prova FP",
      weekStartDate: "2026-08-31",
      weekEndDate: "2026-09-04",
      status: "confirmed",
    });
  });

  pureTest("SHARE-03 - month share include tutte le attività comprese nel periodo (Sett.14 confirmed + Sett.15/16 pending)", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({
        activities: { name: "Prova FP" },
        booking_days: [
          { partner_decision: "accepted", activity_days: { date: "2026-09-01" } },
          { partner_decision: "accepted", activity_days: { date: "2026-09-02" } },
          { partner_decision: "accepted", activity_days: { date: "2026-09-03" } },
          { partner_decision: "accepted", activity_days: { date: "2026-09-04" } },
          { partner_decision: "pending", activity_days: { date: "2026-09-07" } },
          { partner_decision: "pending", activity_days: { date: "2026-09-08" } },
        ],
      }),
      dayRow({
        activities: { name: "test" },
        booking_days: [
          { partner_decision: "pending", activity_days: { date: "2026-09-14" } },
          { partner_decision: "pending", activity_days: { date: "2026-09-15" } },
          { partner_decision: "pending", activity_days: { date: "2026-09-16" } },
          { partner_decision: "pending", activity_days: { date: "2026-09-17" } },
          { partner_decision: "pending", activity_days: { date: "2026-09-18" } },
        ],
      }),
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-09-01", "2026-09-18", 2026);
    // 3 settimane distinte: Sett.14 (confirmed), Sett.15 (pending), Sett.16 (pending).
    pureExpect(entries).toHaveLength(3);
    pureExpect(entries.map((e) => e.status)).toEqual(["confirmed", "pending", "pending"]);
    pureExpect(entries.every((e) => e.kidName === "Lino")).toBe(true);
  });

  pureTest("SHARE-04 - attività fuori range (giorni prima/dopo lo scope) non viene inclusa", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({
        booking_days: [
          { partner_decision: "accepted", activity_days: { date: "2026-08-20" } }, // prima dello scope
          { partner_decision: "accepted", activity_days: { date: "2026-09-01" } }, // dentro lo scope
          { partner_decision: "accepted", activity_days: { date: "2026-09-25" } }, // dopo lo scope
        ],
      }),
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-08-31", "2026-09-04", 2026);
    pureExpect(entries).toHaveLength(1);
    pureExpect(entries[0].weekStartDate).toBe("2026-08-31");
    pureExpect(entries[0].weekEndDate).toBe("2026-09-04");
  });

  pureTest("SHARE-05 - pending booking rappresentato con stato coerente, non eliminato (non finge di essere confermato)", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({
        booking_days: [
          { partner_decision: "pending", activity_days: { date: "2026-09-07" } },
          { partner_decision: "pending", activity_days: { date: "2026-09-08" } },
        ],
      }),
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-09-07", "2026-09-11", 2026);
    pureExpect(entries).toHaveLength(1);
    pureExpect(entries[0].status).toBe("pending"); // MAI "confirmed" per un giorno non ancora accettato dal centro
  });

  // Caso complementare, non esplicitamente numerato ma diretta conseguenza
  // del punto 2 ("giorni rifiutati non fanno parte del piano reale"): un
  // giorno "rejected" non produce alcuna entry (né confirmed né pending).
  pureTest("SHARE-05b - un giorno rejected dal centro non produce alcuna entry pubblica", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({
        booking_days: [{ partner_decision: "rejected", activity_days: { date: "2026-09-07" } }],
      }),
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-09-07", "2026-09-11", 2026);
    pureExpect(entries).toHaveLength(0);
  });

  pureTest("SHARE-06 - share pubblica non espone dati personali/tecnici non necessari (solo kidName/activityName/date/status)", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({
        booking_days: [{ partner_decision: "accepted", activity_days: { date: "2026-09-01" } }],
      }),
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-08-31", "2026-09-04", 2026);
    pureExpect(entries).toHaveLength(1);
    // Nessun parent_id/kid_id/booking_id/email/telefono/indirizzo/metadato
    // tecnico: SOLO i 5 campi pubblici approvati (punto 3).
    pureExpect(Object.keys(entries[0]).sort()).toEqual(
      ["activityName", "kidName", "status", "weekEndDate", "weekStartDate"].sort()
    );
  });

  // Ramo booking_weeks (settimana intera) — verifica che il secondo bug
  // trovato (bookings.status "confirmed" travestiva una prenotazione ancora
  // "pending" lato centro) resti corretto anche per QUESTO ramo, non solo
  // per booking_days.
  pureTest("SHARE-02b - booking a settimana intera con partner_decision 'pending' NON appare 'confirmed'", () => {
    const rows: RawEntryBookingRow[] = [
      {
        partner_decision: "pending",
        activities: { name: "Summer Camp Acquatico" },
        booking_weeks: [{ activity_weeks: { start_date: "2026-06-01", end_date: "2026-06-05" } }],
        booking_days: null,
        booking_kids: [{ kid_id: "kid-lino", kids: { name: "Lino" } }],
      },
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-06-01", "2026-06-05", 2026);
    pureExpect(entries).toHaveLength(1);
    pureExpect(entries[0].status).toBe("pending");
  });

  pureTest("statusFromDecision - 'accepted' -> confirmed, qualunque altro valore -> pending", () => {
    pureExpect(statusFromDecision("accepted")).toBe("confirmed");
    for (const v of ["pending", "proposed", "rejected", null, undefined]) {
      pureExpect(statusFromDecision(v as string | null | undefined)).toBe("pending");
    }
  });
});
