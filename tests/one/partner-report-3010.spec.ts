// Portale centri — report consolidato del 30/10/2026 ("TRAMA PARTNER — Report
// consolidato e comandi di revisione per Claude"), lotto L1 senza migration.
// Logica pura + controlli sul sorgente; i percorsi nel browser restano
// pending local verification (ritest in produzione dopo il deploy).
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  activityNameError,
  dayRate,
  partnerSelectableTags,
  priceSummary,
  weekPriceFromDay,
} from "../../lib/centers/activity-edit-v2";
import { attendanceCounts, attendanceSummaryText, isFutureDay, romeToday } from "../../lib/centers/attendance-summary";
import { isDraftDirty, parseDraft } from "../../lib/centers/activity-draft";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

test.describe("UX-PARTNER-001 — Date e posti con i giorni veri", () => {
  test("RPP-01 il calendario del centro mostra tutti i giorni, anche dopo l'estate; niente conteggi finti", () => {
    const p = code(read("app/center/activities/[id]/calendar/page.tsx"));
    expect(p).toContain("getActivityDays(activity, { includeAfterSeason: true })");
    expect(p).not.toContain("lib/mock-data");
    expect(p).not.toContain("weeksCount");
    expect(p).toContain("datesSummary(");
  });
});

test.describe("UX-PARTNER-002 — prezzo nell'unità della modalità", () => {
  test("RPP-02 giorno = un quinto della settimana, la stessa regola della scheda famiglie", () => {
    expect(dayRate(150)).toBe(30);
    expect(weekPriceFromDay(30)).toBe(150);
    expect(weekPriceFromDay(27.5)).toBe(137.5);
    expect(priceSummary({ bookingMode: "day_only", pricePerWeek: 150, shuttlePrice: 20 })).toBe("€30 al giorno");
    expect(priceSummary({ bookingMode: "mixed", pricePerWeek: 150, shuttlePrice: 0 })).toBe("€150 a settimana · €30 al giorno");
    expect(priceSummary({ bookingMode: "week_only", pricePerWeek: 150, shuttlePrice: 20 })).toBe("€150 a settimana · navetta €20");
    expect(priceSummary({ bookingMode: "week_only", pricePerWeek: 0, shuttlePrice: 0 })).toBe("");
    // stessa regola usata da scheda, richiesta e card: lib/day-pricing.ts
    expect(read("lib/day-pricing.ts")).toContain("return pricePerWeek / 5;");
  });

  test("RPP-03 editor V2: 'Prezzo al giorno' per le attività a giorni, navetta solo con le settimane", () => {
    const v2 = read("components/center/ActivityEditV2.tsx");
    expect(v2).toContain('label="Prezzo al giorno (€)"');
    expect(v2).toContain('onChange={(e) => update("pricePerWeek", weekPriceFromDay(Number(e.target.value)))}');
    expect(v2).toContain('{form.bookingMode !== "day_only" && (');
  });
});

test.describe("UX-PARTNER-003 — nome obbligatorio", () => {
  test("RPP-04 vuoto o soli spazi rifiutati, in pagina e sul server, in creazione e modifica", () => {
    expect(activityNameError("")).not.toBeNull();
    expect(activityNameError("   ")).not.toBeNull();
    expect(activityNameError("Pomeriggi")).toBeNull();
    const actions = read("app/actions/center.ts");
    const update = actions.slice(actions.indexOf("export async function updateActivityAction"));
    expect(update.slice(0, 900)).toContain("activityNameError(input.name");
    const create = actions.slice(actions.indexOf("export async function createActivityAction"));
    expect(create.slice(0, 600)).toContain("activityNameError(input.name");
    const v2 = read("components/center/ActivityEditV2.tsx");
    expect(v2).toContain('aria-invalid={nameError ? true : undefined}');
    expect(v2).toContain('id="a-name-error" role="alert"');
    expect(read("app/center/activities/new/NewActivityForm.tsx")).toContain("activityNameError(form.name)");
  });
});

test.describe("UX-PARTNER-005 — tag di prova", () => {
  test("RPP-05 i tag di prova non si propongono; uno già assegnato resta per poterlo togliere", () => {
    const tags = [
      { id: "arte", isTestFixture: false },
      { id: "test", isTestFixture: true },
      { id: "test-1786", isTestFixture: true },
    ];
    expect(partnerSelectableTags(tags, []).map((t) => t.id)).toEqual(["arte"]);
    expect(partnerSelectableTags(tags, ["test"]).map((t) => t.id)).toEqual(["arte", "test"]);
    expect(read("app/center/activities/[id]/page.tsx")).toContain("partnerSelectableTags(allTags, activity.tagIds)");
  });
});

test.describe("UX-PARTNER-006 — registro: non registrato non è assente", () => {
  test("RPP-06 conteggi del giorno e frase di riepilogo", () => {
    const kids = ["luca", "giulia"];
    expect(attendanceCounts(kids, {}, "2026-12-07")).toEqual({ booked: 2, present: 0, late: 0, absent: 0, notRecorded: 2 });
    const marks = { "luca:2026-11-03": "presente" as const, "giulia:2026-11-03": "assente" as const };
    expect(attendanceCounts(kids, marks, "2026-11-03")).toEqual({ booked: 2, present: 1, late: 0, absent: 1, notRecorded: 0 });
    expect(attendanceSummaryText({ booked: 1, present: 0, late: 0, absent: 0, notRecorded: 1 }, true)).toBe(
      "1 prenotato · giorno non ancora arrivato: le presenze si segnano il giorno stesso"
    );
    expect(attendanceSummaryText({ booked: 2, present: 1, late: 0, absent: 0, notRecorded: 1 }, false)).toBe("1 presente su 2 prenotati · 1 da registrare");
    expect(isFutureDay("2026-12-07", "2026-11-03")).toBe(true);
    expect(isFutureDay("2026-11-03", "2026-11-03")).toBe(false);
    // Roma, non UTC: alle 00:30 del 4 novembre a Roma (23:30 UTC del 3) è già il 4
    expect(romeToday(new Date("2026-11-03T23:30:00Z"))).toBe("2026-11-04");
  });

  test("RPP-07 registro e report non trasformano la mancanza di registrazione in assenza", () => {
    const client = code(read("app/center/attendance/AttendanceClient.tsx"));
    expect(client).not.toContain('?? "assente"');
    expect(client).toContain("disabled={savingKey === key || activeIsFuture}");
    expect(client).toContain("Da registrare");
    const report = code(read("lib/data/attendance-report.ts"));
    const center = report.slice(report.indexOf("export function buildAttendanceReport"), report.indexOf("export function buildParentAttendanceReport"));
    expect(center).toContain("const status = record?.status ?? null;");
    expect(center).not.toContain('?? "assente"');
    expect(read("app/center/report-presenze/page.tsx")).toContain('data-testid="report-not-recorded"');
  });
});

test.describe("UX-PARTNER-007 — bozza della nuova attività", () => {
  test("RPP-08 bozza ripresa solo se diversa dal modulo vuoto e coi campi del tipo giusto", () => {
    const initial = { name: "", ageRange: "6-12", pricePerWeek: 150 };
    expect(isDraftDirty({ ...initial }, initial)).toBe(false);
    expect(isDraftDirty({ ...initial, name: "UX BOZZA" }, initial)).toBe(true);
    expect(parseDraft(JSON.stringify({ name: "UX BOZZA", pricePerWeek: "x", altro: 1 }), initial)).toEqual({
      name: "UX BOZZA",
      ageRange: "6-12",
      pricePerWeek: 150,
    });
    expect(parseDraft(JSON.stringify(initial), initial)).toBeNull();
    expect(parseDraft("non json", initial)).toBeNull();
    expect(parseDraft(null, initial)).toBeNull();
  });

  test("RPP-09 nuova attività (libera e da modello): bozza, avviso prima di chiudere, 'Scarta' esplicito", () => {
    const hook = read("components/center/useActivityDraft.ts");
    expect(hook).toContain('window.addEventListener("beforeunload", onBeforeUnload)');
    expect(hook).toContain("window.sessionStorage.setItem(key, JSON.stringify(form))");
    for (const f of ["app/center/activities/new/NewActivityForm.tsx", "components/center/TemplateActivityForm.tsx"]) {
      const src = read(f);
      expect(src, f).toContain("useActivityDraft(");
      expect(src, f).toContain("draft.clear();");
      expect(src, f).toContain("<DraftRestoredNote");
    }
    expect(read("components/center/DraftRestoredNote.tsx")).toContain("Scarta e ricomincia");
  });
});

test.describe("UX-PARTNER-008 e revisioni REV-PARTNER-001/002", () => {
  test("RPP-10 Servizi consigliati fuori dalla navigazione; funzioni future raccolte in 'In arrivo'", () => {
    const centro = read("app/center/centro/page.tsx");
    expect(centro).not.toContain('href: "/center/servizi-consigliati"');
    const arrivo = centro.slice(centro.indexOf('title="In arrivo"'));
    for (const l of ["Più sedi", "Persone del centro e permessi", "Deleghe per il ritiro"]) expect(arrivo, l).toContain(l);
    // le sezioni operative non hanno più righe "In programma"
    const operative = centro.slice(centro.indexOf('id="c-profilo"'), centro.indexOf('title="In arrivo"'));
    expect(operative).not.toContain('state: "soon"');
    const oggi = read("components/center/OggiV2.tsx");
    expect(oggi).not.toContain("In programma");
    expect(oggi).toContain("controllate le deleghe come fate oggi");
  });

  test("RPP-11 inviti: niente dettagli di sviluppo, stato onesto, condivisione WhatsApp", () => {
    const inv = read("app/center/invites/InvitesClient.tsx");
    expect(inv).not.toContain("Resend");
    expect(inv).toContain('pending: "Link da condividere"');
    expect(inv).toContain('sent: "Email partita"');
    expect(inv).toContain("https://wa.me/?text=");
  });

  test("RPP-12 Preferenze promette solo quello che c'è; note della famiglia: la procedura di oggi", () => {
    expect(read("components/ProfileSettingsSection.tsx")).toContain('"Notifiche (lingua e tema in arrivo)"');
    const sheet = read("components/center/BookingSheet.tsx");
    expect(sheet).toContain("TRAMA non le raccoglie ancora. Chiedetele alla famiglia come fate oggi.");
    expect(sheet).not.toContain("In programma");
  });

  test("RPP-13 'Accessibilità e punto ristoro': il punto ristoro si cambia anche dal profilo", () => {
    const p = read("app/center/profile/CenterProfileClient.tsx");
    expect(p).toContain('onChange={(e) => update("hasBar", e.target.checked)}');
  });
});
