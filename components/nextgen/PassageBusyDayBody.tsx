"use client";

// TRAMA — CHI ACCOMPAGNA NELLE GIORNATE PIENE (28/10/2026, release
// "chi-accompagna-giornate-piene"). Fabrizio: "in una giornata con più
// impegni è un casino, troppi click non si capisce".
//
// v2 (28/10 pomeriggio), dopo la prova in app della prima versione ("il focus
// è sull'accompagnatore o sul bambino? … rimane difficile capire 'mamma' di
// chi deve occuparsi. Proverei a sintetizzare e semplificare ancora"); mock
// v2 approvato ("si ok tutto"):
//   - Per bambino (vista di partenza): una scheda per figlio con la sua
//     giornata in fila; a destra chi lo fa, o "Chi?" se manca; i tuoi in blu;
//   - "Chi?" apre la domanda scritta per intero ("Chi prende Lino all'uscita
//     da scuola?"): in alto chi lo fa di solito, poi le 3 persone più usate,
//     il resto in "Altre persone"; un tocco sceglie e chiude; "Anche
//     Franchidea" se il fratello ha lo stesso passaggio alla stessa ora;
//   - Per persona: a frasi ("Tu: 08:30 porti Lino a scuola");
//   - "Come mercoledì scorso" su una riga; a "Fatto" una sola domanda
//     "Anche gli altri mercoledì?", una spunta per figlio e passaggio.
// Logica: lib/nextgen/passage-busy-day.ts (sopra lib/nextgen/passages.ts).
// Salvataggio: le stesse azioni di PassageAssignBody (app/actions/responsibilities.ts).
// Flag spento → PassageAssignBody, come prima.

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { KidAvatar, kidToneFor } from "@/components/nextgen/AgendaItemRow";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import { clearPassageResponsibilitiesAction, setPassageResponsibilitiesAction } from "@/app/actions/responsibilities";
import { notifyPartnerAssignmentsAction } from "@/app/actions/assign-notify";
import { isPartnerChoice, type AssignChange } from "@/lib/nextgen/assign-plus";
import { markFirstUsefulAction } from "@/lib/nextgen/first-action";
import { applyAllTargets, otherDatesOfPassage, type PassageResponsibility, type PassageTarget } from "@/lib/nextgen/passages";
import {
  buildKidDays,
  chosenKey,
  dayRowFor,
  itemIsPerson,
  kidItemTitle,
  otherWeekdaysIt,
  pendingTargets,
  personLabel,
  personSentence,
  personView,
  sameWeekdayDates,
  sameWeekdaySuggestion,
  shortDateIt,
  siblingTwins,
  suggestionWrites,
  targetsOf,
  topPeople,
  usualPersonFor,
  weekdayIt,
  whoQuestion,
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

const partTitle = (part: BusyPart) => kidItemTitle({ parts: [part] } as unknown as BusyItem);

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
  kids: { id: string; name: string; avatarUrl?: string | null }[];
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
  const [view, setView] = useState<"kid" | "person">("kid");
  const [ask, setAsk] = useState<string | null>(null);
  const [withTwins, setWithTwins] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [otherText, setOtherText] = useState<string | null>(null);
  const [splitTrips, setSplitTrips] = useState<Set<string>>(() => new Set());
  const [suggestionUsed, setSuggestionUsed] = useState(false);
  const [stage, setStage] = useState<"edit" | "repeat">("edit");
  const [repeat, setRepeat] = useState<{ list: RepeatCandidate[]; checked: Set<string> } | null>(null);
  const [applying, setApplying] = useState(false);
  const session = useRef<Record<string, SessionChoice>>({});
  const partnerChanges = useRef<AssignChange[]>([]);
  const seqRef = useRef<Record<string, number>>({});

  const generic = options.find((o) => o.value === "altro" && !o.familyPersonId) ?? null;
  const youLabel = options.find((o) => o.value === "io")?.label ?? "Tu";
  const photoOf = (kidId: string) => kids.find((k) => k.id === kidId)?.avatarUrl ?? null;

  const kidDays = useMemo(
    () =>
      buildKidDays({
        kids,
        entries: day.entries,
        date,
        rows,
        labelFor,
        dayChoiceFor: (kidId) => day.coordination.kids.find((k) => k.kidId === kidId),
        splitTrips,
      }),
    [kids, day, date, rows, labelFor, splitTrips]
  );
  const items = useMemo(() => kidDays.flatMap((k) => k.items), [kidDays]);
  const openCount = items.filter((i) => i.label === null).length;
  const suggestion = useMemo(
    () => (suggestionUsed ? null : sameWeekdaySuggestion({ date, items, rows, labelFor })),
    [suggestionUsed, date, items, rows, labelFor]
  );
  const asked = ask ? (items.find((i) => i.key === ask) ?? null) : null;

  useEffect(() => {
    if (!ask) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAsk(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ask]);

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

  /** Affida (o toglie, con p = null) i passaggi di una o più righe (la riga e i fratelli "anche"). */
  async function assign(list: BusyItem[], p: ChosenPerson | null) {
    const key = list.map((i) => i.key).join("+");
    const seq = (seqRef.current[key] ?? 0) + 1;
    seqRef.current[key] = seq;
    const parts = list.flatMap((i) => i.parts);
    const { targets, mirror } = targetsOf(parts, date);
    const beforeRows = rows;
    const beforeDay = responsibilities;
    onRowsChange((cur) => [...cur.filter((r) => !targets.some((t) => sameRow(r, t))), ...(p ? rowsFor(targets, p) : [])]);
    applyDayMirror(mirror, p);
    if (plusEnabled) {
      for (const part of parts) {
        for (const l of part.legs) {
          const was = l.row?.responsible ?? null;
          if (isPartnerChoice(was ?? undefined) !== isPartnerChoice(p?.opt.value)) {
            partnerChanges.current.push({ dateIso: date, kidName: part.kidName, moment: l.moment, assigned: isPartnerChoice(p?.opt.value) });
          }
        }
      }
    }
    for (const part of parts) {
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
    if (seqRef.current[key] !== seq) return;
    if (res.error) {
      onRowsChange(beforeRows);
      onDayChange(beforeDay);
      showToast(res.error);
      return;
    }
    if (p) markFirstUsefulAction("chi_porta");
  }

  function openAsk(item: BusyItem) {
    setAsk(item.key);
    setWithTwins(true);
    setShowMore(false);
    setOtherText(null);
  }

  function pick(item: BusyItem, twins: BusyItem[], p: ChosenPerson | null) {
    setAsk(null);
    void assign(withTwins ? [item, ...twins] : [item], p);
  }

  async function applySuggestion() {
    if (!suggestion) return;
    setSuggestionUsed(true);
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
        title: partTitle(c.part),
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
          <span className={`text-[12px] font-bold uppercase tracking-[0.08em] ${openCount === 0 ? "text-[#1F6B52]" : "text-[#7A4500]"}`}>
            {weekdayIt(date)} {openCount === 0 ? "· tutto deciso" : `· ${openCount} da decidere`}
          </span>
          <h3 className="font-poppins text-[19px] font-semibold leading-tight text-trama-navy">Anche {otherWeekdaysIt(date)}?</h3>
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

  // ─── Fase 1 ───────────────────────────────────────────────────────────
  function whoChip(item: BusyItem) {
    if (item.label === null) {
      return (
        <span className="flex min-h-[30px] flex-shrink-0 items-center rounded-full bg-[#FFF3E0] px-3 text-[13px] font-bold text-[#7A4500]">Chi?</span>
      );
    }
    const mine = item.label === youLabel;
    return (
      <span
        className={`flex min-h-[30px] max-w-[45%] flex-shrink-0 items-center truncate rounded-full px-2.5 text-[13px] font-semibold ${
          mine ? "bg-trama-navy text-white" : "border border-[#E3E6EC] text-ink"
        }`}
      >
        {item.label}
      </span>
    );
  }

  const persons = personView(kidDays, youLabel);

  return (
    <div className="flex flex-col gap-4" data-testid="passage-busy-day">
      {items.length === 0 ? (
        <p className="text-[13.5px] text-ink-2">Nessun passaggio da organizzare in questa giornata.</p>
      ) : (
        <>
          <span className={`-mt-1 text-[14px] font-semibold ${openCount === 0 ? "text-[#1F6B52]" : "text-[#7A4500]"}`} data-testid="busy-status">
            {openCount === 0 ? "Tutto deciso" : openCount === 1 ? "1 da decidere" : `${openCount} da decidere`}
          </span>

          <div role="tablist" aria-label="Vista" className="grid grid-cols-2 gap-1 rounded-[12px] bg-[#F1F0EC] p-1">
            {(
              [
                ["kid", "Per bambino"],
                ["person", "Per persona"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`min-h-[38px] rounded-[9px] text-[14px] font-semibold ${
                  view === v ? "bg-white text-trama-navy shadow-[0_1px_2px_rgba(23,42,77,0.12)]" : "text-ink-2"
                }`}
                data-testid={`busy-view-${v}`}
              >
                {label}
              </button>
            ))}
          </div>

          {suggestion && (
            <div className="flex items-center gap-2.5 rounded-[14px] bg-trama-accent-soft px-3 py-2.5" data-testid="busy-same-weekday">
              <i className="ti ti-history flex-shrink-0 text-[18px] text-trama-accent-ink" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-[13px] leading-snug text-trama-navy">
                <b>{suggestion.title}</b>: {suggestion.summary}
              </span>
              <button
                type="button"
                onClick={() => void applySuggestion()}
                className="min-h-[36px] flex-shrink-0 rounded-[10px] bg-trama-primary px-3.5 text-[13.5px] font-semibold text-white active:bg-trama-primary-press"
                aria-label={`${suggestion.title}: usa ${suggestion.count === 1 ? "questo passaggio" : `questi ${suggestion.count} passaggi`}`}
              >
                Usa
              </button>
            </div>
          )}

          {view === "kid" &&
            kidDays.map(({ kid, items: mine }) => {
              const missing = mine.filter((i) => i.label === null).length;
              return (
                <section
                  key={kid.id}
                  aria-labelledby={`busy-kid-${kid.id}`}
                  className="flex flex-col overflow-hidden rounded-2xl border border-trama-line bg-white"
                  data-testid="busy-kid"
                >
                  <div className="flex items-center gap-2.5 px-3.5 pb-2 pt-3">
                    <KidAvatar name={kid.name} tone={kidToneFor(kid.id, kidOrder)} size={30} photoUrl={photoOf(kid.id)} />
                    <h3 id={`busy-kid-${kid.id}`} className="min-w-0 flex-1 truncate text-[16px] font-bold text-trama-navy">
                      {kid.name}
                    </h3>
                    {missing > 0 ? (
                      <span className="text-[12.5px] font-semibold text-[#7A4500]">{missing} da decidere</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[12.5px] font-semibold text-[#1F6B52]">
                        <i className="ti ti-check" aria-hidden="true" />
                        deciso
                      </span>
                    )}
                  </div>
                  {mine.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => openAsk(item)}
                      className={`flex min-h-[56px] items-center gap-2.5 border-t border-[#F0EEE8] px-3.5 py-2 text-left ${
                        item.label === null ? "bg-[#FFFBF5]" : "bg-white"
                      }`}
                      data-testid={item.label === null ? "busy-open-row" : "busy-done-row"}
                    >
                      <span className={`w-[42px] flex-shrink-0 text-[13px] font-semibold tabular-nums ${item.label === null ? "text-ink" : "text-ink-2"}`}>
                        {item.time ?? ""}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[14.5px] font-semibold leading-snug text-ink">{kidItemTitle(item)}</span>
                        {item.sub && <span className="truncate text-[12.5px] leading-snug text-ink-2">{item.sub}</span>}
                      </span>
                      {whoChip(item)}
                    </button>
                  ))}
                </section>
              );
            })}

          {view === "person" && (
            <>
              {persons.groups.map((g) => (
                <section
                  key={g.label}
                  className={`flex flex-col gap-1 rounded-2xl bg-white p-3.5 ${g.you ? "border-2 border-trama-navy" : "border border-trama-line"}`}
                  data-testid="busy-person-group"
                >
                  <h3 className="pb-1 text-[16px] font-bold text-trama-navy">{g.label}</h3>
                  {g.items.map((item) => (
                    <button key={item.key} type="button" onClick={() => openAsk(item)} className="flex min-h-[40px] items-baseline gap-2 text-left">
                      <span className="w-[46px] flex-shrink-0 text-[14px] font-bold tabular-nums text-ink">{item.time ?? ""}</span>
                      <span className="text-[15px] leading-snug text-ink">{personSentence(item, g.you)}</span>
                    </button>
                  ))}
                </section>
              ))}
              {persons.open.length > 0 && (
                <section className="flex flex-col gap-1 rounded-2xl border border-[#F0DDBD] bg-[#FFFBF5] p-3.5">
                  <h3 className="pb-1 text-[16px] font-bold text-[#7A4500]">Da decidere</h3>
                  {persons.open.map((item) => (
                    <button key={item.key} type="button" onClick={() => openAsk(item)} className="flex min-h-[44px] items-center gap-2 text-left">
                      <span className="w-[46px] flex-shrink-0 text-[14px] font-bold tabular-nums text-ink">{item.time ?? ""}</span>
                      <span className="min-w-0 flex-1 text-[15px] leading-snug text-ink">
                        {item.kidsLabel}: {kidItemTitle(item).toLowerCase()}
                      </span>
                      {whoChip(item)}
                    </button>
                  ))}
                </section>
              )}
            </>
          )}
        </>
      )}

      <button
        type="button"
        onClick={onDone}
        className="min-h-[48px] rounded-[12px] bg-trama-primary text-[14px] font-bold text-white active:bg-trama-primary-press"
        data-testid="busy-done"
      >
        Fatto
      </button>

      {asked && whoPicker()}
    </div>
  );

  // Il foglietto "Chi …?": una funzione che restituisce JSX, chiamata e non
  // montata come componente (definita qui dentro si ricreerebbe a ogni tasto
  // e il campo "Altro…" perderebbe il focus).
  function whoPicker() {
    if (!asked) return null;
    const item = asked;
    const twins = siblingTwins(item, kidDays);
    const usual = usualPersonFor({ item, date, rows, options });
    const current = options
      .map((o) => ({ opt: o }) as ChosenPerson)
      .find((p) => itemIsPerson(item, p));
    const top = topPeople({ rows, options, exclude: usual ? [chosenKey(usual)] : [], n: 3 });
    const shown = new Set([...(usual ? [chosenKey(usual)] : []), ...top.map(chosenKey)]);
    const more = options.filter((o) => !(o.value === "altro" && !o.familyPersonId)).map((o) => ({ opt: o }) as ChosenPerson).filter((p) => !shown.has(chosenKey(p)));
    const isCurrent = (p: ChosenPerson) => itemIsPerson(item, p);
    const legs = item.parts[0].legs;
    const choiceBtn = (p: ChosenPerson, big = false) => {
      const sel = isCurrent(p);
      return (
        <button
          key={chosenKey(p)}
          type="button"
          aria-pressed={sel}
          onClick={() => pick(item, twins, p)}
          className={`flex items-center justify-center gap-1.5 rounded-[12px] px-2 font-semibold ${
            big ? "min-h-[52px] text-[16px]" : "min-h-[48px] text-[15px]"
          } ${sel || big ? "bg-trama-navy text-white" : "border border-[#E3E6EC] bg-white text-ink"}`}
          data-testid={big ? "busy-who-usual" : "busy-who"}
        >
          {sel && <i className="ti ti-check text-[15px]" aria-hidden="true" />}
          <span className="truncate">{personLabel(p)}</span>
        </button>
      );
    };
    return (
      <div className="fixed inset-0 z-[70] flex flex-col justify-end" role="presentation" data-testid="busy-who-sheet">
        <button type="button" aria-label="Chiudi" onClick={() => setAsk(null)} className="absolute inset-0 bg-[rgba(23,42,77,0.45)]" />
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="busy-who-title"
          className="relative mx-auto flex max-h-[88%] w-full max-w-[560px] flex-col gap-4 overflow-y-auto rounded-t-3xl bg-trama-page px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-8px_30px_rgba(23,42,77,0.2)]"
        >
          <div className="flex items-start gap-3">
            <KidAvatar name={item.parts[0].kidName} tone={kidToneFor(item.kidIds[0], kidOrder)} size={36} photoUrl={photoOf(item.kidIds[0])} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h3 id="busy-who-title" className="font-poppins text-[19px] font-semibold leading-tight text-trama-navy">
                {whoQuestion(item)}
              </h3>
              <span className="text-[13.5px] text-ink-2">
                {weekdayIt(date)} · {item.time ?? "in giornata"}
                {legs.length === 1 && item.sub ? ` · ${item.sub}` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAsk(null)}
              aria-label="Chiudi"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F1F3F6] text-trama-navy"
            >
              <i className="ti ti-x text-[18px]" aria-hidden="true" />
            </button>
          </div>

          {usual && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-trama-accent-ink">Di solito il {weekdayIt(date)}</span>
              {choiceBtn(usual, true)}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {usual && <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-2">Oppure</span>}
            <div className="grid grid-cols-3 gap-2">{top.map((p) => choiceBtn(p))}</div>
            {(more.length > 0 || generic) && (
              <button
                type="button"
                aria-expanded={showMore}
                onClick={() => setShowMore((v) => !v)}
                className="flex min-h-[44px] items-center justify-between text-[14px] font-semibold text-trama-accent-ink"
              >
                <span className="truncate">
                  Altre persone
                  {!showMore && more.length > 0
                    ? ` · ${more
                        .slice(0, 2)
                        .map(personLabel)
                        .join(", ")}${more.length > 2 ? ` e altri ${more.length - 2}` : ""}`
                    : ""}
                </span>
                <i className={`ti ${showMore ? "ti-chevron-up" : "ti-chevron-down"} text-[18px]`} aria-hidden="true" />
              </button>
            )}
            {showMore && (
              <div className="grid grid-cols-3 gap-2">
                {more.map((p) => choiceBtn(p))}
                {generic && (
                  <button
                    type="button"
                    onClick={() => setOtherText("")}
                    className="min-h-[48px] rounded-[12px] border border-dashed border-[#C9CED8] bg-white text-[15px] font-semibold text-ink"
                  >
                    Altro…
                  </button>
                )}
              </div>
            )}
            {otherText !== null && generic && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = otherText.trim();
                  if (!text) return;
                  pick(item, twins, { opt: generic, label: text });
                }}
              >
                <label className="sr-only" htmlFor="busy-altro">
                  Chi se ne occupa
                </label>
                <input
                  id="busy-altro"
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder="Es. Zio Marco"
                  className="min-h-[44px] flex-1 rounded-[12px] border border-[#E3E6EC] px-3 text-[15px]"
                />
                <button type="submit" className="min-h-[44px] rounded-[12px] bg-trama-primary px-4 text-[14px] font-bold text-white">
                  Salva
                </button>
              </form>
            )}
          </div>

          {twins.length > 0 && (
            <label className="flex min-h-[48px] items-center gap-3 rounded-[14px] border border-trama-line bg-white px-3">
              <input
                type="checkbox"
                checked={withTwins}
                onChange={(e) => setWithTwins(e.target.checked)}
                className="h-[22px] w-[22px] flex-shrink-0 accent-trama-navy"
                data-testid="busy-who-twins"
              />
              <span className="text-[14.5px] text-ink">
                Anche <b>{twins.map((t) => t.kidsLabel).join(" e ")}</b> (stessa ora)
              </span>
            </label>
          )}

          <div className="flex flex-wrap gap-x-5">
            {item.parts[0].tripKey && (
              <button
                type="button"
                onClick={() => {
                  const k = item.parts[0].tripKey!;
                  setSplitTrips((cur) => new Set(cur).add(k));
                  setAsk(null);
                }}
                className="min-h-[40px] text-[13.5px] font-semibold text-trama-accent-ink"
                data-testid="busy-split-trip"
              >
                Due persone diverse?
              </button>
            )}
            {(current || item.label !== null) && (
              <button type="button" onClick={() => pick(item, [], null)} className="min-h-[40px] text-[13.5px] font-semibold text-ink-2">
                Togli la scelta
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }
}
