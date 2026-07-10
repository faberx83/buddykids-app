"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Kid, PillColor } from "@/lib/types";
import { PlannerData, SeasonWeek } from "@/lib/data/planner";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { toggleWeekDismissedAction } from "@/app/actions/profile";
import { lightBgClasses, solidBgClasses } from "@/lib/colors";
import { categories } from "@/lib/mock-data";

// Colore testo/icona pieno per categoria (thumbnail settimana coperta) —
// stessi colori di lib/colors.ts pillClasses, qui separati dallo sfondo.
const TINT_TEXT_CLASSES: Record<PillColor, string> = {
  sky: "text-sky",
  aqua: "text-[#1fa88e]",
  orange: "text-[#d4622a]",
  purple: "text-[#6b58d4]",
  green: "text-[#2d8f52]",
};

const DEFAULT_KID_COLOR: PillColor = "sky";

// Vista "risolta" di una settimana per la modalità corrente (aggregata o per
// un bambino specifico) — calcolata da SeasonWeek + il filtro attivo.
interface ResolvedWeek extends SeasonWeek {
  viewCovered: boolean;
  viewActivityName?: string;
  viewActivityTagColor?: PillColor;
  viewActivitySlug?: string;
  // Solo in vista aggregata con più bambini: la settimana è coperta ma non
  // per TUTTI — utile a non far credere al genitore che sia a posto quando
  // in realtà manca ancora un figlio.
  partialForKids: Kid[]; // bambini NON ancora coperti questa settimana (vuoto se non parziale)
}

export default function PlannerView({
  planner,
  activities,
  availabilityByWeek,
  kids,
}: {
  planner: PlannerData;
  // Tutte le attività (non solo un top-4 precotto): il filtro per
  // disponibilità/preferenze bambino ora avviene QUI, perché dipende dalla
  // settimana prioritaria e dal bambino selezionato, entrambi stato interno
  // di questo componente.
  activities: Activity[];
  // Per ciascuna delle 13 settimane stagionali (chiave: data ISO di inizio),
  // gli id delle attività con posti liberi che si sovrappongono — vedi
  // lib/data/activities.ts#getActivityAvailabilityByWeek (stessa funzione
  // usata dal filtro Date di Cerca).
  availabilityByWeek: Record<string, string[]>;
  kids: Kid[];
}) {
  const [weeks, setWeeks] = useState<SeasonWeek[]>(planner.weeks);
  const [saving, setSaving] = useState<string | null>(null);
  // null = "Tutti i bambini" (vista aggregata, comportamento storico) —
  // mostriamo il selettore solo se ci sono davvero più bambini tra cui
  // scegliere, per non aggiungere un controllo inutile alle famiglie con un
  // figlio solo.
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);
  const showKidFilter = kids.length > 1;

  const resolvedWeeks: ResolvedWeek[] = useMemo(() => {
    return weeks.map((w) => {
      if (selectedKidId === null) {
        const partialForKids =
          showKidFilter && w.covered
            ? kids.filter((k) => !w.coveredKids.some((c) => c.kidId === k.id))
            : [];
        return {
          ...w,
          viewCovered: w.covered,
          viewActivityName: w.activityName,
          viewActivityTagColor: w.activityTagColor,
          viewActivitySlug: w.activitySlug,
          partialForKids,
        };
      }
      const entry = w.coveredKids.find((c) => c.kidId === selectedKidId);
      return {
        ...w,
        viewCovered: Boolean(entry),
        viewActivityName: entry?.activityName,
        viewActivityTagColor: entry?.activityTagColor,
        viewActivitySlug: entry?.activitySlug,
        partialForKids: [],
      };
    });
  }, [weeks, selectedKidId, kids, showKidFilter]);

  const { coveredCount, neededCount, totalCount, priorityIndex } = useMemo(() => {
    const covered = resolvedWeeks.filter((w) => w.viewCovered).length;
    const needed = resolvedWeeks.filter((w) => !w.dismissed).length;
    const neededUncovered = resolvedWeeks.filter((w) => !w.viewCovered && !w.dismissed);

    // "Settimana prioritaria" da riempire (richiesto da Fabrizio): prima si
    // prendeva sempre e solo la prima scoperta in ordine cronologico. Ora si
    // preferisce un "buco" — una settimana scoperta con almeno una coperta
    // PRIMA e almeno una coperta DOPO nell'intera stagione — perché
    // interrompe una continuità già prenotata ed è la più urgente da
    // sistemare. Se non c'è nessun buco del genere, si torna al
    // comportamento storico (prima scoperta/necessaria in ordine).
    let priority: number | null = null;
    if (neededUncovered.length > 0) {
      const coveredBefore = (idx: number) => resolvedWeeks.some((w) => w.index < idx && w.viewCovered);
      const coveredAfter = (idx: number) => resolvedWeeks.some((w) => w.index > idx && w.viewCovered);
      const gap = neededUncovered.find((w) => coveredBefore(w.index) && coveredAfter(w.index));
      priority = (gap ?? neededUncovered[0]).index;
    }

    return {
      coveredCount: covered,
      neededCount: needed,
      totalCount: resolvedWeeks.length,
      priorityIndex: priority,
    };
  }, [resolvedWeeks]);

  const progressPercent = neededCount > 0 ? Math.round((coveredCount / neededCount) * 100) : 0;

  const priorityWeek = useMemo(
    () => resolvedWeeks.find((w) => w.index === priorityIndex) ?? null,
    [resolvedWeeks, priorityIndex]
  );

  // Preferenze del bambino selezionato (kid.interests, impostate nel
  // profilo) — salvate come stringa "emoji Etichetta" (vedi
  // ProfileKidsSection.tsx), tradotte negli id di categoria confrontabili
  // con activity.tagIds. Solo in vista per-bambino: in aggregato ("Tutti")
  // non c'è un singolo set di preferenze da applicare.
  const kidInterestTagIds = useMemo(() => {
    const kid = selectedKidId ? kids.find((k) => k.id === selectedKidId) : null;
    if (!kid?.interests?.length) return [];
    return categories.filter((c) => kid.interests!.includes(`${c.emoji} ${c.label}`)).map((c) => c.id);
  }, [selectedKidId, kids]);

  // Suggerimenti per riempire la settimana prioritaria: SOLO attività con
  // disponibilità reale in quella settimana (activity_weeks.spots_left > 0)
  // e, se un bambino specifico è selezionato, che rientrano nelle sue
  // preferenze — prima erano semplicemente le 4 attività con rating
  // migliore, senza alcun filtro (potevano non avere posti, o non
  // interessare affatto quel bambino).
  const suggestions = useMemo(() => {
    if (!priorityWeek) return [];
    const availableIds =
      isSupabaseConfigured && availabilityByWeek[priorityWeek.startDate]
        ? new Set(availabilityByWeek[priorityWeek.startDate])
        : null;

    return [...activities]
      .filter((a) => {
        if (availableIds && a.dbId && !availableIds.has(a.dbId)) return false;
        if (kidInterestTagIds.length > 0 && !a.tagIds.some((id) => kidInterestTagIds.includes(id))) return false;
        return true;
      })
      .sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount)
      .slice(0, 4);
  }, [activities, priorityWeek, availabilityByWeek, kidInterestTagIds]);

  async function toggleDismissed(week: SeasonWeek) {
    const nextDismissed = !week.dismissed;
    setWeeks((prev) =>
      prev.map((w) => (w.index === week.index ? { ...w, dismissed: nextDismissed } : w))
    );
    if (isSupabaseConfigured) {
      setSaving(week.startDate);
      await toggleWeekDismissedAction(week.startDate, nextDismissed);
      setSaving(null);
    }
  }

  return (
    <div className="px-5 pt-4">
      {showKidFilter && (
        <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setSelectedKidId(null)}
            className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
              selectedKidId === null ? "bg-ink text-white" : "bg-white text-ink-2"
            }`}
          >
            Tutti
          </button>
          {kids.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setSelectedKidId(k.id)}
              // BUG CORRETTO (segnalato da Fabrizio): il chip selezionato era
              // sempre nero (bg-ink) per qualunque bambino — incoerente con
              // il colore accento già usato altrove per lo stesso bambino
              // (anello avatar in "Per bambino", badge match%). Ora usa
              // kid.accentColor.
              className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                selectedKidId === k.id ? solidBgClasses[k.accentColor ?? DEFAULT_KID_COLOR] : "bg-white text-ink-2"
              }`}
            >
              {k.emoji} {k.name}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 rounded-2xl bg-white p-3.5">
        <div className="flex items-center justify-between text-[12.5px] font-semibold text-ink-2">
          <span>
            {coveredCount} di {neededCount} settimane coperte
            {selectedKidId && ` per ${kids.find((k) => k.id === selectedKidId)?.name ?? ""}`}
          </span>
          {neededCount < totalCount && <span>{totalCount - neededCount} non ti servono</span>}
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-sky-light">
          <div
            className="h-full rounded-full bg-sky transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Legenda colori (segnalazione di Fabrizio: "non ho capito la legenda
          colori arancio giallo verde delle settimane"). Il colore delle
          righe coperte segue la categoria dell'attività (sky/aqua/viola/
          verde/arancio come nel resto dell'app, vedi lib/colors.ts) — solo
          bianco/giallo hanno un significato di STATO fisso, per questo sono
          gli unici due spiegati qui esplicitamente. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-[#D8DEE8] bg-white" />
          Da riempire
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-yellow-light" />
          Manca un bambino
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-sky-light" />
          Coperta (colore = categoria attività)
        </span>
      </div>

      <div className="mb-4 space-y-2.5">
        {resolvedWeeks.map((w) => {
          const color = w.viewActivityTagColor ?? "sky";
          // Copertura parziale (aggregato, manca almeno un bambino): sfondo
          // distinto (giallo/arancio tenue) invece della tinta di categoria
          // usata per le settimane pienamente coperte — richiesto da
          // Fabrizio ("qui devo avere una colorazione diversa"), perché
          // altrimenti sembrava una riga "a posto" identica alle altre.
          const isPartial = w.partialForKids.length > 0;
          const rowBg = w.viewCovered ? (isPartial ? "bg-yellow-light" : lightBgClasses[color]) : "bg-white";
          const riempiHref = selectedKidId
            ? `/search?week=${w.startDate}&kid=${selectedKidId}`
            : `/search?week=${w.startDate}`;
          // Domanda di Fabrizio: "se due bambini della stessa famiglia nella
          // stessa settimana hanno 2 campus diversi cosa succede?" — il dato
          // era già tutto in coveredKids (per bambino), ma la vista aggregata
          // mostrava solo il nome della PRIMA attività trovata, nascondendo
          // silenziosamente il campo diverso del fratello/sorella. Solo in
          // vista "Tutti" (per-bambino non serve: è già filtrato su un solo
          // figlio) segnaliamo quando i bambini coperti questa settimana NON
          // sono tutti nello stesso campo.
          const distinctActivityNames =
            selectedKidId === null ? new Set(w.coveredKids.map((c) => c.activityName)) : new Set<string>();
          const hasDifferentCamps = selectedKidId === null && distinctActivityNames.size > 1;

          return (
            <div key={w.index} className={`rounded-2xl p-3.5 ${rowBg}`}>
              <div className="flex items-center gap-2.5">
                {w.viewCovered ? (
                  <>
                    {/* Segnalazione di Fabrizio: il click su una settimana
                        coperta non portava da nessuna parte — ora apre la
                        scheda dell'attività (thumbnail + testo cliccabili). Le
                        chip "+ Aggiungi" restano fuori dal link (un <a>
                        dentro un altro <a> non è valido) — vedi sotto. */}
                    <Link
                      href={w.viewActivitySlug ? `/activity/${w.viewActivitySlug}` : "#"}
                      // Segnalazione di Fabrizio: "manca un pò la UX che fa
                      // percepire il click che porta alla pagina di
                      // dettaglio del camp" — aggiunto hover/active feedback
                      // (oltre alla chevron già presente più sotto) così la
                      // riga si "sente" cliccabile anche prima del chevron.
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl transition-colors hover:bg-black/[0.03] active:bg-black/[0.06]"
                    >
                      <div className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-xl bg-white/60">
                        <i className={`ti ti-calendar-check text-lg ${TINT_TEXT_CLASSES[color]}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-bold text-ink">
                          {w.viewActivityName ?? "Prenotata"}
                        </div>
                        <div className="mt-0.5 truncate text-[11.5px] text-ink-2">
                          Settimana {w.index} · {w.dateRange}
                          {isPartial && ` · manca per ${w.partialForKids.map((k) => k.name).join(", ")}`}
                        </div>
                      </div>
                      <i className="ti ti-chevron-right flex-shrink-0 text-base text-ink-3" />
                    </Link>
                    {isPartial ? (
                      <i className="ti ti-alert-circle-filled flex-shrink-0 text-[19px] text-yellow" />
                    ) : (
                      <i className="ti ti-circle-check-filled flex-shrink-0 text-[19px] text-green" />
                    )}
                  </>
                ) : w.dismissed ? (
                  <>
                    {/* Segnalazione di Fabrizio: le settimane escluse/scoperte
                        devono avere la stessa naming convention delle coperte
                        ("Settimana N · intervallo date"), non un'etichetta di
                        stato al posto della data — lo stato ("non ti serve")
                        resta ma come riga secondaria, non sostituisce la data. */}
                    <div className="flex-1">
                      <div className="text-[13px] font-medium text-ink-2">Settimana {w.index} · {w.dateRange}</div>
                      <div className="mt-0.5 text-[11px] text-ink-3">non ti serve</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleDismissed(w)}
                      disabled={saving === w.startDate}
                      className="flex-shrink-0 text-xs font-semibold text-sky disabled:opacity-60"
                    >
                      Ripristina
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className="text-[13px] font-bold text-ink-3">Settimana {w.index} · {w.dateRange}</div>
                      <div className="mt-0.5 text-[11px] text-ink-3">scoperta</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleDismissed(w)}
                      disabled={saving === w.startDate}
                      className="flex-shrink-0 text-[11px] font-medium text-ink-3 underline disabled:opacity-60"
                    >
                      Non mi serve
                    </button>
                    <Link
                      href={riempiHref}
                      className="flex-shrink-0 rounded-full bg-orange px-3.5 py-[7px] text-[11.5px] font-bold text-white"
                    >
                      Riempi
                    </Link>
                  </>
                )}
              </div>
              {/* CTA "Aggiungi [bambino]" per ogni figlio non ancora coperto —
                  prima c'era solo un'icona di warning senza alcuna azione.
                  Punta direttamente alla prenotazione della STESSA
                  attività/settimana già scelta per gli altri fratelli (non a
                  Cerca): se quel bambino ha già una prenotazione DIVERSA per
                  questa settimana, la settimana risulta comunque bloccata
                  come "già prenotata" in Prenotazione, per design. Spostata
                  fuori dal link della card (vedi sopra) per non annidare due
                  <a> uno dentro l'altro. */}
              {w.viewCovered && isPartial && w.viewActivitySlug && (
                <div className="mt-1.5 flex flex-wrap gap-1.5 pl-[50px]">
                  {w.partialForKids.map((k) => (
                    <Link
                      key={k.id}
                      href={`/booking/${w.viewActivitySlug}?week=${w.startDate}&kid=${k.id}`}
                      className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#9a6b00] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                    >
                      + Aggiungi {k.name}
                    </Link>
                  ))}
                </div>
              )}
              {/* Risposta alla domanda di Fabrizio: "se due bambini della
                  stessa famiglia nella stessa settimana hanno 2 campus
                  diversi cosa succede?" — succedeva già correttamente (ogni
                  bambino resta prenotato al proprio campo, coveredKids lo
                  traccia per bambino), ma la vista aggregata lo nascondeva
                  mostrando solo il nome della prima attività trovata. Ora lo
                  segnaliamo esplicitamente. */}
              {hasDifferentCamps && (
                <div className="mt-1.5 flex items-start gap-1.5 pl-[50px] text-[11px] text-ink-2">
                  <i className="ti ti-info-circle mt-[1px] flex-shrink-0 text-ink-3" />
                  <span>
                    Campi diversi questa settimana:{" "}
                    {w.coveredKids
                      .map((c) => `${kids.find((k) => k.id === c.kidId)?.name ?? "?"} → ${c.activityName}`)
                      .join(" · ")}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {priorityIndex !== null && suggestions.length > 0 && (
        <div className="mb-2">
          <Link href={`/search?week=${priorityWeek?.startDate}${selectedKidId ? `&kid=${selectedKidId}` : ""}`}>
            <div className="mb-2.5 flex items-center gap-1 text-sm font-bold text-ink">
              Per riempire la settimana {priorityIndex}
              <i className="ti ti-chevron-right text-sm text-ink-3" />
            </div>
          </Link>
          <div className="grid grid-cols-2 gap-3">
            {suggestions.map((a) => {
              const color = a.tags[0]?.color ?? "sky";
              return (
                <Link
                  key={a.id}
                  href={`/activity/${a.id}?week=${priorityWeek?.startDate}${selectedKidId ? `&kid=${selectedKidId}` : ""}`}
                  className={`overflow-hidden rounded-2xl p-2.5 transition-transform hover:scale-[0.985] ${lightBgClasses[color]}`}
                >
                  <div
                    className="flex h-11 items-center justify-center overflow-hidden rounded-xl bg-cover bg-center text-2xl"
                    style={a.coverImageUrl ? { backgroundImage: `url(${a.coverImageUrl})` } : { background: a.imgGradient }}
                  >
                    {!a.coverImageUrl && a.emoji}
                  </div>
                  <div className="mt-2 truncate text-xs font-bold text-ink">{a.name}</div>
                  <div className="text-[11px] text-ink-2">€{a.pricePerWeek}</div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
