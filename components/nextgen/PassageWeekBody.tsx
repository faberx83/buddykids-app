"use client";

// TRAMA — "CHI FA COSA" DELLA SETTIMANA, IL BAMBINO AL CENTRO (28/10/2026
// sera, release "chi-accompagna-giornate-piene"). Fabrizio, dopo il deploy
// della v2 del foglio del giorno, sul foglio settimanale: "penso sia ancora
// vecchio". Era rimasto Porta / Ritira per giorno e "Uguale per tutta la
// settimana" con tutte le persone in fila.
// Col flag PASSAGE_PERSON_FIRST_ENABLED (e i passaggi accesi):
//   - in cima "Come la settimana scorsa": le scelte dello stesso giorno della
//     settimana prima, per tutti i giorni insieme, in un tocco;
//   - un riquadro per giorno: i figli, ognuno con la foto (o l'iniziale) e i
//     suoi passaggi in fila ("08:00 Tu · 13:40 Zia Carla · 19:00 Chi?");
//     toccando il giorno si apre il foglio del giorno (PassageBusyDayBody);
//   - via "Uguale per tutta la settimana": con i passaggi la ripetizione è
//     "Come la settimana scorsa" qui e "Anche gli altri mercoledì?" nel giorno.
// Logica: lib/nextgen/passage-busy-day.ts. Flag spento → WeekWhoSheet di prima.

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { KidAvatar, kidToneFor } from "@/components/nextgen/AgendaItemRow";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";
import { setPassageResponsibilitiesAction } from "@/app/actions/responsibilities";
import { notifyPartnerAssignmentsAction } from "@/app/actions/assign-notify";
import { isPartnerChoice, type AssignChange } from "@/lib/nextgen/assign-plus";
import { markFirstUsefulAction } from "@/lib/nextgen/first-action";
import type { PassageResponsibility, PassageTarget } from "@/lib/nextgen/passages";
import { buildKidDays, dayRowFor, personFromRow, personLabel, suggestionWrites, weekSameAsLast } from "@/lib/nextgen/passage-busy-day";
import type { ResponsibleOption, WeekResponsibility } from "@/lib/nextgen/responsibility-options";
import type { WeekDayModel } from "@/lib/nextgen/planner-week";

export default function PassageWeekBody({
  days,
  kids,
  kidOrder,
  options,
  rows,
  onRowsChange,
  onDayChange,
  labelFor,
  todayIso,
  plusEnabled,
  partnerOnTrama,
  onOpenDay,
  onClose,
}: {
  days: WeekDayModel[];
  kids: { id: string; name: string; avatarUrl?: string | null }[];
  kidOrder: string[];
  options: ResponsibleOption[];
  rows: PassageResponsibility[];
  onRowsChange: Dispatch<SetStateAction<PassageResponsibility[]>>;
  onDayChange: Dispatch<SetStateAction<WeekResponsibility[]>>;
  labelFor: (row: PassageResponsibility) => string;
  todayIso: string;
  plusEnabled: boolean;
  partnerOnTrama: boolean;
  onOpenDay: (dateIso: string) => void;
  onClose: () => void;
}) {
  const showToast = useNextgenToast();
  const [busy, setBusy] = useState(false);
  const partnerChanges = useRef<AssignChange[]>([]);
  const youLabel = options.find((o) => o.value === "io")?.label ?? "Tu";
  const photoOf = (kidId: string) => kids.find((k) => k.id === kidId)?.avatarUrl ?? null;

  const week = useMemo(
    () =>
      days
        .map((d) => ({
          day: d,
          kidDays: buildKidDays({
            kids,
            entries: d.entries,
            date: d.dateIso,
            rows,
            labelFor,
            dayChoiceFor: (kidId) => d.coordination.kids.find((k) => k.kidId === kidId),
          }),
        }))
        .filter((w) => w.kidDays.length > 0),
    [days, kids, rows, labelFor]
  );
  const openOf = (w: (typeof week)[number]) => w.kidDays.reduce((n, k) => n + k.items.filter((i) => i.label === null).length, 0);
  const openTotal = week.filter((w) => !w.day.isPast).reduce((n, w) => n + openOf(w), 0);
  const last = useMemo(
    () => weekSameAsLast({ days: week.map((w) => ({ date: w.day.dateIso, items: w.kidDays.flatMap((k) => k.items) })), todayIso, rows, labelFor }),
    [week, todayIso, rows, labelFor]
  );

  const sameRow = (r: PassageResponsibility, t: PassageTarget) =>
    r.kidId === t.kidId && r.date === t.date && r.passageKey === t.passageKey && r.moment === t.moment;

  async function applyLastWeek() {
    setBusy(true);
    let ok = 0;
    for (const { date, suggestion } of last.perDay) {
      for (const w of suggestionWrites(suggestion, date)) {
        const p = personFromRow(w.row, options);
        if (!p) continue;
        const before = rows;
        const label = p.opt.value === "altro" ? personLabel(p) : null;
        onRowsChange((cur) => [
          ...cur.filter((r) => !w.targets.some((t) => sameRow(r, t))),
          ...w.targets.map((t) => ({ ...t, responsible: p.opt.value, responsibleLabel: label, familyPersonId: p.opt.familyPersonId ?? null })),
        ]);
        const res = await setPassageResponsibilitiesAction({
          targets: w.targets,
          responsible: p.opt.value,
          responsibleLabel: personLabel(p),
          familyPersonId: p.opt.familyPersonId,
          mirror: w.mirror,
        }).catch(() => ({ error: "Non siamo riusciti a salvare, riprova." }));
        if (res.error) {
          onRowsChange(before);
          showToast(res.error);
          continue;
        }
        ok += w.targets.length;
        const add = w.mirror.flatMap((m) => {
          const d = dayRowFor(m.date);
          return d
            ? [
                {
                  kidId: m.kidId,
                  weekStartDate: d.weekStartDate,
                  weekday: d.weekday,
                  moment: m.moment,
                  responsible: p.opt.value,
                  responsibleLabel: label,
                  familyPersonId: p.opt.familyPersonId ?? null,
                },
              ]
            : [];
        });
        if (add.length > 0) {
          onDayChange((cur) => [
            ...cur.filter(
              (r) => !add.some((a) => a.kidId === r.kidId && a.weekStartDate === r.weekStartDate && a.weekday === r.weekday && a.moment === r.moment)
            ),
            ...add,
          ]);
        }
        if (plusEnabled && isPartnerChoice(p.opt.value)) {
          for (const t of w.targets) {
            partnerChanges.current.push({ dateIso: t.date, kidName: kids.find((k) => k.id === t.kidId)?.name ?? "", moment: t.moment, assigned: true });
          }
        }
      }
    }
    setBusy(false);
    if (ok > 0) {
      markFirstUsefulAction("chi_porta");
      showToast("Fatto: come la settimana scorsa");
    }
  }

  function finish() {
    const changes = partnerChanges.current;
    partnerChanges.current = [];
    if (plusEnabled && partnerOnTrama && changes.length > 0) void notifyPartnerAssignmentsAction(changes).catch(() => undefined);
    onClose();
  }

  return (
    <div className="flex flex-col gap-4" data-testid="passage-week">
      {week.length === 0 ? (
        <p className="text-[13.5px] text-ink-2">Nessun passaggio da organizzare in questa settimana.</p>
      ) : (
        <span className={`-mt-1 text-[14px] font-semibold ${openTotal === 0 ? "text-[#1F6B52]" : "text-[#7A4500]"}`} data-testid="week-status">
          {openTotal === 0 ? "Tutto deciso" : openTotal === 1 ? "1 da decidere" : `${openTotal} da decidere`}
        </span>
      )}

      {last.count > 0 && (
        <div className="flex items-center gap-2.5 rounded-[14px] bg-trama-accent-soft px-3 py-2.5" data-testid="week-same-as-last">
          <i className="ti ti-history flex-shrink-0 text-[18px] text-trama-accent-ink" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-[13px] leading-snug text-trama-navy">
            <b>Come la settimana scorsa</b>: {last.count === 1 ? "1 passaggio" : `${last.count} passaggi`} in{" "}
            {last.perDay.length === 1 ? "1 giorno" : `${last.perDay.length} giorni`}
          </span>
          <button
            type="button"
            onClick={() => void applyLastWeek()}
            disabled={busy}
            className="min-h-[36px] flex-shrink-0 rounded-[10px] bg-trama-primary px-3.5 text-[13.5px] font-semibold text-white active:bg-trama-primary-press disabled:opacity-60"
          >
            {busy ? "…" : "Usa"}
          </button>
        </div>
      )}

      {week.map((w) => {
        const open = openOf(w);
        return (
          <button
            key={w.day.dateIso}
            type="button"
            disabled={w.day.isPast}
            onClick={() => onOpenDay(w.day.dateIso)}
            className="flex flex-col gap-2.5 rounded-2xl border border-trama-line bg-white px-3.5 py-3 text-left disabled:opacity-55"
            data-testid="week-day"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-bold text-trama-navy">{w.day.label}</span>
              {!w.day.isPast &&
                (open > 0 ? (
                  <span className="text-[12.5px] font-semibold text-[#7A4500]">{open} da decidere</span>
                ) : (
                  <span className="flex items-center gap-1 text-[12.5px] font-semibold text-[#1F6B52]">
                    <i className="ti ti-check" aria-hidden="true" />
                    deciso
                  </span>
                ))}
            </span>
            {w.kidDays.map(({ kid, items }) => (
              <span key={kid.id} className="flex items-start gap-2.5">
                <KidAvatar name={kid.name} tone={kidToneFor(kid.id, kidOrder)} size={28} photoUrl={photoOf(kid.id)} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[13.5px] font-semibold text-ink">{kid.name}</span>
                  <span className="flex flex-wrap gap-1">
                    {items.map((i) => (
                      <span
                        key={i.key}
                        className={`flex min-h-[26px] items-center gap-1 rounded-full px-2 text-[12.5px] ${
                          i.label === null
                            ? "bg-[#FFF3E0] font-bold text-[#7A4500]"
                            : i.label === youLabel
                              ? "bg-trama-navy font-semibold text-white"
                              : "border border-[#E3E6EC] font-semibold text-ink"
                        }`}
                      >
                        <span className="tabular-nums opacity-80">{i.time ?? ""}</span>
                        {i.label ?? "Chi?"}
                      </span>
                    ))}
                  </span>
                </span>
              </span>
            ))}
          </button>
        );
      })}

      <button
        type="button"
        onClick={finish}
        className="min-h-[48px] rounded-[12px] bg-trama-primary text-[14px] font-bold text-white active:bg-trama-primary-press"
      >
        Fatto
      </button>
    </div>
  );
}
