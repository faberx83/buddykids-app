import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  normalizeComuneKey,
  groupEventsByScope,
  composeKidCalendarEvents,
  type RegionComuneEvent,
} from "../../lib/school-calendar/comune";
import {
  buildClosureIntervals,
  computeSchoolWeekNeed,
  computeWeekClosureDetail,
  describePartialClosure,
  isWeekSchoolClosed,
  type SchoolCalendarEventInput,
  type SeasonWeekNeedInput,
} from "../../lib/school-calendar/need-core";

// TRAMA — SCHOOL CALENDAR MUNICIPAL SCOPE (16/09/2026). Unit test puri per
// lib/school-calendar/comune.ts (normalizeComuneKey/groupEventsByScope/
// composeKidCalendarEvents) + regressione need-core — stesso principio
// "[no browser]" già seguito da school-calendar-intelligence.spec.ts: nessun
// mock Supabase, nessuna dipendenza da un DB live con 0 righe reali. Il
// layer I/O (lib/data/school-calendar.ts) delega tutta la logica di
// raggruppamento/composizione region+comune a queste stesse funzioni pure
// (vedi groupEventsByScope/composeKidCalendarEvents chiamate lì) — testare
// queste funzioni copre quindi anche il comportamento reale del layer I/O,
// non solo una riproduzione parallela.
//
// Comando: npx playwright test tests/one/school-calendar-municipal-scope.spec.ts

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf-8");
}

function week(startDate: string, endDate: string, overrides: Partial<SeasonWeekNeedInput> = {}): SeasonWeekNeedInput {
  return { startDate, endDate, covered: false, dismissed: false, ...overrides };
}

function event(startDate: string, endDate: string, eventType: SchoolCalendarEventInput["eventType"], label: string): SchoolCalendarEventInput {
  return { startDate, endDate, eventType, label };
}

// ─────────────────────────────────────────────────────────────────────────
// Fixture dataset — SPECCHIO del contenuto di
// PART_D2_data_regional_and_milano_2026_2027.sql (SEZIONE B/C), MAI dati
// reali inseriti nel DB da questa sessione (governance invariata: nessuna
// scrittura). Sintetico ma stesse date/eventi del dataset preparato, così i
// test #9/#10/#11 verificano davvero "quello che verrebbe inserito", non
// un fixture arbitrario scollegato dal dataset reale.
// ─────────────────────────────────────────────────────────────────────────

const REGIONAL_BASELINE_LOMBARDIA: RegionComuneEvent[] = [
  { region: "Lombardia", comune: null, event: event("2026-09-14", "2026-09-14", "school_year_start", "Inizio anno scolastico 2026/2027") },
  { region: "Lombardia", comune: null, event: event("2027-06-08", "2027-06-08", "school_year_end", "Fine anno scolastico 2026/2027") },
  { region: "Lombardia", comune: null, event: event("2026-12-23", "2027-01-06", "christmas_break", "Vacanze di Natale 2026/2027") },
  { region: "Lombardia", comune: null, event: event("2027-03-25", "2027-03-30", "easter_break", "Vacanze di Pasqua 2027") },
  { region: "Lombardia", comune: null, event: event("2026-12-08", "2026-12-08", "public_holiday", "Immacolata Concezione") },
];

const MILANO_LOCAL_EVENTS: RegionComuneEvent[] = [
  { region: "Lombardia", comune: "Milano", event: event("2026-12-07", "2026-12-07", "public_holiday", "Sant'Ambrogio — Festa del Santo Patrono di Milano") },
  { region: "Lombardia", comune: "Milano", event: event("2027-02-12", "2027-02-12", "other_closure", "Carnevale Ambrosiano (Comune di Milano)") },
];

const FULL_DATASET = [...REGIONAL_BASELINE_LOMBARDIA, ...MILANO_LOCAL_EVENTS];

test.describe("School Calendar Municipal Scope — normalizeComuneKey [no browser]", () => {
  test("N1. null/undefined/blank -> null", () => {
    expect(normalizeComuneKey(null)).toBeNull();
    expect(normalizeComuneKey(undefined)).toBeNull();
    expect(normalizeComuneKey("")).toBeNull();
    expect(normalizeComuneKey("   ")).toBeNull();
  });

  test('N2. "Milano" / "MILANO" / " milano " / "  Milano  " -> stessa chiave', () => {
    const keys = ["Milano", "MILANO", " milano ", "  Milano  "].map(normalizeComuneKey);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe("milano");
  });

  test("N3. spazi interni multipli collassati (mai solo i bordi)", () => {
    expect(normalizeComuneKey("Milano   Ovest")).toBe(normalizeComuneKey("Milano Ovest"));
    expect(normalizeComuneKey("Milano  Ovest")).toBe("milano ovest");
  });

  test("N4. il valore originale NON viene mai modificato dalla normalizzazione (solo la chiave di confronto)", () => {
    // Verifica di contratto: normalizeComuneKey NON è usata per riscrivere
    // il valore salvato — qui si verifica solo che la funzione stessa non
    // muti l'input ricevuto (nessun side effect sulla stringa originale).
    const original = "  Milano  ";
    const originalCopy = original;
    normalizeComuneKey(original);
    expect(original).toBe(originalCopy);
  });
});

test.describe("School Calendar Municipal Scope — regional vs local resolution [no browser]", () => {
  // #1/#2: evento regionale -> qualunque comune della regione lo riceve
  test("1. evento regionale (comune NULL) -> bambino Milano lo riceve", () => {
    const grouped = groupEventsByScope(FULL_DATASET);
    const events = composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "Milano" });
    expect(events.some((e) => e.eventType === "christmas_break")).toBe(true);
  });

  test("2. evento regionale (comune NULL) -> bambino Bergamo lo riceve", () => {
    const grouped = groupEventsByScope(FULL_DATASET);
    const events = composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "Bergamo" });
    expect(events.some((e) => e.eventType === "christmas_break")).toBe(true);
  });

  // #3/#4: evento locale Milano -> SOLO Milano
  test("3. evento locale Milano -> bambino Milano lo riceve", () => {
    const grouped = groupEventsByScope(FULL_DATASET);
    const events = composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "Milano" });
    expect(events.some((e) => e.label.includes("Sant'Ambrogio"))).toBe(true);
    expect(events.some((e) => e.label.includes("Carnevale Ambrosiano"))).toBe(true);
  });

  test("4. evento locale Milano -> bambino Bergamo NON lo riceve", () => {
    const grouped = groupEventsByScope(FULL_DATASET);
    const events = composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "Bergamo" });
    expect(events.some((e) => e.label.includes("Sant'Ambrogio"))).toBe(false);
    expect(events.some((e) => e.label.includes("Carnevale Ambrosiano"))).toBe(false);
  });

  // #5: comune null -> nessun evento locale, solo baseline
  test("5. bambino con comune null -> nessun evento locale, solo baseline regionale", () => {
    const grouped = groupEventsByScope(FULL_DATASET);
    const events = composeKidCalendarEvents(grouped, { region: "Lombardia", comune: null });
    expect(events.some((e) => e.label.includes("Sant'Ambrogio"))).toBe(false);
    expect(events.some((e) => e.eventType === "christmas_break")).toBe(true); // baseline sempre presente
    expect(events.length).toBe(REGIONAL_BASELINE_LOMBARDIA.length);
  });

  // #6/#7: normalizzazione applicata al matching kid<->evento
  test('6. "Milano" (evento) matcha "MILANO" (profilo bambino)', () => {
    const grouped = groupEventsByScope(FULL_DATASET); // evento salvato come "Milano"
    const events = composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "MILANO" });
    expect(events.some((e) => e.label.includes("Sant'Ambrogio"))).toBe(true);
  });

  test("7. whitespace normalizzato nel matching (profilo con spazi extra)", () => {
    const grouped = groupEventsByScope(FULL_DATASET);
    const events = composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "  Milano  " });
    expect(events.some((e) => e.label.includes("Sant'Ambrogio"))).toBe(true);
  });

  // #8: evento regionale + locale stesso giorno -> nessun doppio conteggio
  test("8. evento regionale + evento locale sullo stesso giorno -> closedWeekdaysCount non raddoppia", () => {
    const grouped = groupEventsByScope([
      { region: "Lombardia", comune: null, event: event("2026-12-08", "2026-12-08", "public_holiday", "Immacolata Concezione") },
      { region: "Lombardia", comune: "Milano", event: event("2026-12-07", "2026-12-07", "public_holiday", "Sant'Ambrogio") },
    ]);
    const events = composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "Milano" });
    const closures = buildClosureIntervals(events);
    // Settimana lun 7 - ven 11 dicembre 2026: lunedì (Sant'Ambrogio, locale)
    // + martedì (Immacolata, regionale) sono due giorni DIVERSI, quindi il
    // conteggio corretto è 2 (non un doppio conteggio dello stesso giorno).
    const detail = computeWeekClosureDetail(week("2026-12-07", "2026-12-11"), closures);
    expect(detail.closedWeekdaysCount).toBe(2);

    // Caso di sovrapposizione VERA (stesso giorno, due eventi diversi che lo
    // coprono entrambi): closedWeekdaysCount conta il GIORNO una sola volta,
    // mai una volta per evento che lo copre.
    const overlappingGrouped = groupEventsByScope([
      { region: "Lombardia", comune: null, event: event("2026-12-07", "2026-12-07", "regional_closure", "Chiusura regionale coincidente") },
      { region: "Lombardia", comune: "Milano", event: event("2026-12-07", "2026-12-07", "public_holiday", "Sant'Ambrogio") },
    ]);
    const overlappingEvents = composeKidCalendarEvents(overlappingGrouped, { region: "Lombardia", comune: "Milano" });
    const overlappingClosures = buildClosureIntervals(overlappingEvents);
    const overlappingDetail = computeWeekClosureDetail(week("2026-12-07", "2026-12-11"), overlappingClosures);
    expect(overlappingDetail.closedWeekdaysCount).toBe(1); // 1 giorno chiuso, non 2
  });

  // #9: Sant'Ambrogio contribuisce SOLO a Milano
  test("9. Sant'Ambrogio (07/12/2026) contribuisce SOLO alla chiusura del bambino Milano", () => {
    const grouped = groupEventsByScope(FULL_DATASET);
    const milanoClosures = buildClosureIntervals(composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "Milano" }));
    const bergamoClosures = buildClosureIntervals(composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "Bergamo" }));
    expect(milanoClosures.some((c) => c.startDate === "2026-12-07")).toBe(true);
    expect(bergamoClosures.some((c) => c.startDate === "2026-12-07")).toBe(false);
  });

  // #10: 12 febbraio contribuisce SOLO a Milano
  test("10. Carnevale Ambrosiano (12/02/2027) contribuisce SOLO alla chiusura del bambino Milano", () => {
    const grouped = groupEventsByScope(FULL_DATASET);
    const milanoClosures = buildClosureIntervals(composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "Milano" }));
    const bergamoClosures = buildClosureIntervals(composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "Bergamo" }));
    expect(milanoClosures.some((c) => c.startDate === "2027-02-12")).toBe(true);
    expect(bergamoClosures.some((c) => c.startDate === "2027-02-12")).toBe(false);
  });

  // #11: 8-9 febbraio NON presenti nel dataset regionale (bug Carnevale corretto)
  test("11. 8-9 febbraio 2027 NON sono presenti nel dataset regionale (nessun bambino li riceve, nemmeno Milano)", () => {
    const grouped = groupEventsByScope(FULL_DATASET);
    const milanoClosures = buildClosureIntervals(composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "Milano" }));
    const bergamoClosures = buildClosureIntervals(composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "Bergamo" }));
    for (const iso of ["2027-02-08", "2027-02-09"]) {
      expect(milanoClosures.some((c) => iso >= c.startDate && iso <= c.endDate)).toBe(false);
      expect(bergamoClosures.some((c) => iso >= c.startDate && iso <= c.endDate)).toBe(false);
    }
  });

  // #17: multi-child, comuni diversi, stesso groupedEvents (nessuna query duplicata)
  test("17. multi-child con comuni diversi: ogni bambino riceve solo i propri eventi locali, stesso set di eventi grezzi", () => {
    const grouped = groupEventsByScope(FULL_DATASET); // UNA sola risoluzione, riusata per entrambi i figli
    const linoClosures = buildClosureIntervals(composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "Milano" }));
    const altroFiglioClosures = buildClosureIntervals(composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "Bergamo" }));
    const linoHasSantAmbrogio = linoClosures.some((c) => c.startDate === "2026-12-07");
    const altroHasSantAmbrogio = altroFiglioClosures.some((c) => c.startDate === "2026-12-07");
    expect(linoHasSantAmbrogio).toBe(true);
    expect(altroHasSantAmbrogio).toBe(false);
    // Entrambi condividono comunque la baseline regionale (Natale):
    expect(linoClosures.some((c) => c.kind === "christmas_break")).toBe(true);
    expect(altroFiglioClosures.some((c) => c.kind === "christmas_break")).toBe(true);
  });
});

test.describe("School Calendar Municipal Scope — regressione semantiche esistenti [no browser]", () => {
  // #15: settimana interamente chiusa (Natale) -> closed_to_organize, invariato
  test("15. settimana interamente dentro una chiusura diretta -> closed_to_organize (semantica invariata)", () => {
    const grouped = groupEventsByScope(FULL_DATASET);
    const closures = buildClosureIntervals(composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "Milano" }));
    // Settimana lun 28/12 - ven 1/1: interamente dentro Vacanze di Natale
    // (23/12-6/1, evento REGIONALE) -> comportamento identico a prima
    // dell'introduzione degli eventi locali (nessuna regressione).
    const insideWeek = week("2026-12-28", "2027-01-01");
    expect(isWeekSchoolClosed(insideWeek, closures)).toBe(true);
    const result = computeSchoolWeekNeed(true, insideWeek, closures, undefined);
    expect(result).toBe("closed_to_organize");
  });

  // #16: chiusura parziale (1 giorno, es. Sant'Ambrogio da solo in settimana altrimenti aperta) -> nota informativa, MAI closed_to_organize
  test("16. chiusura parziale (Sant'Ambrogio, 1 giorno su 5) -> nota informativa, settimana resta school_open (semantica invariata)", () => {
    // Solo l'evento locale Sant'Ambrogio (SENZA Immacolata regionale, che
    // cade nella stessa settimana nel dataset completo) — isola davvero il
    // caso "1 solo giorno chiuso su 5", come da scenario richiesto.
    const grouped = groupEventsByScope([MILANO_LOCAL_EVENTS[0]]);
    const closures = buildClosureIntervals(composeKidCalendarEvents(grouped, { region: "Lombardia", comune: "Milano" }));
    const w = week("2026-12-07", "2026-12-11"); // lunedì 7 dicembre = Sant'Ambrogio, resto della settimana aperta
    expect(isWeekSchoolClosed(w, closures)).toBe(false);
    const result = computeSchoolWeekNeed(true, w, closures, undefined);
    expect(result).toBe("school_open");
    const detail = computeWeekClosureDetail(w, closures);
    const note = describePartialClosure(detail);
    expect(note).toBe("Scuola chiusa lun 7");
  });
});

test.describe("School Calendar Municipal Scope — Admin (verifica statica del codice sorgente) [no browser]", () => {
  // #12/#13/#14: comportamento dell'azione Admin upsertSchoolCalendarEventAction
  test("12. Admin: comune vuoto/non fornito -> salvato come NULL (trim + fallback esplicito)", () => {
    const src = readSource("../../app/actions/school-calendar.ts");
    expect(src).toContain("const comuneTrimmed = (input.comune ?? \"\").trim();");
    expect(src).toContain("comune: comuneTrimmed.length > 0 ? comuneTrimmed : null,");
  });

  test("13. Admin: comune valorizzato -> salvato con trim, MAI forzato in lowercase (il valore visibile resta quello digitato)", () => {
    const src = readSource("../../app/actions/school-calendar.ts");
    // La normalizzazione lowercase esiste SOLO in normalizeComuneKey
    // (lib/school-calendar/comune.ts) — l'azione Admin non deve mai
    // chiamare .toLowerCase() sul valore salvato.
    const actionSection = src.slice(src.indexOf("export async function upsertSchoolCalendarEventAction"), src.indexOf("export async function deleteSchoolCalendarEventAction"));
    expect(actionSection).not.toContain(".toLowerCase()");
    expect(actionSection).toContain("comuneTrimmed.length > 0 ? comuneTrimmed : null");
  });

  test("14. Admin: flusso regionale esistente invariato (calendario-level upsert non richiede/non tocca comune)", () => {
    const src = readSource("../../app/actions/school-calendar.ts");
    const calendarAction = src.slice(src.indexOf("export async function upsertSchoolCalendarAction"), src.indexOf("export async function upsertSchoolCalendarEventAction"));
    expect(calendarAction).not.toContain("comune"); // upsertSchoolCalendarAction resta scoperto di comune (a livello di regione, come prima)
  });

  test("Admin UI: NewEventForm espone il campo Comune opzionale con la copy richiesta", () => {
    const src = readSource("../../app/admin/school-calendar/SchoolCalendarAdminClient.tsx");
    expect(src).toContain('placeholder="Comune (opzionale)"');
    expect(src).toContain("Lascia vuoto per applicare l&apos;evento a tutta la Regione.");
  });

  test("Admin UI: la lista eventi mostra lo scope (Regionale / Locale · Comune)", () => {
    const src = readSource("../../app/admin/school-calendar/SchoolCalendarAdminClient.tsx");
    expect(src).toContain('e.comune ? `Locale · ${e.comune}` : "Regionale"');
  });
});

test.describe("School Calendar Municipal Scope — flag/gating invariato [no browser]", () => {
  // #18: il guard clause "Supabase non configurato / nessun kid" resta
  // identico — questa correzione non tocca il percorso "flag OFF"/dati
  // assenti, che deve continuare a ritornare il fallback sicuro invariato.
  test("18. guard clause getSchoolCalendarPlannerContext (Supabase non configurato / nessun kid) invariato", () => {
    const src = readSource("../../lib/data/school-calendar.ts");
    expect(src).toContain("if (!isSupabaseConfigured || kidIds.length === 0) {");
    expect(src).toContain("EMPTY_CONTEXT");
  });

  test("il layer I/O delega il raggruppamento a groupEventsByScope/composeKidCalendarEvents (nessuna logica duplicata)", () => {
    const src = readSource("../../lib/data/school-calendar.ts");
    expect(src).toContain("groupEventsByScope(regionComuneEvents)");
    expect(src).toContain("composeKidCalendarEvents(groupedEvents,");
  });

  test("select eventi include la colonna comune (necessaria SOLO dopo la migration — vedi commento ATTENZIONE DEPLOY)", () => {
    const src = readSource("../../lib/data/school-calendar.ts");
    expect(src).toContain('.select("calendar_id, start_date, end_date, event_type, label, comune")');
    expect(src).toContain("ATTENZIONE DEPLOY");
  });
});
