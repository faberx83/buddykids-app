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
  addressBelongsTo,
  groupInviteAcceptMessage,
  GROUP_INVITE_RETRY_MESSAGE,
  familyVisibleTags,
  bellSummary,
  onboardingTotalSteps,
} from "../../lib/nextgen/parent-ux-fix";
import { parsePhotonResponse, mergeSchoolSuggestions, retryQuery, distinctiveWords, rankSchoolSuggestions, type PlaceSuggestion } from "../../lib/places/search";
import { withoutNewExternalItemParam, wantsNewExternalItem } from "../../lib/planner/new-external-item-link";
import { buildSharedExternalEntries, sharedDaysLabel, SHARED_PLANNER_STATUS } from "../../lib/plan-shares/build-entries";
import { externalItemsToCalendarItems, firstOccurrence } from "../../lib/planner/calendar-items-core";
import { buildPlannerCalendarIcs } from "../../lib/ics";
import { tramaEmailHtml, escapeEmailHtml } from "../../lib/email-layout";
import { installBannerFor, parseDismissedAt, INSTALL_REPROPOSE_DAYS } from "../../lib/nextgen/install-banner";
import { appInviteUrl, familyInviteDestination } from "../../lib/public-links";
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
    // 22/10 (UX-PARENT-020): il conteggio passa da bellSummary, sempre senza le Novità
    expect(nc).toContain("const bell = bellSummary(items.filter((i) => !isNovita(i)));");
    expect(nc).toContain("const unseenCount = uxFix ? bell.count : countUnseen(items);");
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
    // 22/10 (link dentro l'app): niente più /auth/login?next=… nell'email, il login lo chiede proxy.ts.
    expect(read("app/actions/groups.ts")).toContain("/nextgen/groups?tab=inviti`;");
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
    // 22/10 (UX-PARENT-018): fuori dal blocco Scuola (senza strict=1) resta questa unione
    expect(route).toContain("strict ? rankSchoolSuggestions(text, s, a, zone) : mergeSchoolSuggestions(text, s, a)");
    expect(route).toContain("let suggestions = merge(q, schools, any);");
    expect(route).toContain("const retry = suggestions.length === 0 ? retryQuery(q) : null;");
  });

  test("UXF-63 (17) 'Stessa scuola di …' salta la ricerca: riepilogo e Cambia", () => {
    const b = read("components/nextgen/KidSchoolBlock.tsx");
    expect(b).toContain('data-testid="kid-school-copied"');
    expect(b).toContain("setCopiedFrom(s.kidName);");
    expect(b).toContain("{copiedFrom ? (");
  });
});

test.describe("22/10 — link che aprono l'app, banner Apri nell'app / Installa [no browser]", () => {
  const DAY = 86_400_000;
  const base = { standalone: false, ios: false, installed: false, canPrompt: false, dismissedAt: null as number | null, now: 100 * DAY };

  test("UXF-70 banner: app già installata → 'Apri dall'icona'; altrimenti Installa / istruzioni iPhone; mai dentro l'app", () => {
    expect(installBannerFor({ ...base, installed: true })).toBe("open_app");
    expect(installBannerFor({ ...base, canPrompt: true })).toBe("install");
    expect(installBannerFor({ ...base, ios: true })).toBe("ios");
    expect(installBannerFor({ ...base, standalone: true, installed: true })).toBe("none");
    expect(installBannerFor(base)).toBe("none");
  });

  test("UXF-71 chiuso → torna dopo 7 giorni, non mai più (il vecchio '1' vale come molto tempo fa)", () => {
    expect(INSTALL_REPROPOSE_DAYS).toBe(7);
    expect(installBannerFor({ ...base, canPrompt: true, dismissedAt: base.now - 2 * DAY })).toBe("none");
    expect(installBannerFor({ ...base, canPrompt: true, dismissedAt: base.now - 8 * DAY })).toBe("install");
    expect(parseDismissedAt("1")).toBe(0);
    expect(parseDismissedAt(null)).toBeNull();
    expect(parseDismissedAt("1700000000000")).toBe(1700000000000);
    const ip = read("components/InstallPrompt.tsx");
    expect(ip).toContain('data-testid="install-open-app"');
    expect(ip).toContain("getInstalledRelatedApps");
    expect(ip).toContain('uxFix ? String(Date.now()) : "1"');
    expect(read("app/nextgen/layout.tsx")).toContain("uxFix={parentUxFix}\n      />");
    const manifest = JSON.parse(read("public/manifest-nextgen.json"));
    expect(manifest.related_applications).toEqual([{ platform: "webapp", url: "https://tramapp.it/manifest-nextgen.json" }]);
    expect(manifest.prefer_related_applications).toBe(false);
    expect(manifest.scope).toBe("/nextgen");
  });

  test("UXF-72 link delle email e delle condivisioni dentro lo spazio dell'app (/nextgen)", () => {
    expect(appInviteUrl("https://tramapp.it/", "AbCdEfGhJkLm")).toBe("https://tramapp.it/nextgen/i/AbCdEfGhJkLm");
    expect(familyInviteDestination("AbCdEfGhJkLm")?.startsWith("/nextgen/")).toBe(true);
    expect(read("app/nextgen/i/[key]/route.ts")).toContain('familyInviteDestination(decodeURIComponent(key)) ?? "/nextgen"');
    expect(read("app/actions/groups.ts")).toContain("const link = `${proto}://${host}/nextgen/groups?tab=inviti`;");
    expect(read("app/actions/family.ts")).toContain("const link = appInviteUrl(origin, token);");
    expect(read("components/GroupDetailClient.tsx")).toContain('${inApp ? "/nextgen/groups/join/" : "/groups/join/"}${groupId}');
    expect(read("app/nextgen/groups/join/[id]/page.tsx")).toContain('basePath="/nextgen/groups"');
    expect(read("components/JoinGroupClient.tsx")).toContain("router.push(`${basePath}/${groupId}`);");
    expect(read("lib/booking-response/notify.ts")).toContain("/nextgen/prenotazioni");
    expect(read("app/actions/attendance.ts")).toContain("/nextgen/prenotazioni");
    // senza sessione si torna alla pagina d'arrivo, non sempre alla Home
    expect(read("components/nextgen/NextgenAuthRedirect.tsx")).toContain('const next = here.startsWith("/nextgen") ? here : "/nextgen";');
  });

  test("UXF-73 guida famiglie: aprire TRAMA dall'icona, Gmail, icona di Chrome nelle notifiche", () => {
    const g = read("docs/trama-one/GUIDA_FAMIGLIE_BETA.md");
    expect(g).toContain("Apri link web in Gmail");
    expect(g).toContain("aprite TRAMA dall'icona");
    expect(g).toContain("L'altro genitore");
  });
});


// ─── Secondo test UX (22/10/2026, ChatGPT): UX-PARENT-016…022 ─────────

test.describe("Secondo test UX 22/10 — 016…022 [no browser]", () => {
  test("UXF-80 (016) migration 49: nomi di colonna con la tabella, ingresso idempotente, preparata", () => {
    const sql = read("supabase/migration_49_accetta_invito_gruppo.sql");
    expect(sql).toContain("-- STATO: PREPARATA, NON APPLICATA");
    expect(sql).toContain("#variable_conflict use_column");
    expect(sql).toContain("where gm.group_id = v_invite.group_id and gm.parent_id = auth.uid()");
    expect(sql).toContain("on conflict do nothing");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public, extensions, pg_temp");
    expect(sql).toContain("grant execute on function public.accept_group_invite(uuid) to authenticated, service_role;");
    expect(sql).toContain("revoke execute on function public.accept_group_invite(uuid) from public, anon;");
    // il difetto: group_id senza tabella dentro la funzione che restituisce group_id
    expect(sql).not.toMatch(/from public\.group_members where group_id/);
    expect(sql).not.toMatch(/\bdrop table\b|\bdelete\s+from\b/i);
  });

  test("UXF-81 (016) messaggi: successo con il nome, errore tecnico → invito ancora valido + Riprova", () => {
    expect(groupInviteAcceptMessage({ groupName: "Calcio Rossi" })).toEqual({ ok: true, text: "Sei nel gruppo «Calcio Rossi».", retry: false });
    expect(groupInviteAcceptMessage({ groupName: null }).text).toBe("Sei nel gruppo.");
    const tech = groupInviteAcceptMessage({ error: 'column reference "group_id" is ambiguous' });
    expect(tech).toEqual({ ok: false, text: GROUP_INVITE_RETRY_MESSAGE, retry: true });
    expect(GROUP_INVITE_RETRY_MESSAGE).toBe("Non siamo riusciti a farti entrare nel gruppo. L'invito è ancora valido.");
    expect(groupInviteAcceptMessage({ error: "Questo invito è per un'altra email" })).toEqual({ ok: false, text: "Questo invito è per un'altra email.", retry: false });
    const ui = read("components/GroupsClient.tsx");
    expect(ui).toContain('uxFix && errorId === inv.id && errorInfo?.retry ? "Riprova" : "Accetta"');
    expect(ui).toContain('showToast(groupInviteAcceptMessage({ groupName }).text, "success")');
    expect(ui).toContain("uxFix={uxFix}");
    expect(read("app/actions/groups.ts")).toContain('revalidatePath("/nextgen", "layout");');
  });

  test("UXF-82 (017) nome cambiato a mano: l'indirizzo vecchio si toglie, con lo stesso nome resta", () => {
    expect(addressBelongsTo("Cavalcavia Bacula, 20155 Milano", "Scuola Pizzigoni", "Scuola Pizzigoni")).toBe(true);
    expect(addressBelongsTo("Cavalcavia Bacula, 20155 Milano", "Scuola Pizzigoni", "  scuola  pizzigoni ")).toBe(true);
    expect(addressBelongsTo("Cavalcavia Bacula, 20155 Milano", "Scuola Pizzigoni", "Scuola Demo UX Non Esistente")).toBe(false);
    expect(addressBelongsTo("Cavalcavia Bacula, 20155 Milano", "", "Scuola Pizzigoni")).toBe(false);
    expect(addressBelongsTo("", "Scuola Pizzigoni", "Scuola Pizzigoni")).toBe(false);
    const ui = read("components/nextgen/KidSchoolBlock.tsx");
    expect(ui).toContain("if (addressBelongsTo(address, addressFor, text)) return;");
    expect(ui).toContain("Hai cambiato scuola. L&apos;indirizzo precedente è stato rimosso. Regione e Comune restano modificabili qui sotto.");
    // copiando la scuola di un fratello l'indirizzo è legato al nome copiato
    expect(ui).toContain('setAddressFor(it.title !== "Scuola" ? it.title : "");');
  });

  const sp = (name: string, kind: string, city?: string, region?: string): PlaceSuggestion => ({
    name, address: city ? `Via 1, ${city}` : "", lat: 45, lng: 9, kind, ...(city ? { city } : {}), ...(region ? { region } : {}),
  });

  test("UXF-83 (018) ricerca stretta: niente tabaccherie, Bolzano fuori zona, Milano prima di Catania", () => {
    // nome inventato: i luoghi estranei spariscono → "Usa questo nome"
    const demo = rankSchoolSuggestions(
      "Scuola Demo UX Non Esistente",
      [sp("Scuola primaria Collodi", "amenity:school", "Milano", "Lombardia")],
      [sp("Tabaccheria Esposito", "shop:tobacco", "Milano", "Lombardia"), sp("Trattoria Da Mario", "amenity:restaurant", "Roma", "Lazio")],
      { city: "Milano", region: "Lombardia" }
    );
    expect(demo).toEqual([]);
    // Grossman: l'azienda di Bolzano non è una scuola ed è fuori zona
    const gross = rankSchoolSuggestions("Fondazione Grossman", [], [sp("Grossmann & Wenter", "office:company", "Bolzano", "Trentino-Alto Adige/Südtirol")], { city: "Milano", region: "Lombardia" });
    expect(gross).toEqual([]);
    // Pizzigoni: la scuola di Milano per prima
    const pizz = rankSchoolSuggestions(
      "Pizzigoni",
      [sp("Scuola Pizzigoni", "amenity:school", "Catania", "Sicilia"), sp("Scuola Pizzigoni", "amenity:school", "Saronno", "Lombardia"), sp("Scuola Primaria Giuseppina Pizzigoni", "amenity:school", "Milano", "Lombardia")],
      [],
      { city: "Milano", region: "Lombardia" }
    );
    expect(pizz.map((p) => p.city)).toEqual(["Milano", "Saronno", "Catania"]);
    // zona sconosciuta: un ente con il nome giusto resta (la Fondazione registrata come ente)
    const ente = rankSchoolSuggestions("Fondazione Grossman", [], [sp("Fondazione Grossman", "office:foundation", "Milano", "Lombardia")]);
    expect(ente).toHaveLength(1);
  });

  test("UXF-84 (018) 'Usa questo nome' esplicito e ricerca stretta solo nel blocco Scuola", () => {
    const ac = read("components/nextgen/PlaceAutocomplete.tsx");
    expect(ac).toContain("Non trovi la scuola? Puoi usare il nome che hai scritto. Per ponti e vacanze bastano Regione e Comune.");
    expect(ac).toContain("Usa questo nome");
    expect(ac).toContain("Altri luoghi con questo nome");
    expect(ac).toContain("&strict=1");
    const block = read("components/nextgen/KidSchoolBlock.tsx");
    expect(block).toContain("strictZone={{ city: comune || residenceCity, region }}");
    expect(block).toContain("onUseTyped={() => {");
    expect(read("app/api/places/search/route.ts")).toContain("strict ? rankSchoolSuggestions(text, s, a, zone) : mergeSchoolSuggestions(text, s, a)");
  });

  test("UXF-85 (019) tag di prova: segno esplicito, filtro per le famiglie, TC-088 fa pulizia", () => {
    const tags = [
      { id: "sport", label: "Sport" },
      { id: "test-1786025340380", label: "Test 1786025340380", isTestFixture: true },
    ];
    expect(familyVisibleTags(tags).map((t) => t.id)).toEqual(["sport"]);
    // prima della migration il campo non c'è: nessun filtro
    expect(familyVisibleTags([{ id: "test", label: "Test" }])).toHaveLength(1);
    const sql = read("supabase/migration_50_tag_di_prova.sql");
    expect(sql).toContain("-- STATO: PREPARATA, NON APPLICATA");
    expect(sql).toContain("add column if not exists is_test_fixture boolean not null default false");
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(read("lib/data/tags.ts")).toContain('.select("*")');
    expect(read("app/nextgen/groups/[id]/page.tsx")).toContain("availableTags: familyVisibleTags(detail.availableTags)");
    expect(read("components/GroupDetailClient.tsx")).toContain('{uxFix ? "Nessuna preferenza" : "Nessuna preferenza particolare"}');
    expect(read("tests/admin/gestione.spec.ts")).toContain('await chip.getByTitle("Elimina tag").click();');
  });

  test("UXF-86 (020) campanella: l'invito in attesa è 'da gestire', non 'da leggere'", () => {
    const invite = { type: "group_invite_pending", isSeen: false, requiresAction: true };
    const reply = { type: "inquiry_reply", isSeen: false };
    const old = { type: "booking_response", isSeen: true };
    expect(bellSummary([invite])).toEqual({ count: 1, toRead: 0, toAnswer: 1, ariaLabel: "Notifiche, 1 invito da gestire" });
    expect(bellSummary([invite, reply, old]).ariaLabel).toBe("Notifiche, 1 da leggere, 1 invito da gestire");
    expect(bellSummary([old]).ariaLabel).toBe("Notifiche");
    expect(bellSummary([invite, { ...invite }]).ariaLabel).toBe("Notifiche, 2 inviti da gestire");
    const nc = read("components/nextgen/NotificationCenter.tsx");
    expect(nc).toContain("Da rispondere");
    expect(nc).toContain("announceUnseenCount(unseenCount, uxFix ? bell.ariaLabel : undefined);");
    expect(read("app/nextgen/HomeDashboardV2Client.tsx")).toContain("unseenLabel ?? `Notifiche, ${unseen} da leggere`");
  });

  test("UXF-87 (022) ?nuovo=impegno si consuma: vista e settimana restano", () => {
    expect(withoutNewExternalItemParam("?nuovo=impegno&view=settimana&week=2026-10-19")).toBe("?view=settimana&week=2026-10-19");
    expect(withoutNewExternalItemParam("?nuovo=impegno")).toBe("");
    expect(withoutNewExternalItemParam("?view=settimana")).toBe("?view=settimana");
    expect(wantsNewExternalItem(withoutNewExternalItemParam("?week=2026-10-19&nuovo=impegno"))).toBe(false);
    const sec = read("components/nextgen/ExternalPlannerItemsSection.tsx");
    expect(sec).toContain("window.history.replaceState(window.history.state, \"\", `${pathname}${withoutNewExternalItemParam(search)}${hash}`);");
    // prima di setMode("creating"): il foglio aggiunge la sua voce di cronologia dopo
    expect(sec.indexOf("withoutNewExternalItemParam(search)")).toBeLessThan(sec.indexOf('setMode("creating");'));
  });

  test("UXF-88 (021, 015) onboarding: 'Passo 1 di 2' fin dall'inizio, tutti gli errori insieme", () => {
    expect(onboardingTotalSteps({ schoolCalendarEnabled: true, kidsCount: 0, kidsWithoutSchoolCount: 0 })).toBe(2);
    expect(onboardingTotalSteps({ schoolCalendarEnabled: true, kidsCount: 1, kidsWithoutSchoolCount: 1 })).toBe(2);
    expect(onboardingTotalSteps({ schoolCalendarEnabled: true, kidsCount: 2, kidsWithoutSchoolCount: 0 })).toBe(1);
    expect(onboardingTotalSteps({ schoolCalendarEnabled: false, kidsCount: 0, kidsWithoutSchoolCount: 0 })).toBe(1);
    const ob = read("components/nextgen/OnboardingV2.tsx");
    expect(ob).toContain("validateNewKid({ name, birthDate, declarationRequired, declarationAccepted, todayIso: today })");
    expect(ob).toContain("return setError(newKidErrorSummary(problems));");
    expect(ob).toContain('aria-invalid={badFields.includes("name") || undefined}');
    expect(read("app/nextgen/layout.tsx")).toContain("uxFix={parentUxFix}");
    expect(newKidErrorSummary(validateNewKid({ name: "", birthDate: "", declarationRequired: false, declarationAccepted: false, todayIso: "2026-10-22" }))).toBe(
      "Da completare: nome e data di nascita."
    );
  });

  test("UXF-89 ritest 22/10 sera: la freccia del gruppo torna indietro, niente rimpallo con la lista", () => {
    const ui = read("components/GroupDetailClient.tsx");
    // V2 con il flag: la freccia è un "indietro", non un link che apre la lista come pagina nuova
    expect(ui).toContain("onClick={() => goBackInApp(router, backHref)}");
    expect(ui).toContain('data-testid="group-detail-back"');
    // dopo Esci/Elimina: indietro se c'è una pagina dell'app dietro, altrimenti la lista al posto del gruppo
    expect(ui).toContain("if (canGoBackInApp()) {\n      router.back();\n    } else {\n      router.replace(backHref);");
    // la lista dei gruppi torna indietro nella cronologia: con la freccia sopra non si rientra nel gruppo
    expect(read("components/GroupsClient.tsx")).toContain("onClick={() => goBackInApp(router, resolvedBackHref)}");
    const actions = read("app/actions/groups.ts");
    expect(actions.match(/revalidatePath\("\/nextgen", "layout"\);/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  test("UXF-90 piano condiviso: anche gli impegni del Planner (scuola e RITMICA), niente note, chi porta sugli impegni", () => {
    const school = {
      id: "s1", title: 'Scuola Primaria "San Giusto"', startDate: "2026-09-14", endDate: "2027-06-08", allDay: false,
      startTime: "08:30:00", endTime: "16:30:00", location: "Via San Giusto, Milano",
      recurrence: { freq: "weekly" as const, weekdays: [1, 2, 3, 4, 5], interval: 1 as const, anchor: "2026-09-14" },
      isSchool: true, kids: [{ id: "k1", name: "Noemi" }],
    };
    const ritmica = {
      id: "r1", title: "RITMICA", startDate: "2026-09-14", endDate: "2027-06-08", allDay: false,
      startTime: "17:00:00", endTime: "19:00:00", location: "Via F.R. Lamennais, 20153 Milano",
      recurrence: { freq: "weekly" as const, weekdays: [5], interval: 1 as const, anchor: "2026-09-14" },
      isSchool: false, kids: [{ id: "k1", name: "Noemi" }],
    };
    const resp = [
      { kidId: "k1", weekStartDate: "2026-10-19", weekday: "ven" as const, moment: "andata" as const, responsible: "io" as const, responsibleLabel: null },
      { kidId: "k1", weekStartDate: "2026-10-19", weekday: "ven" as const, moment: "ritorno" as const, responsible: "io" as const, responsibleLabel: null },
    ];
    const out = buildSharedExternalEntries([ritmica, school], "2026-10-19", "2026-10-25", resp, "padre");
    expect(out.map((e) => e.activityName)).toEqual(['Scuola Primaria "San Giusto"', "RITMICA"]);
    expect(out[0]).toMatchObject({ days: "da lun 19 a ven 23", hours: "08:30–16:30", weekStartDate: "2026-10-19", weekEndDate: "2026-10-25", status: SHARED_PLANNER_STATUS, responsibilities: [] });
    expect(out[1]).toMatchObject({ days: "ven 23", hours: "17:00–19:00", address: "Via F.R. Lamennais, 20153 Milano" });
    expect(out[1].responsibilities).toEqual([{ weekday: "ven", andata: { label: "Papà", emoji: "👨" }, ritorno: { label: "Papà", emoji: "👨" } }]);
    // fuori periodo / senza figli: niente
    expect(buildSharedExternalEntries([{ ...ritmica, kids: [] }], "2026-10-19", "2026-10-25")).toEqual([]);
    expect(buildSharedExternalEntries([ritmica], "2026-10-19", "2026-10-22")).toEqual([]);
    expect(sharedDaysLabel(["2026-10-19", "2026-10-21"])).toBe("lun 19 e mer 21");
    const data = read("lib/data/plan-shares.ts");
    expect(data).toContain("(await plannerShareEnabled(share.parent_id))");
    // mai note, link esterni o organizzatore nella pagina pubblica
    const select = data.slice(data.indexOf('.from("external_planner_items")'), data.indexOf('.eq("parent_id", ownerId)'));
    expect(select).not.toMatch(/notes|external_url|organizer_snapshot/);
    expect(read("app/share/planner/[token]/page.tsx")).toContain("item.status !== SHARED_PLANNER_STATUS");
  });

  test("UXF-91 esporta calendario: impegni del Planner con orario, ripetizione e chiusure della scuola", () => {
    const items = [
      {
        id: "s1", title: 'Scuola Primaria "San Giusto"', startDate: "2026-09-14", endDate: "2027-06-08", allDay: false,
        startTime: "08:30", endTime: "16:30", location: "Via San Giusto, Milano", kidIds: ["k1"],
        recurrence: { weekdays: [1, 2, 3, 4, 5], interval: 1 as const, anchor: "2026-09-14" }, isSchool: true,
      },
      {
        id: "r1", title: "RITMICA", startDate: "2026-09-14", endDate: "2027-06-08", allDay: false,
        startTime: "17:00", endTime: "19:00", location: "Via F.R. Lamennais, 20153 Milano", kidIds: ["k1"],
        recurrence: { weekdays: [5], interval: 1 as const, anchor: "2026-09-14" }, isSchool: false,
      },
    ];
    const cal = externalItemsToCalendarItems(items, { k1: "Noemi" }, ["2026-12-07", "2026-12-08", "2027-07-01"]);
    expect(cal.map((c) => c.title)).toEqual(['Scuola Primaria "San Giusto" · Noemi', "RITMICA"]);
    // la prima volta che c'è davvero: venerdì 18 settembre per RITMICA
    expect(cal[1].startDate).toBe("2026-09-18");
    expect(firstOccurrence({ startDate: "2026-09-14", endDate: "2026-09-16", recurrence: { weekdays: [5], interval: 1, anchor: "2026-09-14" } })).toBeNull();
    expect(cal[0].exceptDates).toEqual(["2026-12-07", "2026-12-08"]);
    expect(cal[1].exceptDates).toEqual([]);
    const ics = buildPlannerCalendarIcs(cal);
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("DTSTART;TZID=Europe/Rome:20260918T170000");
    expect(ics).toContain("DTEND;TZID=Europe/Rome:20260918T190000");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;UNTIL=20270608T225959Z");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR;UNTIL=20270608T225959Z");
    expect(ics).toContain("EXDATE;TZID=Europe/Rome:20261207T083000,20261208T083000");
    expect(ics).toContain("LOCATION:Via F.R. Lamennais\\, 20153 Milano");
    // le prenotazioni TRAMA restano eventi di giornata intera, come prima
    const booking = buildPlannerCalendarIcs([{ id: "b1", title: "Camp", kidNames: ["Noemi"], startDate: "2027-06-14", endDate: "2027-06-18", centerName: "Lido", centerAddress: null, centerCity: null, note: null }]);
    expect(booking).toContain("DTSTART;VALUE=DATE:20270614");
    expect(booking).not.toContain("VTIMEZONE");
    expect(read("app/nextgen/planner/planner-v2-data.ts")).toContain("if (exportEnabled && uxFixEnabled && externalItems.length > 0) {");
  });

  test("UXF-92 tour Spotlight del genitore spento con le correzioni UX", () => {
    const layout = read("app/nextgen/layout.tsx");
    expect(layout).toContain("if (!parentUxFix && (!welcome || welcome.currentStepKey === null)) {");
    expect(layout).toContain("} else if (enabled && !parentUxFix) {");
    expect(read("app/nextgen/profile/impostazioni/preferenze/page.tsx")).toContain('(await parentUxFixEnabled()) ? null : getTutorialDefinition("discover_book_parent")');
  });
});
