import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  activityDateLine,
  dateStateRank,
  isSummerRange,
  looksLikeSummerOnly,
  periodFit,
  schoolCoverage,
  schoolCoverageNote,
  schoolSetupHref,
  summarizeActivityDates,
  unavailableCtaLabel,
  validateNewKid,
  newKidErrorSummary,
  matchesSearch,
  normalizeSearch,
  withoutTestFixtures,
} from "../../lib/nextgen/parent-ux-fix";
import { buildHomeInbox } from "../../lib/nextgen/home-inbox";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { RELEASE_CATALOG } from "../../lib/releases/catalog";

// TRAMA — CORREZIONI DAL TEST UX PARENT (21/10/2026), release
// "correzioni-test-ux" (PARENT_UX_FIX_ENABLED). Iniziativa:
// claude/INIZIATIVA_parent_ux_fix_2110.md. Logica pura + controlli sul
// sorgente: nessun browser.
//
// Comando: npx playwright test tests/one/parent-ux-fix.spec.ts

const ROOT = path.join(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

const PONTE = { start: "2026-12-07", end: "2026-12-08" };
const LUGLIO = { start: "2027-07-05", end: "2027-07-09" };

test.describe("Correzioni dal test UX — ciclo 1 [no browser]", () => {
  test("UXF-01 flag spento di default e in una sola release", () => {
    expect(FEATURE_FLAG_REGISTRY.PARENT_UX_FIX_ENABLED.defaultValue).toBe(false);
    const releases = RELEASE_CATALOG.filter((r) => r.featureKeys.includes("parent_ux_fix"));
    expect(releases.map((r) => r.id)).toEqual(["correzioni-test-ux"]);
  });

  test("UXF-02 (001) una scoperta senza date non è un risultato del ponte: va in 'Date da verificare'", () => {
    expect(periodFit({ startDate: null, endDate: null, title: "Laboratorio di teatro" }, PONTE)).toBe("to_verify");
    // dichiaratamente estiva: per un ponte di dicembre non compare proprio
    expect(periodFit({ startDate: null, endDate: null, title: "Centri Ricreativi Diurni Estivi per Minori" }, PONTE)).toBe("excluded");
    // ma per l'estate resta da verificare
    expect(periodFit({ startDate: null, endDate: null, title: "Centri Ricreativi Diurni Estivi per Minori" }, LUGLIO)).toBe("to_verify");
    // con le date: regola di sempre
    expect(periodFit({ startDate: "2026-12-01", endDate: "2026-12-24", title: "Campus di Natale" }, PONTE)).toBe("match");
    expect(periodFit({ startDate: "2027-06-14", endDate: "2027-07-30", title: "CRE estivo" }, PONTE)).toBe("excluded");
    expect(periodFit({ startDate: "2026-12-07", endDate: null, title: "Open day" }, PONTE)).toBe("match");
  });

  test("UXF-03 estate e parole estive", () => {
    expect(isSummerRange(PONTE)).toBe(false);
    expect(isSummerRange(LUGLIO)).toBe(true);
    expect(isSummerRange({ start: "2026-05-25", end: "2026-06-05" })).toBe(true);
    expect(looksLikeSummerOnly("Campus Estivi Milanosport")).toBe(true);
    expect(looksLikeSummerOnly("CRE Estivo Scuola Primaria")).toBe(true);
    expect(looksLikeSummerOnly("Corso di nuoto")).toBe(false);
  });

  test("UXF-04 (003) stato vero dalle date: aperta, esaurita, conclusa, senza date", () => {
    const today = "2026-10-21";
    const ended = summarizeActivityDates(
      { weeks: [{ start: "2026-06-15", end: "2026-06-19", spotsLeft: 5 }, { start: "2026-08-24", end: "2026-08-28", spotsLeft: 3 }], days: [] },
      today
    );
    expect(ended.state).toBe("ended");
    expect(ended.lastEnd).toBe("2026-08-28");
    expect(activityDateLine(ended).text).toBe("Edizione conclusa il 28 agosto");
    expect(unavailableCtaLabel(ended)).toBe("Edizione conclusa");

    const open = summarizeActivityDates(
      {
        weeks: [{ start: "2026-12-07", end: "2026-12-11", spotsLeft: 0 }, { start: "2026-12-14", end: "2026-12-18", spotsLeft: 4 }],
        days: [],
      },
      today
    );
    expect(open.state).toBe("open");
    expect(open.next).toEqual({ start: "2026-12-14", end: "2026-12-18" });
    expect(open.upcoming.map((u) => u.full)).toEqual([true, false]);
    expect(activityDateLine(open).text).toBe("Prossima data: 14–18 dic");

    const full = summarizeActivityDates({ weeks: [{ start: "2026-12-07", end: "2026-12-11", spotsLeft: 0 }], days: [] }, today);
    expect(full.state).toBe("full");
    expect(unavailableCtaLabel(full)).toBe("Posti esauriti");

    expect(summarizeActivityDates(undefined, today).state).toBe("no_dates");
    expect(unavailableCtaLabel(null)).toBe("Non disponibile ora");
  });

  test("UXF-05 la modalità di prenotazione decide quali date contano", () => {
    const rows = {
      weeks: [{ start: "2026-06-15", end: "2026-06-19", spotsLeft: 5 }],
      days: [{ date: "2026-12-07", isOpen: true, singleDayBookable: true, spotsLeft: 2 }],
    };
    expect(summarizeActivityDates(rows, "2026-10-21", "week_only").state).toBe("ended");
    expect(summarizeActivityDates(rows, "2026-10-21", "day_only").state).toBe("open");
    expect(summarizeActivityDates(rows, "2026-10-21", "mixed").state).toBe("open");
  });

  test("UXF-06 in Scopri le attività senza date future vanno in fondo", () => {
    const open = summarizeActivityDates({ weeks: [{ start: "2026-12-14", end: "2026-12-18", spotsLeft: 4 }], days: [] }, "2026-10-21");
    const ended = summarizeActivityDates({ weeks: [{ start: "2026-06-15", end: "2026-06-19", spotsLeft: 4 }], days: [] }, "2026-10-21");
    expect(dateStateRank(open)).toBeLessThan(dateStateRank(ended));
  });

  test("UXF-07 (004) copertura della scuola per figlio", () => {
    const kids = [
      { id: "l", name: "Luca" },
      { id: "g", name: "Giulia" },
    ];
    const c = schoolCoverage(kids, ["l"]);
    expect(c).toEqual({ total: 2, configured: 1, missing: [{ id: "g", name: "Giulia" }] });
    const note = schoolCoverageNote(c)!;
    expect(note.text).toContain("1 figlio su 2");
    expect(note.text).toContain("Le chiusure di Giulia non sono contate");
    expect(note.ctaLabel).toBe("Imposta per Giulia");
    expect(schoolSetupHref(note.kidId)).toBe("/nextgen/profile/famiglia?scuola=g");
    expect(schoolCoverageNote(schoolCoverage(kids, ["l", "g"]))).toBeNull();
    expect(schoolCoverageNote(schoolCoverage([], []))).toBeNull();
  });

  test("UXF-08 (006) 'Indica la scuola' resta in Da fare finché manca, prima di 'Completa il profilo'", () => {
    const base = { bookings: [], upcomingCoordination: null, groupInvites: [], profileIncomplete: true, pushInactive: false };
    expect(buildHomeInbox(base).all.map((i) => i.kind)).toEqual(["profile_incomplete"]);
    const withSchool = buildHomeInbox({ ...base, schoolMissingKids: [{ id: "g", name: "Giulia" }] });
    expect(withSchool.all.map((i) => i.kind)).toEqual(["school_missing", "profile_incomplete"]);
    expect(withSchool.all[0].title).toBe("Indica la scuola di Giulia");
    expect(withSchool.all[0].href).toBe("/nextgen/profile/famiglia?scuola=g");
    const two = buildHomeInbox({ ...base, schoolMissingKids: [{ id: "l", name: "Luca" }, { id: "g", name: "Giulia" }] });
    expect(two.all[0].title).toBe("Indica la scuola di Luca e Giulia");
  });

  test("UXF-09 Scopri: le scoperte senza date escono dal conteggio solo con il flag", () => {
    const client = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(client).toContain("const uxFix = Boolean(v2 && parentUxFix);");
    expect(client).toContain("if (temporalRange && isUndated(lead)) return false;");
    expect(client).toContain('data-testid="discovery-to-verify"');
    expect(client).toContain("Date da verificare");
    const page = read("app/nextgen/search/page.tsx");
    expect(page).toContain("flagName: PARENT_UX_FIX_FLAG");
    expect(page).toContain("if (user && discoverV2 && uxFixDetail.enabled)");
  });

  test("UXF-10 il tutorial non promette più 'solo le disponibilità reali'", () => {
    expect(read("lib/walkthrough/registry.ts")).not.toContain("vedrai solo le disponibilità reali");
  });

  test("UXF-11 scheda attività: date vere e pulsante con la causa, solo con il flag", () => {
    const detail = read("components/nextgen/ActivityDetailV2.tsx");
    expect(detail).toContain('data-testid="activity-dates"');
    expect(detail).toContain("{!dateSummary && activity.weeksAvailable && (");
    expect(detail).toContain('{dateSummary ? unavailableCtaLabel(dateSummary) : "Non disponibile ora"}');
    expect(detail).toContain("Apri mappa");
    const page = read("app/activity/[id]/page.tsx");
    expect(page).toContain("if (uxFix && activity.dbId)");
  });

  test("UXF-12 (007) Stagione senza scuola: stato iniziale e estate passata chiusa", () => {
    const planner = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(planner).toContain("const noHolidayState = Boolean(schoolCoverage) && summer.isOver && holidaySummary === null;");
    expect(planner).toContain('data-testid="season-no-school"');
    const data = read("app/nextgen/planner/planner-v2-data.ts");
    expect(data).toContain("const parentUxFix = uxFixEnabled");
    expect(data).toContain("schoolCoverage: schoolEnabled");
  });
});

test.describe("Correzioni dal test UX — ciclo 2 [no browser]", () => {
  test("UXF-20 (010) foglio impegno: conferma prima di scartare, bozza ripresa, solo con il flag", () => {
    const src = read("components/nextgen/ExternalPlannerItemsSection.tsx");
    expect(src).toContain("Chiudere senza salvare?");
    expect(src).toContain("Continua a modificare");
    expect(src).toContain('data-testid="impegno-draft-restored"');
    // Indietro chiude e tiene la bozza; X, sfondo, Esc e Annulla chiedono.
    expect(src).toContain("useCloseOnBack(true, onBack ?? onCancel);");
    expect(src).toContain("onCancel={draftKey ? requestClose : onCancel}");
    // senza flag nessuna chiave di bozza: comportamento di prima
    expect(src.match(/draftKey=\{uxFix && v2 \? /g)?.length).toBe(3);
    expect(read("app/nextgen/planner/PlannerV2Client.tsx").match(/uxFix=\{Boolean\(parentUxFix\)\}/g)?.length).toBe(2);
  });

  test("UXF-21 (015) form del figlio: tutti gli errori insieme, nell'ordine dei campi", () => {
    const errors = validateNewKid({ name: " ", birthDate: "", declarationRequired: true, declarationAccepted: false, todayIso: "2026-10-21" });
    expect(errors.map((e) => e.field)).toEqual(["name", "birthDate", "declaration"]);
    expect(newKidErrorSummary(errors)).toBe("Da completare: nome, data di nascita e conferma della dichiarazione.");
    expect(validateNewKid({ name: "Luca", birthDate: "2030-01-01", declarationRequired: false, declarationAccepted: false, todayIso: "2026-10-21" })[0].message).toBe(
      "La data di nascita è nel futuro"
    );
    expect(validateNewKid({ name: "Luca", birthDate: "2016-06-15", declarationRequired: true, declarationAccepted: true, todayIso: "2026-10-21" })).toEqual([]);
    const form = read("components/AddKidForm.tsx");
    expect(form).toContain("if (uxFix) {");
    expect(form).toContain('id="addkid-name"');
  });

  test("UXF-22 (015) gruppo senza nome: errore subito, senza 'Creo…'", () => {
    const src = read("components/GroupsClient.tsx");
    expect(src).toContain("if (uxFix && !newName.trim()) {");
    expect(read("app/nextgen/groups/page.tsx")).toContain("parentUxFixEnabled()");
  });

  test("UXF-23 (013) scheda figlio: ogni Salva dice cosa salva", () => {
    const src = read("components/ProfileKidsSection.tsx");
    expect(src).toContain('uxFix ? "Salva nome e data" : "Salva dati"');
    expect(src).toContain('uxFix ? "Salva interessi" : "Salva"');
    expect(src).toContain('uxFix ? "Salva scuola" : "Salva"');
  });

  test("UXF-24 primi passi: senza figli 'Completa il profilo' aspetta; niente 'Condividi piano' a piano vuoto", () => {
    const base = { bookings: [], upcomingCoordination: null, groupInvites: [], profileIncomplete: true, pushInactive: false };
    expect(buildHomeInbox({ ...base, noKidsYet: true }).all).toEqual([]);
    expect(buildHomeInbox({ ...base, noKidsYet: false }).all.map((i) => i.kind)).toEqual(["profile_incomplete"]);
    expect(read("app/nextgen/home-v2-data.ts")).toContain("hideSharePlan: uxFixEnabled && isNewFamily,");
  });

  test("UXF-25 (001) 'Date da verificare': il periodo cercato si può usare solo con un tocco", () => {
    const card = read("components/nextgen/DiscoveryLeadCard.tsx");
    expect(card).toContain('data-testid="lead-period-hint"');
    expect(card).toContain("{!hasKnownDates && periodHint && (");
    expect(card).toContain('setPlanError("Scegli almeno un figlio e indica quando si svolge.");');
  });
});

test.describe("Correzioni dal test UX — ciclo 3 [no browser]", () => {
  test("UXF-30 (008) nel + co-genitore e altra famiglia sono due voci, solo con il flag", () => {
    const sheet = read("components/nextgen/AddSheet.tsx");
    expect(sheet).toContain('title: "Il mio co-genitore"');
    expect(sheet).toContain('href: "/nextgen/profile/famiglia#genitori-h"');
    expect(sheet).toContain(`title: "Un'altra famiglia"`);
    // senza flag resta la voce di prima
    expect(sheet).toContain('title: "Un altro genitore"');
    expect(read("app/nextgen/layout.tsx")).toContain("uxFix={parentUxFix}");
    expect(read("components/nextgen/NextgenBottomNav.tsx")).toContain("uxFix={uxFix}");
  });

  test("UXF-31 (008) La tua famiglia dice chi vede cosa", () => {
    const fam = read("app/nextgen/profile/famiglia/FamigliaV2Client.tsx");
    expect(fam).toContain("{uxFix && <AccessSummary />}");
    expect(fam).toContain("Possono modificare");
    expect(fam).toContain("Solo consultazione");
    expect(fam).toContain("Solo un nome nel piano");
    expect(fam).toContain("TRAMA non li avvisa");
  });

  test("UXF-32 (009) gruppo appena creato: tre passi, aggregazioni e richiesta dopo", () => {
    const g = read("components/GroupDetailClient.tsx");
    expect(g).toContain('data-testid="group-first-steps"');
    expect(g).toContain("const showAdvanced = !uxFix || groupReady;");
    expect(g).toContain("da confermare dal centro");
    expect(g).toContain("Nel gruppo non c&apos;è una chat");
    expect(read("app/nextgen/groups/[id]/page.tsx")).toContain("uxFix={v2 && uxFix}");
  });
});

test.describe("Correzioni dal test UX — ciclo 4, K e L [no browser]", () => {
  test("UXF-40 (011) 'calcio' trova Soccer Academy; ricerca su più campi e senza accenti", () => {
    const soccer = ["Soccer Academy Estate", "Campo Brera", "Allenamenti e tornei", "Sport"];
    expect(matchesSearch(soccer, "calcio")).toBe(true);
    expect(matchesSearch(soccer, "football")).toBe(true);
    expect(matchesSearch(soccer, "brera")).toBe(true);
    expect(matchesSearch(soccer, "danza")).toBe(false);
    expect(matchesSearch(["Summer Camp Acquatico"], "nuoto")).toBe(true);
    expect(matchesSearch(["Città dei bambini"], "citta")).toBe(true);
    expect(matchesSearch(["Judo per bambini"], "arti marziali")).toBe(true);
    expect(matchesSearch(soccer, "  ")).toBe(true);
    expect(normalizeSearch("  Perché  NO ")).toBe("perche no");
    const client = read("app/nextgen/search/SearchDiscoveryClient.tsx");
    expect(client).toContain("matchesSearch([a.name, a.center, a.description, ...a.tags.map((t) => t.label)], q)");
    expect(client).toContain(": a.name.toLowerCase().includes(q);");
  });

  test("UXF-41 (014) Novità a parte, fuori dal numero, lette all'apertura sul server", () => {
    const nc = read("components/nextgen/NotificationCenter.tsx");
    expect(nc).toContain("const unseenCount = uxFix ? countUnseen(items.filter((i) => !isNovita(i))) : countUnseen(items);");
    expect(nc).toContain("markAnnouncementsSeenFromNovitaAction(");
    expect(nc).toContain('data-testid="notifications-novita-h"');
    const layout = read("app/nextgen/layout.tsx");
    expect(layout).toContain('n.type === "trama_announcement" && n.relevantAt < joinedAt');
    expect(layout).toContain("uxFix={parentUxFix} />}");
    expect(read("components/nextgen/NextgenBottomNav.tsx")).toContain('!(uxFix && i.type === "trama_announcement")');
  });

  test("UXF-42 (002) centri di prova fuori dal catalogo famiglie, l'Admin li vede", () => {
    const list = [{ id: "a", centerDbId: "test" }, { id: "b", centerDbId: "vero" }, { id: "c" }];
    const test = new Set(["test"]);
    expect(withoutTestFixtures(list, test, "parent").map((a) => a.id)).toEqual(["b", "c"]);
    expect(withoutTestFixtures(list, test, "platform_admin").map((a) => a.id)).toEqual(["a", "b", "c"]);
    expect(withoutTestFixtures(list, new Set(), "parent")).toHaveLength(3);
  });

  test("UXF-43 (002) migration 47: additiva, segno esplicito, preparata e non applicata", () => {
    const sql = read("supabase/migration_47_centri_di_prova.sql");
    expect(sql).toContain("-- STATO: PREPARATA, NON APPLICATA");
    expect(sql).toContain("add column if not exists is_test_fixture boolean not null default false");
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/\bdrop\s+table\b/i);
    // colonna assente o errore → nessun centro nascosto
    const data = read("lib/data/activities.ts");
    expect(data).toContain('.from("centers").select("id").eq("is_test_fixture", true)');
    expect(read("app/nextgen/search/page.tsx")).toContain("withoutTestFixtures(activities, await getTestFixtureCenterIds(), role)");
  });
});
