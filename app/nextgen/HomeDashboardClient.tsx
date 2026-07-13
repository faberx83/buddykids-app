"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlannerData } from "@/lib/data/planner";
import { MyBooking, BookingStatus } from "@/lib/data/my-bookings";
import { Activity } from "@/lib/types";
import { TodayCheckin } from "@/lib/data/checkin";
import { CommunityHomeSignal } from "@/lib/types";
import ActivityCard from "@/components/ActivityCard";
import NextgenBadge from "@/components/nextgen/NextgenBadge";
import NextgenCheckinCard from "@/components/nextgen/NextgenCheckinCard";
import BookingVisualCard from "@/components/nextgen/BookingVisualCard";

// SPRINT 1 (NEXTGEN) — Dashboard Genitore come "Family Operating System":
// la schermata risponde a "la mia famiglia è organizzata per le prossime
// settimane?", non più "quali prenotazioni ho?".
//
// SPRINT CORRETTIVO — raffinamento, non redesign: la V2 era diventata "più
// razionale ma meno umana" (parole di Fabrizio). Stessa logica dati e stessi
// componenti riusati di Sprint 1/2/3 (getPlannerData, getMyBookingsForParent,
// computeMatchesForKid, getTodayCheckinsForParent — tutti invariati), cambia
// SOLO l'orchestrazione visiva:
//   1) Hero Card "Stato della famiglia" — prima era una card come le altre,
//      ora occupa ~30% dello schermo, sfondo caldo distinto, comunica lo
//      stato con parole (non solo una percentuale)
//   2) Check-in di oggi (se presente) — prima assente in NEXTGEN
//   3) Prossimo appuntamento (singolare — prima erano "prossimi impegni", una
//      lista di 3: qui la Home mostra solo il più imminente, il resto resta
//      nell'elenco completo in fondo, per ridurre le decisioni da prendere)
//   4) Suggerimenti personalizzati
//   5) Planner sintetico (mini timeline, invariata nel dato, upgrade solo
//      visivo) -> apre /nextgen/planner
//   6) Prenotazioni (righe upgradate a BookingVisualCard: foto, figlio,
//      periodo, badge stato, un'unica azione — non più righe di solo testo)
//   7) Statistiche — spostate in fondo e ridotte (erano a metà pagina, con
//      lo stesso peso visivo della Hero Card: ora sono l'ultima cosa, più
//      piccole, perché sono un riepilogo per chi vuole approfondire, non la
//      prima risposta alla domanda "come sto andando?")

type Recommendation = { activity: Activity; kidName: string; matchPercent: number };

type GroupKey = "kid" | "week" | "month" | "activity" | "status";
type SortKey = "date" | "price" | "name";

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "In attesa",
  confirmed: "Confermata",
  cancelled: "Annullata",
};

const MONTH_LABELS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const WEEKDAY_IT = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return "Senza data";
  return `${MONTH_LABELS_IT[m - 1]} ${y}`;
}

function netPrice(b: MyBooking): number {
  return b.totalAmount - b.discountAmount;
}

// "lunedì 14 luglio" — usato solo nella frase del prossimo impegno nella
// Hero Card, per essere leggibile come una frase e non come una data ISO.
function friendlyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const weekday = WEEKDAY_IT[d.getUTCDay()];
  const day = d.getUTCDate();
  const month = MONTH_LABELS_IT[d.getUTCMonth()].toLowerCase();
  return `${weekday} ${day} ${month}`;
}

export default function HomeDashboardClient({
  firstName,
  planner,
  bookings,
  recommendations,
  todayCheckins,
  communitySignal,
}: {
  firstName: string | null;
  planner: PlannerData;
  bookings: MyBooking[];
  recommendations: Recommendation[];
  todayCheckins: TodayCheckin[];
  communitySignal: CommunityHomeSignal | null;
}) {
  const router = useRouter();
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const active = useMemo(() => bookings.filter((b) => b.status !== "cancelled"), [bookings]);

  const upcoming = useMemo(
    () =>
      active
        .filter((b) => b.firstWeekStart && b.firstWeekStart >= todayIso)
        .sort((a, b) => (a.firstWeekStart ?? "").localeCompare(b.firstWeekStart ?? "")),
    [active, todayIso]
  );
  const nextAppointment = upcoming[0] ?? null;
  // Righe da mostrare in "Prenotazioni": le prossime, esclusa quella già
  // mostrata come "Prossimo appuntamento" — evita di ripetere la stessa
  // informazione due volte nella stessa schermata.
  const upcomingForList = upcoming.slice(1, 4);

  const totalSpent = useMemo(() => active.reduce((sum, b) => sum + netPrice(b), 0), [active]);
  const statusCounts = useMemo(() => {
    const counts: Record<BookingStatus, number> = { pending: 0, confirmed: 0, cancelled: 0 };
    for (const b of bookings) counts[b.status]++;
    return counts;
  }, [bookings]);

  const neededCount = planner.weeks.filter((w) => !w.dismissed).length;
  const percent = neededCount > 0 ? Math.round((planner.coveredCount / neededCount) * 100) : 0;
  const gaps = planner.weeks.filter((w) => !w.covered && !w.dismissed);
  const statusEmoji = percent >= 80 ? "🟢" : percent >= 40 ? "🟡" : "🟠";

  const missingWeeksText = useMemo(() => {
    if (gaps.length === 0) return null;
    const names = gaps.slice(0, 2).map((w) => `Settimana ${w.index}`);
    const rest = gaps.length - names.length;
    return names.join(", ") + (rest > 0 ? ` e altre ${rest}` : "");
  }, [gaps]);

  // Sezione secondaria "Tutte le prenotazioni": Vista/Raggruppamento/
  // Ordinamento tenuti separati come richiesto, in fondo e con peso visivo
  // ridotto rispetto alla sintesi sopra.
  const [showAll, setShowAll] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupKey>("week");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  // SEGNALAZIONE DI FABRIZIO: "mi piacerebbe ci fosse modo per comprimere i
  // gruppi o espanderli" — ogni gruppo (Settimana/Mese/Figlio/...) ora si
  // può chiudere singolarmente, non solo l'intera sezione. Nessun gruppo
  // collassato di default: comprimere è un'azione esplicita, non lo stato
  // iniziale (altrimenti si perderebbe la vista d'insieme al primo tocco).
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  function toggleGroupCollapsed(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const groups = useMemo(() => {
    function keyFor(b: MyBooking): { key: string; label: string } {
      if (groupBy === "kid") return { key: b.kidNames[0] ?? "—", label: b.kidNames[0] ?? "Nessun bambino" };
      if (groupBy === "month") {
        const mk = b.firstWeekStart ? b.firstWeekStart.slice(0, 7) : "9999-99";
        return { key: mk, label: monthLabel(mk) };
      }
      if (groupBy === "activity") return { key: b.activityName, label: b.activityName };
      if (groupBy === "status") return { key: b.status, label: STATUS_LABEL[b.status] };
      return { key: b.firstWeekLabel ?? "—", label: b.firstWeekLabel ?? "Senza settimana" };
    }
    const buckets = new Map<string, { label: string; items: MyBooking[] }>();
    for (const b of bookings) {
      const { key, label } = keyFor(b);
      if (!buckets.has(key)) buckets.set(key, { label, items: [] });
      buckets.get(key)!.items.push(b);
    }
    function cmp(a: MyBooking, b: MyBooking): number {
      if (sortKey === "price") return netPrice(a) - netPrice(b);
      if (sortKey === "name") return a.activityName.localeCompare(b.activityName);
      return (a.firstWeekStart ?? "9999").localeCompare(b.firstWeekStart ?? "9999");
    }
    for (const g of buckets.values()) g.items.sort(cmp);
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [bookings, groupBy, sortKey]);

  return (
    <div className="flex flex-col gap-9 px-5 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">
          Ciao{firstName ? ` ${firstName}` : ""} 👋
        </h1>
        <NextgenBadge />
      </div>

      {/* 1) HERO CARD — "quanto è organizzata la mia famiglia?" deve essere
          leggibile in meno di 3 secondi. Sfondo caldo distinto (non bianco
          come il resto della pagina), radius 22px, ombra diffusa, ~30-35%
          dello schermo iniziale. L'elemento grafico discreto (i due cerchi
          sfumati) la rende riconoscibile a colpo d'occhio, senza essere
          un'illustrazione invadente. */}
      <div className="nextgen-hero-bg nextgen-hero-shadow relative overflow-hidden rounded-[22px] p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/30"
        />
        <div aria-hidden className="pointer-events-none absolute -bottom-12 -right-2 h-24 w-24 rounded-full bg-white/20" />
        <div className="relative">
          <p className="mb-1.5 text-sm font-semibold text-ink-2">La tua estate</p>
          {/* SEGNALAZIONE DI FABRIZIO: "sistemare le dimensioni font perché
              vanno a capo" — 28px (era 30px) resta nel range richiesto
              (28-32px) ma lascia più margine sugli schermi stretti. */}
          <h2 className="mb-3 text-[28px] font-bold leading-tight text-ink">
            {statusEmoji} Organizzata al {percent}%
          </h2>
          {/* "Mancano ancora"/"Prossimo impegno" ristrutturate da frase unica
              (rischio di andare a capo a metà) a blocchi etichetta+valore,
              ciascuno con una piccola icona distintiva (richiesta di
              Fabrizio: "ci vuole una iconcina distintiva?"). */}
          <div className="mb-3.5 flex flex-col gap-2.5">
            {missingWeeksText ? (
              <div className="flex items-start gap-2">
                <i className="ti ti-calendar-exclamation mt-0.5 flex-shrink-0 text-base text-[#d4622a]" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink-3">Mancano ancora</div>
                  <div className="text-base font-semibold text-ink">{missingWeeksText}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <i className="ti ti-circle-check-filled mt-0.5 flex-shrink-0 text-base text-green" />
                <div className="text-base font-semibold text-ink">Tutte le settimane utili sono coperte.</div>
              </div>
            )}
            {nextAppointment && (
              <div className="flex items-start gap-2">
                <i className="ti ti-map-pin-filled mt-0.5 flex-shrink-0 text-base text-[#5B4FE9]" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink-3">Prossimo impegno</div>
                  <div className="truncate text-base font-semibold text-ink">
                    {nextAppointment.activityName}
                    {nextAppointment.firstWeekStart ? `, ${friendlyDate(nextAppointment.firstWeekStart)}` : ""}
                  </div>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push("/nextgen/planner")}
            className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-white"
          >
            Continua a pianificare
          </button>
        </div>
      </div>

      {/* 2) Check-in di oggi — momento fondamentale, non una funzione
          secondaria: prima non compariva affatto in NEXTGEN. */}
      {todayCheckins.length > 0 && (
        <div>
          <div className="mb-3 text-[21px] font-semibold text-ink">Oggi</div>
          <NextgenCheckinCard items={todayCheckins} />
        </div>
      )}

      {/* 3) Prossimo appuntamento — un solo elemento, non una lista: il resto
          è nell'elenco "Prenotazioni" più sotto, per non dover valutare 3
          card diverse nella stessa schermata. */}
      {nextAppointment && (
        <div>
          <div className="mb-3 text-[21px] font-semibold text-ink">Prossimo appuntamento</div>
          <BookingVisualCard booking={nextAppointment} />
        </div>
      )}

      {/* SPRINT 4 — piccolo segnale sociale, solo se rilevante: "Home deve
          mostrare piccoli elementi sociali" (richiesta di Fabrizio), non
          invasivo (una riga, nessun popup), link diretto alla community. */}
      {communitySignal && (
        <Link
          href={`/nextgen/community/${communitySignal.communityId}`}
          className="flex items-center gap-2.5 rounded-2xl bg-[#F5F2FF] px-4 py-3"
        >
          <i className="ti ti-users-group flex-shrink-0 text-lg text-[#5B4FE9]" />
          <span className="text-[13px] font-medium text-ink-2">
            <b className="font-bold text-ink">
              {communitySignal.interestCount} {communitySignal.interestCount === 1 ? "famiglia" : "famiglie"}
            </b>{" "}
            di {communitySignal.communityName} stanno valutando {communitySignal.activityName}
          </span>
          <i className="ti ti-chevron-right ml-auto flex-shrink-0 text-ink-3" />
        </Link>
      )}

      {/* 4) Suggerimenti personalizzati — solo se ci sono buchi da riempire */}
      {recommendations.length > 0 && (
        <div>
          <div className="mb-3 text-[21px] font-semibold text-ink">Consigliati per voi</div>
          <div className="flex flex-col gap-1">
            {recommendations.map((r) => (
              <div key={r.activity.id}>
                <div className="mb-1 px-1 text-sm font-semibold text-ink-2">Per {r.kidName}</div>
                <ActivityCard activity={r.activity} matchPercent={r.matchPercent} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5) Planner sintetico — mini timeline, tocco -> planner completo.
          Stesso dato di sempre (planner.weeks), qui solo come anteprima
          visiva: il Planner (Sprint 3) resta il posto per il dettaglio. */}
      <Link href="/nextgen/planner" className="block">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[21px] font-semibold text-ink">Planner</div>
          <span className="flex items-center gap-1 text-sm font-semibold text-[#5B4FE9]">
            Vedi tutto
            <i className="ti ti-chevron-right text-[13px]" />
          </span>
        </div>
        <div className="flex gap-1">
          {planner.weeks.map((w) => (
            <div
              key={w.index}
              title={`${w.label} · ${w.dateRange}`}
              className={`h-2.5 flex-1 rounded-full ${
                w.covered ? "bg-green" : w.dismissed ? "bg-[#E8EBF0]" : "bg-orange-mid/50"
              }`}
            />
          ))}
        </div>
      </Link>

      {/* 6) Prenotazioni — righe visuali (foto, figlio, periodo, badge stato,
          un'azione), non più solo testo. Elenco completo con Raggruppa/
          Ordina resta disponibile ma collassato, volutamente secondario. */}
      {bookings.length > 0 && (
        <div>
          <div className="mb-3 text-[21px] font-semibold text-ink">Prenotazioni</div>

          {upcomingForList.length > 0 && (
            <div className="mb-3 flex flex-col gap-2">
              {upcomingForList.map((b) => (
                <BookingVisualCard key={b.id} booking={b} compact />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-semibold text-ink-2"
          >
            Tutte le prenotazioni ({bookings.length})
            <i className={`ti ti-chevron-${showAll ? "up" : "down"}`} />
          </button>

          {showAll && (
            <div className="mt-3">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-ink-3">Raggruppa:</span>
                {(
                  [
                    { key: "week", label: "Settimana" },
                    { key: "month", label: "Mese" },
                    { key: "kid", label: "Figlio" },
                    { key: "activity", label: "Attività" },
                    { key: "status", label: "Stato" },
                  ] as { key: GroupKey; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setGroupBy(opt.key)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      groupBy === opt.key ? "bg-ink text-white" : "bg-bg text-ink-2"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-ink-3">Ordina:</span>
                {(
                  [
                    { key: "date", label: "Data" },
                    { key: "price", label: "Prezzo" },
                    { key: "name", label: "Nome" },
                  ] as { key: SortKey; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSortKey(opt.key)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      sortKey === opt.key ? "bg-ink text-white" : "bg-bg text-ink-2"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-4">
                {groups.map((g) => {
                  const collapsed = collapsedGroups.has(g.label);
                  return (
                    <div key={g.label}>
                      <button
                        type="button"
                        onClick={() => toggleGroupCollapsed(g.label)}
                        className="mb-1.5 flex w-full items-center justify-between px-1 text-[10px] font-bold uppercase tracking-wide text-ink-3"
                      >
                        <span>
                          {g.label} · {g.items.length}
                        </span>
                        <i className={`ti ti-chevron-${collapsed ? "down" : "up"} text-[13px]`} />
                      </button>
                      {!collapsed && (
                        <div className="flex flex-col gap-2">
                          {g.items.map((b) => (
                            <BookingVisualCard key={b.id} booking={b} compact />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Link href="/prenotazioni" className="mt-4 inline-block text-sm font-semibold text-[#5B4FE9]">
                Gestisci (modifica/annulla) →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* 7) Statistiche — in fondo, ridotte: un riepilogo per chi vuole
          approfondire, non la prima risposta della schermata (quella è la
          Hero Card). Prima erano a metà pagina con lo stesso peso della Hero. */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-bg p-2.5 text-center">
          <div className="text-sm font-bold text-ink">{statusCounts.confirmed}</div>
          <div className="text-[10px] leading-tight text-ink-3">Confermate</div>
        </div>
        <div className="rounded-xl bg-bg p-2.5 text-center">
          <div className="text-sm font-bold text-ink">{statusCounts.pending}</div>
          <div className="text-[10px] leading-tight text-ink-3">In attesa</div>
        </div>
        <div className="rounded-xl bg-bg p-2.5 text-center">
          <div className="text-sm font-bold text-ink">€{totalSpent}</div>
          <div className="text-[10px] leading-tight text-ink-3">Speso finora</div>
        </div>
      </div>
    </div>
  );
}
