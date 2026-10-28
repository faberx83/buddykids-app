// TRAMA — HOME V2 (Fase 1, 13/10/2026). Riepilogo del periodo. Componente
// CONDIVISO: oggi in Home V2, in Fase 2 in cima alla vista Stagione del
// Planner V2 (stessi stati, stessi colori, stesse parole — baseline V2.1).
//
// Tre stati (lib/nextgen/season-summary.ts):
//   welcome     — famiglia appena entrata: "Iniziamo a costruire il vostro
//                 piano", mai uno "0% organizzato";
//   not_started — ci sono dati ma nessuna settimana del periodo è ancora
//                 pianificata: tono neutro, una CTA;
//   progress    — "X di Y settimane organizzate", barra del periodo,
//                 legenda e prima settimana che chiede un'azione.
// Il budget NON sta qui (resta materia del Planner/Stagione).

import Link from "next/link";
import type { PeriodWeekState, SeasonSummaryModel } from "@/lib/nextgen/season-summary";
// NODI THREAD (28/10/2026): piccolo, accanto al titolo della card del prossimo passo (solo stato welcome).
import Nodi from "@/components/nextgen/Nodi";
import { NODI_SIZE } from "@/lib/nextgen/nodi";

export interface SeasonSummaryAction {
  label: string;
  href: string;
}

export interface SeasonSummaryWelcome {
  steps: { label: string; detail: string; done: boolean }[];
  cta: SeasonSummaryAction;
  body: string;
}

const CELL_CLASS: Record<PeriodWeekState, string> = {
  organized: "bg-trama-green",
  to_complete: "bg-[#F6B84B]",
  to_organize: "border-2 border-dashed border-[#8B93A1]",
  not_needed: "bg-[#EEF0F4]",
  past: "bg-[#EEF0F4]",
  school: "bg-[#EEF0F4]",
};

const CELL_LABEL: Record<PeriodWeekState, string> = {
  organized: "organizzata",
  to_complete: "da completare",
  to_organize: "da organizzare",
  not_needed: "non serve",
  past: "passata",
  school: "scuola",
};

function WeekStrip({
  model,
  weekHref,
  onWeekClick,
}: {
  model: SeasonSummaryModel;
  weekHref?: (weekStartIso: string) => string;
  onWeekClick?: (weekStartIso: string) => void;
}) {
  const description = model.cells.map((c) => `${c.dateRange}: ${CELL_LABEL[c.state]}`).join("; ");
  // 15/10/2026 (Fabrizio: "cliccando sulla settimana di interesse mi porti a
  // gestire quella settimana"): con weekHref/onWeekClick ogni cella che non è
  // solo scuola apre quella settimana nel Planner.
  const interactive = Boolean(weekHref || onWeekClick);
  const cellClass = (c: SeasonSummaryModel["cells"][number]) => `flex h-[30px] items-center justify-center rounded-md ${CELL_CLASS[c.state]}`;
  const icon = (c: SeasonSummaryModel["cells"][number]) =>
    c.closure ? <i className={`ti ti-school text-[13px] ${c.state === "organized" ? "text-white" : "text-[#4B5563]"}`} aria-hidden="true" /> : null;
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role={interactive ? "group" : "img"}
        aria-label={`Settimane del periodo — ${description}`}
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.max(model.cells.length, 1)}, minmax(0, 1fr))` }}
      >
        {model.cells.map((c) => {
          const tappable = interactive && c.weekStart && c.state !== "school";
          if (!tappable) {
            return (
              <span key={c.index} className={cellClass(c)}>
                {icon(c)}
              </span>
            );
          }
          const label = `Apri la settimana ${c.dateRange}: ${CELL_LABEL[c.state]}`;
          return weekHref ? (
            <Link key={c.index} href={weekHref(c.weekStart!)} aria-label={label} className={`${cellClass(c)} active:scale-95`}>
              {icon(c)}
            </Link>
          ) : (
            <button key={c.index} type="button" onClick={() => onWeekClick!(c.weekStart!)} aria-label={label} className={`${cellClass(c)} active:scale-95`}>
              {icon(c)}
            </button>
          );
        })}
      </div>
      <div
        className="grid text-[11.5px] text-ink-2"
        style={{ gridTemplateColumns: model.months.map((m) => `${m.span}fr`).join(" ") || "1fr" }}
      >
        {model.months.map((m) => (
          <span key={m.label} className="truncate">
            {/* mesi con 1–2 settimane: abbreviati ("set"), non troncati ("sette…") */}
            {m.span >= 3 ? m.label : m.label.slice(0, 3)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SeasonSummaryCard({
  model,
  attentionAction,
  notStartedAction,
  welcome,
  weekHref,
  onWeekClick,
  nodi = false,
}: {
  model: SeasonSummaryModel;
  /** NODI THREAD (28/10/2026): Nodi "focus" piccolo nello stato welcome (solo Home; NODI_ENABLED decide se si vede). */
  nodi?: boolean;
  /** 15/10/2026: celle della striscia toccabili (Home → link al Planner). */
  weekHref?: (weekStartIso: string) => string;
  /** 15/10/2026: celle della striscia toccabili (Planner → apre la settimana). */
  onWeekClick?: (weekStartIso: string) => void;
  /** CTA sulla prima settimana che chiede un'azione (stato progress). */
  attentionAction?: SeasonSummaryAction | null;
  /** CTA dello stato not_started. */
  notStartedAction?: SeasonSummaryAction | null;
  /** Contenuto dello stato welcome (obbligatorio se model.state === "welcome"). */
  welcome?: SeasonSummaryWelcome | null;
}) {
  // POLISH V2 (14/10/2026): bordo sottile, niente ombra morbida.
  const shell = "flex flex-col gap-3.5 rounded-2xl border border-trama-line bg-white p-[18px]";

  if (model.state === "welcome" && welcome) {
    return (
      <section aria-labelledby="period-welcome-h" className={shell}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-3">
            <h2 id="period-welcome-h" className="font-poppins text-[21px] font-semibold leading-tight text-ink">
              Iniziamo a costruire il vostro piano
            </h2>
            {nodi && <Nodi state="focus" size={NODI_SIZE.homeHint} className="-my-1" />}
          </div>
          <p className="text-[14px] leading-relaxed text-ink-2">{welcome.body}</p>
        </div>
        <ol className="flex flex-col">
          {welcome.steps.map((s, i) => (
            <li key={s.label} className="flex items-center gap-3 border-t border-[#F0F2F5] py-3">
              {s.done ? (
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-trama-green text-white">
                  <i className="ti ti-check text-[15px]" aria-hidden="true" />
                </span>
              ) : (
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#D6DAE3] text-[13px] font-bold text-ink-2">
                  {i + 1}
                </span>
              )}
              <span className="flex min-w-0 flex-col">
                <span className={`text-[14px] font-semibold ${s.done ? "text-ink-2 line-through" : "text-ink"}`}>
                  {s.label}
                </span>
                <span className="text-[12.5px] text-ink-2">{s.detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <Link
          href={welcome.cta.href}
          className="flex min-h-[48px] items-center justify-center rounded-[12px] bg-trama-primary px-5 text-[14.5px] font-bold text-white active:bg-trama-primary-press"
        >
          {welcome.cta.label}
        </Link>
      </section>
    );
  }

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h2 id="period-summary-h" className="font-poppins text-[17px] font-semibold text-ink">
        {model.title}
      </h2>
      {model.rangeLabel && <span className="text-[12.5px] text-ink-2">{model.rangeLabel}</span>}
    </div>
  );

  if (model.state === "not_started") {
    return (
      <section aria-labelledby="period-summary-h" className={shell}>
        {header}
        <p className="text-[14px] leading-relaxed text-ink">
          {model.neededCount === 1 ? "1 settimana" : `${model.neededCount} settimane`} ancora da pianificare.
          <span className="text-ink-2"> Aggiungi ciò che fate già o cerca un'attività.</span>
        </p>
        <WeekStrip model={model} weekHref={weekHref} onWeekClick={onWeekClick} />
        {notStartedAction && (
          <Link
            href={notStartedAction.href}
            className="flex min-h-[44px] items-center justify-center rounded-[12px] bg-trama-primary px-5 text-[14px] font-bold text-white active:bg-trama-primary-press"
          >
            {notStartedAction.label}
          </Link>
        )}
      </section>
    );
  }

  const attention = model.firstAttention;
  return (
    <section aria-labelledby="period-summary-h" className={shell}>
      {header}
      <div className="flex items-baseline gap-2">
        <span className="font-poppins text-[30px] font-semibold leading-none text-trama-navy">
          {model.organizedCount} di {model.neededCount}
        </span>
        <span className="text-[14px] text-[#374151]">{model.unitLabel ?? "settimane organizzate"}</span>
      </div>
      <WeekStrip model={model} weekHref={weekHref} onWeekClick={onWeekClick} />
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-[#4B5563]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-trama-green" aria-hidden="true" />
          Organizzata
        </span>
        {model.toCompleteCount > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[#F6B84B]" aria-hidden="true" />
            Da completare · {model.toCompleteCount}
          </span>
        )}
        {model.toOrganizeCount > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border-[1.5px] border-dashed border-[#8B93A1]" aria-hidden="true" />
            Da organizzare · {model.toOrganizeCount}
          </span>
        )}
        {model.cells.some((c) => c.state === "school") && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[#EEF0F4]" aria-hidden="true" />
            Scuola
          </span>
        )}
      </div>
      {attention && attentionAction && (
        <div className="flex items-center gap-3 border-t border-[#F0F2F5] pt-3.5">
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-[12px] text-ink-2">
              {attention.state === "to_organize" ? "Prima settimana da organizzare" : "Prima settimana da completare"}
            </span>
            <span className="text-[14.5px] font-semibold text-ink">{attention.dateRange}</span>
          </div>
          <Link
            href={attentionAction.href}
            className="flex min-h-[44px] flex-shrink-0 items-center rounded-[12px] border border-[#D9DDE5] bg-white px-4 text-[13.5px] font-bold text-trama-primary active:bg-black/[0.03]"
          >
            {attentionAction.label}
          </Link>
        </div>
      )}
    </section>
  );
}
