// Test UX (ChatGPT) del 29/10/2026: UX-PARENT-023, 024, 025.
// Cause verificate (codice + dati di produzione in sola lettura):
//  023 — il nome della scuola viveva solo nel titolo degli orari: spegnendo
//        gli orari l'impegno "scuola" si cancellava e il nome con lui;
//        kid_school_profiles aveva solo Regione e Comune (migration 56).
//  024 — la Home contava le scelte "del giorno" (week_responsibilities, dove
//        la sola scuola non conta); il Planner i passaggi, scuola compresa.
//  025 — getActivityDays tagliava i giorni dopo la fine dell'estate
//        (7–8 dicembre), mentre date e posti in Scopri e in scheda li
//        contavano: "Posti liberi" e pulsante "Non disponibile ora".
// Logica pura + controlli sul sorgente; i percorsi nel browser restano
// "pending local verification".
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { missingPassagesLine, passageDayCoordination } from "../../lib/nextgen/passage-busy-day";
import { summarizeActivityDates, unavailableCtaLabel } from "../../lib/nextgen/parent-ux-fix";
import type { PassageResponsibility } from "../../lib/nextgen/passages";
import type { AgendaEntry } from "../../lib/nextgen/today-agenda";

const ROOT = path.join(__dirname, "../..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");

test.describe("UX-PARENT-023 nome della scuola anche senza orari", () => {
  test("R023-01 migration 56: additiva, preparata, due colonne facoltative", () => {
    const sql = read("supabase/migration_56_nome_scuola.sql");
    expect(sql.split("\n")[1]).toBe("-- STATO: PREPARATA, NON APPLICATA");
    expect(sql).toContain("add column if not exists school_name text;");
    expect(sql).toContain("add column if not exists school_address text;");
  });

  test("R023-02 il nome si salva nel profilo scuola insieme a Regione e Comune, orari accesi o spenti", () => {
    const a = read("app/actions/school-calendar.ts");
    expect(a).toContain(".upsert({ ...base, school_name: name, school_address: address }, { onConflict: \"kid_id\" });");
    // Indirizzo solo se c'è un nome (cambiando scuola l'indirizzo vecchio è già tolto nel modulo).
    expect(a).toContain("const address = name ? school.address?.trim() || null : null;");
    // Prima della migration: Regione e Comune salvati, e si dice che il nome non si è potuto conservare.
    expect(a).toContain("return { schoolNotSaved: true };");
    const b = read("components/nextgen/KidSchoolBlock.tsx");
    expect(b).toContain('const savedName = (schoolItem && schoolItem.title !== "Scuola" ? schoolItem.title : "") || profile?.schoolName || "";');
    expect(b).toContain("setSchoolContextForKidAction(kid.id, region, comune, { name: name.trim() || null, address: address.trim() || null });");
    // L'avviso "Hai cambiato scuola…" resta.
    expect(b).toContain('data-testid="kid-school-address-removed"');
    const d = read("lib/data/school-calendar.ts");
    expect(d).toContain("schoolName: p.school_name ?? null,");
  });

  test("R023-03 riepilogo subito aggiornato; in errore il modulo resta aperto con i dati", () => {
    const b = read("components/nextgen/KidSchoolBlock.tsx");
    expect(b).toContain("setJustSaved({");
    expect(b).toContain("useEffect(() => setJustSaved(null), [profile, schoolItem]);");
    expect(b).toContain("I dati sono ancora qui, riprova.");
  });
});

test.describe("UX-PARENT-024 Home e Planner contano gli stessi passaggi", () => {
  const LUCA = { id: "k-luca", name: "Luca" };
  const GIULIA = { id: "k-giulia", name: "Giulia" };
  const TODAY = "2026-10-29";
  const entries: AgendaEntry[] = [
    { id: "external:s", school: true, startTime: "08:30", endTime: "16:30", title: "Scuola", place: null, kids: [LUCA], source: "manuale", status: null } as AgendaEntry,
    { id: "external:g", startTime: "15:00", endTime: "17:00", title: "Danza", place: null, kids: [GIULIA], source: "manuale", status: null } as AgendaEntry,
  ];
  const labelFor = (r: PassageResponsibility) => (r.responsible === "io" ? "Tu" : r.responsible === "nonno" ? "Nonno" : "Altro");
  // Giulia decisa con le scelte del giorno (Nonno porta, Tu ritiri), Luca no.
  const dayChoiceFor = (kidId: string) => (kidId === GIULIA.id ? { andata: "Nonno", ritorno: "Tu" } : undefined);

  test("R024-01 Giulia organizzata e Luca scoperto: niente conferma verde, '2 passaggi da decidere · Luca'", () => {
    const { summary, missingItems } = passageDayCoordination({ kids: [LUCA, GIULIA], entries, date: TODAY, rows: [], labelFor, dayChoiceFor });
    expect(summary.mode).toBe("detailed");
    expect(summary.missingCount).toBe(2);
    expect(missingPassagesLine(summary.passageKids!)).toBe("2 passaggi da decidere · Luca");
    expect(missingItems.map((m) => [m.kidName, m.moment])).toEqual([
      ["Luca", "andata"],
      ["Luca", "ritorno"],
    ]);
    expect(summary.people).toEqual(["Nonno", "Tu"]);
  });

  test("R024-02 conferma solo con tutti i passaggi decisi", () => {
    const rows: PassageResponsibility[] = [
      { kidId: LUCA.id, date: TODAY, passageKey: "school", moment: "andata", responsible: "io", responsibleLabel: null },
      { kidId: LUCA.id, date: TODAY, passageKey: "school", moment: "ritorno", responsible: "nonno", responsibleLabel: null },
    ];
    const { summary } = passageDayCoordination({ kids: [LUCA, GIULIA], entries, date: TODAY, rows, labelFor, dayChoiceFor });
    expect(summary.mode).toBe("compact");
    expect(summary.missingCount).toBe(0);
  });

  test("R024-03 la Home usa lo stesso conteggio con la release dei passaggi; la scritta 'decisi' solo se è tutto deciso", () => {
    const h = read("app/nextgen/home-v2-data.ts");
    expect(h).toContain("if (passageFlag && dayViewFlag && kidList.length > 0) {");
    expect(h).toContain("coordinationShown = on(todayIso).summary;");
    expect(h).toContain("coordination: coordinationShown,");
    const c = read("components/nextgen/DayCoordination.tsx");
    expect(c).toContain("Accompagnamenti decisi per oggi · {joinPeople(coordination.people)}");
    expect(c).toContain("{missingPassagesLine(coordination.passageKids)}");
  });
});

test.describe("UX-PARENT-025 scheda, date, riepilogo e pulsante dicono la stessa cosa", () => {
  test("R025-01 i giorni dopo l'estate restano (con le correzioni UX) nella scheda, nella richiesta e nella modifica", () => {
    const d = read("lib/data/activity-days.ts");
    expect(d).toContain("if (opts.includeAfterSeason) return (data as RawDayRow[]).map(mapRow);");
    expect(read("app/activity/[id]/page.tsx")).toContain("getActivityDays(activity, { includeAfterSeason: uxFix })");
    expect(read("app/booking/[id]/page.tsx")).toContain("getActivityDays(activity, { includeAfterSeason: uxFix })");
    expect(read("app/prenotazioni/[id]/modifica/page.tsx")).toContain("getActivityDays(activity, { includeAfterSeason: uxFix })");
  });

  test("R025-02 ponte 7–8 dicembre a giornate: 'open'; esaurito, concluso e senza date con la causa vera", () => {
    const days = (spots: number) => ({
      weeks: [],
      days: [
        { date: "2026-12-07", isOpen: true, singleDayBookable: true, spotsLeft: spots },
        { date: "2026-12-08", isOpen: true, singleDayBookable: true, spotsLeft: spots },
      ],
    });
    expect(summarizeActivityDates(days(10), "2026-10-29", "day_only").state).toBe("open");
    const full = summarizeActivityDates(days(0), "2026-10-29", "day_only");
    expect(unavailableCtaLabel(full)).toBe("Posti esauriti");
    expect(unavailableCtaLabel(summarizeActivityDates(days(10), "2026-12-20", "day_only"))).toBe("Edizione conclusa");
    expect(unavailableCtaLabel(summarizeActivityDates({ weeks: [], days: [] }, "2026-10-29", "day_only"))).toBe("Date non ancora aperte");
  });

  test("R025-03 attività solo a giornate: prezzo al giorno", () => {
    const v = read("components/nextgen/ActivityDetailV2.tsx");
    expect(v).toContain('const dayOnlyPriced = Boolean(dateSummary) && activity.bookingMode === "day_only";');
    expect(v).toContain('dayOnlyPriced ? "al giorno" : "a settimana"');
  });
});
