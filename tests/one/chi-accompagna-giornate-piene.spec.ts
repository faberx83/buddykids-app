// TRAMA — CHI ACCOMPAGNA NELLE GIORNATE PIENE (28/10/2026, release
// "chi-accompagna-giornate-piene"). Fabrizio: "in una giornata con più
// impegni è un casino, troppi click"; mock approvato il 28/10. Caso del mock:
// mercoledì con scuola per Lino e Sara, Calcio (Lino) e Inglese (Sara).
// Logica pura + controlli sul sorgente: nessun browser.
// Comando: npx playwright test tests/one/chi-accompagna-giornate-piene.spec.ts
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  PASSAGE_PERSON_FIRST_FLAG,
  buildBusyItems,
  buildKidDays,
  kidItemTitle,
  personSentence,
  personView,
  siblingTwins,
  topPeople,
  usualPersonFor,
  weekSameAsLast,
  whoQuestion,
  dayRowFor,
  groupByPerson,
  itemIsPerson,
  namesIt,
  otherWeekdaysIt,
  pendingTargets,
  sameWeekdayDates,
  sameWeekdaySuggestion,
  sameWeekdayTitle,
  suggestionWrites,
  targetsOf,
} from "../../lib/nextgen/passage-busy-day";
import type { PassageResponsibility } from "../../lib/nextgen/passages";
import type { AgendaEntry } from "../../lib/nextgen/today-agenda";
import { RESPONSIBLE_OPTIONS, type ResponsibleOption } from "../../lib/nextgen/responsibility-options";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { getReleaseById } from "../../lib/releases/catalog";

const ROOT = path.join(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

const LINO = { id: "k-lino", name: "Lino" };
const SARA = { id: "k-sara", name: "Sara" };
const KIDS = [LINO, SARA];
const WED = "2026-10-28"; // mercoledì
const CALCIO = "booking:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const INGLESE = "external:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const entries: AgendaEntry[] = [
  {
    id: "external:cccccccc-cccc-cccc-cccc-cccccccccccc",
    school: true,
    startTime: "08:10",
    endTime: "16:30",
    title: "Scuola Collodi",
    place: null,
    kids: [LINO, SARA],
    source: "manuale",
    status: null,
  } as AgendaEntry,
  { id: CALCIO, startTime: "17:00", endTime: "18:30", title: "Calcio", place: "Campo Forza e Coraggio", kids: [LINO], source: "trama", status: null } as AgendaEntry,
  { id: INGLESE, startTime: "17:15", endTime: "18:15", title: "Inglese", place: null, kids: [SARA], source: "manuale", status: null } as AgendaEntry,
];

const LABELS: Record<string, string> = { io: "Mamma", partner: "Papà", nonna: "Nonna Rita" };
const labelFor = (r: PassageResponsibility) => (r.responsible === "altro" ? (r.responsibleLabel ?? "Altro") : LABELS[r.responsible]);
const row = (kidId: string, date: string, passageKey: string, moment: "andata" | "ritorno", responsible: PassageResponsibility["responsible"]): PassageResponsibility => ({
  kidId,
  date,
  passageKey,
  moment,
  responsible,
  responsibleLabel: null,
  familyPersonId: null,
});
const MAMMA: ResponsibleOption = { value: "io", emoji: "", label: "Mamma" };
const NONNA: ResponsibleOption = { value: "nonna", emoji: "", label: "Nonna Rita" };

const today = (rows: PassageResponsibility[] = [], extra: Partial<Parameters<typeof buildBusyItems>[0]> = {}) =>
  buildBusyItems({ kids: KIDS, entries, date: WED, rows, labelFor, ...extra });

test.describe("Chi accompagna, giornate piene: righe del foglio", () => {
  test("GP-01 cinque righe in ordine: l'entrata dei due fratelli è una sola, i viaggi sono interi", () => {
    const items = today();
    expect(items.map((i) => [i.time, i.title, i.kidsLabel])).toEqual([
      ["08:10", "Entrano a scuola", "Lino e Sara"],
      ["16:30", "Da scuola a Calcio", "Lino"],
      ["16:30", "Da scuola a Inglese", "Sara"],
      ["18:15", "Ritiro da Inglese", "Sara"],
      ["18:30", "Ritiro da Calcio", "Lino"],
    ]);
    expect(items[1].sub).toBe("esce alle 16:30, a Calcio alle 17:00 · un viaggio");
    expect(items[0].sub).toBe("Scuola Collodi");
    expect(items.every((i) => i.label === null)).toBe(true);
    // Un tocco sulla riga dell'entrata vale per tutti e due.
    expect(targetsOf(items[0].parts, WED).targets.map((t) => t.kidId)).toEqual([LINO.id, SARA.id]);
    // Il viaggio scrive uscita da scuola e andata a Calcio.
    expect(targetsOf(items[1].parts, WED).targets.map((t) => `${t.passageKey}|${t.moment}`)).toEqual(["school|ritorno", `${CALCIO}|andata`]);
  });

  test("GP-02 fratelli con persone diverse (o separati) tornano su due righe", () => {
    const diverse = today([row(LINO.id, WED, "school", "andata", "io"), row(SARA.id, WED, "school", "andata", "partner")]);
    expect(diverse.filter((i) => i.title === "Entra a scuola").map((i) => [i.kidsLabel, i.label])).toEqual([
      ["Lino", "Mamma"],
      ["Sara", "Papà"],
    ]);
    const sig = today()[0].signature;
    const separati = today([], { separated: new Set([sig]) });
    expect(separati.filter((i) => i.time === "08:10")).toHaveLength(2);
  });

  test("GP-03 'Due persone diverse?' divide il viaggio in uscita e andata", () => {
    const items = today();
    const tripKey = items[1].parts[0].tripKey!;
    expect(tripKey).toBe(`${LINO.id}|school|ritorno>${CALCIO}|andata`);
    const split = today([], { splitTrips: new Set([tripKey]) });
    // L'entrata resta in comune con Sara; il viaggio di Lino diventa due righe.
    expect(split.filter((i) => i.kidsLabel === "Lino").map((i) => i.title)).toEqual(["Esce da scuola", "Porta a Calcio", "Ritiro da Calcio"]);
  });

  test("GP-04 decisi raccolti per persona; 'tocca per togliere' riconosce la persona scelta", () => {
    const rows = [
      row(LINO.id, WED, "school", "andata", "io"),
      row(SARA.id, WED, "school", "andata", "io"),
      row(LINO.id, WED, "school", "ritorno", "nonna"),
      row(LINO.id, WED, CALCIO, "andata", "nonna"),
      row(SARA.id, WED, "school", "ritorno", "nonna"),
      row(SARA.id, WED, INGLESE, "andata", "nonna"),
    ];
    const items = today(rows);
    expect(items.filter((i) => i.label === null).map((i) => i.title)).toEqual(["Ritiro da Inglese", "Ritiro da Calcio"]);
    expect(groupByPerson(items).map((g) => [g.label, g.items.length])).toEqual([
      ["Mamma", 1],
      ["Nonna Rita", 2],
    ]);
    expect(itemIsPerson(items[1], { opt: NONNA })).toBe(true);
    expect(itemIsPerson(items[1], { opt: MAMMA })).toBe(false);
  });
});

test.describe("Chi accompagna, giornate piene: 'Come mercoledì scorso'", () => {
  const LAST = "2026-10-21";
  const lastWeek = [
    row(LINO.id, LAST, "school", "ritorno", "nonna"),
    row(LINO.id, LAST, CALCIO, "andata", "nonna"),
    row(SARA.id, LAST, "school", "ritorno", "nonna"),
    row(SARA.id, LAST, INGLESE, "andata", "nonna"),
    row(SARA.id, LAST, INGLESE, "ritorno", "partner"),
    row(LINO.id, LAST, CALCIO, "ritorno", "partner"),
  ];

  test("GP-10 copia solo i passaggi uguali e ancora da decidere; conta le righe", () => {
    const rows = [row(LINO.id, WED, "school", "andata", "io"), row(SARA.id, WED, "school", "andata", "io"), ...lastWeek];
    const s = sameWeekdaySuggestion({ date: WED, items: today(rows), rows, labelFor })!;
    expect(s.title).toBe("Come mercoledì scorso");
    expect(s.fromDate).toBe(LAST);
    expect(s.count).toBe(4);
    expect(s.summary).toBe("Nonna Rita 2 passaggi, Papà 2");
    const writes = suggestionWrites(s, WED);
    expect(writes.map((w) => [w.row.responsible, w.targets.length])).toEqual([
      ["nonna", 4],
      ["partner", 2],
    ]);
    // Scritti per OGGI, non per la settimana scorsa; la scelta del giorno segue l'ultimo ritorno.
    expect(writes.every((w) => w.targets.every((t) => t.date === WED))).toBe(true);
    expect(writes[1].mirror.map((m) => [m.kidId, m.moment])).toEqual([
      [SARA.id, "ritorno"],
      [LINO.id, "ritorno"],
    ]);
  });

  test("GP-11 niente in comune la settimana scorsa: si guarda fino a 4 settimane indietro, poi nulla", () => {
    const old = [row(LINO.id, "2026-10-07", CALCIO, "ritorno", "partner")];
    const s = sameWeekdaySuggestion({ date: WED, items: today(old), rows: old, labelFor })!;
    expect(s.weeksBack).toBe(3);
    expect(s.title).toBe("Come mercoledì 7 ottobre");
    expect(s.count).toBe(1);
    const tooOld = [row(LINO.id, "2026-09-23", CALCIO, "ritorno", "partner")];
    expect(sameWeekdaySuggestion({ date: WED, items: today(tooOld), rows: tooOld, labelFor })).toBeNull();
    // Altro giorno della settimana: non conta.
    const tuesday = [row(LINO.id, "2026-10-20", CALCIO, "ritorno", "partner")];
    expect(sameWeekdaySuggestion({ date: WED, items: today(tuesday), rows: tuesday, labelFor })).toBeNull();
  });

  test("GP-12 tutto già deciso: nessuna card", () => {
    const rows = lastWeek.map((r) => ({ ...r, date: WED }));
    rows.push(row(LINO.id, WED, "school", "andata", "io"), row(SARA.id, WED, "school", "andata", "io"));
    expect(sameWeekdaySuggestion({ date: WED, items: today(rows), rows, labelFor })).toBeNull();
  });
});

test.describe("Chi accompagna, giornate piene: 'Anche gli altri mercoledì?'", () => {
  test("GP-20 solo lo stesso giorno della settimana; salta quelli già uguali", () => {
    expect(sameWeekdayDates(["2026-10-28", "2026-10-29", "2026-11-04", "2026-11-11", "2026-11-12"], WED)).toEqual(["2026-11-04", "2026-11-11"]);
    const targets = [
      { kidId: LINO.id, date: "2026-11-04", passageKey: CALCIO, moment: "ritorno" as const },
      { kidId: LINO.id, date: "2026-11-11", passageKey: CALCIO, moment: "ritorno" as const },
    ];
    const rows = [row(LINO.id, "2026-11-04", CALCIO, "ritorno", "partner"), row(LINO.id, "2026-11-11", CALCIO, "ritorno", "io")];
    expect(pendingTargets(targets, rows, { responsible: "partner", familyPersonId: null, responsibleLabel: null }).map((t) => t.date)).toEqual([
      "2026-11-11",
    ]);
  });

  test("GP-21 testi italiani", () => {
    expect(otherWeekdaysIt(WED)).toBe("gli altri mercoledì");
    expect(otherWeekdaysIt("2026-10-31")).toBe("gli altri sabati");
    expect(otherWeekdaysIt("2026-11-01")).toBe("le altre domeniche");
    expect(sameWeekdayTitle("2026-11-01", 1)).toBe("Come domenica scorsa");
    expect(namesIt(["Lino", "Sara", "Bea"])).toBe("Lino, Sara e Bea");
    expect(dayRowFor(WED)).toEqual({ weekStartDate: "2026-10-26", weekday: "mer" });
    expect(dayRowFor("2026-10-31")).toBeNull();
  });
});

test.describe("Chi accompagna, giornate piene: flag e foglio (sorgente)", () => {
  test("GP-30 flag spento di default, card Release, una release sola", () => {
    expect(PASSAGE_PERSON_FIRST_FLAG).toBe("PASSAGE_PERSON_FIRST_ENABLED");
    expect(FEATURE_FLAG_REGISTRY.PASSAGE_PERSON_FIRST_ENABLED.defaultValue).toBe(false);
    const e = FEATURE_CATALOG.find((x) => x.key === "passage_person_first");
    expect(e?.flagName).toBe("PASSAGE_PERSON_FIRST_ENABLED");
    expect(e?.releaseEligible).toBe(true);
    expect(getReleaseById("chi-accompagna-giornate-piene")?.featureKeys).toEqual(["passage_person_first"]);
  });

  test("GP-31 spento = foglio per passaggio di prima; acceso solo dentro 'per passaggio'", () => {
    const data = read("app/nextgen/planner/planner-v2-data.ts");
    expect(data).toContain("const passagePersonFirst = passagesEnabled ? await flagOn(PASSAGE_PERSON_FIRST_FLAG, userId, role) : false;");
    expect(data).toContain("passagePersonFirst ? -PERSON_FIRST_HISTORY_DAYS : -14");
    const client = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(client).toContain("personFirst={passagePersonFirst}");
    expect(client).toContain("if (personFirst) {");
    expect(client).toContain("<PassageAssignBody");
  });

  // v2 (28/10 pomeriggio, Fabrizio: "il focus è sull'accompagnatore o sul
  // bambino? … difficile capire 'mamma' di chi deve occuparsi"): via la
  // scelta "prima chi"; ogni passaggio apre la sua domanda. Le garanzie su
  // "Fatto", salvataggio e avviso restano quelle di prima.
  test("GP-32 foglio v2: per bambino, 'Chi?' apre la domanda, una domanda sola a 'Fatto'", () => {
    const body = read("components/nextgen/PassageBusyDayBody.tsx");
    expect(body).toContain('const [view, setView] = useState<"kid" | "person">("kid");');
    expect(body).toContain("onClick={() => openAsk(item)}");
    expect(body).toContain("{whoQuestion(item)}");
    expect(body).toContain("usualPersonFor({ item, date, rows, options })");
    expect(body).toContain("void assign(withTwins ? [item, ...twins] : [item], p);");
    // Il foglietto è chiamato, non montato come componente (il campo "Altro…" non perde il focus).
    expect(body).toContain("{asked && whoPicker()}");
    // "Anche gli altri mercoledì?" solo a Fatto, una spunta per figlio e passaggio.
    expect(body).toContain("Anche {otherWeekdaysIt(date)}?");
    expect(body).toContain("sameWeekdayDates(");
    expect(body).toContain("pendingTargets(all.targets, rows,");
    // Stesse azioni di salvataggio e stesso avviso all'altro genitore del foglio di prima.
    expect(body).toContain("setPassageResponsibilitiesAction({");
    expect(body).toContain("clearPassageResponsibilitiesAction({ targets, mirror })");
    expect(body).toContain("notifyPartnerAssignmentsAction(changes)");
  });
});

test.describe("Chi accompagna v2: il bambino al centro", () => {
  const PAPA: ResponsibleOption = { value: "partner", emoji: "", label: "Papà" };
  const OPTIONS: ResponsibleOption[] = [
    { value: "io", emoji: "", label: "Tu" },
    PAPA,
    { value: "altro", emoji: "", label: "Zia Carla", familyPersonId: "fp-carla" },
    { value: "nonno", emoji: "", label: "Nonno" },
    NONNA,
    { value: "tata", emoji: "", label: "Tata" },
    { value: "altro", emoji: "", label: "Altro" },
  ];
  const days = (rows: PassageResponsibility[] = []) => buildKidDays({ kids: KIDS, entries, date: WED, rows, labelFor });

  test("GP-40 una scheda per figlio, nessuna riga in comune; titoli dal punto di vista del bambino", () => {
    const d = days();
    expect(d.map((k) => k.kid.name)).toEqual(["Lino", "Sara"]);
    expect(d[0].items.map((i) => [i.time, kidItemTitle(i)])).toEqual([
      ["08:10", "Entra a scuola"],
      ["16:30", "Da scuola a Calcio"],
      ["18:30", "Esce da Calcio"],
    ]);
    // Split del viaggio: "Va a Calcio".
    const tripKey = d[0].items[1].parts[0].tripKey!;
    const split = buildKidDays({ kids: KIDS, entries, date: WED, rows: [], labelFor, splitTrips: new Set([tripKey]) });
    expect(split[0].items.map(kidItemTitle)).toEqual(["Entra a scuola", "Esce da scuola", "Va a Calcio", "Esce da Calcio"]);
    // Il fratello con lo stesso passaggio alla stessa ora: "Anche Sara".
    expect(siblingTwins(d[0].items[0], d).map((i) => i.kidsLabel)).toEqual(["Sara"]);
    expect(siblingTwins(d[0].items[2], d)).toEqual([]);
  });

  test("GP-41 la domanda è scritta per intero; le frasi per persona dicono di chi si occupa", () => {
    const [lino, sara] = days();
    expect(whoQuestion(lino.items[0])).toBe("Chi porta Lino a scuola?");
    expect(whoQuestion(lino.items[1])).toBe("Chi accompagna Lino da scuola a Calcio?");
    expect(whoQuestion(sara.items[2])).toBe("Chi riprende Sara da Inglese?");
    expect(personSentence(lino.items[0], true)).toBe("porti Lino a scuola");
    expect(personSentence(sara.items[2], false)).toBe("riprende Sara da Inglese");
    const split = buildKidDays({ kids: [LINO], entries, date: WED, rows: [], labelFor, splitTrips: new Set([lino.items[1].parts[0].tripKey!]) });
    expect(whoQuestion(split[0].items[1])).toBe("Chi prende Lino all'uscita da scuola?");
    expect(personSentence(split[0].items[1], false)).toBe("prende Lino a scuola");
  });

  test("GP-42 'Di solito': lo stesso giorno della settimana prima, poi il più frequente", () => {
    const item = days()[0].items[2]; // Lino, ritiro da Calcio
    const rows = [
      row(LINO.id, "2026-10-26", CALCIO, "ritorno", "nonna"),
      row(LINO.id, "2026-10-19", CALCIO, "ritorno", "nonna"),
      row(LINO.id, "2026-10-14", CALCIO, "ritorno", "partner"),
    ];
    expect(usualPersonFor({ item, date: WED, rows, options: OPTIONS })?.opt.label).toBe("Papà");
    expect(usualPersonFor({ item, date: WED, rows: rows.slice(0, 2), options: OPTIONS })?.opt.label).toBe("Nonna Rita");
    expect(usualPersonFor({ item, date: WED, rows: [], options: OPTIONS })).toBeNull();
    // Le scelte di oggi o del futuro non contano.
    expect(usualPersonFor({ item, date: WED, rows: [row(LINO.id, "2026-11-04", CALCIO, "ritorno", "io")], options: OPTIONS })).toBeNull();
  });

  test("GP-43 le 3 persone più usate, poi l'ordine delle opzioni; 'Altro' generico mai fra i primi", () => {
    const rows = [
      { ...row(LINO.id, "2026-10-21", CALCIO, "ritorno", "altro"), familyPersonId: "fp-carla", responsibleLabel: "Zia Carla" },
      { ...row(SARA.id, "2026-10-21", CALCIO, "ritorno", "altro"), familyPersonId: "fp-carla", responsibleLabel: "Zia Carla" },
      row(LINO.id, "2026-10-21", "school", "andata", "nonna"),
    ];
    const top = topPeople({ rows, options: OPTIONS, exclude: ["partner||"], n: 3 });
    expect(top.map((p) => p.opt.label)).toEqual(["Zia Carla", "Nonna Rita", "Tu"]);
  });

  test("GP-44 'Per persona': Tu per primo, poi in ordine di orario; i da decidere a parte", () => {
    const rows = [
      row(LINO.id, WED, "school", "andata", "partner"),
      row(SARA.id, WED, "school", "andata", "io"),
      row(LINO.id, WED, CALCIO, "ritorno", "io"),
    ];
    const labelsTu = (r: PassageResponsibility) => (r.responsible === "io" ? "Tu" : labelFor(r));
    const v = personView(buildKidDays({ kids: KIDS, entries, date: WED, rows, labelFor: labelsTu }), "Tu");
    expect(v.groups.map((g) => [g.label, g.you, g.items.length])).toEqual([
      ["Tu", true, 2],
      ["Papà", false, 1],
    ]);
    expect(v.open).toHaveLength(3);
  });

  test("GP-45 'Io' diventa 'Tu' (opzioni e scelte salvate)", () => {
    expect(RESPONSIBLE_OPTIONS.find((o) => o.value === "io")?.label).toBe("Tu");
  });
});

// 28/10/2026 sera (Fabrizio sul foglio "Chi fa cosa" della settimana: "penso sia
// ancora vecchio… nei gruppi ancora icona vecchia… mettiamo foto?").
test.describe("Chi fa cosa della settimana e foto dei figli", () => {
  test("GP-50 'Come la settimana scorsa': solo da oggi in poi, solo la settimana prima", () => {
    const LAST = "2026-10-21";
    const rows = [row(LINO.id, LAST, CALCIO, "ritorno", "partner"), row(LINO.id, "2026-10-14", "school", "andata", "io")];
    const items = buildKidDays({ kids: KIDS, entries, date: WED, rows, labelFor }).flatMap((k) => k.items);
    const w = weekSameAsLast({ days: [{ date: WED, items }], todayIso: "2026-10-26", rows, labelFor });
    expect(w.count).toBe(1); // solo il ritiro da Calcio: l'entrata di due settimane fa non conta
    expect(w.perDay.map((d) => d.date)).toEqual([WED]);
    expect(weekSameAsLast({ days: [{ date: WED, items }], todayIso: "2026-10-29", rows, labelFor }).count).toBe(0);
  });

  test("GP-51 col flag il foglio della settimana è PassageWeekBody; spento resta WeekWhoSheet", () => {
    const client = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(client).toContain('{panel === "chi" && passages && passagePersonFirst && (');
    expect(client).toContain('{panel === "chi" && !(passages && passagePersonFirst) && (');
    const body = read("components/nextgen/PassageWeekBody.tsx");
    expect(body).toContain("onClick={() => onOpenDay(w.day.dateIso)}");
    expect(body).toContain("photoUrl={photoOf(kid.id)}");
    expect(body).not.toContain("setWeekBulkResponsibilityAction"); // niente più "Uguale per tutta la settimana"
  });

  test("GP-52 foto dei figli: nel Planner e nei gruppi, solo i propri", () => {
    expect(read("components/nextgen/AgendaItemRow.tsx")).toContain("photoUrl?: string | null;");
    expect(read("app/nextgen/planner/PlannerV2Client.tsx")).toContain("avatarUrl: k.avatarUrl ?? null");
    expect(read("lib/data/group-detail.ts")).toContain("kidPhotoUrl: isOwn ? (myKid?.avatarUrl ?? null) : null,");
    expect(read("components/GroupDetailClient.tsx")).toContain("photoUrl={k.isOwn ? k.kidPhotoUrl : null}");
  });
});
