"use client";

// TRAMA — CHI ACCOMPAGNA DOVE SI TOCCA (29/10/2026, release
// "chi-accompagna-giornate-piene"). Fabrizio: "non è possibile far aprire la
// scheda nel contesto di dove viene cliccata? oggi ricarica la pagina e
// finisce nel planner..ha senso?".
// Montato una volta nel layout delle famiglie: quando un link al foglio
// (Home "Assegna", il +, il buongiorno) chiama openChiAccompagna(), il foglio
// "Chi fa cosa" (settimana) o "Chi accompagna" (giorno) si apre QUI, sopra la
// pagina; chiudendo si resta dove si era (la pagina si aggiorna).
// Stessi fogli del Planner (PassageWeekBody, PassageBusyDayBody) e stessi
// dati (app/actions/chi-accompagna.ts → loadPlannerV2Props). Release spenta
// o errore → si segue il link al Planner, come prima.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PassageBusyDayBody from "@/components/nextgen/PassageBusyDayBody";
import PassageWeekBody from "@/components/nextgen/PassageWeekBody";
import { loadChiAccompagnaAction, type ChiAccompagnaContext } from "@/app/actions/chi-accompagna";
import { CHI_EVENT, mondayOf, setChiOverlayMounted, type ChiTarget } from "@/lib/nextgen/chi-accompagna-open";
import { buildTodayAgenda } from "@/lib/nextgen/today-agenda";
import { buildWeekModel } from "@/lib/nextgen/planner-week";
import { resolveResponsibleDisplay, resolveResponsibleOptions, type WeekResponsibility } from "@/lib/nextgen/responsibility-options";
import type { PassageResponsibility } from "@/lib/nextgen/passages";

export default function ChiAccompagnaOverlay() {
  const router = useRouter();
  const [open, setOpen] = useState<{ target: ChiTarget; href: string; fromWeek: boolean } | null>(null);
  const [ctx, setCtx] = useState<ChiAccompagnaContext | null>(null);
  const [rows, setRows] = useState<PassageResponsibility[]>([]);
  const [resp, setResp] = useState<WeekResponsibility[]>([]);

  useEffect(() => {
    setChiOverlayMounted(true);
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ target: ChiTarget; href: string }>).detail;
      if (!detail) return;
      setOpen({ target: detail.target, href: detail.href, fromWeek: false });
      setCtx(null);
      void loadChiAccompagnaAction()
        .catch(() => ({ fallback: true as const }))
        .then((res) => {
          if (res.fallback) {
            setOpen(null);
            router.push(detail.href);
            return;
          }
          setCtx(res.context);
          setRows(res.context.passageResponsibilities ?? []);
          setResp(res.context.responsibilities);
        });
    }
    window.addEventListener(CHI_EVENT, onOpen);
    return () => {
      setChiOverlayMounted(false);
      window.removeEventListener(CHI_EVENT, onOpen);
    };
  }, [router]);

  const close = useCallback(() => {
    setOpen(null);
    setCtx(null);
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Stesse regole del Planner (app/nextgen/planner/PlannerV2Client.tsx): impegni, etichette, settimana.
  const parentRole = ctx?.parentRole ?? null;
  const kidNameById = useMemo(() => Object.fromEntries((ctx?.kids ?? []).map((k) => [k.id, k.name])), [ctx]);
  const kids = useMemo(() => (ctx?.kids ?? []).map((k) => ({ id: k.id, name: k.name, avatarUrl: k.avatarUrl ?? null })), [ctx]);
  const kidOrder = useMemo(() => kids.map((k) => k.id), [kids]);
  const agendaExternal = useMemo(
    () =>
      (ctx?.externalItems ?? []).map((i) => ({
        id: i.id,
        title: i.title,
        startDate: i.startDate,
        endDate: i.endDate,
        allDay: i.allDay,
        startTime: i.startTime,
        endTime: i.endTime,
        location: i.location,
        sourceType: i.sourceType,
        kidIds: i.kidIds,
        recurrence: i.recurrence ?? null,
        isSchool: i.isSchool ?? false,
      })),
    [ctx]
  );
  const labelFor = useCallback((r: WeekResponsibility) => resolveResponsibleDisplay(r, parentRole).label, [parentRole]);
  const passageLabelFor = useCallback((r: PassageResponsibility) => resolveResponsibleDisplay(r, parentRole).label, [parentRole]);
  const options = useMemo(() => resolveResponsibleOptions(parentRole, ctx?.familyPeople ?? []), [parentRole, ctx]);
  const agendaFor = useCallback(
    (dateIso: string) =>
      buildTodayAgenda({
        todayIso: dateIso,
        bookings: ctx?.bookings ?? [],
        externalItems: agendaExternal,
        hoursByActivityDbId: ctx?.hoursByActivityDbId ?? {},
        kidNameById,
        schoolClosedDates: ctx?.schoolClosedDates ?? [],
      }),
    [ctx, agendaExternal, kidNameById]
  );
  const rangeFor = useCallback(
    (passageKey: string) => {
      if (passageKey === "school") {
        const school = agendaExternal.filter((i) => i.isSchool);
        if (school.length === 0) return null;
        return { startDate: school.map((i) => i.startDate).sort()[0], endDate: school.map((i) => i.endDate).sort()[school.length - 1] };
      }
      if (passageKey.startsWith("external:")) {
        const item = agendaExternal.find((i) => `external:${i.id}` === passageKey);
        return item ? { startDate: item.startDate, endDate: item.endDate } : null;
      }
      const b = (ctx?.bookings ?? []).find((x) => `booking:${x.id}` === passageKey);
      if (!b) return null;
      const dates = [...b.dayDates, ...b.weeks.flatMap((w) => [w.startDate, w.endDate])].sort();
      return dates.length > 0 ? { startDate: dates[0], endDate: dates[dates.length - 1] } : null;
    },
    [agendaExternal, ctx]
  );

  const todayIso = ctx?.todayIso ?? "";
  const monday = !open || !ctx ? null : open.target.kind === "day" ? mondayOf(open.target.date) : (open.target.monday ?? mondayOf(todayIso));
  const week = useMemo(
    () =>
      ctx && monday
        ? buildWeekModel({
            mondayIso: monday,
            todayIso,
            bookings: ctx.bookings,
            externalItems: agendaExternal,
            hoursByActivityDbId: ctx.hoursByActivityDbId,
            kidNameById,
            responsibilities: resp,
            labelFor,
            kidFilter: null,
            closureLabelsByDate: ctx.closureLabelsByDate,
            schoolClosedDates: ctx.schoolClosedDates,
          })
        : null,
    [ctx, monday, todayIso, agendaExternal, kidNameById, resp, labelFor]
  );

  if (!open) return null;
  const day = open.target.kind === "day" && week ? (week.days.find((d) => d.dateIso === (open.target as { date: string }).date) ?? null) : null;
  const title = open.target.kind === "week" ? `Chi fa cosa${week ? ` · ${week.label}` : ""}` : `Chi accompagna${day ? ` · ${day.label}` : ""}`;

  return (
    <div data-nav-v2 className="absolute inset-0 z-[55] flex flex-col justify-end" role="presentation" data-testid="chi-overlay">
      <button type="button" aria-label="Chiudi" onClick={close} className="absolute inset-0 bg-[rgba(23,42,77,0.45)]" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex h-[88%] flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(23,42,77,0.18)]"
      >
        <div className="flex items-center gap-2 px-5 pb-2 pt-3">
          {open.fromWeek && open.target.kind === "day" && (
            <button
              type="button"
              onClick={() => setOpen({ ...open, target: { kind: "week", monday: mondayOf(open.target.kind === "day" ? open.target.date : todayIso) }, fromWeek: false })}
              aria-label="Torna alla settimana"
              className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-trama-navy"
            >
              <i className="ti ti-chevron-left text-[20px]" aria-hidden="true" />
            </button>
          )}
          <h2 className="flex-1 font-poppins text-[18px] font-semibold text-ink">{title}</h2>
          <button type="button" onClick={close} aria-label="Chiudi" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F1F3F6] text-trama-navy">
            <i className="ti ti-x text-[18px]" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {!ctx || !week ? (
            <div className="flex flex-col gap-3 pt-2" aria-busy="true">
              <span className="text-[14px] text-ink-2">Un attimo…</span>
              <span className="h-[120px] animate-pulse rounded-2xl bg-[#F1F0EC]" />
              <span className="h-[120px] animate-pulse rounded-2xl bg-[#F1F0EC]" />
            </div>
          ) : open.target.kind === "week" ? (
            <PassageWeekBody
              days={week.days}
              kids={kids}
              kidOrder={kidOrder}
              options={options}
              rows={rows}
              onRowsChange={setRows}
              onDayChange={setResp}
              labelFor={passageLabelFor}
              todayIso={todayIso}
              plusEnabled={ctx.assignPlusEnabled ?? false}
              partnerOnTrama={ctx.partnerOnTrama ?? false}
              onOpenDay={(dateIso) => setOpen({ ...open, target: { kind: "day", date: dateIso }, fromWeek: true })}
              onClose={close}
            />
          ) : day ? (
            <PassageBusyDayBody
              day={day}
              kids={kids}
              kidOrder={kidOrder}
              options={options}
              rows={rows}
              onRowsChange={setRows}
              responsibilities={resp}
              onDayChange={setResp}
              labelFor={passageLabelFor}
              todayIso={todayIso}
              agendaFor={agendaFor}
              rangeFor={rangeFor}
              plusEnabled={ctx.assignPlusEnabled ?? false}
              partnerOnTrama={ctx.partnerOnTrama ?? false}
              onClose={open.fromWeek ? () => setOpen({ ...open, target: { kind: "week", monday }, fromWeek: false }) : close}
            />
          ) : (
            <p className="pt-2 text-[14px] text-ink-2">Nessun passaggio da organizzare in questa giornata.</p>
          )}
        </div>
      </section>
    </div>
  );
}
