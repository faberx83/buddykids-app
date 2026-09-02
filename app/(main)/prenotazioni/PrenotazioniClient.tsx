"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MyBooking, BookingStatus } from "@/lib/data/my-bookings";
import { PlannerData } from "@/lib/data/planner";
import { Kid } from "@/lib/types";
import { cancelBookingAction } from "@/app/actions/bookings";
import PageHeader from "@/components/PageHeader";
import { ComingSoonBadge } from "@/components/StatusBadge";
import ContactCenterButton from "@/components/ContactCenterButton";
import DecorativeIntroCard from "@/components/nextgen/DecorativeIntroCard";

// "Le mie prenotazioni" ridisegnata da Fabrizio come dashboard di
// pianificazione familiare (non più un semplice elenco): "L'obiettivo è
// permettere al genitore di capire in pochi secondi se la propria famiglia è
// organizzata per le prossime settimane e dove ci sono ancora 'buchi' da
// coprire." Tre concetti tenuti separati come richiesto: Vista (Elenco/
// Copertura/Calendario), Raggruppamento (Figlio/Settimana/Mese/Attività/
// Centro/Stato) e Ordinamento (Data/Prezzo/Nome attività/Luogo). Il filtro
// "per bambino" (chip in alto) è un quarto controllo indipendente — non è un
// duplicato del raggruppamento "Figlio": qui FILTRA la lista, il
// raggruppamento la ORGANIZZA — serve anche a supportare il link da Home
// "Già prenotato per [bambino]" (?kid=...).

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "In attesa di conferma",
  confirmed: "Confermata",
  cancelled: "Annullata",
};

const STATUS_CLASS: Record<BookingStatus, string> = {
  pending: "bg-yellow-light text-[#9a6b00]",
  confirmed: "bg-green-light text-green",
  cancelled: "bg-bg text-ink-3",
};

// FIX (FINAL MICRO-PILOT LIVE ACCEPTANCE, 01/09/2026 — segnalazione di
// Fabrizio: la stessa prenotazione risultava "Confermata" qui ma "in attesa
// di conferma del centro" nel Planner). Causa: due colonne INDIPENDENTI su
// bookings — "status" (pending/confirmed/cancelled, transazione/pagamento
// lato genitore — con pagamento demo diventa "confirmed" subito) e
// "partner_decision" (pending/accepted/rejected/proposed, risposta
// OPERATIVA del centro — vedi /center/prenotazioni "Rispondi alle
// prenotazioni ricevute"). Il badge qui guardava SOLO "status", ignorando
// che il centro potesse non aver ancora risposto affatto — il Planner
// (lib/data/planner.ts) guarda invece "partner_decision", da qui la
// discrepanza visibile. Non tocchiamo le due colonne (stato/decisione
// restano concetti distinti, entrambi corretti nel loro dominio): qui si
// corregge solo l'ETICHETTA mostrata al genitore, che ora riflette
// entrambe — "Confermata" da sola resta vera solo quando il centro ha
// anche accettato.
// AGGIORNAMENTO 02/09/2026 (feature "conferma parziale", segnalazione di
// Fabrizio) — un genitore con una prenotazione "Giorni spot" con almeno un
// giorno accettato ma non tutti non deve vedere "Confermata" (falso: alcuni
// giorni non ci sono, o non ancora) né un generico "In attesa di conferma
// del centro" (falso/incompleto: nasconderebbe che qualcosa è GIÀ
// confermato) — vedi lib/booking-response/effective-decision.ts.
//
// AGGIORNAMENTO 02/09/2026 (seconda passata): "partial" ora scatta anche
// mentre il centro deve ancora rispondere per alcuni giorni (non solo a
// risposta completata) — la label distingue i due casi con una nota in più
// quando stillPendingDayCount > 0, invece di far credere che la risposta
// del centro sia già definitiva.
//
// AGGIORNAMENTO 02/09/2026 (terza passata — "come funziona la lista
// d'attesa, chi la vede?"): un giorno "waitlisted" (pieno al momento
// dell'accettazione) era visibile al genitore SOLO via email
// (notifyParentOfBookingResponse) — mai dentro l'app, dove finiva
// indistinguibile da un giorno su cui il centro non aveva ancora nemmeno
// guardato. waitlistedDayCount isola il sottoinsieme per un badge dedicato.
function effectiveStatusBadge(
  b: Pick<
    MyBooking,
    "status" | "partnerDecision" | "acceptedDayCount" | "totalDayCount" | "stillPendingDayCount" | "waitlistedDayCount"
  >
): { label: string; className: string } {
  if (b.status === "confirmed" && b.partnerDecision === "partial") {
    const base = `Confermata parzialmente (${b.acceptedDayCount} di ${b.totalDayCount} giorni)`;
    const notes: string[] = [];
    if (b.waitlistedDayCount > 0) {
      notes.push(`${b.waitlistedDayCount} in lista d'attesa (pien${b.waitlistedDayCount === 1 ? "o" : "i"})`);
    }
    const trulyPending = b.stillPendingDayCount - b.waitlistedDayCount;
    if (trulyPending > 0) notes.push("il centro deve ancora rispondere per gli altri");
    return {
      label: notes.length > 0 ? `${base} — ${notes.join(", ")}` : base,
      className: "bg-[#F0EEFF] text-[#6F63C5]",
    };
  }
  if (b.status === "confirmed" && b.partnerDecision === "pending" && b.waitlistedDayCount > 0) {
    return {
      label: `In lista d'attesa (${b.waitlistedDayCount} giorn${b.waitlistedDayCount === 1 ? "o" : "i"} pien${b.waitlistedDayCount === 1 ? "o" : "i"}) — ti avviseremo se si libera un posto`,
      className: "bg-sky-light text-sky",
    };
  }
  if (b.status === "confirmed" && b.partnerDecision === "pending") {
    return { label: "In attesa di conferma del centro", className: "bg-yellow-light text-[#9a6b00]" };
  }
  return { label: STATUS_LABEL[b.status], className: STATUS_CLASS[b.status] };
}

const MONTH_LABELS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function monthLabelFromKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return "Senza data";
  return `${MONTH_LABELS_IT[m - 1]} ${y}`;
}

type ViewKey = "elenco" | "copertura" | "calendario";
type GroupKey = "kid" | "week" | "month" | "activity" | "center" | "status";
type SortKey = "date" | "price" | "name" | "place";

const VIEW_OPTIONS: { key: ViewKey; label: string; icon: string }[] = [
  { key: "elenco", label: "Elenco", icon: "ti-list" },
  { key: "copertura", label: "Copertura", icon: "ti-calendar-stats" },
  { key: "calendario", label: "Calendario", icon: "ti-calendar" },
];

const GROUP_OPTIONS: { key: GroupKey; label: string }[] = [
  { key: "week", label: "Settimana" },
  { key: "month", label: "Mese" },
  { key: "kid", label: "Figlio" },
  { key: "activity", label: "Attività" },
  { key: "center", label: "Centro" },
  { key: "status", label: "Stato" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Data" },
  { key: "price", label: "Prezzo" },
  { key: "name", label: "Nome attività" },
  { key: "place", label: "Luogo" },
];

function netPrice(b: MyBooking): number {
  return b.totalAmount - b.discountAmount;
}

function compareBookings(a: MyBooking, b: MyBooking, sortKey: SortKey): number {
  switch (sortKey) {
    case "price":
      return netPrice(a) - netPrice(b);
    case "name":
      return a.activityName.localeCompare(b.activityName);
    case "place":
      return a.centerCity.localeCompare(b.centerCity) || a.centerName.localeCompare(b.centerName);
    case "date":
    default:
      return (a.firstWeekStart ?? "9999").localeCompare(b.firstWeekStart ?? "9999");
  }
}

function groupKeyAndLabel(b: MyBooking, groupBy: GroupKey): { key: string; label: string; sortHint: string } {
  switch (groupBy) {
    case "kid":
      return { key: b.kidNames[0] ?? "—", label: b.kidNames[0] ?? "Nessun bambino", sortHint: b.firstWeekStart ?? "9999" };
    case "month": {
      const monthKey = b.firstWeekStart ? b.firstWeekStart.slice(0, 7) : "9999-99";
      return { key: monthKey, label: monthLabelFromKey(monthKey), sortHint: monthKey };
    }
    case "activity":
      return { key: b.activityName, label: b.activityName, sortHint: b.firstWeekStart ?? "9999" };
    case "center":
      return { key: b.centerName || "—", label: b.centerName || "Centro non specificato", sortHint: b.firstWeekStart ?? "9999" };
    case "status":
      return { key: b.status, label: STATUS_LABEL[b.status], sortHint: b.status };
    case "week":
    default:
      return {
        key: b.firstWeekLabel ?? "—",
        label: b.firstWeekLabel ?? "Senza settimana",
        sortHint: b.firstWeekStart ?? "9999",
      };
  }
}

interface BookingGroup {
  key: string;
  label: string;
  items: MyBooking[];
}

export default function PrenotazioniClient({
  bookings,
  planner,
  kids,
  initialKidFilter,
  initialHighlightBookingId,
  showBrandIcon,
}: {
  bookings: MyBooking[];
  planner: PlannerData;
  kids: Kid[];
  initialKidFilter: string | null;
  initialHighlightBookingId: string | null;
  // TRAMA ONE Prenotazioni NEXTGEN-native (24/08/2026): pagina condivisa
  // LEGACY/NEXTGEN (vedi commento più sotto), ma solo il call site NEXTGEN
  // (app/nextgen/prenotazioni/page.tsx) passa true — stesso pattern già usato
  // in ogni altra pagina NEXTGEN Genitore per il logo TRAMA nell'header.
  // Default false: nessun impatto sul call site LEGACY esistente.
  showBrandIcon?: boolean;
}) {
  // Segnalazione di Fabrizio (01/09/2026, "grafica legacy" residua): solo
  // CoverageStrip aveva la variante nextgen (via showBrandIcon come proxy),
  // il resto della pagina (StatCard, link "Modifica", box "Proposta del
  // centro") restava sky hardcoded. showBrandIcon è già il segnale
  // affidabile "questa pagina è montata da NEXTGEN" (stesso identico prop
  // usato sopra per CoverageStrip) — lo riusiamo qui come `nextgen` per
  // restare coerenti con lo stesso pattern del resto dell'app invece di
  // aggiungere un secondo prop ridondante.
  const nextgen = !!showBrandIcon;
  const router = useRouter();
  const [view, setView] = useState<ViewKey>("elenco");
  const [kidFilter, setKidFilter] = useState<string | null>(initialKidFilter);
  // Task #357 (arrivo dal Planner, click su una settimana coperta): evidenzia
  // e scrolla in vista la prenotazione indicata da "?bookingId=" — stesso
  // pattern già usato per "Stato per settimana" nel Planner NEXTGEN
  // (highlightedWeekIndex + scrollIntoView + auto-clear dopo 1600ms).
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(initialHighlightBookingId);
  useEffect(() => {
    if (!initialHighlightBookingId) return;
    const scrollTimeout = window.setTimeout(() => {
      document
        .getElementById(`booking-${initialHighlightBookingId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    const clearTimeout = window.setTimeout(() => setHighlightedBookingId(null), 1600);
    return () => {
      window.clearTimeout(scrollTimeout);
      window.clearTimeout(clearTimeout);
    };
  }, [initialHighlightBookingId]);
  const [groupBy, setGroupBy] = useState<GroupKey>("week");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Gruppi comprimibili (segnalazione di Fabrizio: la stessa funzionalità
  // esisteva solo nella Home NEXTGEN — qui non c'era proprio, per questo
  // sembrava "non funzionare"). Chiave prefissata con il criterio di
  // raggruppamento (non solo l'etichetta) per evitare collisioni quando si
  // cambia "Raggruppa per" (es. un'attività e un centro con lo stesso nome).
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  function toggleGroupCollapsed(groupKey: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const kidsWithBookings = useMemo(() => {
    const idsInBookings = new Set(bookings.flatMap((b) => b.kidIds));
    return kids.filter((k) => idsInBookings.has(k.id));
  }, [bookings, kids]);

  const activeBookings = useMemo(() => bookings.filter((b) => b.status !== "cancelled"), [bookings]);

  const filteredBookings = useMemo(() => {
    if (!kidFilter) return bookings;
    return bookings.filter((b) => b.kidIds.includes(kidFilter));
  }, [bookings, kidFilter]);

  // Statistiche sintetiche — sempre sull'intera famiglia (non filtrate per
  // bambino): "Quanto abbiamo già pianificato e speso?" è una domanda a
  // livello di famiglia, il filtro bambino serve solo a esplorare l'elenco.
  const stats = useMemo(() => {
    const totalSpent = activeBookings.reduce((sum, b) => sum + netPrice(b), 0);
    const upcoming = activeBookings
      .filter((b) => b.firstWeekStart && b.firstWeekStart >= todayIso)
      .sort((a, b) => (a.firstWeekStart ?? "").localeCompare(b.firstWeekStart ?? ""));
    return { count: activeBookings.length, totalSpent, next: upcoming[0] ?? null };
  }, [activeBookings, todayIso]);

  const groups: BookingGroup[] = useMemo(() => {
    const buckets = new Map<string, BookingGroup>();
    for (const b of filteredBookings) {
      const { key, label, sortHint } = groupKeyAndLabel(b, groupBy);
      if (!buckets.has(key)) buckets.set(key, { key: sortHint, label, items: [] });
      buckets.get(key)!.items.push(b);
    }
    for (const group of buckets.values()) {
      group.items.sort((a, b) => compareBookings(a, b, sortKey));
    }
    return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredBookings, groupBy, sortKey]);

  async function handleCancel(bookingId: string) {
    setCancellingId(bookingId);
    setActionError(null);
    const result = await cancelBookingAction(bookingId);
    setCancellingId(null);
    setConfirmCancelId(null);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col pb-6">
      {/* BUGFIX (segnalato da Fabrizio) — pagina condivisa tra profilo LEGACY
          e NEXTGEN: niente backHref fisso, PageHeader ricade su
          router.back() e torna sempre a dove l'utente era arrivato davvero. */}
      <PageHeader title="Le mie prenotazioni" showBrandIcon={showBrandIcon} />

      <div className="px-5 py-4">
        {/* 1) Copertura del periodo — "in pochi secondi" capire cosa è
            organizzato e dove ci sono ancora buchi.
            showBrandIcon è già il segnale (esistente, non nuovo) che questa
            pagina è montata da NEXTGEN (vedi PageHeader sopra) — riusato qui
            per la variante viola coi pallozzi (feedback Fabrizio 31/08:
            coerenza con la Hero Card di Home). LEGACY (showBrandIcon
            assente) resta con la card bianca invariata. */}
        <CoverageStrip planner={planner} nextgen={nextgen} />

        {/* 3) Statistiche sintetiche */}
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          <StatCard label="Attività prenotate" value={String(stats.count)} icon="ti-ticket" nextgen={nextgen} />
          <StatCard label="Speso finora" value={`€${stats.totalSpent}`} icon="ti-coin" nextgen={nextgen} />
          <StatCard
            label="Prossimo impegno"
            value={stats.next ? stats.next.firstWeekLabel ?? "—" : "Nessuno"}
            icon="ti-calendar-event"
            nextgen={nextgen}
          />
        </div>

        {/* Filtro per bambino — quarto controllo indipendente da Vista/
            Raggruppamento/Ordinamento (vedi commento in testa al file). */}
        {kidsWithBookings.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setKidFilter(null)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                kidFilter === null ? "bg-ink text-white" : "bg-bg text-ink-2"
              }`}
            >
              Tutti i bambini
            </button>
            {kidsWithBookings.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKidFilter(k.id)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  kidFilter === k.id ? "bg-ink text-white" : "bg-bg text-ink-2"
                }`}
              >
                {k.name}
              </button>
            ))}
          </div>
        )}

        {/* Vista */}
        <div className="mt-4 flex items-center gap-1.5 rounded-full bg-bg p-1">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setView(opt.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[12.5px] font-semibold transition-colors ${
                view === opt.key ? "bg-white text-ink shadow-sm" : "text-ink-2"
              }`}
            >
              <i className={`ti ${opt.icon} text-[14px]`} />
              {opt.label}
              {opt.key === "calendario" && <ComingSoonBadge label="Presto" />}
            </button>
          ))}
        </div>

        {view === "calendario" ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#D8DEE8] bg-white p-6 text-center">
            <i className="ti ti-calendar mb-2 text-2xl text-ink-3" />
            <div className="mb-1 text-sm font-bold text-ink">Vista calendario in arrivo</div>
            <p className="text-xs text-ink-2">
              Una griglia mensile con tutte le settimane organizzate colpo d&apos;occhio — per ora usa
              &quot;Copertura&quot; per lo stesso obiettivo.
            </p>
          </div>
        ) : view === "copertura" ? (
          <CoperturaView planner={planner} kids={kidsWithBookings} />
        ) : (
          <>
            {/* Raggruppamento / Ordinamento — concetti separati come richiesto.
                SPRINT CORRETTIVO (01/09/2026, segnalazione di Fabrizio dopo
                la live QA: "bisogna sistemare graficamente i 'raggruppa per'
                e 'ordina per' con un layout più moderno e semplice, fai tu
                in base a quello che si fa di solito sulle app con motore di
                ricerca") — le due file di pill (6 + 4 bottoni, andavano a
                capo su due righe ciascuna) diventano due chip compatti in
                un'unica riga, stile filtro di Google Flights/Booking:
                etichetta + valore corrente + freccina, che aprono la stessa
                lista di opzioni in un menu nativo al tap. Stessi state
                (groupBy/sortKey) e stesse opzioni (GROUP_OPTIONS/
                SORT_OPTIONS), cambia solo la presentazione. */}
            <div className="mt-4 flex flex-wrap gap-2">
              <label className="flex items-center gap-1.5 rounded-full bg-bg py-1.5 pl-3 pr-2.5">
                <span className="text-[11px] font-semibold text-ink-3">Raggruppa</span>
                <span className="relative flex items-center">
                  <select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value as GroupKey)}
                    className="appearance-none bg-transparent pr-4 text-[12px] font-bold text-ink outline-none"
                    aria-label="Raggruppa per"
                  >
                    {GROUP_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <i className="ti ti-chevron-down pointer-events-none absolute right-0 text-[11px] text-ink-3" />
                </span>
              </label>
              <label className="flex items-center gap-1.5 rounded-full bg-bg py-1.5 pl-3 pr-2.5">
                <span className="text-[11px] font-semibold text-ink-3">Ordina</span>
                <span className="relative flex items-center">
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="appearance-none bg-transparent pr-4 text-[12px] font-bold text-ink outline-none"
                    aria-label="Ordina per"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <i className="ti ti-chevron-down pointer-events-none absolute right-0 text-[11px] text-ink-3" />
                </span>
              </label>
            </div>

            {actionError && (
              <p className="mt-3 rounded-md bg-orange-light px-3 py-2 text-xs font-medium text-trama-orange">
                {actionError}
              </p>
            )}

            {filteredBookings.length === 0 ? (
              <p className="mt-6 rounded-lg border border-dashed border-[#D8DEE8] bg-white p-5 text-center text-sm text-ink-2">
                Nessuna prenotazione trovata. Trovi le attività disponibili in &quot;Cerca&quot;.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {groups.map((group) => {
                  const groupKey = `${groupBy}:${group.label}`;
                  const collapsed = collapsedGroups.has(groupKey);
                  return (
                    <div key={groupKey}>
                      <button
                        type="button"
                        onClick={() => toggleGroupCollapsed(groupKey)}
                        className="mb-1.5 flex w-full items-center justify-between px-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-3"
                      >
                        <span>
                          {group.label} · {group.items.length}
                        </span>
                        <i className={`ti ti-chevron-${collapsed ? "down" : "up"} text-[13px]`} />
                      </button>
                      {!collapsed && (
                        <div className="flex flex-col gap-2.5">
                          {group.items.map((b) => (
                            <BookingCard
                              key={b.id}
                              booking={b}
                              highlighted={highlightedBookingId === b.id}
                              confirming={confirmCancelId === b.id}
                              cancelling={cancellingId === b.id}
                              onAskCancel={() => setConfirmCancelId(b.id)}
                              onCancelConfirmed={() => handleCancel(b.id)}
                              onCancelAbort={() => setConfirmCancelId(null)}
                              nextgen={nextgen}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  nextgen,
}: {
  label: string;
  value: string;
  icon: string;
  nextgen?: boolean;
}) {
  const accentText = nextgen ? "text-trama-violet" : "text-sky";
  return (
    <div className="rounded-xl border border-[#E8EBF0] bg-white p-3">
      <i className={`ti ${icon} text-[15px] ${accentText}`} />
      <div className="mt-1.5 truncate text-[13px] font-bold text-ink">{value}</div>
      <div className="text-[10.5px] leading-tight text-ink-2">{label}</div>
    </div>
  );
}

// Striscia di copertura compatta (sempre visibile, in cima) — risponde a
// "Abbiamo organizzato tutte le prossime settimane?" con un colpo d'occhio,
// riusando lib/data/planner.ts (la stessa logica già corretta e testata del
// Planner in Home) invece di ricalcolare la copertura da zero qui.
function CoverageStrip({ planner, nextgen }: { planner: PlannerData; nextgen?: boolean }) {
  // Segnalazione 25/08/2026 (Fabrizio): a fine agosto la card diceva ancora
  // "15 settimane ancora da organizzare" su 16 totali — contava anche le
  // settimane di giugno/luglio ormai CONCLUSE, mai selezionate per
  // costruzione perché passate, non perché "dimenticate". Stesso principio
  // già applicato a firstUncoveredWeekIndex (lib/data/planner.ts, 24/08/2026)
  // ma mai a questo conteggio: una settimana passata non è più un "buco" da
  // colmare, quindi va esclusa sia dal conteggio "da organizzare" sotto sia
  // dalle barrette non ancora organizzate mostrate come "urgenti".
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = planner.weeks.filter((w) => !w.dismissed && w.endDate >= todayIso);
  const gaps = upcoming.filter((w) => !w.covered).length;

  const body = (
    <>
      <div className="mb-2.5 flex items-center justify-between">
        <div
          className={
            nextgen
              ? "font-poppins text-[13px] font-bold text-ink"
              : "text-sm font-bold text-ink"
          }
        >
          Copertura dell&apos;estate
        </div>
        <span className="text-[12px] font-semibold text-ink-2">
          {planner.coveredCount}/{planner.totalCount} settimane organizzate
        </span>
      </div>
      <div className="flex gap-1">
        {planner.weeks.map((w) => {
          // Segnalazione 25/08/2026 (Fabrizio, dopo il deploy del fix sopra):
          // il TESTO ora esclude le settimane passate da "ancora da
          // organizzare", ma questa barretta le coloriva comunque come
          // "orange-mid" (stesso colore di un buco reale ancora aperto) —
          // "le settimane passate vanno visualizzate in grigio come non
          // disponibili". w.dismissed è un flag applicativo diverso
          // (settimana esplicitamente esclusa dal genitore), non basta per
          // le settimane semplicemente concluse: serve un secondo check sulla
          // data, stesso confronto isoDate già usato per "gaps" sopra.
          const isPast = !w.covered && w.endDate < todayIso;
          return (
            <div
              key={w.index}
              title={`${w.label} · ${w.dateRange}${
                w.covered ? " — organizzata" : isPast ? " — conclusa" : w.dismissed ? " — non serve" : " — da organizzare"
              }`}
              className={`h-2.5 flex-1 rounded-full ${
                w.covered ? "bg-green" : isPast || w.dismissed ? "bg-[#E8EBF0]" : "bg-orange-mid/50"
              }`}
            />
          );
        })}
      </div>
      {gaps > 0 ? (
        <p className="mt-2 text-[12px] text-ink-2">
          <i className="ti ti-alert-circle mr-1 text-orange-mid" />
          {gaps} settiman{gaps === 1 ? "a" : "e"} ancora da organizzare —{" "}
          {/* BUGFIX (segnalato da Fabrizio, 31/08): questo link puntava
              sempre a "/" (Home LEGACY) anche quando la card è montata su
              NEXTGEN (/nextgen/prenotazioni) — un genitore su NEXTGEN che
              lo cliccava finiva fuori da NEXTGEN senza alcun redirect
              esplicito nel codice a giustificarlo, solo perché l'href era
              hardcoded. Stesso "nextgen" già usato sopra per lo stile:
              qui sceglie anche la destinazione e il colore coerente col
              resto del brand NEXTGEN (trama-violet invece di sky). */}
          <Link
            href={nextgen ? "/nextgen/planner" : "/"}
            className={`font-semibold ${nextgen ? "text-trama-violet" : "text-sky"}`}
          >
            vai al Planner
          </Link>
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-green">
          <i className="ti ti-circle-check mr-1" />
          Tutte le settimane sono organizzate
        </p>
      )}
    </>
  );

  // Variante NEXTGEN (feedback Fabrizio, 31/08): stessi pallozzi viola della
  // Hero Card di Home, invece della card bianca con bordo di LEGACY — vedi
  // DecorativeIntroCard.tsx. LEGACY resta invariato di proposito (nessuna
  // richiesta di toccarlo, la card bianca con bordo è ancora il suo
  // linguaggio visivo attuale).
  if (nextgen) {
    return <DecorativeIntroCard padding="p-4">{body}</DecorativeIntroCard>;
  }

  return <div className="rounded-2xl border border-[#E8EBF0] bg-white p-4">{body}</div>;
}

// Vista "Copertura" estesa: stessa striscia, ma con il dettaglio per
// bambino sotto ogni settimana scoperta — risponde a "Per quale figlio manca
// ancora qualcosa?" senza dover aprire il Planner in Home.
function CoperturaView({ planner, kids }: { planner: PlannerData; kids: Kid[] }) {
  const kidById = new Map(kids.map((k) => [k.id, k]));
  return (
    <div className="mt-4 flex flex-col gap-2">
      {planner.weeks.map((w) => (
        <div
          key={w.index}
          className={`rounded-xl border p-3.5 ${
            w.covered
              ? "border-green-light bg-green-light/40"
              : w.dismissed
              ? "border-[#E8EBF0] bg-bg opacity-70"
              : "border-orange-mid/40 bg-orange-light/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-bold text-ink">{w.label}</div>
              <div className="text-[11px] text-ink-2">{w.dateRange}</div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                w.covered ? "bg-green text-white" : w.dismissed ? "bg-[#E8EBF0] text-ink-3" : "bg-orange-mid text-white"
              }`}
            >
              {w.covered ? "Organizzata" : w.dismissed ? "Non serve" : "Da organizzare"}
            </span>
          </div>
          {w.coveredKids.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {w.coveredKids.map((ck) => (
                <span
                  key={ck.kidId}
                  className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-ink-2"
                >
                  {kidById.get(ck.kidId)?.name ?? "Bambino"} → {ck.activityName}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BookingCard({
  booking: b,
  highlighted,
  confirming,
  cancelling,
  onAskCancel,
  onCancelConfirmed,
  onCancelAbort,
  nextgen,
}: {
  booking: MyBooking;
  highlighted: boolean;
  confirming: boolean;
  cancelling: boolean;
  onAskCancel: () => void;
  onCancelConfirmed: () => void;
  onCancelAbort: () => void;
  nextgen?: boolean;
}) {
  const accentText = nextgen ? "text-trama-violet" : "text-sky";
  const accentLight = nextgen ? "bg-trama-lilac/20" : "bg-sky-light";
  return (
    <div
      id={`booking-${b.id}`}
      className={`rounded-xl border border-[#E8EBF0] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow ${
        highlighted ? "ring-2 ring-trama-violet" : ""
      }`}
    >
      <div className="flex gap-3">
        <div
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cover bg-center text-2xl"
          style={b.coverImageUrl ? { backgroundImage: `url(${b.coverImageUrl})` } : { background: b.imgGradient }}
        >
          {!b.coverImageUrl && b.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
              {!b.readByParent && (
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#FF6B6B]" aria-label="Novità dal centro" />
              )}
              {b.activityName}
            </span>
            <span
              className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${effectiveStatusBadge(b).className}`}
            >
              {effectiveStatusBadge(b).label}
            </span>
          </div>
          <div className="text-xs text-ink-2">{b.weeksLabel}</div>
          {b.centerName && <div className="text-xs text-ink-3">{b.centerName}{b.centerCity ? ` · ${b.centerCity}` : ""}</div>}
          {b.kidNames.length > 0 && <div className="mt-0.5 text-xs text-ink-2">{b.kidNames.join(", ")}</div>}
          {/* TRAMA ONE Build Sprint 4 (DEC-42): il centro ha risposto con una
              proposta alternativa (partner_decision = "proposed") — la
              prenotazione resta "pending" finché il genitore non decide,
              quindi va segnalato qui esplicitamente, non solo con lo status
              badge sopra (che mostrerebbe ancora "In attesa"). */}
          {b.partnerDecision === "proposed" && b.partnerProposalNote && (
            <div className={`mt-1.5 rounded-md ${accentLight} p-2 text-[11px] text-ink`}>
              <span className={`font-semibold ${accentText}`}>Proposta del centro: </span>
              {b.partnerProposalNote}
            </div>
          )}
          <div className="mt-1 text-xs font-semibold text-ink">
            €{netPrice(b)}
            {b.discountAmount > 0 && <span className="ml-1 font-normal text-ink-3 line-through">€{b.totalAmount}</span>}
          </div>
        </div>
      </div>

      {b.status !== "cancelled" && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#F0F2F5] pt-2.5">
          <Link href={`/activity/${b.activityId}`} className="flex items-center gap-1 text-[12px] font-semibold text-ink-2">
            <i className="ti ti-eye text-[13px]" /> Dettagli
          </Link>
          {b.canCancelOrModify ? (
            <>
              <Link
                href={`/prenotazioni/${b.id}/modifica`}
                className={`flex items-center gap-1 text-[12px] font-semibold ${accentText}`}
              >
                <i className="ti ti-edit text-[13px]" /> Modifica
              </Link>
              {confirming ? (
                <span className="flex items-center gap-2 text-[12px]">
                  <span className="font-semibold text-ink">Annullare?</span>
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={onCancelConfirmed}
                    className="font-bold text-orange disabled:opacity-50"
                  >
                    {cancelling ? "Annullo…" : "Sì, annulla"}
                  </button>
                  <button type="button" onClick={onCancelAbort} className="text-ink-3">
                    No
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onAskCancel}
                  className="flex items-center gap-1 text-[12px] font-semibold text-orange"
                >
                  <i className="ti ti-x text-[13px]" /> Annulla
                </button>
              )}
            </>
          ) : (
            <span className="text-[11px] text-ink-3">
              Fuori dai {b.cancellationWindowDays} giorni di preavviso — contatta il centro per modifiche
            </span>
          )}
          {b.activityDbId && <ContactCenterButton activityDbId={b.activityDbId} />}
        </div>
      )}
    </div>
  );
}
