"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PlannerData } from "@/lib/data/planner";
import {
  KidOverlap,
  BudgetSummary,
  computePerKidCoverage,
  computeWeekStatus,
  WEEK_STATUS_BAR_CLASS,
  weekIndexFromLabel,
  overlapVerb,
  formatBookingNames,
} from "@/lib/nextgen/planner-insights";
import type { Mission } from "@/lib/nextgen/missions";
import type { SmartMatch } from "@/lib/nextgen/smart-search";
// "import type": queste due sono interfacce usate SOLO come tipo (prop
// types), mai come valore — con "import type" il compilatore le elimina
// sempre dal bundle client, garantendo che lib/data/responsibilities.ts e
// lib/data/plan-shares.ts (che importano lib/supabase/server) non vengano
// mai trascinati qui per errore (stesso bug di build causato da
// ADDRESS_KIND_LABELS/RESPONSIBLE_OPTIONS, vedi lib/nextgen/address-kinds.ts).
import type { WeekResponsibility } from "@/lib/data/responsibilities";
import type { PlanShare } from "@/lib/data/plan-shares";
import type { PlannerMapPin } from "@/lib/data/planner-map";
import type { Reminder } from "@/lib/nextgen/reminders";
import { Kid, CommunityItem, GroupItem } from "@/lib/types";
import { lightBgClasses } from "@/lib/colors";
import ActivityCard from "@/components/ActivityCard";
import PageHeader from "@/components/PageHeader";
import NextgenBadge from "@/components/nextgen/NextgenBadge";
import PlannerModeTabs, { PlannerMode, PLANNER_MODES } from "@/components/nextgen/PlannerModeTabs";
import PlannerBudgetView from "@/components/nextgen/PlannerBudgetView";
import PlannerCalendarView from "@/components/nextgen/PlannerCalendarView";
import PlannerMapView from "@/components/nextgen/PlannerMapView";
import PlannerGroupsView from "@/components/nextgen/PlannerGroupsView";
import Link from "next/link";

const REMINDER_TONE_CLASSES: Record<Reminder["tone"], string> = {
  urgent: "bg-[#FDECEC] text-[#B02A2A]",
  warning: "bg-[#FFF7E8] text-[#9a6b00]",
  info: "bg-trama-lilac/20 text-trama-violet",
};

// SPRINT 3 (NEXTGEN) — Planner come "cuore dell'esperienza": timeline
// familiare completa (13 settimane), sovrapposizioni, settimana prioritaria
// da riempire, budget impegnato, consigli — tutto qui, non sparso fra Home e
// "Le mie prenotazioni" (LEGACY, che resta il posto per annullare/modificare,
// vedi link "Gestisci prenotazioni" in fondo). Riuso: ActivityCard, PageHeader,
// NextgenBadge, lightBgClasses — nessun componente visivo nuovo per le parti
// già esistenti altrove.
//
// SPRINT 5.1 (NEXTGEN) — "Family Planner" (PRD di Fabrizio): il Planner
// diventa il centro operativo, con 5 modalità sugli stessi dati.
// Organizzazione, Budget, Calendario, Mappa e — da Sprint 5.6 — Gruppi (vedi
// PlannerGroupsView, riepilogo di Community + Gruppi sconto, riuso puro dei
// dati già letti in Sprint 4) sono ora tutte funzionanti.
// weekIndexFromLabel spostato in lib/nextgen/planner-insights.ts (serve
// anche a lib/nextgen/reminders.ts per l'azione "week" dei promemoria).

export default function PlannerClient({
  planner,
  kids,
  overlaps,
  budget,
  priorityIndex,
  recommendations,
  missions,
  reminders,
  seasonBudgetTarget,
  responsibilities,
  existingShares,
  mapPins,
  communities,
  groups,
}: {
  planner: PlannerData;
  kids: Kid[];
  overlaps: KidOverlap[];
  budget: BudgetSummary;
  priorityIndex: number | null;
  recommendations: SmartMatch[];
  missions: Mission[];
  reminders: Reminder[];
  seasonBudgetTarget: number | null;
  responsibilities: WeekResponsibility[];
  existingShares: PlanShare[];
  mapPins: PlannerMapPin[];
  communities: CommunityItem[];
  groups: GroupItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // SPRINT CORRETTIVO — deep-link da /nextgen/planner/logistica ("Condivisione
  // piano" apre direttamente la modalita' Calendario, dove quella feature
  // vive davvero, invece di lasciare l'utente in Organizzazione a cercarla).
  // Fallback silenzioso su "organizzazione" se il valore non e' valido.
  const initialModeParam = searchParams.get("mode");
  const initialMode: PlannerMode = PLANNER_MODES.some((m) => m.key === initialModeParam)
    ? (initialModeParam as PlannerMode)
    : "organizzazione";
  const [mode, setMode] = useState<PlannerMode>(initialMode);
  const perKidCoverage = useMemo(() => computePerKidCoverage(planner, kids), [planner, kids]);

  // SPRINT CORRETTIVO — Calendario non e' piu' un tab a se stante: vive qui,
  // dentro Organizzazione, dietro un riquadro pieghevole. Se si arriva da
  // ?mode=calendario (link "Condivisione piano" dell'hub Logistica), il
  // riquadro parte gia' aperto invece di lasciare l'utente a cercarlo.
  const [calendarExpanded, setCalendarExpanded] = useState(initialModeParam === "calendario");
  // SPRINT CORRETTIVO — "Ogni barra del bambino... deve portare ad un
  // dettaglio del piano (per bambino)": click su una barra apre/chiude un
  // pannello inline con le singole settimane di quel bambino (copertura
  // derivata da planner.weeks, nessuna nuova query).
  const [expandedKidId, setExpandedKidId] = useState<string | null>(null);
  // SPRINT CORRETTIVO — "...o lo stato per settimana deve portare ad un
  // dettaglio del piano (per settimana)": click su una barra della striscia
  // "Stato per settimana" scorre fino alla riga corrispondente della
  // Timeline sotto (che e' gia' il "dettaglio" — nome attivita, stato,
  // CTA "Riempi") e la evidenzia per un istante.
  const [highlightedWeekIndex, setHighlightedWeekIndex] = useState<number | null>(null);
  function jumpToWeek(index: number) {
    setHighlightedWeekIndex(index);
    document.getElementById(`week-row-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setHighlightedWeekIndex((cur) => (cur === index ? null : cur)), 1600);
  }
  // SPRINT CORRETTIVO — "vorrei semplificare le notifiche, sono troppe": prima
  // Promemoria (fino a 4) e Missioni (fino a 3) si impilavano entrambe per
  // intero, fino a 7 banner uno sopra l'altro. Ora se ne mostra UNA sola (la
  // piu' urgente: un Promemoria se presente, altrimenti la prima Missione),
  // con un link "Mostra tutti" per chi vuole vedere il resto — nessun dato
  // perso, solo meno rumore visivo di default.
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  // SPRINT CORRETTIVO (feedback Fabrizio: "le notifiche nascoste devono
  // avere una CTA e un routing") — ogni alert porta con sé l'azione già
  // calcolata dalla sua funzione di dominio (lib/nextgen/reminders.ts /
  // missions.ts): "week" scorre alla riga della Timeline, "mode" cambia tab
  // (es. Budget), "link" naviga altrove. Le missioni "success" restano senza
  // action (sono solo rassicurazione, nessuna azione sensata).
  const allAlerts = useMemo(
    () => [
      ...reminders.map((r) => ({ id: r.id, emoji: r.emoji, text: r.text, className: REMINDER_TONE_CLASSES[r.tone], action: r.action })),
      ...missions.map((m) => ({
        id: m.id,
        emoji: m.emoji,
        text: m.text,
        className: m.tone === "success" ? "bg-[#E8F9EE] text-ink" : "bg-trama-lilac/20 text-ink",
        action: m.action,
      })),
    ],
    [reminders, missions]
  );

  const overlapsByWeekIndex = useMemo(() => {
    const map = new Map<number, KidOverlap[]>();
    for (const o of overlaps) {
      const idx = weekIndexFromLabel(o.weekLabel);
      if (idx === null) continue;
      const list = map.get(idx) ?? [];
      list.push(o);
      map.set(idx, list);
    }
    return map;
  }, [overlaps]);

  const neededCount = planner.weeks.filter((w) => !w.dismissed).length;
  // BUGFIX (segnalato da Fabrizio: "5 di 4 settimane coperte") —
  // planner.coveredCount conta anche settimane coperte ma "non ti servono"
  // (dismissed), quindi il rapporto poteva superare il 100%.
  // coveredNeededCount esclude le dismissed anche al numeratore.
  const progressPercent = neededCount > 0 ? Math.round((planner.coveredNeededCount / neededCount) * 100) : 0;
  const priorityWeek = planner.weeks.find((w) => w.index === priorityIndex) ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Planner" onBack={() => router.push("/nextgen")} showBrandIcon />
      <div className="px-5 py-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs text-ink-2">
            {mode === "budget" ? "Quanto stai spendendo per questa estate." : "La timeline completa della tua famiglia per l'estate."}
          </p>
          <NextgenBadge />
        </div>

        <PlannerModeTabs mode={mode} onChange={setMode} />

        {mode === "mappa" && <PlannerMapView pins={mapPins} />}

        {mode === "gruppi" && <PlannerGroupsView communities={communities} groups={groups} />}

        {mode === "budget" && <PlannerBudgetView budget={budget} seasonBudgetTarget={seasonBudgetTarget} />}

        {mode === "organizzazione" && (
        <>
        {/* SPRINT CORRETTIVO — un solo avviso mostrato di default (il più
            urgente), "Mostra tutti" per il resto. Vedi allAlerts sopra. */}
        {allAlerts.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {(showAllAlerts ? allAlerts : allAlerts.slice(0, 1)).map((a) => {
              const rowClass = `flex w-full items-start gap-2.5 rounded-2xl p-3.5 text-left ${a.className}`;
              const inner = (
                <>
                  <span className="text-base leading-none">{a.emoji}</span>
                  <span className="flex-1 text-[12.5px] font-medium">{a.text}</span>
                  {a.action && <i className="ti ti-chevron-right flex-shrink-0 text-base opacity-60" />}
                </>
              );
              if (!a.action) {
                return (
                  <div key={a.id} className={rowClass}>
                    {inner}
                  </div>
                );
              }
              if (a.action.type === "link") {
                return (
                  <Link key={a.id} href={a.action.href} className={rowClass}>
                    {inner}
                  </Link>
                );
              }
              const action = a.action;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    if (action.type === "week") jumpToWeek(action.index);
                    else if (action.type === "mode") setMode(action.mode);
                  }}
                  className={rowClass}
                >
                  {inner}
                </button>
              );
            })}
            {allAlerts.length > 1 && (
              <button
                type="button"
                onClick={() => setShowAllAlerts((v) => !v)}
                className="self-start text-[11.5px] font-semibold text-trama-violet"
              >
                {showAllAlerts ? "Mostra meno" : `Mostra tutti (${allAlerts.length})`}
              </button>
            )}
          </div>
        )}

        {/* 1. Copertura — stessa domanda guida della Dashboard ("la mia
            famiglia è organizzata?"), qui con il dettaglio completo.
            SPRINT CORRETTIVO: aggiunta una riga di rassicurazione quando non
            manca nulla — prima, a copertura completa, questa card restava
            puramente informativa (solo numeri), senza mai "dire" che va
            tutto bene. */}
        <div className="mb-4 rounded-2xl bg-white p-4">
          <div className="flex items-center justify-between text-[13px] font-semibold text-ink-2">
            <span>{planner.coveredNeededCount} di {neededCount} settimane coperte</span>
            {neededCount < planner.totalCount && (
              <span>{planner.totalCount - neededCount} non ti servono</span>
            )}
          </div>
          <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-[#EEF0F4]">
            <div
              className="h-full rounded-full bg-trama-violet transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progressPercent >= 100 && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-green">
              <i className="ti ti-circle-check-filled text-[14px]" />
              Tutto sotto controllo per questa estate.
            </p>
          )}
        </div>

        {/* Copertura per bambino — "Sofia 7/8 settimane" (mockup condiviso
            da Fabrizio): solo se c'è più di un bambino, altrimenti è un
            doppione della card di copertura sopra.
            SPRINT CORRETTIVO: aggiunto "Mancano Settimana X, Y" (mockup
            "2. Calendario") + click sulla barra apre/chiude il dettaglio
            settimana-per-settimana di quel bambino, sotto. */}
        {kids.length > 1 && (
          <div className="mb-4 rounded-2xl bg-white p-4">
            <div className="mb-2.5 font-poppins text-[13px] font-bold text-ink">Copertura per bambino</div>
            <div className="flex flex-col gap-2.5">
              {perKidCoverage.map((k) => {
                const percent = k.neededCount > 0 ? Math.round((k.coveredCount / k.neededCount) * 100) : 0;
                const done = k.coveredCount === k.neededCount && k.neededCount > 0;
                const isExpanded = expandedKidId === k.kidId;
                return (
                  <div key={k.kidId}>
                    <button
                      type="button"
                      onClick={() => setExpandedKidId(isExpanded ? null : k.kidId)}
                      className="w-full text-left"
                      aria-expanded={isExpanded}
                    >
                      <div className="mb-1 flex items-center justify-between text-[12.5px]">
                        <span className="font-semibold text-ink">{k.kidName}</span>
                        <span className={done ? "font-semibold text-green" : "text-ink-2"}>
                          {done ? "Tutto organizzato! 🎉" : `${k.coveredCount}/${k.neededCount} settimane`}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EEF0F4]">
                        <div
                          className={`h-full rounded-full ${done ? "bg-green" : "bg-orange-mid/60"}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      {!done && k.missingIndexes.length > 0 && (
                        <p className="mt-1 text-[11px] text-ink-3">
                          Mancano Settimana {k.missingIndexes.join(", ")}
                        </p>
                      )}
                    </button>
                    {isExpanded && (
                      <div className="mt-2 flex flex-wrap gap-1.5 rounded-xl bg-bg p-2.5">
                        {planner.weeks
                          .filter((w) => !w.dismissed)
                          .map((w) => {
                            const covered = w.coveredKids.some((c) => c.kidId === k.kidId);
                            return (
                              <span
                                key={w.index}
                                className={`rounded-full px-2 py-1 text-[10.5px] font-semibold ${
                                  covered ? "bg-[#E8F9EE] text-green" : "bg-white text-ink-3"
                                }`}
                              >
                                {w.index}
                              </span>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SPRINT CORRETTIVO (mockup "2. Calendario") — "Stato per settimana":
            striscia compatta, un colpo d'occhio sull'intera stagione senza
            scorrere la Timeline sotto. Click su una barra scorre fino alla
            riga corrispondente della Timeline e la evidenzia (vedi
            jumpToWeek sopra) — quella riga È il "dettaglio per settimana"
            richiesto da Fabrizio, non serve duplicarlo. */}
        <div className="mb-4 rounded-2xl bg-white p-4">
          <div className="mb-2.5 font-poppins text-[13px] font-bold text-ink">Stato per settimana</div>
          <div className="flex items-end gap-1">
            {planner.weeks.map((w) => {
              const hasOverlap = overlapsByWeekIndex.has(w.index);
              const status = computeWeekStatus(w, kids.length, hasOverlap, w.index === priorityIndex);
              return (
                <button
                  key={w.index}
                  type="button"
                  onClick={() => jumpToWeek(w.index)}
                  title={`Settimana ${w.index}`}
                  aria-label={`Vai al dettaglio della Settimana ${w.index}`}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div className={`h-6 w-full rounded-full ${WEEK_STATUS_BAR_CLASS[status]}`} />
                  <span className="text-[9px] font-semibold text-ink-3">{w.index}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SPRINT CORRETTIVO (feedback Fabrizio): "anche Planner-Calendario
            finirebbero a collassare nella stessa sezione" — Mese/Settimana +
            "Chi fa cosa?" + "Condivisione piano" (PlannerCalendarView,
            invariato) restano tutti raggiungibili da qui, dietro questo
            riquadro pieghevole, invece che da un tab a sé. Bottone chiamato
            "Calendario" di proposito: stesso testo del vecchio tab, cosi il
            click per aprirlo resta identico a prima. */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setCalendarExpanded((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left"
            aria-expanded={calendarExpanded}
          >
            <span className="flex items-center gap-2 font-poppins text-[13px] font-bold text-ink">
              <i className="ti ti-calendar text-[16px] text-trama-violet" />
              Calendario
            </span>
            <i className={`ti ${calendarExpanded ? "ti-chevron-up" : "ti-chevron-down"} text-[16px] text-ink-3`} />
          </button>
          {calendarExpanded && (
            <div className="mt-3">
              <PlannerCalendarView
                weeks={planner.weeks}
                kids={kids}
                overlaps={overlaps}
                responsibilities={responsibilities}
                existingShares={existingShares}
              />
            </div>
          )}
        </div>

        {/* 2. Sovrapposizioni — segnale di rischio reale, non decorativo:
            mostrato solo se c'è davvero qualcosa da controllare. */}
        {overlaps.length > 0 && (
          <div className="mb-4 rounded-2xl border border-[#F5D6A8] bg-[#FFF7E8] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#9a6b00]">
              <i className="ti ti-alert-triangle text-base" />
              Sovrapposizioni da controllare
            </div>
            <div className="flex flex-col gap-1.5">
              {overlaps.map((o) => {
                const gender = kids.find((k) => k.id === o.kidId)?.gender;
                return (
                  <p key={`${o.kidId}-${o.weekId}`} className="text-[12.5px] text-[#7a5400]">
                    <strong>{o.kidName}</strong> risulta {overlapVerb(gender)} due volte in {o.weekLabel}:{" "}
                    {formatBookingNames(o.bookings.map((b) => b.activityName))}.
                  </p>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Timeline familiare — tutte le settimane della stagione. */}
        <div className="mb-4">
          <div className="mb-2.5 font-poppins text-sm font-bold text-ink">Timeline della stagione</div>
          <div className="flex flex-col gap-1.5">
            {planner.weeks.map((w) => {
              const isPartial = w.covered && w.coveredKids.length > 0 && w.coveredKids.length < kids.length;
              const hasOverlap = overlapsByWeekIndex.has(w.index);
              const color = w.activityTagColor ?? "sky";
              const rowBg = w.dismissed
                ? "bg-white"
                : w.covered
                  ? isPartial || hasOverlap
                    ? "bg-[#FFF7E8]"
                    : lightBgClasses[color]
                  : w.index === priorityIndex
                    ? "bg-trama-lilac/20"
                    : "bg-white";

              // SPRINT CORRETTIVO — id + anello viola temporaneo: bersaglio
              // dello scroll-to + evidenziazione quando si clicca la barra
              // corrispondente in "Stato per settimana" sopra.
              const isHighlighted = highlightedWeekIndex === w.index;
              return (
                <div
                  key={w.index}
                  id={`week-row-${w.index}`}
                  className={`flex items-center gap-3 rounded-xl p-3 transition-shadow ${rowBg} ${
                    isHighlighted ? "ring-2 ring-trama-violet" : ""
                  }`}
                >
                  {/* SEGNALAZIONE DI FABRIZIO: "settimana 12 e 13 vanno a capo" —
                      con una larghezza fissa (84px) "Settimana 12"/"Settimana 13"
                      (12 caratteri, più larghi di "Settimana 1".."Settimana 9")
                      arrivavano al limite e andavano a capo. whitespace-nowrap
                      + larghezza automatica (solo flex-shrink-0, nessun width
                      fisso): la colonna si allarga quanto serve, il testo non
                      va mai a capo, qualunque sia il numero della settimana. */}
                  <div className="flex-shrink-0">
                    <div className="whitespace-nowrap text-[12.5px] font-bold text-ink">Settimana {w.index}</div>
                    <div className="whitespace-nowrap text-[10.5px] text-ink-2">{w.dateRange}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    {w.dismissed ? (
                      <span className="text-[12px] text-ink-3">Non ti serve</span>
                    ) : w.covered ? (
                      <span className="truncate text-[12.5px] font-semibold text-ink">
                        {w.activityName}
                        {isPartial && ` · manca ${kids.length - w.coveredKids.length} bambino/i`}
                      </span>
                    ) : (
                      <span className="text-[12px] font-medium text-ink-3">
                        Scoperta{w.index === priorityIndex ? " · priorità" : ""}
                      </span>
                    )}
                  </div>
                  {/* BUGFIX (segnalato da Fabrizio: "se non mi serve perché
                      c'è il triangolino?") — il triangolo ignorava
                      completamente lo stato "dismissed": una settimana
                      "Non ti serve" con una sovrapposizione rilevata lo
                      mostrava comunque, in contraddizione con la riga
                      stessa. Il segnale resta comunque visibile nel box
                      "Sovrapposizioni da controllare" sopra. */}
                  {hasOverlap && !w.dismissed && <i className="ti ti-alert-triangle flex-shrink-0 text-base text-[#9a6b00]" />}
                  {!w.dismissed && !w.covered && (
                    <Link
                      href="/nextgen/search"
                      className="flex-shrink-0 rounded-full bg-trama-violet px-3 py-1.5 text-[11px] font-bold text-white"
                    >
                      Riempi
                    </Link>
                  )}
                  {w.covered && !hasOverlap && (
                    <i className={`ti ti-circle-check-filled flex-shrink-0 text-[18px] ${isPartial ? "text-[#9a6b00]" : "text-green"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SPRINT CORRETTIVO (feedback Fabrizio: "il Budget impegnato non mi
            interessa qui, c'è una sezione dedicata no?") — rimossa la card
            duplicata: il riepilogo budget vive solo nel tab "Budget"
            (PlannerBudgetView), niente più doppione qui in Organizzazione. */}

        {/* 4. Consigliate — stessa logica di Ricerca (Sprint 2), qui mirata
            alla settimana prioritaria. */}
        {recommendations.length > 0 && (
          <div>
            <div className="mb-2.5 flex items-center gap-1 font-poppins text-sm font-bold text-ink">
              {priorityWeek ? `Per riempire la Settimana ${priorityWeek.index}` : "Consigliate per te"}
            </div>
            <div className="flex flex-col gap-1">
              {recommendations.map((m) => (
                <div key={m.activity.id}>
                  {m.reasons.length > 0 && (
                    <div className="mb-1 flex flex-wrap gap-1 px-1">
                      {m.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="rounded-full bg-trama-lilac/20 px-2 py-0.5 text-[10px] font-semibold text-trama-violet"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                  <ActivityCard activity={m.activity} matchPercent={Math.min(99, Math.round(m.score))} />
                </div>
              ))}
            </div>
          </div>
        )}
        </>
        )}

      </div>
    </div>
  );
}
