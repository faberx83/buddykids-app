"use client";

// TRAMA — PLANNER, UN GIORNO ALLA VOLTA (21/10/2026, release "planner-giorno").
// La giornata aperta nella vista Settimana: per ogni figlio una catena di
// passaggi (entra a scuola → esce → attività → ritiro) con chi accompagna
// attaccato al passaggio; tocco su un passaggio = foglio "Chi accompagna"
// esistente (AssignSheet). Sotto, l'anteprima del giorno dopo.
// Logica: lib/nextgen/planner-day.ts.

import { buildKidDayChains, dayTeaser, type DayStep, type KidDayChain } from "@/lib/nextgen/planner-day";
import type { WeekDayModel } from "@/lib/nextgen/planner-week";
import { KidAvatar, kidToneFor } from "@/components/nextgen/AgendaItemRow";

const KID_DOTS = ["#6F63C5", "#F6A623", "#2DBA8C", "#4DAFEF"];

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function PlannerDayFocus({
  day,
  nextDay,
  kids,
  kidOrder,
  todayIso,
  onAssign,
  onSelect,
}: {
  day: WeekDayModel;
  nextDay: WeekDayModel | null;
  /** Figli da mostrare (rispetta il filtro). */
  kids: { id: string; name: string }[];
  kidOrder: string[];
  todayIso: string;
  onAssign: () => void;
  onSelect: (dateIso: string) => void;
}) {
  const chains = buildKidDayChains(day, kids);
  const busy = chains.filter((c) => c.steps.length > 0);
  const idle = chains.filter((c) => c.steps.length === 0);
  const canAssign = !day.isPast;

  return (
    <section aria-label={day.isToday ? `${day.label}, oggi` : day.label} className={`flex flex-col gap-3 ${day.isPast ? "opacity-70" : ""}`} data-testid="planner-day-focus">
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        <h2 className="font-poppins text-[19px] font-semibold text-ink">{day.label}</h2>
        {day.isToday && <span className="rounded-full bg-trama-primary px-2 py-0.5 text-[11px] font-bold text-white">Oggi</span>}
        {day.closureLabels.length > 0 && (
          <span className="rounded-full bg-[#F6F4EF] px-2 py-0.5 text-[11px] font-semibold text-[#4B5563]">
            <i className="ti ti-school mr-1 text-[12px]" aria-hidden="true" />
            Scuola chiusa
          </span>
        )}
      </div>

      {busy.length === 0 && (
        <p className="rounded-2xl border border-trama-line bg-white px-4 py-3.5 text-[14px] text-ink-2" data-testid="day-free">
          {day.closureLabels.length > 0 ? "Scuola chiusa e niente in programma." : "Giornata libera."}
        </p>
      )}

      {busy.map((c) => (
        <KidChainCard key={c.kidId} chain={c} kidOrder={kidOrder} canAssign={canAssign} onAssign={onAssign} />
      ))}

      {busy.length > 0 && idle.length > 0 && (
        <p className="px-1 text-[13px] text-ink-2">
          {idle.map((c) => c.kidName).join(" e ")}: niente in programma.
        </p>
      )}

      {nextDay && (
        <button
          type="button"
          onClick={() => onSelect(nextDay.dateIso)}
          className="flex items-center gap-2 rounded-2xl bg-[#F4F3EF] px-4 py-3 text-left text-[13px] text-ink-2 active:scale-[0.99]"
          data-testid="next-day-teaser"
        >
          <span className="flex-1">
            <b className="font-semibold text-ink">
              {nextDay.dateIso === addDays(todayIso, 1) ? `Domani, ${nextDay.label.toLowerCase()}` : nextDay.label}:
            </b>{" "}
            {dayTeaser(nextDay)}
          </span>
          <i className="ti ti-chevron-right text-[16px] text-trama-accent-ink" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

function KidChainCard({
  chain,
  kidOrder,
  canAssign,
  onAssign,
}: {
  chain: KidDayChain;
  kidOrder: string[];
  canAssign: boolean;
  onAssign: () => void;
}) {
  const dot = KID_DOTS[Math.max(kidOrder.indexOf(chain.kidId), 0) % KID_DOTS.length];
  const compactSchool = chain.onlySchool && chain.steps.every((s) => !s.passage);
  const schoolIn = chain.steps.find((s) => s.kind === "school_in");
  const schoolOut = chain.steps.find((s) => s.kind === "school_out");
  return (
    <div className="rounded-2xl border border-trama-line bg-white p-4" data-testid="kid-day-card">
      <div className="mb-3 flex items-center gap-2.5">
        <KidAvatar name={chain.kidName} tone={kidToneFor(chain.kidId, kidOrder)} size={30} />
        <span className="flex-1 text-[16px] font-semibold text-ink">{chain.kidName}</span>
        {chain.missing > 0 && (
          <span className="rounded-full bg-[#FFF3E0] px-2.5 py-1 text-[12px] font-semibold text-[#8A5A0B]">
            {chain.missing === 1 ? "1 da decidere" : `${chain.missing} da decidere`}
          </span>
        )}
      </div>
      {compactSchool ? (
        <>
          <div className="flex items-center gap-2 rounded-[10px] bg-[#F4F3EF] px-3 py-2 text-[13px] text-ink-2" data-testid="day-school-row">
            <i className="ti ti-school text-[15px]" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{schoolIn?.detail ?? "Scuola"}</span>
            <span className="font-medium text-ink">
              {schoolIn?.time ?? ""}
              {schoolOut?.time ? `–${schoolOut.time}` : ""}
            </span>
          </div>
          <p className="mt-2.5 text-[13px] text-ink-2">Nient&apos;altro in questa giornata.</p>
        </>
      ) : (
        <ol className="flex flex-col">
          {chain.steps.map((s, i) => (
            <StepRow key={s.key} step={s} last={i === chain.steps.length - 1} dot={dot} canAssign={canAssign} onAssign={onAssign} />
          ))}
        </ol>
      )}
    </div>
  );
}

function StepRow({
  step,
  last,
  dot,
  canAssign,
  onAssign,
}: {
  step: DayStep;
  last: boolean;
  dot: string;
  canAssign: boolean;
  onAssign: () => void;
}) {
  const quiet = step.kind === "school_out";
  const school = step.kind === "school_in" || step.kind === "school_out";
  return (
    <li className={`relative flex gap-3 ${last ? "" : "pb-3.5"}`} data-testid="day-step">
      {!last && <span aria-hidden="true" className="absolute bottom-0 left-[5px] top-4 w-[2px] bg-[#ECEAE4]" />}
      <span
        aria-hidden="true"
        className="relative z-[1] mt-[5px] h-3 w-3 flex-shrink-0 rounded-full"
        style={school || quiet ? { background: "#fff", border: "2px solid #C9CED8" } : { background: dot }}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline gap-2">
          <span className="w-[42px] flex-shrink-0 text-[13px] font-semibold tabular-nums text-ink">{step.time ?? ""}</span>
          <span className={`text-[14.5px] font-semibold ${quiet ? "text-ink-2" : "text-ink"}`}>{step.title}</span>
        </span>
        {step.detail && <span className="pl-[50px] text-[12.5px] leading-snug text-ink-2">{step.detail}</span>}
        {step.passage && (
          <span className="pl-[50px]">
            <PassageChip passage={step.passage} canAssign={canAssign} onAssign={onAssign} />
          </span>
        )}
      </span>
    </li>
  );
}

function PassageChip({
  passage,
  canAssign,
  onAssign,
}: {
  passage: NonNullable<DayStep["passage"]>;
  canAssign: boolean;
  onAssign: () => void;
}) {
  const what = passage.moment === "andata" ? "Andata" : "Ritorno";
  const decided = passage.label !== null;
  const cls = decided
    ? "bg-[#E6F6EF] text-[#1E7A5B]"
    : "bg-[#FFF3E0] text-[#8A5A0B]";
  const content = decided ? (
    <>
      <i className="ti ti-check text-[13px]" aria-hidden="true" />
      {what} · {passage.label}
    </>
  ) : (
    <>
      {what} da decidere{canAssign ? " · Assegna" : ""}
    </>
  );
  if (!canAssign) {
    return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${cls}`}>{content}</span>;
  }
  return (
    <button
      type="button"
      onClick={onAssign}
      className={`inline-flex min-h-[32px] items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold active:scale-[0.98] ${cls}`}
      data-testid={decided ? "passage-decided" : "passage-missing"}
    >
      {content}
    </button>
  );
}
