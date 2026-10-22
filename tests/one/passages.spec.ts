import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import {
  applyAllTargets,
  otherDatesOfPassage,
  dayLegs,
  dayMirrorFor,
  groupTrips,
  legKey,
  legLabel,
  missingPassages,
  resolveLegs,
  tripTitle,
  type PassageResponsibility,
} from "../../lib/nextgen/passages";
import { buildKidPassageChains } from "../../lib/nextgen/planner-day";
import type { AgendaEntry } from "../../lib/nextgen/today-agenda";

// TRAMA — CHI ACCOMPAGNA PER PASSAGGIO (22/10/2026, Fase B, release
// "chi-accompagna-per-passaggio"). Caso reale: il venerdì di Noemi (scuola
// 8:30–16:30, RITMICA 17–19 alla Lamennais). Logica pura: nessun browser.
// Comando: npx playwright test tests/one/passages.spec.ts

const ROOT = path.join(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

const NOEMI = { id: "k-noemi", name: "Noemi" };
const BIANCA = { id: "k-bianca", name: "Bianca" };
const SCHOOL_ID = "external:11111111-1111-1111-1111-111111111111";
const RITMICA_ID = "external:22222222-2222-2222-2222-222222222222";

const school = (kid = NOEMI, start = "08:30", end = "16:30"): AgendaEntry => ({
  id: kid === NOEMI ? SCHOOL_ID : "external:33333333-3333-3333-3333-333333333333",
  school: true,
  startTime: start,
  endTime: end,
  title: 'Scuola Primaria "San Giusto"',
  place: null,
  kids: [kid],
  source: "manuale",
  status: null,
});
const ritmica = (start = "17:00", end = "19:00"): AgendaEntry => ({
  id: RITMICA_ID,
  startTime: start,
  endTime: end,
  title: "RITMICA",
  place: "Via F.R. Lamennais, 20153 Milano",
  kids: [NOEMI],
  source: "manuale",
  status: null,
});
const row = (passageKey: string, moment: "andata" | "ritorno", responsible: PassageResponsibility["responsible"], responsibleLabel: string | null = null): PassageResponsibility => ({
  kidId: NOEMI.id,
  date: "2026-10-23",
  passageKey,
  moment,
  responsible,
  responsibleLabel,
});
const LABELS: Record<string, string> = { io: "Io", partner: "Mamma", nonno: "Nonno" };
const labelFor = (r: PassageResponsibility) => (r.responsible === "altro" ? r.responsibleLabel ?? "Altro" : LABELS[r.responsible]);

test.describe("Chi accompagna per passaggio — modello [no browser]", () => {
  test("PB-01 venerdì di Noemi: quattro passaggi in ordine (entra, esce, porta a RITMICA, ritiro)", () => {
    const legs = dayLegs([ritmica(), school()], NOEMI.id);
    expect(legs.map((l) => `${l.time} ${legLabel(l)}`)).toEqual([
      "08:30 Entra a scuola",
      "16:30 Esce da scuola",
      "17:00 Porta a RITMICA",
      "19:00 Ritiro da RITMICA",
    ]);
    expect(legs.map((l) => l.key)).toEqual([legKey("school", "andata"), legKey("school", "ritorno"), legKey(RITMICA_ID, "andata"), legKey(RITMICA_ID, "ritorno")]);
  });

  test("PB-02 solo scuola: nessun passaggio (come prima, niente 'da decidere' ogni giorno)", () => {
    expect(dayLegs([school()], NOEMI.id)).toEqual([]);
    expect(dayLegs([ritmica()], BIANCA.id)).toEqual([]);
  });

  test("PB-03 scelta del giorno di prima: vale per la prima andata e l'ultimo ritorno, in mezzo da decidere", () => {
    const legs = dayLegs([school(), ritmica()], NOEMI.id);
    const r = resolveLegs({ legs, kidId: NOEMI.id, date: "2026-10-23", rows: [], labelFor, dayChoice: { andata: "Io", ritorno: "Io" } });
    expect(r.map((l) => [l.label, l.source])).toEqual([
      ["Io", "day"],
      [null, null],
      [null, null],
      ["Io", "day"],
    ]);
  });

  test("PB-04 la scelta per passaggio vince sulla scelta del giorno", () => {
    const legs = dayLegs([school(), ritmica()], NOEMI.id);
    const r = resolveLegs({
      legs,
      kidId: NOEMI.id,
      date: "2026-10-23",
      rows: [row("school", "andata", "partner"), row("school", "ritorno", "nonno"), row(RITMICA_ID, "andata", "nonno")],
      labelFor,
      dayChoice: { andata: "Io", ritorno: "Io" },
    });
    expect(r.map((l) => l.label)).toEqual(["Mamma", "Nonno", "Nonno", "Io"]);
    expect(r[0].source).toBe("passage");
    // altra data o altro figlio: la riga non vale
    const other = resolveLegs({ legs, kidId: NOEMI.id, date: "2026-10-30", rows: [row("school", "andata", "partner")], labelFor });
    expect(other[0].label).toBeNull();
  });

  test("PB-05 uscita 16:30 e RITMICA 17:00: un viaggio dichiarato; persone diverse → diviso", () => {
    const legs = dayLegs([school(), ritmica()], NOEMI.id);
    const same = groupTrips(resolveLegs({ legs, kidId: NOEMI.id, date: "2026-10-23", rows: [row("school", "ritorno", "nonno"), row(RITMICA_ID, "andata", "nonno")], labelFor }));
    expect(same.map((s) => s.kind)).toEqual(["leg", "trip", "leg"]);
    const trip = same[1];
    expect(trip.kind === "trip" && trip.split).toBe(false);
    if (trip.kind === "trip") expect(tripTitle(trip.from, trip.to)).toBe("Da scuola a RITMICA");
    const diff = groupTrips(resolveLegs({ legs, kidId: NOEMI.id, date: "2026-10-23", rows: [row("school", "ritorno", "nonno"), row(RITMICA_ID, "andata", "io")], labelFor }));
    expect(diff[1].kind === "trip" && diff[1].split).toBe(true);
    // da decidere: viaggio intero = 1; diviso = i pezzi mancanti
    expect(missingPassages(groupTrips(resolveLegs({ legs, kidId: NOEMI.id, date: "2026-10-23", rows: [], labelFor })))).toBe(4 - 1);
  });

  test("PB-06 niente viaggio se l'attività inizia più di un'ora dopo l'uscita, o prima", () => {
    const far = groupTrips(resolveLegs({ legs: dayLegs([school(), ritmica("18:00", "20:00")], NOEMI.id), kidId: NOEMI.id, date: "2026-10-23", rows: [], labelFor }));
    expect(far.map((s) => s.kind)).toEqual(["leg", "leg", "leg", "leg"]);
    const edge = groupTrips(resolveLegs({ legs: dayLegs([school(), ritmica("17:30", "19:00")], NOEMI.id), kidId: NOEMI.id, date: "2026-10-23", rows: [], labelFor }));
    expect(edge.map((s) => s.kind)).toEqual(["leg", "trip", "leg"]);
    // stesso orario: esce alle 16:30, entra alle 16:30 → viaggio
    const zero = groupTrips(resolveLegs({ legs: dayLegs([school(), ritmica("16:30", "18:00")], NOEMI.id), kidId: NOEMI.id, date: "2026-10-23", rows: [], labelFor }));
    expect(zero.map((s) => s.kind)).toEqual(["leg", "trip", "leg"]);
  });

  test("PB-07 sabato: passaggi anche senza scelta del giorno (week_responsibilities conosce solo lun–ven)", () => {
    const legs = dayLegs([ritmica("09:30", "13:30")], NOEMI.id);
    expect(legs).toHaveLength(2);
    const r = resolveLegs({ legs, kidId: NOEMI.id, date: "2026-10-24", rows: [{ ...row(RITMICA_ID, "andata", "io"), date: "2026-10-24" }], labelFor });
    expect(r.map((l) => l.label)).toEqual(["Io", null]);
  });

  test("PB-08 scelta del giorno scritta anche come prima andata / ultimo ritorno (Home e promemoria la leggono ancora)", () => {
    const legs = dayLegs([school(), ritmica()], NOEMI.id);
    expect(dayMirrorFor(legs, legKey("school", "andata"))).toBe("andata");
    expect(dayMirrorFor(legs, legKey(RITMICA_ID, "ritorno"))).toBe("ritorno");
    expect(dayMirrorFor(legs, legKey("school", "ritorno"))).toBeNull();
    expect(dayMirrorFor(legs, legKey(RITMICA_ID, "andata"))).toBeNull();
  });

  test("PB-09 catena della giornata: tre righe e tre scelte (entra · un viaggio · ritiro)", () => {
    const day = {
      dateIso: "2026-10-23",
      entries: [school(), ritmica()],
      coordination: { mode: "detailed" as const, kids: [{ kidId: NOEMI.id, kidName: "Noemi", andata: "Io", ritorno: "Io" }], missingCount: 0, people: ["Io"] },
    };
    const [chain] = buildKidPassageChains(day, [NOEMI], { rows: [], labelFor });
    expect(chain.steps.map((s) => `${s.time} ${s.title}`)).toEqual(["08:30 Entra a scuola", "16:30 Da scuola a RITMICA", "19:00 Ritiro da RITMICA"]);
    expect(chain.steps.map((s) => s.chips?.map((c) => `${c.text}:${c.label ?? "?"}`).join("+"))).toEqual(["Andata:Io", "Un viaggio:?", "Ritorno:Io"]);
    expect(chain.steps[1].detail).toBe("→ 17:00 RITMICA, fino alle 19:00 · Via F.R. Lamennais, 20153 Milano");
    expect(chain.missing).toBe(1);
    // persone diverse: il viaggio mostra due scelte
    const [split] = buildKidPassageChains(day, [NOEMI], { rows: [row("school", "ritorno", "nonno"), row(RITMICA_ID, "andata", "io")], labelFor });
    expect(split.steps[1].chips?.map((c) => `${c.text}:${c.label}`)).toEqual(["Ritiro da scuola:Nonno", "Porta a RITMICA:Io"]);
    expect(split.missing).toBe(0);
    // solo scuola: catena compatta di prima, senza scelte
    const [only] = buildKidPassageChains({ ...day, entries: [school()] }, [NOEMI], { rows: [], labelFor });
    expect(only.onlySchool).toBe(true);
    expect(only.steps.every((s) => !s.chips && !s.passage)).toBe(true);
  });

  test("PB-10 migration 51: additiva, nuova tabella con RLS per genitore, preparata e non applicata", () => {
    const sql = read("supabase/migration_51_chi_accompagna_per_passaggio.sql");
    expect(sql).toContain("-- STATO: PREPARATA, NON APPLICATA");
    expect(sql).toContain("create table if not exists public.passage_responsibilities");
    expect(sql).toContain("unique (parent_id, kid_id, date, passage_key, moment)");
    expect(sql).toContain("using (parent_id = auth.uid())");
    expect(sql).toContain("with check (parent_id = auth.uid())");
    expect(sql).not.toMatch(/alter table public\.week_responsibilities|\bdrop table\b(?!.*if exists public\.passage_responsibilities)/i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
  });

  // Agenda finta: scuola lun–ven, RITMICA il venerdì 17–19 e il sabato 9:30–13:30 (altro impegno).
  const agendaFor = (iso: string): AgendaEntry[] => {
    const wd = new Date(iso + "T00:00:00Z").getUTCDay();
    const out: AgendaEntry[] = [];
    if (wd >= 1 && wd <= 5 && iso !== "2026-12-08") out.push(school());
    if (wd === 5) out.push(ritmica());
    return out;
  };

  test("PB-11 'anche gli altri giorni di RITMICA': solo i venerdì, da oggi, mai la scuola", () => {
    const dates = otherDatesOfPassage({
      dateIso: "2026-10-23",
      todayIso: "2026-10-22",
      kidId: NOEMI.id,
      passageKey: RITMICA_ID,
      range: { startDate: "2026-09-14", endDate: "2026-11-20" },
      agendaFor,
    });
    expect(dates).toEqual(["2026-10-30", "2026-11-06", "2026-11-13", "2026-11-20"]);
    expect(otherDatesOfPassage({ dateIso: "2026-10-23", todayIso: "2026-10-22", kidId: NOEMI.id, passageKey: "school", range: { startDate: "2026-09-14", endDate: "2027-06-08" }, agendaFor })).toEqual([]);
  });

  test("PB-12 negli altri venerdì si ripete il viaggio intero (uscita da scuola + porta a RITMICA), con la scelta del giorno solo dove serve", () => {
    const trip = applyAllTargets({ kidId: NOEMI.id, passageKey: RITMICA_ID, moment: "andata", dates: ["2026-10-30"], agendaFor });
    expect(trip.targets.map((t) => `${t.date} ${t.passageKey === "school" ? "school" : "ritmica"} ${t.moment}`)).toEqual([
      "2026-10-30 school ritorno",
      "2026-10-30 ritmica andata",
    ]);
    expect(trip.mirror).toEqual([]);
    const pickup = applyAllTargets({ kidId: NOEMI.id, passageKey: RITMICA_ID, moment: "ritorno", dates: ["2026-10-30", "2026-11-06"], agendaFor });
    expect(pickup.targets).toHaveLength(2);
    expect(pickup.mirror).toEqual([
      { kidId: NOEMI.id, date: "2026-10-30", moment: "ritorno" },
      { kidId: NOEMI.id, date: "2026-11-06", moment: "ritorno" },
    ]);
  });

  test("PB-13 dietro il flag e con 'un giorno alla volta': foglio per passaggio, quello di prima resta senza flag", () => {
    const data = read("app/nextgen/planner/planner-v2-data.ts");
    expect(data).toContain("flagOn(PASSAGE_RESPONSIBILITIES_FLAG, userId, role)");
    expect(data).toContain("const passagesEnabled = passageFlag && dayViewEnabled;");
    const client = read("app/nextgen/planner/PlannerV2Client.tsx");
    expect(client).toContain('"assign" in panel && passages && (');
    expect(client).toContain('"assign" in panel && !passages && (');
    expect(client).toContain("<AssignSheet");
    expect(read("components/nextgen/PlannerDayFocus.tsx")).toContain("passages ? buildKidPassageChains(day, kids, passages) : buildKidDayChains(day, kids)");
    const body = read("components/nextgen/PassageAssignBody.tsx");
    expect(body).toContain("Due persone diverse?");
    expect(body).toContain("· un viaggio");
    // il campo "Altro…" non perde il focus: niente componenti definiti dentro il render
    expect(body).not.toMatch(/<Choices|<Row[ >]/);
    const actions = read("app/actions/responsibilities.ts");
    expect(actions).toContain('{ onConflict: "parent_id,kid_id,date,passage_key,moment" }');
    expect(actions).toContain("if (!wd) return null; // sabato/domenica: la scelta del giorno non esiste");
  });
});
