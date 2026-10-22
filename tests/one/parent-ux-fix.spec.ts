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
  regionFromPlace,
  siblingSchools,
} from "../../lib/nextgen/parent-ux-fix";
import { parsePhotonResponse, mergeSchoolSuggestions, retryQuery, distinctiveWords } from "../../lib/places/search";
import { tramaEmailHtml, escapeEmailHtml } from "../../lib/email-layout";
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
  test("UXF-30 (008) nel + l'altro genitore e altra famiglia sono due voci, solo con il flag", () => {
    const sheet = read("components/nextgen/AddSheet.tsx");
    // 22/10/2026 (Fabrizio): "L'altro genitore", non "Il mio co-genitore".
    expect(sheet).toContain(`title: "L'altro genitore"`);
    expect(sheet).not.toContain("co-genitore\"");
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

test.describe("Ritest 22/10 — uscire da un gruppo, eliminare un gruppo [no browser]", () => {
  test("UXF-50 migration 48: solo due regole DELETE, preparata e non applicata", () => {
    const sql = read("supabase/migration_48_gruppi_esci_elimina.sql");
    expect(sql).toContain("-- STATO: PREPARATA, NON APPLICATA");
    expect(sql).toContain("on public.group_members\n  for delete\n  using (auth.uid() = parent_id);");
    expect(sql).toContain("on public.groups\n  for delete\n  using (created_by = auth.uid());");
    expect(sql).not.toMatch(/\balter table\b|\bdelete\s+from\b|\bdrop\s+table\b/i);
  });

  test("UXF-51 azioni: chi crea elimina, gli altri escono; nessuna eliminazione con richiesta aperta", () => {
    const a = read("app/actions/groups.ts");
    expect(a).toContain("export async function leaveGroupAction(groupId: string)");
    expect(a).toContain("export async function deleteGroupAction(groupId: string)");
    expect(a).toContain("Hai creato tu questo gruppo: puoi eliminarlo, non uscire.");
    expect(a).toContain('.in("status", ["pending", "accepted"])');
    // uscendo, via prima i propri dati
    const leave = a.slice(a.indexOf("export async function leaveGroupAction"), a.indexOf("export async function deleteGroupAction"));
    expect(leave.indexOf('from("group_kids").delete()')).toBeLessThan(leave.indexOf('from("group_members")'));
    expect(leave).toContain('.eq("parent_id", user.id)');
  });

  test("UXF-52 dettaglio gruppo: Esci / Elimina con conferma, solo con il flag", () => {
    const g = read("components/GroupDetailClient.tsx");
    expect(g).toContain("{uxFix && <LeaveOrDeleteGroup detail={detail} backHref={backHref} />}");
    expect(g).toContain('data-testid="group-leave-delete"');
    expect(g).toContain("Sparisce anche per le altre famiglie");
  });
});

test.describe("Ritest 22/10 — una sola Scuola per figlio [no browser]", () => {
  const REGIONS = ["Emilia-Romagna", "Friuli-Venezia Giulia", "Lombardia", "Sicilia", "Trentino-Alto Adige", "Valle d'Aosta"];

  test("UXF-53 regione di OpenStreetMap → regione di TRAMA", () => {
    expect(regionFromPlace("Lombardia", REGIONS)).toBe("Lombardia");
    expect(regionFromPlace("Trentino-Alto Adige/Südtirol", REGIONS)).toBe("Trentino-Alto Adige");
    expect(regionFromPlace("Friuli Venezia Giulia", REGIONS)).toBe("Friuli-Venezia Giulia");
    expect(regionFromPlace("Valle d'Aosta / Vallée d'Aoste", REGIONS)).toBe("Valle d'Aosta");
    expect(regionFromPlace("Emilia Romagna", REGIONS)).toBe("Emilia-Romagna");
    expect(regionFromPlace("Lombardy", REGIONS)).toBe("Lombardia");
    expect(regionFromPlace("Bayern", REGIONS)).toBeNull();
    expect(regionFromPlace(undefined, REGIONS)).toBeNull();
  });

  test("UXF-54 la ricerca luoghi dà anche Comune e Regione (mai la provincia come Comune)", () => {
    const [school, fuori] = parsePhotonResponse({
      features: [
        { geometry: { coordinates: [9.2, 45.47] }, properties: { name: "Scuola primaria Pizzigoni", street: "Via Castellino da Castello", housenumber: "10", postcode: "20127", city: "Milano", state: "Lombardia", countrycode: "IT", osm_key: "amenity", osm_value: "school" } },
        { geometry: { coordinates: [9.1, 45.6] }, properties: { name: "Scuola dell'infanzia", county: "Monza e Brianza", state: "Lombardia", countrycode: "IT" } },
      ],
    });
    expect(school.city).toBe("Milano");
    expect(school.region).toBe("Lombardia");
    expect(fuori.city).toBeUndefined();
    expect(fuori.region).toBe("Lombardia");
  });

  test("UXF-55 'Stessa scuola di …': solo fratelli con la scuola, al massimo due", () => {
    const kids = [
      { id: "l", name: "Luca" },
      { id: "g", name: "Giulia" },
      { id: "m", name: "Marco" },
    ];
    const profiles = { l: { region: "Lombardia", comune: "Milano" }, m: undefined };
    expect(siblingSchools("g", kids, profiles, { l: "Pizzigoni" })).toEqual([
      { kidId: "l", kidName: "Luca", region: "Lombardia", comune: "Milano", schoolName: "Pizzigoni" },
    ]);
    expect(siblingSchools("l", kids, profiles, {})).toEqual([]);
  });

  test("UXF-56 scheda figlio: un solo blocco Scuola (calendario + orari), il blocco orari a parte sparisce con il flag", () => {
    const k = read("components/ProfileKidsSection.tsx");
    expect(k).toContain("const schoolV2 = v2 && uxFix;");
    expect(k).toContain("{schoolCalendarEnabled && schoolV2 && (");
    expect(k).toContain("<KidSchoolBlock");
    expect(k).toContain("{schoolCalendarEnabled && !schoolV2 && (");
    const b = read("components/nextgen/KidSchoolBlock.tsx");
    expect(b).toContain('data-testid="kid-school-unified"');
    expect(b).toContain("setSchoolContextForKidAction(kid.id, region, comune)");
    expect(b).toContain("isSchool: true,");
    expect(b).toContain("Stessa scuola di {s.kidName}");
    // il collegamento ?scuola= da Home e Planner apre ancora la sezione giusta
    expect(b).toContain("id={`kid-school-${kid.id}`}");
    const f = read("app/nextgen/profile/famiglia/FamigliaV2Client.tsx");
    expect(f).toContain("{schoolItems && !uxFix && <SchoolHoursBlock");
    expect(f).toContain("schoolItems={uxFix ? schoolItems : null}");
    expect(read("components/AddKidForm.tsx")).toContain("Nome e orari li puoi aggiungere dopo, nella scheda del figlio.");
  });
});

test.describe("Ritest 22/10, secondo giro — 404, email, Grossman, stessa scuola [no browser]", () => {
  const sug = (name: string, kind = "amenity:school") => ({ name, address: "", lat: 45.4, lng: 9.1, kind });

  test("UXF-60 (14) dopo Elimina: replace, e un gruppo che non c'è più porta alla lista, non a un 404", () => {
    expect(read("components/GroupDetailClient.tsx")).toContain("router.replace(backHref);");
    const page = read("app/nextgen/groups/[id]/page.tsx");
    expect(page).toContain('if (uxFix) redirect("/nextgen/groups");');
    expect(page).toContain("notFound();");
  });

  test("UXF-61 (15) email: stessa forma per tutte, testi ripuliti", () => {
    const html = tramaEmailHtml({ title: "Ti <b>invito</b>", paragraphs: ["Ciao"], cta: { label: "Vedi", href: "https://tramapp.it/x?a=1&b=2" }, footnote: "Nota <x>" });
    expect(html).toContain("Ti &lt;b&gt;invito&lt;/b&gt;");
    expect(html).toContain('href="https://tramapp.it/x?a=1&amp;b=2"');
    expect(html).toContain("Nota &lt;x&gt;");
    expect(html).toContain("trama-logo-mark.png");
    expect(escapeEmailHtml(`"'`)).toBe("&quot;&#39;");
    expect(read("app/actions/groups.ts")).toContain("tramaEmailHtml({");
    expect(read("app/actions/groups.ts")).toContain('encodeURIComponent("/nextgen/groups?tab=inviti")');
    expect(read("app/actions/family.ts")).toContain("tramaEmailHtml({");
    expect(read("lib/booking-response/notify.ts")).toContain("tramaEmailHtml({");
  });

  test("UXF-62 (6 bis) 'Fondazione Grossman': fondazioni ed enti insieme alle scuole, poi senza parole generiche", () => {
    expect(distinctiveWords("Fondazione Grossman")).toEqual(["grossman"]);
    expect(retryQuery("Fondazione Grossman")).toBe("grossman");
    expect(retryQuery("Grossman")).toBeNull();
    const merged = mergeSchoolSuggestions(
      "Fondazione Grossman",
      [sug("Scuola primaria Gonzaga"), sug("Istituto Gesù")],
      [sug("Fondazione Grossman", "office:foundation"), sug("Scuola primaria Gonzaga")]
    );
    expect(merged.map((m) => m.name)).toEqual(["Fondazione Grossman", "Scuola primaria Gonzaga", "Istituto Gesù"]);
    const route = read("app/api/places/search/route.ts");
    expect(route).toContain("mergeSchoolSuggestions(q, schools, any)");
    expect(route).toContain("const retry = suggestions.length === 0 ? retryQuery(q) : null;");
  });

  test("UXF-63 (17) 'Stessa scuola di …' salta la ricerca: riepilogo e Cambia", () => {
    const b = read("components/nextgen/KidSchoolBlock.tsx");
    expect(b).toContain('data-testid="kid-school-copied"');
    expect(b).toContain("setCopiedFrom(s.kidName);");
    expect(b).toContain("{copiedFrom ? (");
  });
});

