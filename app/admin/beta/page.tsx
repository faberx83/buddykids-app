import Link from "next/link";
import { getBetaCockpitData } from "@/lib/data/beta-cockpit";
import { buildCockpitView } from "@/lib/beta-cockpit/view";
import { romeDay } from "@/lib/beta-cockpit/dates";
import { Card, Notice, PeriodBar } from "@/components/admin/beta/BetaUi";
import { COCKPIT_TABS, cockpitHref, periodQuery, readFilter, readPeriod, readTab, type SearchParams } from "./params";
import {
  AlertsBlock,
  DemandSection,
  FamiliesTable,
  FrictionsSection,
  FunnelSection,
  KpiGrid,
  StatusLegend,
  SummaryBlock,
  SurveySection,
  UsageSection,
  filterLabel,
  periodSentence,
} from "./sections";
import FeedbackTriageClient from "./FeedbackTriageClient";
import InviteFamilyForm from "./InviteFamilyForm";

// Dati per-richiesta, solo Admin: getBetaCockpitData() rifà il controllo
// platform_admin lato server prima di qualunque lettura.
export const dynamic = "force-dynamic";

// TRAMA — ADMIN BETA COCKPIT (20/10/2026). Strumento operativo per la beta
// famiglie: leggibile in 5 minuti, una riga per famiglia, solo dati
// first-party già esistenti. Definizioni in lib/beta-cockpit/definitions.ts;
// documento: docs/trama-one/claude/INIZIATIVA_admin_beta_cockpit.md.
export default async function BetaCockpitPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const data = await getBetaCockpitData();

  if (!data) {
    return (
      <div>
        <h1 className="text-xl font-bold text-white">Beta Famiglie</h1>
        <p className="mt-2 text-sm text-navy-text2">Dati non disponibili: serve l&apos;accesso Admin e la chiave di servizio di Supabase su Vercel.</p>
      </div>
    );
  }

  const now = new Date();
  const todayIso = romeDay(now);
  const period = readPeriod(sp, todayIso, data.settings.betaStart);
  const tab = readTab(sp);
  const filter = readFilter(sp);
  const view = buildCockpitView(
    {
      raw: data.raw,
      feedback: data.feedback,
      surveyResponses: data.surveyResponses,
      demandSignals: data.demandSignals,
      zonesByFamily: data.zonesByFamily,
      thresholds: data.settings.thresholds,
      betaStart: data.settings.betaStart,
    },
    period,
    now
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Beta Famiglie</h1>
          <p className="mt-1 text-sm text-navy-text2">
            {periodSentence(period)} · inizio beta {data.settings.betaStart.split("-").reverse().join("/")} ·{" "}
            <Link href={`/admin/beta/report?${new URLSearchParams(periodQuery(period)).toString()}`} className="font-semibold text-white underline">
              Apri il report
            </Link>
          </p>
        </div>
        <InviteFamilyForm />
      </div>

      {!data.settings.tableReady && (
        <Notice>
          Migration 46 non ancora applicata: soglie e frequenza sono quelle di default, il decision log è spento, &quot;app aperta&quot; non si vede e i feedback hanno
          tre stati. Tutto il resto funziona.
        </Notice>
      )}
      {data.settings.tableReady && !data.capabilities.openDays && (
        <Notice>&quot;App aperta&quot; non disponibile: il ritorno si misura solo dalle azioni.</Notice>
      )}

      <PeriodBar period={period} basePath="/admin/beta" extra={tab !== "overview" ? { tab } : {}} />

      <nav aria-label="Sezioni" className="mb-4 flex flex-wrap gap-1 border-b border-white/15">
        {COCKPIT_TABS.map((t) => (
          <Link
            key={t.key}
            href={cockpitHref(period, { tab: t.key })}
            aria-current={tab === t.key ? "page" : undefined}
            className={`-mb-px rounded-t px-3 py-2 text-sm font-semibold ${tab === t.key ? "border-b-2 border-white text-white" : "text-navy-text2 hover:text-white"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <>
          <AlertsBlock view={view} />
          <KpiGrid view={view} />
          {!view.comparisonShown && (
            <p className="-mt-2 mb-4 text-xs text-navy-text2">
              Il confronto col periodo precedente compare da {data.settings.thresholds.minFamiliesForComparison} famiglie registrate e solo dentro la beta.
            </p>
          )}
          <SummaryBlock view={view} />
          <StatusLegend t={data.settings.thresholds} />
        </>
      )}

      {tab === "famiglie" && (
        <>
          <FamiliesTable view={view} filter={filter} filterLabel={filterLabel(filter, view)} />
          <StatusLegend t={data.settings.thresholds} />
        </>
      )}

      {tab === "funnel" && <FunnelSection view={view} />}
      {tab === "utilizzo" && <UsageSection view={view} />}
      {tab === "frizioni" && <FrictionsSection view={view} />}
      {tab === "centri" && <DemandSection view={view} />}

      {tab === "feedback" && (
        <>
          <Card
            title="Feedback"
            subtitle={`${data.feedback.length} in tutto da ${view.feedbackSummary.families} famiglie · ultimo ${
              view.feedbackSummary.lastAt ? new Date(view.feedbackSummary.lastAt).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" }) : "—"
            } · ${view.feedbackInPeriod.length} nel periodo`}
          >
            {view.feedbackSummary.recurring.length > 0 && (
              <div className="mb-3 text-xs text-ink-2">
                Più ricorrenti:{" "}
                {view.feedbackSummary.recurring.map((r, i) => (
                  <span key={r.label}>
                    {i > 0 && " · "}
                    <b className="text-ink">{r.label}</b> ({r.items}, {r.families} {r.families === 1 ? "famiglia" : "famiglie"})
                  </span>
                ))}
              </div>
            )}
            <FeedbackTriageClient initial={data.feedback} extended={data.capabilities.extendedFeedback} />
          </Card>
          <SurveySection view={view} />
        </>
      )}
    </div>
  );
}
