"use client";

// TRAMA — CHI ACCOMPAGNA NELLE GIORNATE PIENE (28/10/2026, release
// "chi-accompagna-giornate-piene"). Fabrizio: "in una giornata con più
// impegni è un casino, troppi click non si capisce"; mock approvato il 28/10
// ("a me torna il mockup"). Il contenuto del foglio "Chi accompagna" col flag
// PASSAGE_PERSON_FIRST_ENABLED:
//   1. "Come mercoledì scorso": le scelte dello stesso giorno della settimana
//      prima, in un tocco (solo i passaggi uguali e ancora da decidere);
//   2. "Chi se ne occupa?": si sceglie la persona, poi un tocco per passaggio;
//      senza persona scelta, il tocco apre le scelte di quel passaggio (come
//      prima), così nessuno resta bloccato;
//   3. da decidere in alto; decisi raccolti per persona;
//   4. a "Fatto", una domanda sola: "Anche gli altri mercoledì?", con una
//      spunta per figlio e passaggio (per un figlio sì, per l'altro no).
// Logica: lib/nextgen/passage-busy-day.ts (sopra lib/nextgen/passages.ts).
// Salvataggio: le stesse azioni di PassageAssignBody (app/actions/responsibilities.ts).
// Flag spento → PassageAssignBody, come prima.

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { KidAvatar, kidToneFor } from "@/components/nextgen/AgendaItemRow";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import { clearPassageResponsibilitiesAction, setPassageResponsibilitiesAction } from "@/app/actions/responsibilities";
import { notifyPartnerAssignmentsAction } from "@/app/actions/assign-notify";
import { isPartnerChoice, type AssignChange } from "@/lib/nextgen/assign-plus";
import { markFirstUsefulAction } from "@/lib/nextgen/first-action";
import { applyAllTargets, legLabel, otherDatesOfPassage, tripTitle, type PassageResponsibility, type PassageTarget } from "@/lib/nextgen/passages";
import {
  buildBusyItems,
  dayRowFor,
  groupByPerson,
  itemIsPerson,
  legIsPerson,
  otherWeekdaysIt,
  pendingTargets,
  personLabel,
  sameWeekdayDates,
  sameWeekdaySuggestion,
  shortDateIt,
  suggestionWrites,
  targetsOf,
  weekdayIt,
  type BusyItem,
  type BusyPart,
  type ChosenPerson,
} from "@/lib/nextgen/passage-busy-day";
import type { Moment, ResponsibleOption, WeekResponsibility } from "@/lib/nextgen/responsibility-options";
import type { AgendaEntry } from "@/lib/nextgen/today-agenda";
import type { WeekDayModel } from "@/lib/nextgen/planner-week";

type Mirror = { kidId: string; date: string; moment: Moment };

interface SessionChoice {
  part: BusyPart;
  person: ChosenPerson;
}

interface RepeatCandidate {
  key: string;
  kidId: string;
  kidName: string;
  time: string | null;
  title: string;
  who: string;
  person: ChosenPerson;
  targets: PassageTarget[];
  mirror: Mirror[];
  days: number;
  lastDate: string;
}

export default function PassageBusyDayBody({
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
  onShareWeek,
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
  agendaFor: (dateIso: string) => AgendaEntry[];
  rangeFor: (passageKey: string) => { startDate: string; endDate: string } | null;
  plusEnabled: boolean;
  partnerOnTrama: boolean;
  onShareWeek?: () => void;
  onClose: () => void;
}) {
  const showToast = useNextgenToast();
  const date = day.dateIso;
  const [person, setPerson] = useState<ChosenPerson | null>(null);
  const [nudge, setNudge] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [personOther, setPersonOther] = useState<string | null>(null);
  const [itemOther, setItemOther] = useState<{ key: string; text: string } | null>(null);
  const [splitTrips, setSplitTrips] = useState<Set<string>>(() => new Set());
  const [separated, setSeparated] = useState<Set<string>>(() => new Set());
  const [suggestionUsed, setSuggestionUsed] = useState(false);
  const [showDoneState, setShowDone] = useState<boolean | null>(null);
  const [stage, setStage] = useState<"edit" | "repeat">("edit");
  const [repeat, setRepeat] = useState<{ list: RepeatCandidate[]; checked: Set<string> } | null>(null);
  const [applying, setApplying] = useState(false);
  const session = useRef<Record<string, SessionChoice>>({});
  const partnerChanges = useRef<AssignChange[]>([]);
  const seqRef = useRef<Record<string, number>>({});

  const generic = options.find((o) => o.value === "altro" && !o.familyPersonId) ?? null;
  const chips = options.filter((o) => !(o.value === "altro" && !o.familyPersonId));

  const items = useMemo(
    () =>
      buildBusyItems({
        kids,
        entries: day.entries,
        date,
        rows,
        labelFor,
        dayChoiceFor: (kidId) => day.coordination.kids.find((k) => k.kidId === kidId),
        splitTrips,
        separated,
      }),
    [kids, day, date, rows, labelFor, splitTrips, separated]
  );
  const open = items.filter((i) => i.label === null);
  const done = items.filter((i) => i.label !== null);
  const byPerson = groupByPerson(done);
  const suggestion = useMemo(
    () => (suggestionUsed ? null : sameWeekdaySuggestion({ date, items, rows, labelFor })),
    [suggestionUsed, date, items, rows, labelFor]
  );
  const showDone = showDoneState ?? open.length === 0;
  const mineCount = person ? items.filter((i) => itemIsPerson(i, person)).length : 0;

  const sameRow = (r: PassageResponsibility, t: PassageTarget) =>
    r.kidId === t.kidId && r.date === t.date && r.passageKey === t.passageKey && r.moment === t.moment;
  const sameDay = (r: WeekResponsibility, kidId: string, week: string, wd: string, moment: Moment) =>
    r.kidId === kidId && r.weekStartDate === week && r.weekday === wd && r.moment === moment;

  function rowsFor(targets: PassageTarget[], p: ChosenPerson): PassageResponsibility[] {
    return targets.map((t) => ({
      ...t,
      responsible: p.opt.value,
      responsibleLabel: p.opt.value === "altro" ? personLabel(p) : null,
      familyPersonId: p.opt.familyPersonId ?? null,
    }));
  }

  function applyDayMirror(mirror: Mirror[], p: ChosenPerson | null) {
    const dayRows = mirror.flatMap((m) => {
      const d = dayRowFor(m.date);
      return d ? [{ ...d, kidId: m.kidId, moment: m.moment }] : [];
    });
    if (dayRows.length === 0) return;
    onDayChange((cur) => [
      ...cur.filter((r) => !dayRows.some((d) => sameDay(r, d.kidId, d.weekStartDate, d.weekday, d.moment))),
      ...(p
        ? dayRows.map((d) => ({
            kidId: d.kidId,
            weekStartDate: d.weekStartDate,
            weekday: d.weekday,
            moment: d.moment,
            responsible: p.opt.value,
            responsibleLabel: p.opt.value === "altro" ? personLabel(p) : null,
            familyPersonId: p.opt.familyPersonId ?? null,
          }))
        : []),
    ]);
  }

  function trackPartner(parts: BusyPart[], p: ChosenPerson | null) {
    if (!plusEnabled) return;
    for (const part of parts) {
      for (const l of part.legs) {
        const was = l.row?.responsible ?? null;
        if (isPartnerChoice(was ?? undefined) !== isPartnerChoice(p?.opt.value)) {
          partnerChanges.current.push({ dateIso: date, kidName: part.kidName, moment: l.moment, assigned: isPartnerChoice(p?.opt.value) });
        }
      }
    }
  }

  /** Affida (o toglie, con p = null) tutti i passaggi di una riga. */
  async function assign(item: BusyItem, p: ChosenPerson | null) {
    const seq = (seqRef.current[item.key] ?? 0) + 1;
    seqRef.current[item.key] = seq;
    const { targets, mirror } = targetsOf(item.parts, date);
    const beforeRows = rows;
    const beforeDay = responsibilities;
    onRowsChange((cur) => [...cur.filter((r) => !targets.some((t) => sameRow(r, t))), ...(p ? rowsFor(targets, p) : [])]);
    applyDayMirror(mirror, p);
    trackPartner(item.parts, p);
    for (const part of item.parts) {
      const k = `${part.kidId}|${part.signature}`;
      if (p) session.current[k] = { part, person: p };
      else delete session.current[k];
    }
    const fail = { error: "Non siamo riusciti a salvare, riprova." };
    const res = p
      ? await setPassageResponsibilitiesAction({
          targets,
          responsible: p.opt.value,
          responsibleLabel: personLabel(p),
          familyPersonId: p.opt.familyPersonId,
          mirror,
        }).catch(() => fail)
      : await clearPassageResponsibilitiesAction({ targets, mirror }).catch(() => fail);
    if (seqRef.current[item.key] !== seq) return;
    if (res.error) {
      onRowsChange(beforeRows);
      onDayChange(beforeDay);
      showToast(res.error);
      return;
    }
    if (p) markFirstUsefulAction("chi_porta");
  }

  async function applySuggestion() {
    if (!suggestion) return;
    setSuggestionUsed(true);
    setShowDone(true);
    const writes = suggestionWrites(suggestion, date);
    const beforeRows = rows;
    const beforeDay = responsibilities;
    for (const w of writes) {
      const opt =
        options.find((o) => o.value === w.row.responsible && (o.familyPersonId ?? null) === (w.row.familyPersonId ?? null)) ??
        (w.row.responsible === "altro" ? generic : null);
      if (!opt) continue;
      const p: ChosenPerson = { opt, label: w.row.responsible === "altro" && !w.row.familyPersonId ? (w.row.responsibleLabel ?? undefined) : undefined };
      onRowsChange((cur) => [...cur.filter((r) => !w.targets.some((t) => sameRow(r, t))), ...rowsFor(w.targets, p)]);
      applyDayMirror(w.mirror, p);
      for (const it of items) {
        for (const part of it.parts) {
          if (w.targets.some((t) => t.kidId === part.kidId && part.legs.some((l) => l.passageKey === t.passageKey && l.moment === t.moment))) {
            session.current[`${part.kidId}|${part.signature}`] = { part, person: p };
          }
        }
      }
      if (plusEnabled && isPartnerChoice(opt.value)) {
        for (const t of w.targets) {
          const kidName = kids.find((k) => k.id === t.kidId)?.name ?? "";
          partnerChanges.current.push({ dateIso: date, kidName, moment: t.moment, assigned: true });
        }
      }
      const res = await setPassageResponsibilitiesAction({
        targets: w.targets,
        responsible: opt.value,
        responsibleLabel: personLabel(p),
        familyPersonId: opt.familyPersonId,
        mirror: w.mirror,
      }).catch(() => ({ error: "Non siamo riusciti a salvare, riprova." }));
      if (res.error) {
        onRowsChange(beforeRows);
        onDayChange(beforeDay);
        setSuggestionUsed(false);
        showToast(res.error);
        return;
      }
    }
    markFirstUsefulAction("chi_porta");
  }

  function tap(item: BusyItem) {
    setItemOther(null);
    if (!person) {
      setExpanded((cur) => (cur === item.key ? null : item.key));
      if (item.label === null) setNudge(true);
      return;
    }
    setExpanded(null);
    void assign(item, itemIsPerson(item, person) ? null : person);
  }

  function pickPerson(p: ChosenPerson | null) {
    setPerson(p);
    setNudge(false);
    setExpanded(null);
    setPersonOther(null);
  }

  function finish() {
    const changes = partnerChanges.current;
    partnerChanges.current = [];
    if (plusEnabled && partnerOnTrama && changes.length > 0) void notifyPartnerAssignmentsAction(changes).catch(() => undefined);
    onClose();
  }

  function onDone() {
    if (!plusEnabled) return finish();
    const list: RepeatCandidate[] = [];
    for (const [key, c] of Object.entries(session.current)) {
      const activity = c.part.legs.find((l) => !l.school) ?? c.part.legs[0];
      const range = rangeFor(activity.passageKey);
      if (!range) continue;
      const dates = sameWeekdayDates(
        otherDatesOfPassage({ dateIso: date, todayIso, kidId: c.part.kidId, passageKey: activity.passageKey, range, agendaFor }),
        date
      );
      if (dates.length === 0) continue;
      const all = applyAllTargets({ kidId: c.part.kidId, passageKey: activity.passageKey, moment: activity.moment, dates, agendaFor });
      const targets = pendingTargets(all.targets, rows, {
        responsible: c.person.opt.value,
        familyPersonId: c.person.opt.familyPersonId ?? null,
        responsibleLabel: c.person.opt.value === "altro" ? personLabel(c.person) : null,
      });
      if (targets.length === 0) continue;
      const days = Array.from(new Set(targets.map((t) => t.date))).sort();
      list.push({
        key,
        kidId: c.part.kidId,
        kidName: c.part.kidName,
        time: c.part.legs[0].time,
        title: c.part.legs.length === 2 ? tripTitle(c.part.legs[0], c.part.legs[1]) : legLabel(c.part.legs[0]),
        who: personLabel(c.person),
        person: c.person,
        targets,
        mirror: all.mirror.filter((m) => days.includes(m.date)),
        days: days.length,
        lastDate: days[days.length - 1],
      });
    }
    if (list.length === 0) return finish();
    list.sort((a, b) => kidOrder.indexOf(a.kidId) - kidOrder.indexOf(b.kidId) || (a.time ?? "").localeCompare(b.time ?? ""));
    setRepeat({ list, checked: new Set(list.map((c) => c.key)) });
    setStage("repeat");
  }

  async function applyRepeat() {
    if (!repeat) return;
    const chosen = repeat.list.filter((c) => repeat.checked.has(c.key));
    if (chosen.length === 0) return finish();
    setApplying(true);
    let ok = 0;
    for (const c of chosen) {
      const before = rows;
      onRowsChange((cur) => [...cur.filter((r) => !c.targets.some((t) => sameRow(r, t))), ...rowsFor(c.targets, c.person)]);
      const res = await setPassageResponsibilitiesAction({
        targets: c.targets,
        responsible: c.person.opt.value,
        responsibleLabel: personLabel(c.person),
        familyPersonId: c.person.opt.familyPersonId,
        mirror: c.mirror,
      }).catch(() => ({ error: "Non siamo riusciti a salvare, riprova." }));
      if (res.error) {
        onRowsChange(before);
        showToast(res.error);
        continue;
      }
      applyDayMirror(c.mirror, c.person);
      if (plusEnabled && isPartnerChoice(c.person.opt.value)) {
        for (const t of c.targets) partnerChanges.current.push({ dateIso: t.date, kidName: c.kidName, moment: t.moment, assigned: true });
      }
      ok += 1;
    }
    setApplying(false);
    if (ok > 0) showToast(`Fatto: ${ok === 1 ? "1 passaggio ripetuto" : `${ok} passaggi ripetuti`} ${otherWeekdaysIt(date)}`);
    finish();
  }

  // ─── Fase 2: "Anche gli altri mercoledì?" ─────────────────────────────
  if (stage === "repeat" && repeat) {
    const kidsInList = Array.from(new Set(repeat.list.map((c) => c.kidId)));
    const checkedCount = repeat.checked.size;
    const last = repeat.list
      .filter((c) => repeat.checked.has(c.key))
      .map((c) => c.lastDate)
      .sort()
      .pop();
    const partnerNotOnTrama = !partnerOnTrama && repeat.list.some((c) => c.person.opt.value === "partner");
    const outsider = repeat.list.find((c) => c.person.opt.value !== "io" && c.person.opt.value !== "partner");
    return (
      <div className="flex flex-col gap-4" data-testid="busy-repeat">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#1F6B52]">
            {weekdayIt(date)} {open.length === 0 ? "· tutto deciso" : `· ${open.length} da decidere`}
          </span>
          <h3 className="font-poppins text-[19px] font-semibold leading-tight text-trama-navy">
            Anche {otherWeekdaysIt(date)}?
          </h3>
          <p className="text-[13.5px] leading-snug text-ink-2">Togli la spunta a ciò che cambia.</p>
        </div>
        {kidsInList.map((kidId) => {
          const mine = repeat.list.filter((c) => c.kidId === kidId);
          return (
            <fieldset key={kidId} className="flex flex-col gap-2">
              <legend className="pb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-trama-accent-ink">{mine[0].kidName}</legend>
              {mine.map((c) => (
                <label key={c.key} className="flex min-h-[56px] items-center gap-3 rounded-[14px] border border-trama-line bg-white px-3 py-2">
                  <input
                    type="checkbox"
                    checked={repeat.checked.has(c.key)}
                    onChange={(e) =>
                      setRepeat((cur) => {
                        if (!cur) return cur;
                        const next = new Set(cur.checked);
                        if (e.target.checked) next.add(c.key);
                        else next.delete(c.key);
                        return { ...cur, checked: next };
                      })
                    }
                    className="h-[22px] w-[22px] flex-shrink-0 accent-trama-navy"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[14.5px] font-semibold text-ink">
                      {c.time ? `${c.time} ` : ""}
                      {c.title}
                    </span>
                    <span className="text-[12.5px] text-ink-2">
                      {c.who} · {c.days === 1 ? "1 altro giorno" : `altri ${c.days}`}, fino al {shortDateIt(c.lastDate)}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          );
        })}
        {partnerNotOnTrama && (
          <p className="text-[13px] leading-snug text-ink-2">
            L&apos;altro genitore non è ancora su TRAMA.{" "}
            <Link href="/nextgen/profile/famiglia" className="font-semibold text-trama-accent-ink">
              Invitalo
            </Link>
            : vedrete lo stesso Planner.
          </p>
        )}
        {outsider && onShareWeek && (
          <button
            type="button"
            onClick={onShareWeek}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-[12px] border border-[#D9DDE5] bg-white px-3.5 text-[13.5px] font-semibold text-trama-primary"
          >
            <i className="ti ti-share" aria-hidden="true" />
            {outsider.who} non usa TRAMA? Manda il piano della settimana
          </button>
        )}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => void applyRepeat()}
            disabled={applying || checkedCount === 0}
            className="min-h-[50px] rounded-[12px] bg-trama-primary px-4 text-[15px] font-semibold text-white active:bg-trama-primary-press disabled:bg-[#B9C0CC]"
            data-testid="busy-repeat-apply"
          >
            {applying
              ? "Un attimo…"
              : `Ripeti ${checkedCount === 1 ? "1 passaggio" : `${checkedCount} passaggi`}${last ? ` fino al ${shortDateIt(last)}` : ""}`}
          </button>
          <button type="button" onClick={finish} disabled={applying} className="min-h-[44px] text-[14.5px] font-semibold text-trama-accent-ink">
            Solo questo {weekdayIt(date)}
          </button>
        </div>
      </div>
    );
  }

  // ─── Fase 1: chi, poi i passaggi ──────────────────────────────────────
  function avatars(item: BusyItem) {
    return (
      <span className="flex flex-shrink-0">
        {item.parts.map((p, i) => (
          <span key={p.kidId} className={i > 0 ? "-ml-1.5" : ""}>
            <KidAvatar name={p.kidName} tone={kidToneFor(p.kidId, kidOrder)} size={26} ring />
          </span>
        ))}
      </span>
    );
  }

  function inlineChoices(item: BusyItem) {
    const legs = item.parts.flatMap((p) => p.legs);
    return (
      <div className="flex flex-col gap-2 rounded-[12px] bg-[#F7F6F2] p-2.5" data-testid="busy-inline">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((o) => {
            const p: ChosenPerson = { opt: o };
            const selected = legs.every((l) => legIsPerson(l, p));
            return (
              <button
                key={`${o.value}-${o.familyPersonId ?? ""}`}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setExpanded(null);
                  void assign(item, selected ? null : p);
                }}
                className={`min-h-[38px] rounded-full px-3.5 text-[13px] font-semibold ${
                  selected ? "bg-trama-navy text-white" : "border border-[#E3E6EC] bg-white text-ink"
                }`}
              >
                {o.label}
              </button>
            );
          })}
          {generic && (
            <button
              type="button"
              onClick={() => setItemOther({ key: item.key, text: "" })}
              className="min-h-[38px] rounded-full border border-dashed border-[#C9CED8] bg-white px-3.5 text-[13px] font-semibold text-ink"
            >
              Altro…
            </button>
          )}
        </div>
        {itemOther?.key === item.key && generic && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const text = itemOther.text.trim();
              if (!text) return;
              setItemOther(null);
              setExpanded(null);
              void assign(item, { opt: generic, label: text });
            }}
          >
            <label className="sr-only" htmlFor={`altro-${item.key}`}>
              Chi se ne occupa
            </label>
            <input
              id={`altro-${item.key}`}
              value={itemOther.text}
              onChange={(e) => setItemOther({ key: item.key, text: e.target.value })}
              placeholder="Es. Zio Marco"
              className="min-h-[40px] flex-1 rounded-[12px] border border-[#E3E6EC] px-3 text-[14px]"
            />
            <button type="submit" className="min-h-[44px] rounded-[12px] bg-trama-primary px-4 text-[13px] font-bold text-white">
              Salva
            </button>
          </form>
        )}
        <div className="flex flex-wrap gap-x-4">
          {item.parts.some((p) => p.tripKey) && (
            <button
              type="button"
              onClick={() => {
                setSplitTrips((cur) => {
                  const next = new Set(cur);
                  for (const p of item.parts) if (p.tripKey) next.add(p.tripKey);
                  return next;
                });
                setExpanded(null);
              }}
              className="min-h-[32px] text-[12.5px] font-semibold text-trama-accent-ink"
              data-testid="busy-split-trip"
            >
              Due persone diverse?
            </button>
          )}
          {item.parts.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setSeparated((cur) => new Set(cur).add(item.signature));
                setExpanded(null);
              }}
              className="min-h-[32px] text-[12.5px] font-semibold text-trama-accent-ink"
              data-testid="busy-separate"
            >
              Persone diverse per {item.kidsLabel}?
            </button>
          )}
        </div>
      </div>
    );
  }

  function itemRow(item: BusyItem, decided: boolean) {
    const mine = person ? itemIsPerson(item, person) : false;
    return (
      <div key={item.key} className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => tap(item)}
          aria-expanded={!person ? expanded === item.key : undefined}
          className={`flex w-full items-center gap-2.5 rounded-[14px] border bg-white px-3 text-left ${
            decided ? "min-h-[52px] border-trama-line py-2" : "min-h-[64px] border-[#F0DDBD] py-2.5"
          }`}
          data-testid={decided ? "busy-done-row" : "busy-open-row"}
        >
          <span className={`w-[42px] flex-shrink-0 text-[13px] font-semibold tabular-nums ${decided ? "text-ink-2" : "text-ink"}`}>{item.time ?? ""}</span>
          {avatars(item)}
          <span className="flex min-w-0 flex-1 flex-col pl-1">
            <span className={`text-[14.5px] leading-snug text-ink ${decided ? "font-medium" : "font-semibold"}`}>{item.title}</span>
            <span className="text-[12.5px] leading-snug text-ink-2">
              {item.kidsLabel}
              {item.sub ? ` · ${item.sub}` : ""}
            </span>
          </span>
          {decided ? (
            <span
              className={`flex min-h-[30px] flex-shrink-0 items-center rounded-full px-2.5 text-[12.5px] font-semibold ${
                mine ? "bg-trama-navy text-white" : "border border-trama-line text-ink"
              }`}
            >
              {item.label}
            </span>
          ) : person ? (
            <span className="flex min-h-[30px] flex-shrink-0 items-center rounded-full bg-trama-accent-soft px-2.5 text-[12.5px] font-bold text-trama-accent-ink">
              + {personLabel(person)}
            </span>
          ) : (
            <span className="flex min-h-[30px] flex-shrink-0 items-center rounded-full bg-[#FFF3E0] px-2.5 text-[12.5px] font-bold text-[#7A4500]">
              da decidere
            </span>
          )}
        </button>
        {!person && expanded === item.key && inlineChoices(item)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" data-testid="passage-busy-day">
      {items.length === 0 && <p className="text-[13.5px] text-ink-2">Nessun passaggio da organizzare in questa giornata.</p>}

      {suggestion && (
        <div className="flex flex-col gap-2.5 rounded-2xl bg-trama-accent-soft p-3.5" data-testid="busy-same-weekday">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-trama-accent-ink" aria-hidden="true">
              <i className="ti ti-history text-[18px]" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[15px] font-bold text-trama-navy">{suggestion.title}</span>
              <span className="text-[13px] leading-snug text-ink-2">{suggestion.summary}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => void applySuggestion()}
            className="min-h-[44px] rounded-[12px] bg-trama-primary text-[14px] font-semibold text-white active:bg-trama-primary-press"
          >
            Usa {suggestion.count === 1 ? "questo passaggio" : `questi ${suggestion.count} passaggi`}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-trama-accent-ink">Chi se ne occupa?</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chi se ne occupa">
            {chips.map((o) => {
              // Confronto per valore: le opzioni si ricreano a ogni render del Planner.
              const selected = !!person && !person.label && person.opt.value === o.value && (person.opt.familyPersonId ?? null) === (o.familyPersonId ?? null);
              return (
                <button
                  key={`${o.value}-${o.familyPersonId ?? ""}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pickPerson(selected ? null : { opt: o })}
                  className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold ${
                    selected ? "bg-trama-navy text-white" : "border border-[#E3E6EC] bg-white text-ink"
                  }`}
                  data-testid="busy-person"
                >
                  {selected && <i className="ti ti-check text-[14px]" aria-hidden="true" />}
                  {o.label}
                </button>
              );
            })}
            {generic && (
              <button
                type="button"
                aria-pressed={!!person?.label}
                onClick={() => (person?.label ? pickPerson(null) : setPersonOther(""))}
                className={`min-h-[40px] rounded-full px-3.5 text-[14px] font-semibold ${
                  person?.label ? "bg-trama-navy text-white" : "border border-dashed border-[#C9CED8] bg-white text-ink"
                }`}
              >
                {person?.label ?? "Altro…"}
              </button>
            )}
          </div>
          {personOther !== null && generic && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = personOther.trim();
                if (!text) return;
                pickPerson({ opt: generic, label: text });
              }}
            >
              <label className="sr-only" htmlFor="busy-altro">
                Chi se ne occupa
              </label>
              <input
                id="busy-altro"
                value={personOther}
                onChange={(e) => setPersonOther(e.target.value)}
                placeholder="Es. Zio Marco"
                className="min-h-[40px] flex-1 rounded-[12px] border border-[#E3E6EC] px-3 text-[14px]"
              />
              <button type="submit" className="min-h-[44px] rounded-[12px] bg-trama-primary px-4 text-[13px] font-bold text-white">
                Scegli
              </button>
            </form>
          )}
          <span className={`text-[13px] ${nudge && !person ? "font-semibold text-[#7A4500]" : "text-ink-2"}`} aria-live="polite">
            {person
              ? `Tocca i passaggi di ${personLabel(person)}. Ritocca per togliere.`
              : nudge
                ? "Scegli qui chi lo fa, oppure una persona qui sopra e poi tocca i suoi passaggi."
                : "Scegli una persona, poi tocca i suoi passaggi."}
          </span>
        </div>
      )}

      {open.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#7A4500]">Da decidere · {open.length}</span>
          {open.map((i) => itemRow(i, false))}
        </div>
      )}
      {items.length > 0 && open.length === 0 && (
        <div className="flex items-center gap-2.5 rounded-[14px] bg-[#E8F6EF] px-3.5 py-3 text-[14.5px] font-semibold text-[#1F6B52]" data-testid="busy-all-done">
          <i className="ti ti-check text-[18px]" aria-hidden="true" />
          {weekdayIt(date).charAt(0).toUpperCase() + weekdayIt(date).slice(1)} è tutto deciso
        </div>
      )}

      {done.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowDone(!showDone)}
            aria-expanded={showDone}
            className="flex min-h-[44px] items-center justify-between"
            data-testid="busy-done-toggle"
          >
            <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-trama-accent-ink">Già decisi · {done.length}</span>
            <span className="text-[13px] font-semibold text-trama-accent-ink">{showDone ? "Nascondi" : "Mostra"}</span>
          </button>
          {showDone &&
            byPerson.map((g) => (
              <div key={g.label} className="flex flex-col gap-1.5">
                <span className="pt-1 text-[13px] font-semibold text-trama-navy">
                  {g.label} · {g.items.length === 1 ? "1 passaggio" : `${g.items.length} passaggi`}
                </span>
                {g.items.map((i) => itemRow(i, true))}
              </div>
            ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {person && (
          <span className="text-center text-[13px] font-semibold text-trama-navy" data-testid="busy-person-bar">
            {personLabel(person)}: {mineCount === 1 ? "1 passaggio" : `${mineCount} passaggi`}
          </span>
        )}
        <button
          type="button"
          onClick={onDone}
          className="min-h-[48px] rounded-[12px] bg-trama-primary text-[14px] font-bold text-white active:bg-trama-primary-press"
          data-testid="busy-done"
        >
          Fatto
        </button>
      </div>
    </div>
  );
}
