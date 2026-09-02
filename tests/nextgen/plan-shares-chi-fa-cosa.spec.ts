import { test as pureTest, expect as pureExpect } from "@playwright/test";
import { buildSharedPlanEntriesFromRows, type RawEntryBookingRow } from "@/lib/plan-shares/build-entries";
import type { WeekResponsibility } from "@/lib/nextgen/responsibility-options";
import type { ParentRole } from "@/lib/data/profile";

// TRAMA BETA v1.1.1 — PIANO CONDIVISO: "le informazioni sono poche... nome
// del centro, attività, indirizzo (Naviga), orari, chi fa cosa" (Fabrizio,
// 02/09/2026, dopo aver visto la pagina live del piano condiviso — un
// bambino "In attesa di conferma" senza altro contesto non basta a chi deve
// davvero accompagnare/ritirare: nonni, tata). Confermato esplicitamente
// dall'utente: includere anche "chi fa cosa" per giorno, pur restando un
// link pubblico senza login (§ vedi commento in lib/data/plan-shares.ts).
//
// Copre: propagazione centro/indirizzo/orari dall'attività; costruzione
// delle celle "chi fa cosa" SOLO per i giorni realmente prenotati (mai i 5
// giorni "a prescindere"); risoluzione in TERZA PERSONA di "io"/"partner"
// (resolvePublicResponsibleLabel, lib/nextgen/responsibility-options.ts) —
// la pagina pubblica non deve mai mostrare "Io" (che ha senso solo per il
// genitore che l'ha creato); comportamento invariato quando i nuovi
// parametri non sono passati (fallback RPC, funzione SQL non estendibile
// senza migration).

function resp(
  kidId: string,
  weekStartDate: string,
  weekday: WeekResponsibility["weekday"],
  moment: WeekResponsibility["moment"],
  responsible: WeekResponsibility["responsible"],
  responsibleLabel: string | null = null
): WeekResponsibility {
  return { kidId, weekStartDate, weekday, moment, responsible, responsibleLabel };
}

const ACTIVITY_FULL = {
  name: "Prova FP",
  address: "Via Roma 12, Milano",
  hours: "8:00-18:00",
  days: "Lun-Ven",
  centers: { name: "Centro Estivo Prova" },
};

function dayRow(overrides: Partial<RawEntryBookingRow> & { booking_days: RawEntryBookingRow["booking_days"] }): RawEntryBookingRow {
  return {
    partner_decision: "pending",
    activities: ACTIVITY_FULL,
    booking_weeks: null,
    booking_kids: [{ kid_id: "kid-lino", kids: { name: "Lino" } }],
    ...overrides,
  };
}

pureTest.describe("Piano condiviso — centro/indirizzo/orari (dalla stessa riga activities, nessuna nuova tabella)", () => {
  pureTest("include centro/indirizzo/orari per un'entry a giorni (booking_days)", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({ booking_days: [{ partner_decision: "accepted", activity_days: { date: "2026-09-07" } }] }),
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-09-07", "2026-09-11", 2026);
    pureExpect(entries).toHaveLength(1);
    pureExpect(entries[0].centerName).toBe("Centro Estivo Prova");
    pureExpect(entries[0].address).toBe("Via Roma 12, Milano");
    pureExpect(entries[0].hours).toBe("8:00-18:00");
    pureExpect(entries[0].days).toBe("Lun-Ven");
  });

  pureTest("include centro/indirizzo/orari anche per un'entry a settimana intera (booking_weeks)", () => {
    const rows: RawEntryBookingRow[] = [
      {
        partner_decision: "accepted",
        activities: ACTIVITY_FULL,
        booking_weeks: [{ activity_weeks: { start_date: "2026-06-01", end_date: "2026-06-05" } }],
        booking_days: null,
        booking_kids: [{ kid_id: "kid-lino", kids: { name: "Lino" } }],
      },
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-06-01", "2026-06-05", 2026);
    pureExpect(entries).toHaveLength(1);
    pureExpect(entries[0].centerName).toBe("Centro Estivo Prova");
    pureExpect(entries[0].address).toBe("Via Roma 12, Milano");
  });

  pureTest("attività legacy senza indirizzo/orari/centro compilati -> null, nessun crash", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({
        activities: { name: "Attività legacy", address: null, hours: null, days: null, centers: null },
        booking_days: [{ partner_decision: "accepted", activity_days: { date: "2026-09-07" } }],
      }),
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-09-07", "2026-09-11", 2026);
    pureExpect(entries).toHaveLength(1);
    pureExpect(entries[0].centerName).toBeNull();
    pureExpect(entries[0].address).toBeNull();
    pureExpect(entries[0].hours).toBeNull();
    pureExpect(entries[0].days).toBeNull();
  });
});

pureTest.describe("Piano condiviso — 'chi fa cosa' per giorno (solo i giorni realmente prenotati)", () => {
  pureTest("booking_days: le celle coprono SOLO i giorni effettivamente prenotati (mai tutti e 5 'a prescindere')", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({
        booking_days: [
          { partner_decision: "accepted", activity_days: { date: "2026-09-07" } }, // lun
          { partner_decision: "accepted", activity_days: { date: "2026-09-09" } }, // mer
        ],
      }),
    ];
    const responsibilities: WeekResponsibility[] = [
      resp("kid-lino", "2026-09-07", "lun", "andata", "tata"),
      resp("kid-lino", "2026-09-07", "lun", "ritorno", "tata"),
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-09-07", "2026-09-11", 2026, responsibilities, null);
    pureExpect(entries).toHaveLength(1);
    const weekdaysShown = entries[0].responsibilities.map((c) => c.weekday);
    pureExpect(weekdaysShown).toEqual(["lun", "mer"]); // MAI mar/gio/ven: non prenotati
  });

  pureTest("booking_weeks: le celle coprono tutti e 5 i giorni feriali (prenotazione a settimana intera = coperto lun-ven)", () => {
    const rows: RawEntryBookingRow[] = [
      {
        partner_decision: "accepted",
        activities: ACTIVITY_FULL,
        booking_weeks: [{ activity_weeks: { start_date: "2026-06-01", end_date: "2026-06-05" } }],
        booking_days: null,
        booking_kids: [{ kid_id: "kid-lino", kids: { name: "Lino" } }],
      },
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-06-01", "2026-06-05", 2026, [], null);
    pureExpect(entries).toHaveLength(1);
    pureExpect(entries[0].responsibilities.map((c) => c.weekday)).toEqual(["lun", "mar", "mer", "gio", "ven"]);
  });

  pureTest("uno slot non ancora assegnato in 'Chi fa cosa?' resta null (mai finto assegnato)", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({ booking_days: [{ partner_decision: "accepted", activity_days: { date: "2026-09-07" } }] }),
    ];
    const responsibilities: WeekResponsibility[] = [
      resp("kid-lino", "2026-09-07", "lun", "andata", "tata"),
      // ritorno di lunedì NON assegnato
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-09-07", "2026-09-11", 2026, responsibilities, null);
    const cell = entries[0].responsibilities.find((c) => c.weekday === "lun")!;
    pureExpect(cell.andata).not.toBeNull();
    pureExpect(cell.ritorno).toBeNull();
  });

  pureTest("'altro' con etichetta libera (es. 'Zio Marco') usa SEMPRE quella label, a prescindere dal ruolo del genitore proprietario", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({ booking_days: [{ partner_decision: "accepted", activity_days: { date: "2026-09-07" } }] }),
    ];
    const responsibilities: WeekResponsibility[] = [
      resp("kid-lino", "2026-09-07", "lun", "andata", "altro", "Zio Marco"),
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-09-07", "2026-09-11", 2026, responsibilities, "madre");
    const cell = entries[0].responsibilities.find((c) => c.weekday === "lun")!;
    pureExpect(cell.andata?.label).toBe("Zio Marco");
  });

  pureTest("'io'/'partner' risolti in TERZA PERSONA rispetto al genitore proprietario del link (mai 'Io', che avrebbe senso solo per lui)", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({ booking_days: [{ partner_decision: "accepted", activity_days: { date: "2026-09-07" } }] }),
    ];
    const responsibilities: WeekResponsibility[] = [
      resp("kid-lino", "2026-09-07", "lun", "andata", "io"),
      resp("kid-lino", "2026-09-07", "lun", "ritorno", "partner"),
    ];
    // Proprietario del link = "padre" -> "io" deve leggersi "Papà", "partner" -> "Mamma".
    const asPadre = buildSharedPlanEntriesFromRows(rows, "2026-09-07", "2026-09-11", 2026, responsibilities, "padre");
    const cellPadre = asPadre[0].responsibilities.find((c) => c.weekday === "lun")!;
    pureExpect(cellPadre.andata?.label).toBe("Papà");
    pureExpect(cellPadre.andata?.label).not.toBe("Io"); // mai la prima persona su una pagina pubblica
    pureExpect(cellPadre.ritorno?.label).toBe("Mamma");

    // Proprietario = "madre" -> invertito.
    const asMadre = buildSharedPlanEntriesFromRows(rows, "2026-09-07", "2026-09-11", 2026, responsibilities, "madre");
    const cellMadre = asMadre[0].responsibilities.find((c) => c.weekday === "lun")!;
    pureExpect(cellMadre.andata?.label).toBe("Mamma");
    pureExpect(cellMadre.ritorno?.label).toBe("Papà");
  });

  pureTest("ruolo del genitore proprietario sconosciuto/'tutore' -> etichette generiche, mai un genere indovinato", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({ booking_days: [{ partner_decision: "accepted", activity_days: { date: "2026-09-07" } }] }),
    ];
    const responsibilities: WeekResponsibility[] = [
      resp("kid-lino", "2026-09-07", "lun", "andata", "io"),
      resp("kid-lino", "2026-09-07", "lun", "ritorno", "partner"),
    ];
    for (const role of [null, "tutore" as ParentRole]) {
      const entries = buildSharedPlanEntriesFromRows(rows, "2026-09-07", "2026-09-11", 2026, responsibilities, role);
      const cell = entries[0].responsibilities.find((c) => c.weekday === "lun")!;
      pureExpect(cell.andata?.label).toBe("Genitore");
      pureExpect(cell.ritorno?.label).toBe("Partner");
    }
  });

  pureTest("nonno/nonna/tata restano invariati (già naturalmente in terza persona, nessuna risoluzione contestuale necessaria)", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({ booking_days: [{ partner_decision: "accepted", activity_days: { date: "2026-09-09" } }] }),
    ];
    const responsibilities: WeekResponsibility[] = [
      resp("kid-lino", "2026-09-07", "mer", "andata", "tata"),
      resp("kid-lino", "2026-09-07", "mer", "ritorno", "nonna"),
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-09-07", "2026-09-11", 2026, responsibilities, "padre");
    const cell = entries[0].responsibilities.find((c) => c.weekday === "mer")!;
    pureExpect(cell.andata?.label).toBe("Tata");
    pureExpect(cell.ritorno?.label).toBe("Nonna");
  });

  pureTest("senza passare responsibilities/ownerParentRole (fallback RPC): i giorni prenotati restano visibili, ma tutti 'da assegnare' (mai un crash)", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({ booking_days: [{ partner_decision: "accepted", activity_days: { date: "2026-09-07" } }] }),
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-09-07", "2026-09-11", 2026); // nessun 5°/6° argomento
    pureExpect(entries).toHaveLength(1);
    // Nessuna assegnazione nota (responsibilities di default []): il giorno
    // prenotato compare comunque (mai nascosto), semplicemente senza nessuno
    // ancora assegnato — coerente con "mai finto assegnato" sopra.
    pureExpect(entries[0].responsibilities).toEqual([{ weekday: "lun", andata: null, ritorno: null }]);
    pureExpect(entries[0].status).toBe("confirmed"); // comportamento SHARE-02 invariato
  });

  pureTest("due bambini nella stessa settimana/attività: 'chi fa cosa' di uno non si mescola con l'altro (chiave per kidId)", () => {
    const rows: RawEntryBookingRow[] = [
      dayRow({
        booking_kids: [
          { kid_id: "kid-lino", kids: { name: "Lino" } },
          { kid_id: "kid-sofia", kids: { name: "Sofia" } },
        ],
        booking_days: [{ partner_decision: "accepted", activity_days: { date: "2026-09-07" } }],
      }),
    ];
    const responsibilities: WeekResponsibility[] = [
      resp("kid-lino", "2026-09-07", "lun", "andata", "tata"),
      resp("kid-sofia", "2026-09-07", "lun", "andata", "nonna"),
    ];
    const entries = buildSharedPlanEntriesFromRows(rows, "2026-09-07", "2026-09-11", 2026, responsibilities, null);
    const lino = entries.find((e) => e.kidName === "Lino")!;
    const sofia = entries.find((e) => e.kidName === "Sofia")!;
    pureExpect(lino.responsibilities.find((c) => c.weekday === "lun")?.andata?.label).toBe("Tata");
    pureExpect(sofia.responsibilities.find((c) => c.weekday === "lun")?.andata?.label).toBe("Nonna");
  });
});
