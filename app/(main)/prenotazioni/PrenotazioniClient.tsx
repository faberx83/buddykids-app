"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MyBooking, BookingStatus } from "@/lib/data/my-bookings";
import { PlannerData } from "@/lib/data/planner";
import { Kid } from "@/lib/types";
import { cancelBookingAction } from "@/app/actions/bookings";
import PageHeader from "@/components/PageHeader";
import { ComingSoonBadge } from "@/components/StatusBadge";
import ContactCenterButton from "@/components/ContactCenterButton";

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
}: {
  bookings: MyBooking[];
  planner: PlannerData;
  kids: Kid[];
  initialKidFilter: string | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<ViewKey>("elenco");
  const [kidFilter, setKidFilter] = useState<string | null>(initialKidFilter);
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
      <PageHeader title="Le mie prenotazioni" />

      <div className="px-5 py-4">
        {/* 1) Copertura del periodo — "in pochi secondi" capire cosa è
            organizzato e dove ci sono ancora buchi. */}
        <CoverageStrip planner={planner} />

        {/* 3) Statistiche sintetiche */}
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          <StatCard label="Attività prenotate" value={String(stats.count)} icon="ti-ticket" />
          <StatCard label="Speso finora" value={`€${stats.totalSpent}`} icon="ti-coin" />
          <StatCard
            label="Prossimo impegno"
            value={stats.next ? stats.next.firstWeekLabel ?? "—" : "Nessuno"}
            icon="ti-calendar-event"
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
            {/* Raggruppamento / Ordinamento — concetti separati come richiesto */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-ink-2">Raggruppa per:</span>
              {GROUP_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setGroupBy(opt.key)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    groupBy === opt.key ? "bg-ink text-white" : "bg-white text-ink-2"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-ink-2">Ordina per:</span>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSortKey(opt.key)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    sortKey === opt.key ? "bg-ink text-white" : "bg-white text-ink-2"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
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
                              confirming={confirmCancelId === b.id}
                              cancelling={cancellingId === b.id}
                              onAskCancel={() => setConfirmCancelId(b.id)}
                              onCancelConfirmed={() => handleCancel(b.id)}
                              onCancelAbort={() => setConfirmCancelId(null)}
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

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl border border-[#E8EBF0] bg-white p-3">
      <i className={`ti ${icon} text-[15px] text-sky`} />
      <div className="mt-1.5 truncate text-[13px] font-bold text-ink">{value}</div>
      <div className="text-[10.5px] leading-tight text-ink-2">{label}</div>
    </div>
  );
}

// Striscia di copertura compatta (sempre visibile, in cima) — risponde a
// "Abbiamo organizzato tutte le prossime settimane?" con un colpo d'occhio,
// riusando lib/data/planner.ts (la stessa logica già corretta e testata del
// Planner in Home) invece di ricalcolare la copertura da zero qui.
function CoverageStrip({ planner }: { planner: PlannerData }) {
  const upcoming = planner.weeks.filter((w) => !w.dismissed);
  const gaps = upcoming.filter((w) => !w.covered).length;
  return (
    <div className="rounded-2xl border border-[#E8EBF0] bg-white p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="text-sm font-bold text-ink">Copertura dell&apos;estate</div>
        <span className="text-[12px] font-semibold text-ink-2">
          {planner.coveredCount}/{planner.totalCount} settimane organizzate
        </span>
      </div>
      <div className="flex gap-1">
        {planner.weeks.map((w) => (
          <div
            key={w.index}
            title={`${w.label} · ${w.dateRange}${w.covered ? " — organizzata" : w.dismissed ? " — non serve" : " — da organizzare"}`}
            className={`h-2.5 flex-1 rounded-full ${
              w.covered ? "bg-green" : w.dismissed ? "bg-[#E8EBF0]" : "bg-orange-mid/50"
            }`}
          />
        ))}
      </div>
      {gaps > 0 ? (
        <p className="mt-2 text-[12px] text-ink-2">
          <i className="ti ti-alert-circle mr-1 text-orange-mid" />
          {gaps} settiman{gaps === 1 ? "a" : "e"} ancora da organizzare —{" "}
          <Link href="/" className="font-semibold text-sky">
            vai al Planner
          </Link>
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-green">
          <i className="ti ti-circle-check mr-1" />
          Tutte le settimane sono organizzate
        </p>
      )}
    </div>
  );
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
  confirming,
  cancelling,
  onAskCancel,
  onCancelConfirmed,
  onCancelAbort,
}: {
  booking: MyBooking;
  confirming: boolean;
  cancelling: boolean;
  onAskCancel: () => void;
  onCancelConfirmed: () => void;
  onCancelAbort: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#E8EBF0] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex gap-3">
        <div
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cover bg-center text-2xl"
          style={b.coverImageUrl ? { backgroundImage: `url(${b.coverImageUrl})` } : { background: b.imgGradient }}
        >
          {!b.coverImageUrl && b.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-ink">{b.activityName}</span>
            <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_CLASS[b.status]}`}>
              {STATUS_LABEL[b.status]}
            </span>
          </div>
          <div className="text-xs text-ink-2">{b.weeksLabel}</div>
          {b.centerName && <div className="text-xs text-ink-3">{b.centerName}{b.centerCity ? ` · ${b.centerCity}` : ""}</div>}
          {b.kidNames.length > 0 && <div className="mt-0.5 text-xs text-ink-2">{b.kidNames.join(", ")}</div>}
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
                className="flex items-center gap-1 text-[12px] font-semibold text-sky"
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
