"use client";

// TRAMA — CHI ACCOMPAGNA PER PASSAGGIO (22/10/2026, release
// "chi-accompagna-per-passaggio"). Il contenuto del foglio "Chi accompagna"
// quando la giornata ha i passaggi: per ogni figlio, uno per riga, in ordine
// di orario — "08:30 Entra a scuola", "16:30 Da scuola a RITMICA · un
// viaggio", "19:00 Ritiro da RITMICA". Un viaggio ha una scelta sola, con
// "Due persone diverse?" per dividerlo. Stesse persone, stesso "Altro…",
// stesse proposte dopo una scelta (tutto l'impegno, invito, piano) del foglio
// di prima (AssignSheet in PlannerV2Client.tsx).
// Logica: lib/nextgen/passages.ts. Salvataggio: app/actions/responsibilities.ts.

import { useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { KidAvatar, kidToneFor } from "@/components/nextgen/AgendaItemRow";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import { clearPassageResponsibilitiesAction, setPassageResponsibilitiesAction } from "@/app/actions/responsibilities";
import { notifyPartnerAssignmentsAction } from "@/app/actions/assign-notify";
import { isPartnerChoice, type AssignChange, type CommitmentDays } from "@/lib/nextgen/assign-plus";
import { markFirstUsefulAction } from "@/lib/nextgen/first-action";
import {
  applyAllTargets,
  dayLegs,
  dayMirrorFor,
  groupTrips,
  legLabel,
  otherDatesOfPassage,
  resolveLegs,
  tripTitle,
  type PassageResponsibility,
  type PassageTarget,
  type ResolvedLeg,
} from "@/lib/nextgen/passages";
import { WEEKDAYS, type Moment, type ResponsibleOption, type WeekResponsibility } from "@/lib/nextgen/responsibility-options";
import type { AgendaEntry } from "@/lib/nextgen/today-agenda";
import type { WeekDayModel } from "@/lib/nextgen/planner-week";

export interface PassageOffer {
  key: string;
  kidId: string;
  kidName: string;
  moment: Moment;
  opt: ResponsibleOption;
  label?: string;
  commitments: CommitmentDays[];
  /** Per ogni impegno proposto: il passaggio e il momento da ripetere. */
  passageKey: string;
}

function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Settimana e giorno della scelta "del giorno" (solo lun–ven). */
function dayRowFor(date: string): { weekStartDate: string; weekday: WeekResponsibility["weekday"] } | null {
  const monday = mondayOf(date);
  const offset = Math.round((Date.parse(date) - Date.parse(monday)) / 86400000);
  const wd = WEEKDAYS.find((w) => w.dayOffset === offset);
  return wd ? { weekStartDate: monday, weekday: wd.value } : null;
}

export default function PassageAssignBody({
  day,
  kids,
  kidOrder,
  options,
  rows,
  onRowsChange,
  responsibilities,
  onDayChange,
  labelFor,
  todayIso,
  agendaFor,
  rangeFor,
  plusEnabled,
  partnerOnTrama,
  renderOffer,
  onClose,
}: {
  day: WeekDayModel;
  kids: { id: string; name: string }[];
  kidOrder: string[];
  options: ResponsibleOption[];
  rows: PassageResponsibility[];
  onRowsChange: Dispatch<SetStateAction<PassageResponsibility[]>>;
  responsibilities: WeekResponsibility[];
  onDayChange: Dispatch<SetStateAction<WeekResponsibility[]>>;
  labelFor: (row: PassageResponsibility) => string;
  todayIso: string;
  /** Agenda di una data qualunque (per "tutto l'impegno"). */
  agendaFor: (dateIso: string) => AgendaEntry[];
  /** Primo e ultimo giorno possibili di un impegno ("external:<id>", "booking:<id>"). */
  rangeFor: (passageKey: string) => { startDate: string; endDate: string } | null;
  plusEnabled: boolean;
  partnerOnTrama: boolean;
  renderOffer: (input: { offer: PassageOffer; applying: boolean; onApply: (c: CommitmentDays) => void; onDismiss: () => void }) => ReactNode;
  onClose: () => void;
}) {
  const showToast = useNextgenToast();
  const [otherFor, setOtherFor] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const [splitTrips, setSplitTrips] = useState<Set<string>>(() => new Set());
  const [offer, setOffer] = useState<PassageOffer | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const partnerChanges = useRef<AssignChange[]>([]);
  const seqRef = useRef<Record<string, number>>({});

  const chains = kids
    .map((kid) => {
      const legs = dayLegs(day.entries, kid.id);
      const coord = day.coordination.kids.find((k) => k.kidId === kid.id);
      const resolved = resolveLegs({ legs, kidId: kid.id, date: day.dateIso, rows, labelFor, dayChoice: coord });
      return { kid, legs, steps: groupTrips(resolved) };
    })
    .filter((c) => c.legs.length > 0);

  function close() {
    const changes = partnerChanges.current;
    partnerChanges.current = [];
    if (plusEnabled && partnerOnTrama && changes.length > 0) void notifyPartnerAssignmentsAction(changes).catch(() => undefined);
    onClose();
  }

  const sameRow = (r: PassageResponsibility, t: PassageTarget) =>
    r.kidId === t.kidId && r.date === t.date && r.passageKey === t.passageKey && r.moment === t.moment;
  const sameDay = (r: WeekResponsibility, kidId: string, week: string, wd: string, moment: Moment) =>
    r.kidId === kidId && r.weekStartDate === week && r.weekday === wd && r.moment === moment;

  async function choose(kidId: string, kidName: string, allLegs: ResolvedLeg[], legs: ResolvedLeg[], opt: ResponsibleOption | null, label?: string) {
    const key = legs.map((l) => l.key).join("+");
    const seq = (seqRef.current[key] ?? 0) + 1;
    seqRef.current[key] = seq;
    const targets: PassageTarget[] = legs.map((l) => ({ kidId, date: day.dateIso, passageKey: l.passageKey, moment: l.moment }));
    const mirror = legs.flatMap((l) => {
      const m = dayMirrorFor(allLegs, l.key);
      return m ? [{ kidId, date: day.dateIso, moment: m }] : [];
    });
    const beforeRows = rows;
    const beforeDay = responsibilities;
    const newRows: PassageResponsibility[] = opt
      ? targets.map((t) => ({
          ...t,
          responsible: opt.value,
          responsibleLabel: opt.value === "altro" ? (label ?? opt.label) : null,
          familyPersonId: opt.familyPersonId ?? null,
        }))
      : [];
    onRowsChange((cur) => [...cur.filter((r) => !targets.some((t) => sameRow(r, t))), ...newRows]);
    const dayRows = mirror.flatMap((m) => {
      const d = dayRowFor(m.date);
      return d ? [{ ...d, kidId: m.kidId, moment: m.moment }] : [];
    });
    if (dayRows.length > 0) {
      onDayChange((cur) => [
        ...cur.filter((r) => !dayRows.some((d) => sameDay(r, d.kidId, d.weekStartDate, d.weekday, d.moment))),
        ...(opt
          ? dayRows.map((d) => ({
              kidId: d.kidId,
              weekStartDate: d.weekStartDate,
              weekday: d.weekday,
              moment: d.moment,
              responsible: opt.value,
              responsibleLabel: opt.value === "altro" ? (label ?? opt.label) : null,
              familyPersonId: opt.familyPersonId ?? null,
            }))
          : []),
      ]);
    }
    if (plusEnabled) {
      for (const l of legs) {
        const was = l.row?.responsible ?? null;
        if (isPartnerChoice(was ?? undefined) !== isPartnerChoice(opt?.value)) {
          partnerChanges.current.push({ dateIso: day.dateIso, kidName, moment: l.moment, assigned: isPartnerChoice(opt?.value) });
        }
      }
    }
    // "Anche gli altri giorni di …": dell'impegno; se il passaggio è solo di
    // scuola (entra / esce), degli altri giorni di scuola (26/10/2026).
    const activity = legs.find((l) => !l.school) ?? legs[0] ?? null;
    if (opt && plusEnabled && activity) {
      const range = rangeFor(activity.passageKey);
      const dates = range
        ? otherDatesOfPassage({ dateIso: day.dateIso, todayIso, kidId, passageKey: activity.passageKey, range, agendaFor })
        : [];
      setOffer({
        key,
        kidId,
        kidName,
        moment: activity.moment,
        opt,
        label,
        passageKey: activity.passageKey,
        commitments: dates.length > 0 ? [{ key: activity.passageKey, title: activity.school ? "scuola" : activity.title, dates }] : [],
      });
    } else if (opt && plusEnabled) {
      setOffer({ key, kidId, kidName, moment: legs[0].moment, opt, label, passageKey: legs[0].passageKey, commitments: [] });
    } else if (!opt) {
      setOffer((o) => (o?.key === key ? null : o));
    }

    const fail = { error: "Non siamo riusciti a salvare, riprova." };
    const res = opt
      ? await setPassageResponsibilitiesAction({
          targets,
          responsible: opt.value,
          responsibleLabel: label ?? opt.label,
          familyPersonId: opt.familyPersonId,
          mirror,
        }).catch(() => fail)
      : await clearPassageResponsibilitiesAction({ targets, mirror }).catch(() => fail);
    if (seqRef.current[key] !== seq) return;
    if (res.error) {
      onRowsChange(beforeRows);
      onDayChange(beforeDay);
      setOffer((o) => (o?.key === key ? null : o));
      showToast(res.error);
      return;
    }
    if (opt) markFirstUsefulAction("chi_porta");
  }

  async function applyToAll(c: CommitmentDays) {
    if (!offer) return;
    const { kidId, opt, label, moment, passageKey } = offer;
    setApplyingAll(true);
    const { targets, mirror } = applyAllTargets({ kidId, passageKey, moment, dates: c.dates, agendaFor });
    const beforeRows = rows;
    const beforeDay = responsibilities;
    onRowsChange((cur) => [
      ...cur.filter((r) => !targets.some((t) => sameRow(r, t))),
      ...targets.map((t) => ({
        ...t,
        responsible: opt.value,
        responsibleLabel: opt.value === "altro" ? (label ?? opt.label) : null,
        familyPersonId: opt.familyPersonId ?? null,
      })),
    ]);
    const res = await setPassageResponsibilitiesAction({
      targets,
      responsible: opt.value,
      responsibleLabel: label ?? opt.label,
      familyPersonId: opt.familyPersonId,
      mirror,
    }).catch(() => ({ error: "Non siamo riusciti a salvare, riprova." }));
    setApplyingAll(false);
    if (res.error) {
      onRowsChange(beforeRows);
      onDayChange(beforeDay);
      showToast(res.error);
      return;
    }
    // La scelta del giorno negli altri giorni (prima andata / ultimo ritorno).
    onDayChange((cur) => {
      const add = mirror.flatMap((m) => {
        const d = dayRowFor(m.date);
        return d
          ? [
              {
                kidId: m.kidId,
                weekStartDate: d.weekStartDate,
                weekday: d.weekday,
                moment: m.moment,
                responsible: opt.value,
                responsibleLabel: opt.value === "altro" ? (label ?? opt.label) : null,
                familyPersonId: opt.familyPersonId ?? null,
              },
            ]
          : [];
      });
      return [...cur.filter((r) => !add.some((a) => sameDay(r, a.kidId, a.weekStartDate, a.weekday, a.moment))), ...add];
    });
    if (isPartnerChoice(opt.value)) {
      for (const t of targets) partnerChanges.current.push({ dateIso: t.date, kidName: offer.kidName, moment: t.moment, assigned: true });
    }
    showToast(`Fatto: ${label ?? opt.label} anche negli altri ${c.dates.length === 1 ? "giorno" : `${c.dates.length} giorni`}`);
    setOffer((o) => (o ? { ...o, commitments: o.commitments.filter((x) => x.key !== c.key) } : o));
  }

  const isSelected = (leg: ResolvedLeg, o: ResponsibleOption) => {
    if (leg.row) return leg.row.responsible === o.value && (o.value !== "altro" || leg.row.familyPersonId === o.familyPersonId);
    // Scelta del giorno (ripiego): si confronta l'etichetta.
    return leg.source === "day" && leg.label === o.label;
  };

  // Funzioni che restituiscono JSX (non componenti): un componente definito
  // qui dentro si ricreerebbe a ogni tasto e il campo "Altro…" perderebbe il focus.
  function choices({ kidId, kidName, allLegs, legs, rowKey }: { kidId: string; kidName: string; allLegs: ResolvedLeg[]; legs: ResolvedLeg[]; rowKey: string }) {
    const lead = legs[0];
    const freeLabel = lead.row && lead.row.responsible === "altro" && !lead.row.familyPersonId ? lead.row.responsibleLabel : null;
    return (
      <>
        <div className="flex flex-wrap gap-1.5">
          {options
            .filter((o) => !(o.value === "altro" && !o.familyPersonId))
            .map((o) => {
              const selected = legs.every((l) => isSelected(l, o));
              return (
                <button
                  key={`${o.value}-${o.familyPersonId ?? ""}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => void choose(kidId, kidName, allLegs, legs, selected ? null : o)}
                  className={`min-h-[38px] rounded-full px-3.5 text-[13px] font-semibold ${
                    selected ? "bg-trama-navy text-white" : "border border-[#E3E6EC] bg-white text-ink"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          <button
            type="button"
            aria-pressed={Boolean(freeLabel)}
            onClick={() => {
              setOtherFor(rowKey);
              setOtherText(freeLabel ?? "");
            }}
            className={`min-h-[38px] rounded-full px-3.5 text-[13px] font-semibold ${
              freeLabel ? "bg-trama-navy text-white" : "border border-dashed border-[#C9CED8] bg-white text-ink"
            }`}
          >
            {freeLabel ?? "Altro…"}
          </button>
        </div>
        {otherFor === rowKey && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const text = otherText.trim();
              if (!text) return;
              const generic = options.find((o) => o.value === "altro" && !o.familyPersonId);
              if (generic) void choose(kidId, kidName, allLegs, legs, generic, text);
              setOtherFor(null);
            }}
          >
            <label className="sr-only" htmlFor={`altro-${rowKey}`}>
              Chi se ne occupa
            </label>
            <input
              id={`altro-${rowKey}`}
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="Es. Zio Marco"
              className="min-h-[40px] flex-1 rounded-xl border border-[#E3E6EC] px-3 text-[14px]"
            />
            <button type="submit" className="min-h-[44px] rounded-[12px] bg-trama-primary px-4 text-[13px] font-bold text-white active:bg-trama-primary-press">
              Salva
            </button>
          </form>
        )}
        {offer?.key === legs.map((l) => l.key).join("+") &&
          plusEnabled &&
          renderOffer({ offer, applying: applyingAll, onApply: (c) => void applyToAll(c), onDismiss: () => setOffer(null) })}
      </>
    );
  }

  function row({ key, time, title, sub, children, testId }: { key: string; time: string | null; title: string; sub?: string | null; children: ReactNode; testId: string }) {
    return (
      <div key={key} className="flex flex-col gap-1.5" data-testid={testId}>
        <span className="flex items-baseline gap-2">
          <span className="w-[42px] flex-shrink-0 text-[12.5px] font-semibold tabular-nums text-ink">{time ?? ""}</span>
          <span className="text-[13.5px] font-semibold text-ink">{title}</span>
        </span>
        {sub && <span className="-mt-1 pl-[50px] text-[12px] text-ink-2">{sub}</span>}
        <div className="flex flex-col gap-1.5 pl-[50px]">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" data-testid="passage-assign">
      {chains.length === 0 && <p className="text-[13.5px] text-ink-2">Nessun passaggio da organizzare in questa giornata.</p>}
      {chains.map(({ kid, steps }) => {
        const allLegs = steps.flatMap((s) => (s.kind === "trip" ? [s.from, s.to] : [s.leg]));
        return (
          <div key={kid.id} className="flex flex-col gap-3.5">
            <div className="flex items-center gap-2">
              <KidAvatar name={kid.name} tone={kidToneFor(kid.id, kidOrder)} size={26} />
              <span className="text-[15px] font-semibold text-ink">{kid.name}</span>
            </div>
            {steps.map((s) => {
              if (s.kind === "leg") {
                return row({
                  key: s.leg.key,
                  time: s.leg.time,
                  title: legLabel(s.leg),
                  testId: "passage-row",
                  children: choices({ kidId: kid.id, kidName: kid.name, allLegs, legs: [s.leg], rowKey: `${kid.id}|${s.leg.key}` }),
                });
              }
              const tripKey = `${kid.id}|${s.from.key}>${s.to.key}`;
              const divided = s.split || splitTrips.has(tripKey);
              if (!divided) {
                return row({
                  key: tripKey,
                  time: s.from.time,
                  title: `${tripTitle(s.from, s.to)} · un viaggio`,
                  sub: `Esce alle ${s.from.time}, ${s.to.school ? "a scuola" : `a ${s.to.title}`} alle ${s.to.time}: chi la ritira la porta.`,
                  testId: "passage-trip",
                  children: (
                    <>
                    {choices({ kidId: kid.id, kidName: kid.name, allLegs, legs: [s.from, s.to], rowKey: tripKey })}
                    <button
                      type="button"
                      onClick={() => setSplitTrips((cur) => new Set(cur).add(tripKey))}
                      className="min-h-[32px] self-start text-[12.5px] font-semibold text-trama-accent-ink"
                      data-testid="trip-split"
                    >
                      Due persone diverse?
                    </button>
                    </>
                  ),
                });
              }
              return (
                <div key={tripKey} className="flex flex-col gap-3 rounded-[14px] bg-[#F7F6F2] p-3" data-testid="passage-trip-split">
                  <span className="text-[12px] font-semibold text-ink-2">{tripTitle(s.from, s.to)}: due persone</span>
                  {row({
                    key: s.from.key,
                    time: s.from.time,
                    title: legLabel(s.from),
                    testId: "passage-row",
                    children: choices({ kidId: kid.id, kidName: kid.name, allLegs, legs: [s.from], rowKey: `${kid.id}|${s.from.key}` }),
                  })}
                  {row({
                    key: s.to.key,
                    time: s.to.time,
                    title: legLabel(s.to),
                    testId: "passage-row",
                    children: choices({ kidId: kid.id, kidName: kid.name, allLegs, legs: [s.to], rowKey: `${kid.id}|${s.to.key}` }),
                  })}
                  {s.from.label !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        const opt = options.find((o) => isSelected(s.from, o));
                        if (opt) void choose(kid.id, kid.name, allLegs, [s.to], opt, s.from.row?.responsibleLabel ?? undefined);
                        setSplitTrips((cur) => {
                          const next = new Set(cur);
                          next.delete(tripKey);
                          return next;
                        });
                      }}
                      className="min-h-[32px] self-start text-[12.5px] font-semibold text-trama-accent-ink"
                      data-testid="trip-join"
                    >
                      Un viaggio solo: {s.from.label} anche {s.to.school ? "a scuola" : `a ${s.to.title}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <button type="button" onClick={close} className="min-h-[48px] rounded-[12px] bg-trama-primary text-[14px] font-bold text-white active:bg-trama-primary-press">
        Fatto
      </button>
    </div>
  );
}
