import Link from "next/link";
import type { ReactNode } from "react";
import { getBetaCockpitData, getBetaDecisions } from "@/lib/data/beta-cockpit";
import { buildCockpitView } from "@/lib/beta-cockpit/view";
import { rangeLabel, reportWindows, romeDay } from "@/lib/beta-cockpit/dates";
import { FEEDBACK_STATUS_DEF, FEEDBACK_VIEWS } from "@/lib/beta-cockpit/feedback";
import { Notice, PeriodBar } from "@/components/admin/beta/BetaUi";
import { cockpitHref, familiesHref, readPeriod, type SearchParams } from "../params";
import { AlertsBlock, DemandSection, FamiliesTable, FrictionsSection, FunnelSection, KpiGrid, SummaryBlock, SurveySection, UsageSection } from "../sections";
import DecisionLogClient from "./DecisionLogClient";
import ReportSettingsForm from "./ReportSettingsForm";

export const dynamic = "force-dynamic";

// TRAMA — ADMIN BETA COCKPIT · Beta → Report. Report NAVIGABILE (non un
// PDF): ogni sezione si apre e chiude, ogni numero porta alla tabella
// famiglie filtrata e da lì alla singola famiglia. I report schedulati sono
// finestre di date ricalcolate dai dati; nel database si salvano solo le
// decisioni (decision log).

function Section({ id, title, open = true, children }: { id: string; title: string; open?: boolean; children: ReactNode }) {
  return (
    <details id={id} open={open} className="group mb-3 rounded-lg border border-white/10 bg-white/[0.04]">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm font-bold text-white">
        {title}
        <i className="ti ti-chevron-down text-navy-text2 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="px-3 pb-1">{children}</div>
    </details>
  );
}

export default async function BetaReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const data = await getBetaCockpitData();
  if (!data) {
    return <p className="text-sm text-navy-text2">Report non disponibile: serve l&apos;accesso Admin.</p>;
  }
  const now = new Date();
  const todayIso = romeDay(now);
  const s = data.settings;
  const windows = reportWindows({ frequency: s.frequency, weekday: s.weekday, time: s.time, betaStart: s.betaStart }, now);
  // Senza periodo esplicito: l'ultima finestra chiusa, altrimenti gli ultimi 7 giorni.
  const lastClosed = windows.find((w) => w.closed);
  const effectiveSp: SearchParams = sp.p || !lastClosed ? sp : { p: "custom", da: lastClosed.from, a: lastClosed.to };
  const period = readPeriod(effectiveSp, todayIso, s.betaStart);
  const view = buildCockpitView(
    {
      raw: data.raw,
      feedback: data.feedback,
      surveyResponses: data.surveyResponses,
      demandSignals: data.demandSignals,
      zonesByFamily: data.zonesByFamily,
      thresholds: s.thresholds,
      betaStart: s.betaStart,
    },
    period,
    now
  );
  const decisions = data.capabilities.decisions ? await getBetaDecisions() : null;
  const fs = view.feedbackSummary;

  return (
    <div>
      <Link href={cockpitHref(period)} className="text-xs font-semibold text-white underline">
        ← Beta Famiglie
      </Link>
      <h1 className="mt-2 text-xl font-bold text-white">Beta Report · {rangeLabel(period.from, period.to)}</h1>
      <p className="mb-3 mt-1 text-sm text-navy-text2">
        {s.frequency === "manual" ? "Report manuale" : s.frequency === "daily" ? `Giornaliero, alle ${s.time}` : `Settimanale, ${["", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"][s.weekday]} alle ${s.time}`}
        {" · "}dati ricalcolati il {now.toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" })}
      </p>

      {!s.tableReady && <Notice>Migration 46 non applicata: impostazioni di default e decision log spento.</Notice>}

      <PeriodBar period={period} basePath="/admin/beta/report" />

      {windows.length > 0 && (
        <nav aria-label="Report precedenti" className="mb-4 flex flex-wrap gap-1.5 text-xs">
          <span className="py-1 text-navy-text2">Report:</span>
          {windows.slice(0, 12).map((w) => {
            const active = period.from === w.from && period.to === w.to;
            return (
              <Link
                key={w.key}
                href={`/admin/beta/report?p=custom&da=${w.from}&a=${w.to}`}
                className={`rounded-full px-2.5 py-1 font-semibold ${active ? "bg-white text-ink" : "border border-white/25 text-white"}`}
              >
                {w.label}
                {!w.closed && " (in corso)"}
              </Link>
            );
          })}
        </nav>
      )}

      <Section id="sintesi" title="Executive summary">
        {view.isCurrent && <AlertsBlock view={view} />}
        <KpiGrid view={view} />
        <SummaryBlock view={view} />
      </Section>
      <Section id="funnel" title="Funnel">
        <FunnelSection view={view} />
      </Section>
      <Section id="famiglie" title="Famiglie" open={false}>
        <FamiliesTable view={view} filter={null} filterLabel={null} compact />
      </Section>
      <Section id="utilizzo" title="Utilizzo" open={false}>
        <UsageSection view={view} />
      </Section>
      <Section id="frizioni" title="Frizioni">
        <FrictionsSection view={view} />
      </Section>
      <Section id="centri" title="Centri" open={false}>
        <DemandSection view={view} limit={20} />
      </Section>
      <Section id="feedback" title="Feedback" open={false}>
        <div className="mb-4 rounded-lg border border-[#E8EBF0] bg-white px-4 py-3 text-sm text-ink">
          <p>
            <b>{view.feedbackInPeriod.length}</b> nel periodo · {FEEDBACK_VIEWS.filter((v) => v.key !== "tutti").map((v) => `${v.label} ${fs.counts[v.key]}`).join(" · ")} (in tutto)
          </p>
          <p className="mt-1 text-xs text-ink-2">Stato: {FEEDBACK_STATUS_DEF.map((x) => `${x.label} ${fs.byStatus[x.value]}`).join(" · ")}</p>
          {fs.recurring.length > 0 && (
            <p className="mt-1 text-xs text-ink-2">Ricorrenti: {fs.recurring.map((r) => `${r.label} (${r.families} fam.)`).join(" · ")}</p>
          )}
          <Link href="/admin/beta?tab=feedback" className="mt-2 inline-block text-xs font-semibold text-trama-violet underline">
            Apri il triage dei feedback
          </Link>
        </div>
      </Section>
      <Section id="survey" title="Survey" open={false}>
        <SurveySection view={view} />
      </Section>
      <Section id="decisioni" title="Decisioni">
        <div className="mb-4 rounded-lg border border-[#E8EBF0] bg-white px-4 py-3">
          <p className="mb-2 text-xs text-ink-2">
            Dai numeri alle decisioni. Prima di cambiare la UI, verifica l&apos;ipotesi con 1–2 famiglie (
            <Link href={familiesHref(period, { kind: "status", status: "a_rischio" })} className="text-trama-violet underline">
              famiglie a rischio
            </Link>
            ).
          </p>
          <DecisionLogClient period={{ from: period.from, to: period.to }} decisions={decisions ?? []} available={decisions !== null} />
        </div>
      </Section>
      <Section id="impostazioni" title="Impostazioni" open={false}>
        <div className="mb-4 rounded-lg border border-[#E8EBF0] bg-white px-4 py-3">
          <ReportSettingsForm
            available={s.tableReady}
            initial={{ frequency: s.frequency, weekday: s.weekday, time: s.time, betaStart: s.betaStart, thresholds: s.thresholds, surveyConfig: s.surveyConfig }}
            excluded={data.members.filter((m) => m.excluded).map((m) => ({ userId: m.userId, label: m.label }))}
          />
        </div>
      </Section>
    </div>
  );
}
