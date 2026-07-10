"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { PlannerData } from "@/lib/data/planner";
import { KidOverlap, BudgetSummary } from "@/lib/nextgen/planner-insights";
import { SmartMatch } from "@/lib/nextgen/smart-search";
import { Kid } from "@/lib/types";
import { lightBgClasses } from "@/lib/colors";
import ActivityCard from "@/components/ActivityCard";
import PageHeader from "@/components/PageHeader";
import NextgenBadge from "@/components/nextgen/NextgenBadge";
import Link from "next/link";

// SPRINT 3 (NEXTGEN) — Planner come "cuore dell'esperienza": timeline
// familiare completa (13 settimane), sovrapposizioni, settimana prioritaria
// da riempire, budget impegnato, consigli — tutto qui, non sparso fra Home e
// "Le mie prenotazioni" (LEGACY, che resta il posto per annullare/modificare,
// vedi link "Gestisci prenotazioni" in fondo). Riuso: ActivityCard, PageHeader,
// NextgenBadge, lightBgClasses — nessun componente visivo nuovo per le parti
// già esistenti altrove.
function weekIndexFromLabel(label: string): number | null {
  const m = label.match(/\d+/);
  return m ? Number(m[0]) : null;
}

export default function PlannerClient({
  planner,
  kids,
  overlaps,
  budget,
  priorityIndex,
  recommendations,
}: {
  planner: PlannerData;
  kids: Kid[];
  overlaps: KidOverlap[];
  budget: BudgetSummary;
  priorityIndex: number | null;
  recommendations: SmartMatch[];
}) {
  const router = useRouter();

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
  const progressPercent = neededCount > 0 ? Math.round((planner.coveredCount / neededCount) * 100) : 0;
  const priorityWeek = planner.weeks.find((w) => w.index === priorityIndex) ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Planner" onBack={() => router.push("/nextgen")} />
      <div className="px-5 py-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs text-ink-2">La timeline completa della tua famiglia per l&apos;estate.</p>
          <NextgenBadge />
        </div>

        {/* 1. Copertura — stessa domanda guida della Dashboard ("la mia
            famiglia è organizzata?"), qui con il dettaglio completo.
            SPRINT CORRETTIVO: aggiunta una riga di rassicurazione quando non
            manca nulla — prima, a copertura completa, questa card restava
            puramente informativa (solo numeri), senza mai "dire" che va
            tutto bene. */}
        <div className="mb-4 rounded-2xl bg-white p-4">
          <div className="flex items-center justify-between text-[13px] font-semibold text-ink-2">
            <span>{planner.coveredCount} di {neededCount} settimane coperte</span>
            {neededCount < planner.totalCount && (
              <span>{planner.totalCount - neededCount} non ti servono</span>
            )}
          </div>
          <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-[#EEF0F4]">
            <div
              className="h-full rounded-full bg-[#5B4FE9] transition-all"
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

        {/* 2. Sovrapposizioni — segnale di rischio reale, non decorativo:
            mostrato solo se c'è davvero qualcosa da controllare. */}
        {overlaps.length > 0 && (
          <div className="mb-4 rounded-2xl border border-[#F5D6A8] bg-[#FFF7E8] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#9a6b00]">
              <i className="ti ti-alert-triangle text-base" />
              Sovrapposizioni da controllare
            </div>
            <div className="flex flex-col gap-1.5">
              {overlaps.map((o) => (
                <p key={`${o.kidId}-${o.weekId}`} className="text-[12.5px] text-[#7a5400]">
                  <strong>{o.kidName}</strong> risulta prenotato due volte in {o.weekLabel}:{" "}
                  {o.bookings.map((b) => b.activityName).join(" e ")}.
                </p>
              ))}
            </div>
          </div>
        )}

        {/* 3. Timeline familiare — tutte le settimane della stagione. */}
        <div className="mb-4">
          <div className="mb-2.5 text-sm font-bold text-ink">Timeline della stagione</div>
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
                    ? "bg-[#EFECFD]"
                    : "bg-white";

              return (
                <div key={w.index} className={`flex items-center gap-3 rounded-xl p-3 ${rowBg}`}>
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
                  {hasOverlap && <i className="ti ti-alert-triangle flex-shrink-0 text-base text-[#9a6b00]" />}
                  {!w.dismissed && !w.covered && (
                    <Link
                      href="/nextgen/search"
                      className="flex-shrink-0 rounded-full bg-[#5B4FE9] px-3 py-1.5 text-[11px] font-bold text-white"
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

        {/* 4. Budget impegnato finora — informativo (non c'è ancora un tetto
            di spesa impostabile), rotto per bambino quando utile. */}
        <div className="mb-4 rounded-2xl bg-white p-4">
          <div className="mb-2.5 text-sm font-bold text-ink">Budget impegnato</div>
          <div className="text-2xl font-bold text-ink">€{budget.totalSpent}</div>
          <div className="mb-2.5 text-[11.5px] text-ink-2">Totale prenotazioni attive di questa stagione.</div>
          {budget.byKid.length > 1 && (
            <div className="flex flex-col gap-1.5 border-t border-[#F0F2F5] pt-2.5">
              {budget.byKid.map((k) => (
                <div key={k.kidId} className="flex items-center justify-between text-[12.5px]">
                  <span className="text-ink-2">{k.kidName}</span>
                  <span className="font-semibold text-ink">€{k.amount}</span>
                </div>
              ))}
              <p className="mt-0.5 text-[10.5px] text-ink-3">
                Le attività condivise tra più figli sono conteggiate per intero su ciascuno.
              </p>
            </div>
          )}
        </div>

        {/* 5. Consigliate — stessa logica di Ricerca (Sprint 2), qui mirata
            alla settimana prioritaria. */}
        {recommendations.length > 0 && (
          <div>
            <div className="mb-2.5 flex items-center gap-1 text-sm font-bold text-ink">
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
                          className="rounded-full bg-[#EFECFD] px-2 py-0.5 text-[10px] font-semibold text-[#5B4FE9]"
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

        <Link href="/prenotazioni" className="mt-2 block text-center text-[12.5px] font-semibold text-[#5B4FE9]">
          Gestisci prenotazioni (annulla/modifica) →
        </Link>
      </div>
    </div>
  );
}
