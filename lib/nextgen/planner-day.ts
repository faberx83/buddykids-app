// TRAMA — PLANNER, UN GIORNO ALLA VOLTA (21/10/2026, release "planner-giorno").
// Fabrizio, dopo la settimana tipo: "sul planner, avendo aggiunto questo
// aspetto, va ripensato il layout?". Scelta la versione A delle anteprime:
// la Settimana mostra un giorno alla volta (striscia dei giorni in alto) e,
// per ogni figlio, la giornata come catena di passaggi — entra a scuola,
// esce, attività, ritiro — con chi accompagna attaccato al passaggio.
//
// Logica pura sopra il modello della settimana (buildWeekModel): niente dati
// nuovi. Il modello attuale (week_responsibilities) ha UN'andata e UN
// ritorno per figlio e giorno: l'andata va sul primo passaggio della
// giornata, il ritorno su un passo "Ritiro" alla fine dell'ultimo impegno.
// La scuola da sola non crea passaggi (Fase B: un passaggio per orario).

import type { AgendaEntry } from "@/lib/nextgen/today-agenda";
import type { Moment } from "@/lib/nextgen/responsibility-options";
import type { WeekDayModel, WeekModel } from "@/lib/nextgen/planner-week";
import { dayLegs, groupTrips, missingPassages, resolveLegs, tripTitle, type PassageResponsibility } from "@/lib/nextgen/passages";

export const PLANNER_DAY_VIEW_FLAG = "PLANNER_DAY_VIEW_ENABLED";

export type DayStepKind = "school_in" | "school_out" | "activity" | "all_day" | "pickup" | "trip";

export interface DayPassage {
  moment: Moment;
  /** Chi se ne occupa; null = da decidere. */
  label: string | null;
}

export interface DayStep {
  key: string;
  kind: DayStepKind;
  /** "HH:MM" o null (tutto il giorno). */
  time: string | null;
  title: string;
  /** Riga sotto: luogo, "fino alle 19:00", stato. */
  detail: string | null;
  passage: DayPassage | null;
  /**
   * 22/10/2026 — release "chi-accompagna-per-passaggio": uno o più passaggi
   * attaccati al passo (un viaggio intero ne ha uno, un viaggio diviso due).
   * Quando c'è, sostituisce `passage`.
   */
  chips?: StepChip[];
}

export interface StepChip {
  /** Chiavi dei passaggi che la scelta copre (lib/nextgen/passages.ts#legKey). */
  legKeys: string[];
  /** "Andata", "Ritorno", "Un viaggio", "Ritiro da scuola", "Porta a RITMICA". */
  text: string;
  label: string | null;
}

export interface KidDayChain {
  kidId: string;
  kidName: string;
  steps: DayStep[];
  /** Passaggi ancora da decidere in questa giornata. */
  missing: number;
  /** Solo la scuola (o niente): la card resta compatta. */
  onlySchool: boolean;
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

/**
 * Giorno aperto all'arrivo: oggi se è nella settimana; altrimenti il primo
 * giorno non passato con qualcosa; altrimenti il primo con qualcosa; altrimenti lunedì.
 */
export function defaultDayIso(week: Pick<WeekModel, "days">, todayIso: string): string {
  const today = week.days.find((d) => d.dateIso === todayIso);
  if (today) return today.dateIso;
  const busy = (d: WeekDayModel) => d.entries.length > 0 || d.coordination.mode !== "none";
  return (
    week.days.find((d) => d.dateIso >= todayIso && busy(d))?.dateIso ??
    week.days.find(busy)?.dateIso ??
    week.days[0]?.dateIso ??
    todayIso
  );
}

function entryDetail(e: AgendaEntry): string | null {
  const parts = [e.place, e.startTime && e.endTime ? `fino alle ${hhmm(e.endTime)}` : null, e.status].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** La giornata di ogni figlio come catena di passaggi, in ordine di orario. */
export function buildKidDayChains(day: Pick<WeekDayModel, "entries" | "coordination">, kids: { id: string; name: string }[]): KidDayChain[] {
  return kids.map((kid) => {
    const mine = day.entries.filter((e) => e.kids.some((k) => k.id === kid.id));
    const school = mine.filter((e) => e.school);
    const others = mine.filter((e) => !e.school);
    const steps: DayStep[] = [];
    for (const s of school) {
      const name = s.title && s.title !== "Scuola" ? s.title : null;
      if (s.startTime) steps.push({ key: `${s.id}:in`, kind: "school_in", time: hhmm(s.startTime), title: "Entra a scuola", detail: name, passage: null });
      if (s.endTime) steps.push({ key: `${s.id}:out`, kind: "school_out", time: hhmm(s.endTime), title: "Esce da scuola", detail: null, passage: null });
    }
    for (const e of others) {
      steps.push(
        e.startTime
          ? { key: e.id, kind: "activity", time: hhmm(e.startTime), title: e.title, detail: entryDetail(e), passage: null }
          : { key: e.id, kind: "all_day", time: null, title: e.title, detail: ["Tutto il giorno", e.place, e.status].filter(Boolean).join(" · "), passage: null }
      );
    }
    // Tutto il giorno prima, poi per orario (a parità: entrata prima di uscita).
    const order: Record<DayStepKind, number> = { all_day: 0, school_in: 1, activity: 2, school_out: 2, trip: 2, pickup: 3 };
    steps.sort((a, b) => {
      if (a.time === null || b.time === null) return a.time === b.time ? order[a.kind] - order[b.kind] : a.time === null ? -1 : 1;
      return a.time === b.time ? order[a.kind] - order[b.kind] : a.time < b.time ? -1 : 1;
    });

    const coord = day.coordination.kids.find((k) => k.kidId === kid.id);
    if (coord && steps.length > 0) {
      if (coord.andata !== undefined) steps[0] = { ...steps[0], passage: { moment: "andata", label: coord.andata ?? null } };
      if (coord.ritorno !== undefined) {
        const timed = others.filter((e) => e.endTime);
        const last = timed.sort((a, b) => (a.endTime! < b.endTime! ? -1 : 1)).pop() ?? null;
        steps.push({
          key: `${kid.id}:ritiro`,
          kind: "pickup",
          time: last ? hhmm(last.endTime) : null,
          title: last ? `Ritiro da ${last.title}` : "Ritiro",
          detail: null,
          passage: { moment: "ritorno", label: coord.ritorno ?? null },
        });
      }
    }
    const missing = steps.filter((s) => s.passage && s.passage.label === null).length;
    return { kidId: kid.id, kidName: kid.name, steps, missing, onlySchool: others.length === 0 };
  });
}

/** Riga "Domani, giovedì 22: …" sotto la giornata aperta. */
export function dayTeaser(day: Pick<WeekDayModel, "entries" | "closureLabels">): string {
  const others = day.entries.filter((e) => !e.school);
  if (others.length === 0) {
    if (day.entries.length > 0) return "solo scuola";
    return day.closureLabels.length > 0 ? "scuola chiusa, niente in programma" : "giornata libera";
  }
  const titles = Array.from(new Set(others.map((e) => e.title)));
  return titles.length <= 2 ? titles.join(" e ") : `${titles.slice(0, 2).join(", ")} e altri ${titles.length - 2}`;
}

// ─── 22/10/2026 — chi accompagna per passaggio (Fase B) ────────────────
// Stessa catena di prima, ma i passaggi vengono da lib/nextgen/passages.ts:
// quattro spostamenti nel venerdì di Noemi (entra a scuola, da scuola a
// RITMICA come un viaggio, ritiro da RITMICA), sabato e domenica compresi.

export function buildKidPassageChains(
  day: Pick<WeekDayModel, "entries" | "coordination" | "dateIso">,
  kids: { id: string; name: string }[],
  ctx: { rows: PassageResponsibility[]; labelFor: (row: PassageResponsibility) => string }
): KidDayChain[] {
  return kids.map((kid) => {
    const mine = day.entries.filter((e) => e.kids.some((k) => k.id === kid.id));
    const others = mine.filter((e) => !e.school);
    const legs = dayLegs(day.entries, kid.id);
    if (legs.length === 0) {
      // Solo scuola (o niente): la catena di sempre, compatta.
      const [plain] = buildKidDayChains({ entries: day.entries, coordination: { mode: "none", kids: [], missingCount: 0, people: [] } }, [kid]);
      return plain;
    }
    const coord = day.coordination.kids.find((k) => k.kidId === kid.id);
    const resolved = resolveLegs({ legs, kidId: kid.id, date: day.dateIso, rows: ctx.rows, labelFor: ctx.labelFor, dayChoice: coord });
    const grouped = groupTrips(resolved);
    const steps: DayStep[] = grouped.map((g) => {
      if (g.kind === "trip") {
        const chips: StepChip[] = g.split
          ? [
              { legKeys: [g.from.key], text: g.from.school ? "Ritiro da scuola" : `Ritiro da ${g.from.title}`, label: g.from.label },
              { legKeys: [g.to.key], text: g.to.school ? "Porta a scuola" : `Porta a ${g.to.title}`, label: g.to.label },
            ]
          : [{ legKeys: [g.from.key, g.to.key], text: "Un viaggio", label: g.from.label }];
        const until = g.to.endTime ? `, fino alle ${g.to.endTime}` : "";
        return {
          key: `${g.from.key}>${g.to.key}`,
          kind: "trip" as const,
          time: g.from.time,
          title: tripTitle(g.from, g.to),
          detail: [`→ ${g.to.time} ${g.to.school ? "scuola" : g.to.title}${until}`, g.to.place, g.to.status].filter(Boolean).join(" · "),
          passage: null,
          chips,
        };
      }
      const l = g.leg;
      const chip: StepChip = { legKeys: [l.key], text: l.moment === "andata" ? "Andata" : "Ritorno", label: l.label };
      if (l.school) {
        return l.moment === "andata"
          ? { key: l.key, kind: "school_in" as const, time: l.time, title: "Entra a scuola", detail: l.schoolName, passage: null, chips: [chip] }
          : { key: l.key, kind: "school_out" as const, time: l.time, title: "Esce da scuola", detail: null, passage: null, chips: [chip] };
      }
      if (l.moment === "andata") {
        const allDay = l.time === null;
        const detail = allDay
          ? ["Tutto il giorno", l.place, l.status].filter(Boolean).join(" · ")
          : [l.place, l.endTime ? `fino alle ${l.endTime}` : null, l.status].filter(Boolean).join(" · ") || null;
        return { key: l.key, kind: allDay ? ("all_day" as const) : ("activity" as const), time: l.time, title: l.title, detail, passage: null, chips: [chip] };
      }
      return { key: l.key, kind: "pickup" as const, time: l.time, title: `Ritiro da ${l.title}`, detail: null, passage: null, chips: [chip] };
    });
    return { kidId: kid.id, kidName: kid.name, steps, missing: missingPassages(grouped), onlySchool: others.length === 0 };
  });
}
