import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { evaluateFlag, evaluateFlagDetailed } from "../../lib/feature-flags/evaluate";
import { anyResolvedViaInternalPreview, isResolvedViaInternalPreview } from "../../lib/feature-flags/internal-preview";
import { INTERNAL_PREVIEW_COHORT_KEY } from "../../lib/releases/visibility";
import { mapBookingRowsToPlannerCalendarItems, RawBookingRow } from "../../lib/planner/calendar-items-core";
import {
  buildIcsDataUrl,
  buildPlannerCalendarIcs,
  buildPlannerCalendarIcsDataUrl,
  plannerCalendarIcsFilename,
  PlannerCalendarItemForIcs,
} from "../../lib/ics";

// TRAMA — Calendar Export V1 · ANTEPRIMA INTERNA (11/09/2026, richiesta di
// Fabrizio, §11 della spec: 14 scenari minimi). Unit test puri, stesso
// principio "[no browser]" già seguito da tests/one/release-catalog.spec.ts
// e tests/one/checkin-quick-actions.spec.ts: nessun "page" fixture,
// eseguibili in qualunque ambiente Node. La risoluzione flag DB-based
// (resolveFeatureFlagVisibility, "server-only") e la query Supabase
// (getPlannerCalendarItemsForParent) non sono testate qui direttamente
// (richiederebbero un ambiente Supabase live) — sono invece testate: (a)
// TUTTA la logica pura di risoluzione flag che le governa
// (evaluateFlag/evaluateFlagDetailed, IDENTICA a quella usata dentro
// resolveFeatureFlagDetail), e (b) tramite lettura statica del codice
// sorgente, che i call site reali (page.tsx, PlannerCalendarExportCard.tsx)
// usano correttamente quei risultati.
//
// Comando: npx playwright test tests/one/calendar-export.spec.ts

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf-8");
}

test.describe("TRAMA — Calendar Export V1: gating (1-5) [no browser]", () => {
  test("1. flag OFF (nessun override) → risolve false, CTA assente", () => {
    const result = evaluateFlag("CALENDAR_EXPORT_ENABLED", { environment: "production" }, []);
    expect(result).toBe(false);
  });

  test("2. utente in internal-preview con override cohort attivo → risolve true, CTA presente", () => {
    const context = { userId: "internal-1", cohortKeys: [INTERNAL_PREVIEW_COHORT_KEY] };
    const overrides = [{ scopeType: "cohort" as const, scopeValue: INTERNAL_PREVIEW_COHORT_KEY, enabled: true, expiresAt: null }];
    const result = evaluateFlag("CALENDAR_EXPORT_ENABLED", context, overrides);
    expect(result).toBe(true);
  });

  test("3. utente in internal-preview → badge ANTEPRIMA INTERNA presente (matchedScope=cohort)", () => {
    const context = { userId: "internal-1", cohortKeys: [INTERNAL_PREVIEW_COHORT_KEY] };
    const overrides = [{ scopeType: "cohort" as const, scopeValue: INTERNAL_PREVIEW_COHORT_KEY, enabled: true, expiresAt: null }];
    const detail = evaluateFlagDetailed("CALENDAR_EXPORT_ENABLED", context, overrides);
    expect(detail.enabled).toBe(true);
    expect(isResolvedViaInternalPreview(detail)).toBe(true);
    expect(anyResolvedViaInternalPreview([detail])).toBe(true);
  });

  test("4. override GLOBAL attivo → CTA presente ma badge ANTEPRIMA INTERNA assente", () => {
    const context = { userId: "any-user", cohortKeys: [] };
    const overrides = [{ scopeType: "global" as const, scopeValue: null, enabled: true, expiresAt: null }];
    const detail = evaluateFlagDetailed("CALENDAR_EXPORT_ENABLED", context, overrides);
    expect(detail.enabled).toBe(true);
    expect(detail.matchedScope).toBe("global");
    expect(isResolvedViaInternalPreview(detail)).toBe(false);
    expect(anyResolvedViaInternalPreview([detail])).toBe(false);
  });

  test("5. utente normale, flag risolto SOLO tramite scope internal-preview (di cui non fa parte) → CTA assente", () => {
    const context = { userId: "normal-user", cohortKeys: [] };
    const overrides = [{ scopeType: "cohort" as const, scopeValue: INTERNAL_PREVIEW_COHORT_KEY, enabled: true, expiresAt: null }];
    const result = evaluateFlag("CALENDAR_EXPORT_ENABLED", context, overrides);
    expect(result).toBe(false);
  });

  test("gating: page.tsx risolve CALENDAR_EXPORT_ENABLED server-side e fetcha gli item SOLO se enabled", () => {
    const source = readSource("../../app/nextgen/planner/page.tsx");
    expect(source).toContain('flagName: "CALENDAR_EXPORT_ENABLED"');
    expect(source).toContain("resolveFeatureFlagVisibility");
    expect(source).toContain("anyResolvedViaInternalPreview([calendarExportDetail])");
    const gateIndex = source.indexOf("if (calendarExportEnabled) {");
    const fetchIndex = source.indexOf("getPlannerCalendarItemsForParent()");
    expect(gateIndex).toBeGreaterThan(-1);
    expect(fetchIndex).toBeGreaterThan(gateIndex);
  });

  test("gating: PlannerCalendarExportCard non renderizza nulla se enabled è false (nessuna CTA per utente normale)", () => {
    const source = readSource("../../components/nextgen/PlannerCalendarExportCard.tsx");
    expect(source).toContain("if (!enabled) return null;");
  });

  test("gating: InternalPreviewBadge è montato nel Planner con la prop calcolata server-side", () => {
    const source = readSource("../../app/nextgen/planner/PlannerClient.tsx");
    expect(source).toContain("<InternalPreviewBadge visible={calendarExportBadgeVisible} />");
  });
});

test.describe("TRAMA — Calendar Export V1: dominio/filtro (6-11) [no browser]", () => {
  function bookingRow(overrides: Partial<RawBookingRow>): RawBookingRow {
    return {
      id: "booking-1",
      status: "confirmed",
      partner_decision: null,
      activities: { name: "Centro Estivo Prova", centers: { name: "Centro Prova", city: "Milano", address: "Via Roma 1" } },
      booking_weeks: null,
      booking_days: null,
      booking_kids: [{ kids: { name: "Lino" } }],
      ...overrides,
    };
  }

  test("6. prenotazione a settimana intera ACCETTATA produce un evento valido", () => {
    const rows: RawBookingRow[] = [
      bookingRow({
        partner_decision: "accepted",
        booking_weeks: [{ activity_weeks: { id: "week-1", start_date: "2026-07-06", end_date: "2026-07-10" } }],
      }),
    ];
    const items = mapBookingRowsToPlannerCalendarItems(rows);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Centro Estivo Prova",
      startDate: "2026-07-06",
      endDate: "2026-07-10",
      centerAddress: "Via Roma 1",
    });
  });

  test("7. multi-child: entrambi i nomi bambino compaiono nell'item esportato", () => {
    const rows: RawBookingRow[] = [
      bookingRow({
        partner_decision: "accepted",
        booking_weeks: [{ activity_weeks: { id: "week-1", start_date: "2026-07-06", end_date: "2026-07-10" } }],
        booking_kids: [{ kids: { name: "Lino" } }, { kids: { name: "Anna" } }],
      }),
    ];
    const items = mapBookingRowsToPlannerCalendarItems(rows);
    expect(items[0].kidNames).toEqual(["Lino", "Anna"]);
  });

  test("8. Giorni Spot (lun+mer+ven accettati): un evento PER GIORNO, non un intervallo unito", () => {
    const rows: RawBookingRow[] = [
      bookingRow({
        booking_weeks: null,
        booking_days: [
          { partner_decision: "accepted", activity_days: { date: "2026-07-06" } }, // lun
          { partner_decision: "accepted", activity_days: { date: "2026-07-08" } }, // mer
          { partner_decision: "accepted", activity_days: { date: "2026-07-10" } }, // ven
        ],
      }),
    ];
    const items = mapBookingRowsToPlannerCalendarItems(rows);
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.startDate)).toEqual(["2026-07-06", "2026-07-08", "2026-07-10"]);
    // ogni evento è un singolo giorno (startDate === endDate), MAI un
    // intervallo lun..ven che includerebbe martedì/giovedì mai prenotati.
    for (const item of items) expect(item.startDate).toBe(item.endDate);
  });

  test("9. giorno NON prenotato/accettato non viene esportato (né come evento, né come parte di un intervallo)", () => {
    const rows: RawBookingRow[] = [
      bookingRow({
        booking_weeks: null,
        booking_days: [
          { partner_decision: "accepted", activity_days: { date: "2026-07-06" } },
          { partner_decision: "pending", activity_days: { date: "2026-07-07" } },
          { partner_decision: "waitlisted", activity_days: { date: "2026-07-08" } },
        ],
      }),
    ];
    const items = mapBookingRowsToPlannerCalendarItems(rows);
    expect(items).toHaveLength(1);
    expect(items[0].startDate).toBe("2026-07-06");
  });

  test("10. prenotazione rifiutata o 'proposed' (mai una conferma reale) non produce alcun evento", () => {
    const rejectedWeek = mapBookingRowsToPlannerCalendarItems([
      bookingRow({
        partner_decision: "rejected",
        booking_weeks: [{ activity_weeks: { id: "week-1", start_date: "2026-07-06", end_date: "2026-07-10" } }],
      }),
    ]);
    expect(rejectedWeek).toHaveLength(0);

    // "proposed" = il centro ha proposto un'alternativa, in attesa di
    // risposta del GENITORE — NON è una conferma (vedi
    // lib/booking-response/effective-decision.ts), non va esportata.
    const proposedWeek = mapBookingRowsToPlannerCalendarItems([
      bookingRow({
        partner_decision: "proposed",
        booking_weeks: [{ activity_weeks: { id: "week-1", start_date: "2026-07-06", end_date: "2026-07-10" } }],
      }),
    ]);
    expect(proposedWeek).toHaveLength(0);

    const rejectedDays = mapBookingRowsToPlannerCalendarItems([
      bookingRow({
        booking_weeks: null,
        booking_days: [{ partner_decision: "rejected", activity_days: { date: "2026-07-06" } }],
      }),
    ]);
    expect(rejectedDays).toHaveLength(0);
  });

  test("11. nessun orario nel modello dati → evento tutto il giorno (VALUE=DATE), mai un orario inventato", () => {
    const items: PlannerCalendarItemForIcs[] = [
      {
        id: "b1:w1",
        title: "Centro Estivo Prova",
        kidNames: ["Lino"],
        startDate: "2026-07-06",
        endDate: "2026-07-10",
        centerName: "Centro Prova",
        centerAddress: "Via Roma 1",
        centerCity: "Milano",
        note: null,
      },
    ];
    const ics = buildPlannerCalendarIcs(items);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260706");
    // DTEND è ESCLUSIVO per eventi "tutto il giorno" in iCalendar: il
    // giorno dopo l'ultimo giorno effettivo (10 luglio -> 11 luglio).
    expect(ics).toContain("DTEND;VALUE=DATE:20260711");
    expect(ics).not.toMatch(/DTSTART:\d{8}T/); // mai un DTSTART con componente ora
  });
});

test.describe("TRAMA — Calendar Export V1: file ICS (12-14) [no browser]", () => {
  test("12. escaping caratteri speciali (virgola, punto e virgola, backslash) nel testo ICS", () => {
    const items: PlannerCalendarItemForIcs[] = [
      {
        id: "b1:w1",
        title: "Centro, Estivo; Prova\\Extra",
        kidNames: ["Lino"],
        startDate: "2026-07-06",
        endDate: "2026-07-06",
        centerName: "Via A, 12; interno 3",
        centerAddress: null,
        centerCity: null,
        note: null,
      },
    ];
    const ics = buildPlannerCalendarIcs(items);
    expect(ics).toContain("SUMMARY:Centro\\, Estivo\\; Prova\\\\Extra");
    expect(ics).toContain("LOCATION:Via A\\, 12\\; interno 3");
  });

  test("13. nome file sensato (data odierna, estensione .ics)", () => {
    const filename = plannerCalendarIcsFilename("2026-09-11");
    expect(filename).toBe("trama-planner-2026-09-11.ics");
    expect(filename.endsWith(".ics")).toBe(true);
  });

  test("14. nessuna regressione sul vecchio export a evento singolo (BookingSuccessActions)", () => {
    const dataUrl = buildIcsDataUrl({
      title: "Prenotazione TRAMA",
      description: "Lino — Settimana 3",
      startDate: "2026-07-06",
      endDate: "2026-07-10",
    });
    expect(dataUrl.startsWith("data:text/calendar;charset=utf-8,")).toBe(true);
    const decoded = decodeURIComponent(dataUrl.replace("data:text/calendar;charset=utf-8,", ""));
    expect(decoded).toContain("BEGIN:VEVENT");
    expect(decoded).toContain("SUMMARY:Prenotazione TRAMA");
    expect(decoded).toContain("DTSTART;VALUE=DATE:20260706");
    expect(decoded).toContain("DTEND;VALUE=DATE:20260711");
    // Un solo VEVENT — il generatore single-event resta invariato, non
    // delega al generatore multi-evento introdotto per Calendar Export.
    expect((decoded.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1);
  });

  test("multi-evento: buildPlannerCalendarIcsDataUrl produce N VEVENT distinti con UID stabili", () => {
    const items: PlannerCalendarItemForIcs[] = [
      {
        id: "b1:w1",
        title: "Attività A",
        kidNames: ["Lino"],
        startDate: "2026-07-06",
        endDate: "2026-07-10",
        centerName: null,
        centerAddress: null,
        centerCity: null,
        note: null,
      },
      {
        id: "b2:2026-07-08",
        title: "Attività B",
        kidNames: ["Anna"],
        startDate: "2026-07-08",
        endDate: "2026-07-08",
        centerName: null,
        centerAddress: null,
        centerCity: null,
        note: null,
      },
    ];
    const dataUrl = buildPlannerCalendarIcsDataUrl(items);
    const decoded = decodeURIComponent(dataUrl.replace("data:text/calendar;charset=utf-8,", ""));
    expect((decoded.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    expect(decoded).toContain("UID:b1:w1@buddykids.app");
    expect(decoded).toContain("UID:b2:2026-07-08@buddykids.app");
  });
});
