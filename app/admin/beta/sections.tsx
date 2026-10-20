// TRAMA — ADMIN BETA COCKPIT · Le sezioni, usate sia dal cockpit sia dal
// report navigabile. Ogni numero porta alla tabella famiglie filtrata.

import Link from "next/link";
import { AREA_LABEL, FUNNEL_DEF, STATUS_DEF, STATUS_ORDER, countOf, type CockpitThresholds } from "@/lib/beta-cockpit/definitions";
import { shortDate, type Period } from "@/lib/beta-cockpit/dates";
import { DEMAND_TYPE_LABEL } from "@/lib/beta-cockpit/demand";
import { applyFamilyFilter, hoursLabel, lastActionLabel, type FamilyFilter, type FamilyRow } from "@/lib/beta-cockpit/model";
import type { CockpitView } from "@/lib/beta-cockpit/view";
import { Card, Empty, KpiTile, StatusBadge, YesNo, fmtDate } from "@/components/admin/beta/BetaUi";
import { familiesHref, familyDetailHref } from "./params";

const th = "whitespace-nowrap border-b border-[#E8EBF0] px-2.5 py-2 text-left text-[11.5px] font-semibold text-ink-2";
const td = "whitespace-nowrap border-b border-[#F0F2F5] px-2.5 py-2 text-ink";

// ── Overview ──────────────────────────────────────────────────────────────

export function AlertsBlock({ view }: { view: CockpitView }) {
  if (view.alerts.length === 0) {
    return (
      <Card title="Richiede attenzione">
        <Empty>Niente da segnalare adesso.</Empty>
      </Card>
    );
  }
  return (
    <Card title="Richiede attenzione" subtitle="Situazione di oggi, qualunque sia il periodo scelto.">
      <ul className="flex flex-col gap-1.5">
        {view.alerts.map((a) => (
          <li key={a.key} className="flex items-center gap-2 text-sm">
            <i className="ti ti-alert-circle text-trama-orange" aria-hidden="true" />
            <Link
              href={a.key === "new_feedback" ? `/admin/beta?tab=feedback` : familiesHref(view.period, { kind: "alert", alert: a.key })}
              className="font-medium text-trama-violet underline underline-offset-2"
            >
              {a.text}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function KpiGrid({ view }: { view: CockpitView }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {view.kpis.map((k) => (
        <KpiTile key={k.key} kpi={k} href={k.filter ? familiesHref(view.period, k.filter) : k.key === "feedback" ? "/admin/beta?tab=feedback" : null} />
      ))}
    </div>
  );
}

export function SummaryBlock({ view }: { view: CockpitView }) {
  return (
    <Card title="Sintesi" subtitle="Calcolata dai dati, senza interpretazioni: le cause vanno verificate con survey e interviste.">
      <p className="text-sm text-ink">{view.summary.lines.join(" · ")}</p>
      {view.summary.signals.length > 0 && (
        <>
          <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-ink-2">Segnali da guardare</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-ink">
            {view.summary.signals.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function StatusLegend({ t }: { t: CockpitThresholds }) {
  return (
    <details className="mb-4 rounded-lg border border-[#E8EBF0] bg-white px-4 py-2 text-xs text-ink-2">
      <summary className="cursor-pointer font-semibold text-ink">Come si calcolano stati e attivazione</summary>
      <ul className="mt-2 flex flex-col gap-1">
        <li>
          <b>Attivata</b>: almeno un figlio e {t.activationMinCommitments} impegni reali (impegni nel Planner + richieste ai centri non annullate). È un traguardo, con
          la sua data.
        </li>
        {STATUS_ORDER.map((s) => (
          <li key={s}>
            <b>{STATUS_DEF[s].label}</b>: {STATUS_DEF[s].rule}
          </li>
        ))}
        <li>
          Soglie attuali: a rischio da {t.atRiskAfterDays} giorni, dormiente da {t.dormantAfterDays} giorni senza azioni significative. Si cambiano in Report → Impostazioni.
        </li>
        <li>
          <b>Azione significativa</b>: figlio, scuola, impegno inserito o modificato, attività da Scopri nel Planner, chi porta/ritira, altro genitore invitato o
          collegato, nonni/tata aggiunti, salvataggio, piano condiviso, richiesta o messaggio a un centro, centro suggerito, Radar, gruppi e Classe e scuola, feedback e
          survey. Non contano accessi, aperture di pagina, cambi di scheda.
        </li>
      </ul>
    </details>
  );
}

// ── Tabella famiglie ──────────────────────────────────────────────────────

export function FamiliesTable({
  view,
  filter,
  filterLabel,
  compact = false,
}: {
  view: CockpitView;
  filter: FamilyFilter | null;
  filterLabel: string | null;
  compact?: boolean;
}) {
  const rows = applyFamilyFilter(view.rows, filter, {
    activeInPeriod: view.activeInPeriod,
    frictions: view.frictionMap,
    alerts: view.alerts,
    areaFamilies: view.areaFamilies,
  });
  const today = view.period.to;
  return (
    <Card
      title={`Famiglie${filterLabel ? ` · ${filterLabel}` : ""}`}
      subtitle={`${rows.length} ${rows.length === 1 ? "famiglia" : "famiglie"}. Una riga per famiglia, dati al ${shortDate(today)}.`}
      right={
        filter ? (
          <Link href={familiesHref(view.period, null)} className="text-xs font-semibold text-trama-violet underline">
            Togli il filtro
          </Link>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <Empty>Nessuna famiglia{filter ? " con questo filtro" : " ancora: compariranno con i primi inviti e le prime registrazioni"}.</Empty>
      ) : (
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className={`${th} sticky left-0 bg-white`}>Famiglia</th>
                <th className={th}>Stato</th>
                <th className={th}>Invito</th>
                <th className={th}>Registr.</th>
                <th className={th}>Onboard.</th>
                <th className={th}>Figli</th>
                <th className={th}>Scuola</th>
                <th className={th}>Impegni</th>
                <th className={th}>2° adulto</th>
                <th className={th}>Coord.</th>
                <th className={th} title="Giorni con almeno un'azione significativa">Gg attivi 7/14</th>
                {!compact && <th className={th} title="Giorni con app aperta negli ultimi 7">App 7</th>}
                <th className={th}>Ultima azione significativa</th>
                {!compact && (
                  <>
                    <th className={th}>Salvati</th>
                    <th className={th}>Da Scopri</th>
                    <th className={th}>Richieste</th>
                    <th className={th} title="Condivisioni del piano negli ultimi 7 giorni">Condiv. 7</th>
                    <th className={th}>Feedback</th>
                    <th className={th}>Push</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <FamilyTr key={r.key} r={r} today={today} compact={compact} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function FamilyTr({ r, today, compact }: { r: FamilyRow; today: string; compact: boolean }) {
  return (
    <tr>
      <td className={`${td} sticky left-0 bg-white`}>
        <Link href={familyDetailHref(r.key)} className="font-semibold text-trama-violet underline underline-offset-2">
          {r.label}
        </Link>
        {r.readsOnly && (
          <span title="Apre l'app senza modificare nulla" className="ml-1.5 rounded bg-[#E8F0FE] px-1 text-[10px] font-semibold text-[#1A4FB0]">
            legge
          </span>
        )}
      </td>
      <td className={td}>
        <StatusBadge status={r.status} />
        {r.activatedAt && <div className="text-[10.5px] text-ink-2">attivata {fmtDate(r.activatedAt)}</div>}
      </td>
      <td className={td}>{fmtDate(r.invitedAt)}</td>
      <td className={td}>{fmtDate(r.registeredAt)}</td>
      <td className={td}>{r.registeredAt ? <YesNo value={r.onboardingDone} /> : "—"}</td>
      <td className={td}>{r.kids}</td>
      <td className={td}>
        <YesNo value={r.school} />
      </td>
      <td className={td}>{r.commitments}</td>
      <td className={td}>
        <YesNo value={r.secondAdult} />
        {!r.secondAdult && r.pendingPartnerInvites.length > 0 && <div className="text-[10.5px] text-ink-2">invito in attesa</div>}
      </td>
      <td className={td}>
        <YesNo value={r.coordinationUsed} />
      </td>
      <td className={td}>
        {r.activeDays7} / {r.activeDays14}
      </td>
      {!compact && <td className={td}>{r.openDays7 ?? "—"}</td>}
      <td className={td}>{lastActionLabel(r, today)}</td>
      {!compact && (
        <>
          <td className={td}>{r.saved}</td>
          <td className={td}>{r.fromDiscovery}</td>
          <td className={td}>{r.centerRequests}</td>
          <td className={td}>{r.sharesWeek}</td>
          <td className={td}>{r.feedback}</td>
          <td className={td}>{r.registeredAt ? <YesNo value={r.pushActive} /> : "—"}</td>
        </>
      )}
    </tr>
  );
}

// ── Funnel e time to value ────────────────────────────────────────────────

export function FunnelSection({ view }: { view: CockpitView }) {
  const total = view.funnel[0]?.reached ?? 0;
  return (
    <>
      <Card title="Funnel" subtitle="Ogni passo richiede il precedente. Clicca le famiglie ferme per vederle in tabella.">
        {total === 0 ? (
          <Empty>Ancora nessuna famiglia.</Empty>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={th}>Passo</th>
                  <th className={th}>Arrivate</th>
                  <th className={th}>Ferme qui</th>
                  <th className={th}>Regola</th>
                </tr>
              </thead>
              <tbody>
                {view.funnel.map((f) => (
                  <tr key={f.step}>
                    <td className={`${td} font-semibold`}>{f.label}</td>
                    <td className={td}>
                      <span className="font-semibold">{countOf(f.reached, total)}</span>
                      <span
                        aria-hidden="true"
                        className="ml-2 inline-block h-2 rounded-full bg-trama-violet/70 align-middle"
                        style={{ width: `${Math.max(2, Math.round((f.reached / total) * 120))}px` }}
                      />
                    </td>
                    <td className={td}>
                      {f.stopped > 0 ? (
                        <Link href={familiesHref(view.period, { kind: "stopped", step: f.step })} className="font-semibold text-trama-violet underline">
                          {f.stopped}
                        </Link>
                      ) : (
                        "0"
                      )}
                      {f.pending > 0 && <span className="ml-1 text-[11px] text-ink-2">(di cui {f.pending} troppo recenti per dirlo)</span>}
                    </td>
                    <td className={`${td} whitespace-normal text-[12px] text-ink-2`}>{f.rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <TtvBlock view={view} />
    </>
  );
}

export function TtvBlock({ view }: { view: CockpitView }) {
  return (
    <Card title="Tempo al valore" subtitle="Mediana e famiglie più lente. Con pochi casi conta più la lista dei nomi che il numero.">
      <div className="grid gap-4 md:grid-cols-2">
        {view.ttv.map((s) => (
          <div key={s.label}>
            <h3 className="text-xs font-bold text-ink">{s.label}</h3>
            <p className="mt-1 text-lg font-bold text-ink">
              {s.median === null ? "—" : `mediana ${hoursLabel(s.median)}`}
              <span className="ml-1 text-xs font-normal text-ink-2">su {s.measured} {s.measured === 1 ? "famiglia" : "famiglie"}</span>
            </p>
            {s.slowest.length > 0 && (
              <ul className="mt-1 text-xs text-ink-2">
                {s.slowest.map((x) => (
                  <li key={x.key}>
                    <Link href={familyDetailHref(x.key)} className="text-trama-violet underline">
                      {x.label}
                    </Link>{" "}
                    — {hoursLabel(x.hours)}
                  </li>
                ))}
              </ul>
            )}
            {s.notYet.length > 0 && <p className="mt-1 text-xs text-ink-2">Non ancora: {s.notYet.map((x) => x.label).join(", ")}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Utilizzo ──────────────────────────────────────────────────────────────

export function UsageSection({ view }: { view: CockpitView }) {
  const reg = view.rows.filter((r) => r.registeredAt).length;
  return (
    <Card title="Utilizzo per area" subtitle={`Solo azioni salvate nel periodo (${view.period.label.toLowerCase()}), mai visite di pagina. Su ${reg} famiglie registrate.`}>
      <div className="-mx-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={th}>Area</th>
              <th className={th}>Famiglie</th>
              <th className={th}>Azioni</th>
              <th className={th} title="Famiglie che l'hanno usata in almeno 2 giorni diversi">Tornate (≥2 giorni)</th>
            </tr>
          </thead>
          <tbody>
            {view.usage.map((u) => (
              <tr key={u.area}>
                <td className={td}>
                  {u.label}
                  {u.note && <div className="text-[11px] text-ink-2">{u.note}</div>}
                </td>
                <td className={td}>
                  {u.families > 0 ? (
                    <Link href={familiesHref(view.period, { kind: "area", area: u.area })} className="font-semibold text-trama-violet underline">
                      {countOf(u.families, reg)}
                    </Link>
                  ) : (
                    <span className="text-ink-3">0</span>
                  )}
                </td>
                <td className={td}>{u.actions}</td>
                <td className={td}>{u.repeatFamilies}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Frizioni ──────────────────────────────────────────────────────────────

export function FrictionsSection({ view }: { view: CockpitView }) {
  const labels = new Map(view.rows.map((r) => [r.key, r.label]));
  return (
    <Card title="Frizioni" subtitle="Fatti osservati, non cause: il perché si chiede alle famiglie.">
      <ul className="flex flex-col divide-y divide-[#F0F2F5]">
        {view.frictions.map((f) => (
          <li key={f.key} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <span className={f.families.length ? "text-ink" : "text-ink-3"}>{f.label}</span>
              {f.families.length > 0 && (
                <div className="mt-0.5 text-xs">
                  {f.families.slice(0, 8).map((k, i) => (
                    <span key={k}>
                      {i > 0 && ", "}
                      <Link href={familyDetailHref(k)} className="text-trama-violet underline">
                        {labels.get(k) ?? "famiglia"}
                      </Link>
                    </span>
                  ))}
                  {f.families.length > 8 && <span className="text-ink-2"> e altre {f.families.length - 8}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-ink-2">
              <span title="Variazione dall'inizio del periodo">{f.trend === null ? "dato di oggi" : f.trend === 0 ? "stabile" : `${f.trend > 0 ? "+" : ""}${f.trend} nel periodo`}</span>
              {f.families.length > 0 && (
                <Link href={familiesHref(view.period, { kind: "friction", friction: f.key })} className="font-semibold text-trama-violet underline">
                  Filtra
                </Link>
              )}
            </div>
          </li>
        ))}
        <li className="py-2 text-sm text-ink-2">
          Errori tecnici del Planner nel periodo (aggregati, senza famiglia): <b className="text-ink">{view.technicalErrors}</b>
        </li>
      </ul>
    </Card>
  );
}

// ── Centri / domanda ──────────────────────────────────────────────────────

export function DemandSection({ view, limit }: { view: CockpitView; limit?: number }) {
  const labels = new Map(view.rows.map((r) => [r.key, r.label]));
  const list = limit ? view.demand.slice(0, limit) : view.demand;
  const tierCount = (n: number) => view.demand.filter((d) => d.families >= n && !d.freeTextOnly).length;
  return (
    <>
      <Card title="Top opportunità accerchiamento" subtitle="Centri o attività citati da almeno 2 famiglie diverse (escluso il solo testo libero).">
        {view.topDemand.length === 0 ? (
          <Empty>Ancora nessun centro citato da più di una famiglia.</Empty>
        ) : (
          <ol className="list-decimal pl-5 text-sm text-ink">
            {view.topDemand.map((d) => (
              <li key={d.key} className="py-0.5">
                <b>{d.label}</b>
                {d.locality && <span className="text-ink-2"> · {d.locality}</span>} — {d.families} famiglie, {d.signals} segnali
              </li>
            ))}
          </ol>
        )}
        <p className="mt-2 text-xs text-ink-2">
          Citati da ≥2 famiglie: <b>{tierCount(2)}</b> · ≥3: <b>{tierCount(3)}</b> · ≥5: <b>{tierCount(5)}</b>
        </p>
      </Card>
      <Card title="Domanda verso i centri" subtitle="Una riga per centro o attività. 'Testo libero' = scritto a mano in un impegno: l'abbinamento va controllato.">
        {list.length === 0 ? (
          <Empty>Nessun segnale ancora.</Empty>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className={th}>Centro / attività</th>
                  <th className={th}>Famiglie distinte</th>
                  <th className={th}>Segnali</th>
                  <th className={th}>Zone (scuole)</th>
                  <th className={th}>Tipo di segnali</th>
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.key} className={d.families >= 3 ? "bg-green-light/40" : d.families >= 2 ? "bg-orange-light/40" : ""}>
                    <td className={`${td} whitespace-normal`}>
                      <b>{d.label}</b>
                      {d.locality && <span className="text-ink-2"> · {d.locality}</span>}
                      {d.freeTextOnly && <span className="ml-1 rounded bg-[#F1F3F6] px-1 text-[10px] text-ink-2">testo libero</span>}
                    </td>
                    <td className={`${td} whitespace-normal`}>
                      <b>{d.families}</b>
                      <div className="text-[11px]">
                        {d.familyKeys.slice(0, 5).map((k, i) => (
                          <span key={k}>
                            {i > 0 && ", "}
                            <Link href={familyDetailHref(k)} className="text-trama-violet underline">
                              {labels.get(k) ?? "famiglia"}
                            </Link>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className={td}>{d.signals}</td>
                    <td className={`${td} whitespace-normal`}>{d.zones.join(", ") || "—"}</td>
                    <td className={`${td} whitespace-normal text-[11.5px] text-ink-2`}>{d.types.map((t) => DEMAND_TYPE_LABEL[t]).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ── Survey ────────────────────────────────────────────────────────────────

export function SurveySection({ view }: { view: CockpitView }) {
  return (
    <>
      {view.surveys.map((s) => (
        <Card key={s.survey.id} title={s.survey.title} subtitle={`${s.responses} ${s.responses === 1 ? "risposta" : "risposte"} fino al ${shortDate(view.period.to)}.`}>
          {s.responses === 0 ? (
            <Empty>Nessuna risposta ancora. La survey si accende per le famiglie dalla card Release ("Survey della beta").</Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {s.choices.map((c) => (
                <div key={c.questionId}>
                  <h3 className="text-xs font-bold text-ink">{c.text}</h3>
                  <ul className="mt-1 text-sm text-ink">
                    {c.options.map((o) => (
                      <li key={o.label}>
                        {o.label}: <b>{countOf(o.count, s.responses)}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {s.texts.map((q) => (
                <div key={q.questionId}>
                  <h3 className="text-xs font-bold text-ink">{q.text}</h3>
                  {q.answers.length === 0 ? (
                    <Empty>Nessuna risposta scritta.</Empty>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1 text-sm text-ink">
                      {q.answers.map((a, i) => (
                        <li key={i} className="rounded bg-[#F7F9FC] px-2 py-1">
                          “{a.text}”
                          {a.familyKey && (
                            <Link href={familyDetailHref(a.familyKey)} className="ml-1 text-xs text-trama-violet underline">
                              {a.familyLabel ?? "famiglia"}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </>
  );
}

// ── Etichette dei filtri ──────────────────────────────────────────────────

export function filterLabel(f: FamilyFilter | null, view: CockpitView): string | null {
  if (!f) return null;
  switch (f.kind) {
    case "status":
      return STATUS_DEF[f.status].label;
    case "registered":
      return "Registrate";
    case "activated":
      return "Attivate";
    case "active_period":
      return `Attive nel periodo (${view.period.label.toLowerCase()})`;
    case "second_adult":
      return "Con 2 adulti";
    case "coordination":
      return "Con coordinamento";
    case "stopped":
      return `Ferme a "${FUNNEL_DEF.find((x) => x.step === f.step)?.label}"`;
    case "friction":
      return view.frictions.find((x) => x.key === f.friction)?.label ?? "Frizione";
    case "alert":
      return view.alerts.find((x) => x.key === f.alert)?.text ?? "Avviso";
    case "area":
      return f.area === "app" ? "Hanno aperto l'app" : `Area: ${AREA_LABEL[f.area]}`;
  }
}

export function periodSentence(p: Period): string {
  return p.from === p.to ? shortDate(p.from) : `${shortDate(p.from)} – ${shortDate(p.to)}`;
}

