"use client";

import { useMemo, useState } from "react";
import { CenterBooking, BookingStatus, PartnerDecision, DayPartnerDecision } from "@/lib/data/center-bookings";
import {
  respondToBookingAction,
  respondToBookingDayAction,
  respondToBookingDaysAction,
  promoteWaitlistedDayAction,
  cancelBookingDayAction,
  markBookingsReadAction,
} from "@/app/actions/booking-response";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Stesso principio di STATUS_LABEL in RichiesteClient.tsx, qui su
// partner_decision invece di status (l'asse rilevante per il centro: cosa
// deve ancora fare/ha fatto rispetto alla RISPOSTA, non lo stato finale
// della prenotazione).
// "partial" (02/09/2026, feature richiesta esplicitamente da Fabrizio —
// esplicitamente ANCHE quando restano giorni ancora da decidere, non solo a
// risposta completata: "1 accettato e 1 boh" deve già mostrare l'informazione
// positiva) — appena almeno un giorno è accettato ma non tutti. NON implica
// "nulla resta da fare": una prenotazione "partial" può ancora avere giorni
// pending/waitlisted, per cui resta visibile nel filtro "Da rispondere" (vedi
// bookingNeedsAction più sotto, che guarda i singoli giorni invece di questa
// etichetta aggregata). Vedi lib/booking-response/effective-decision.ts.
const DECISION_LABEL: Record<PartnerDecision, { label: string; cls: string }> = {
  pending: { label: "Da rispondere", cls: "bg-orange-light text-trama-orange" },
  accepted: { label: "Accettata", cls: "bg-green-light text-[#2d8f52]" },
  rejected: { label: "Rifiutata", cls: "bg-bg text-ink-3" },
  proposed: { label: "Proposta inviata", cls: "bg-sky-light text-sky" },
  partial: { label: "Confermata parzialmente", cls: "bg-[#F0EEFF] text-[#6F63C5]" },
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "In attesa",
  confirmed: "Confermata",
  cancelled: "Annullata",
};

// Etichetta/colore per lo stato di un singolo "Giorno spot" — a differenza
// di DECISION_LABEL sopra (livello intera prenotazione, niente "waitlisted"
// possibile lì), qui copre anche "waitlisted" (migrazione 34, segnalazione
// beta 02/09/2026: giorno pieno al momento dell'accettazione, richiesta
// rimasta in coda invece di essere rifiutata).
const DAY_DECISION_LABEL: Record<DayPartnerDecision, { label: string; cls: string }> = {
  pending: { label: "Da rispondere", cls: "bg-orange-light text-trama-orange" },
  accepted: { label: "Accettato", cls: "bg-green-light text-[#2d8f52]" },
  rejected: { label: "Rifiutato", cls: "bg-white text-ink-3" },
  waitlisted: { label: "In lista d'attesa", cls: "bg-sky-light text-sky" },
};

// 02/09/2026 — segnalazione beta di Fabrizio: "il gestore quando riceve una
// prenotazione, se non ha quei dati [disponibilità], come fa a decidere?".
// Prima di oggi la Inbox non mostrava MAI spots_left/capacity — il centro
// doveva accettare "alla cieca" e scoprire solo dopo (via lista d'attesa
// automatica) se il posto non c'era più. Stessa soglia/wording già in uso
// lato genitore per le settimane (components/WeekCard.tsx: <=3 = "ultimi",
// qui adattato al linguaggio del gestore).
function spotsLeftLabel(spotsLeft: number, capacity: number): { label: string; cls: string } {
  if (capacity <= 0) return { label: "Capacità non impostata", cls: "text-ink-3" };
  if (spotsLeft <= 0) return { label: "0 posti liberi", cls: "text-orange" };
  if (spotsLeft <= 3) return { label: `⚡ ultimi ${spotsLeft} posti`, cls: "text-[#9a6b00]" };
  return { label: `${spotsLeft} posti liberi`, cls: "text-green" };
}

const MONTH_LABELS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function monthLabel(iso: string): string {
  const d = new Date(iso);
  return `${MONTH_LABELS_IT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Raggruppamento per mese — stessa logica di RichiesteClient.tsx /
// AttendanceClient.tsx (segnalazione ricorrente di Fabrizio su ogni lista
// cronologica di questa sezione).
function useMonthBuckets(items: CenterBooking[]) {
  return useMemo(() => {
    const buckets = new Map<string, { label: string; items: CenterBooking[] }>();
    for (const b of items) {
      const key = b.createdAt.slice(0, 7);
      if (!buckets.has(key)) buckets.set(key, { label: monthLabel(b.createdAt), items: [] });
      buckets.get(key)!.items.push(b);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, v]) => v);
  }, [items]);
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

// Redesign richiesto da Fabrizio dopo il deploy Sprint 4: "le sezioni Da
// rispondere/Storico devono essere raggruppabili, la navigazione è
// complessa" + "un grafico di sintesi in alto con i KPI principali,
// cliccabili, che rimandano alla sezione giusta". Invece di anchor/scroll
// (che con 2 sole sezioni non risolverebbe la lamentela), i KPI qui
// FILTRANO la lista a una sola vista mirata — più utile quando ci sono
// molte prenotazioni miste (accettate/rifiutate/proposte tutte dentro
// "Storico" oggi). "Tutte" (nessun filtro attivo) torna alla vista
// originale a due sezioni, invariata per chi la preferisce.
type FilterKey = "pending" | "proposed" | "accepted" | "partial" | "rejected";

// 02/09/2026 — dopo l'allargamento di "partial" (vedi effective-decision.ts:
// scatta appena c'è almeno un giorno accettato, ANCHE se altri giorni sono
// ancora pending/waitlisted), b.partnerDecision === "pending" da solo non
// basta più per sapere se il centro ha ancora qualcosa da decidere: una
// prenotazione "1 giorno accettato + 1 ancora da rispondere" è già
// "partial", non "pending". Per le prenotazioni a giorni si guarda quindi
// direttamente ogni singolo booking_day invece della sola etichetta
// aggregata — per quelle a settimana intera (niente giorni, un'unica
// risposta indivisibile) partnerDecision resta l'unica fonte, invariato.
function bookingNeedsAction(b: CenterBooking): boolean {
  if (b.status === "cancelled") return false;
  if (b.isDayBased) return b.days.some((d) => d.partnerDecision === "pending" || d.partnerDecision === "waitlisted");
  return b.partnerDecision === "pending";
}

const KPI_CONFIG: Record<FilterKey, { label: string; cls: string; predicate: (b: CenterBooking) => boolean }> = {
  pending: {
    label: "Da rispondere",
    cls: "text-trama-orange",
    predicate: bookingNeedsAction,
  },
  proposed: {
    label: "Proposte in attesa del genitore",
    cls: "text-sky",
    predicate: (b) => b.status !== "cancelled" && b.partnerDecision === "proposed",
  },
  accepted: {
    label: "Accettate",
    cls: "text-[#2d8f52]",
    predicate: (b) => b.status !== "cancelled" && b.partnerDecision === "accepted",
  },
  // "partial" (02/09/2026) — Giorni spot con tutti i giorni ormai decisi ma
  // esito misto: bucket separato da "Accettate" (nulla travestito da piena
  // accettazione) e da "Da rispondere" (il centro non deve più rispondere).
  partial: {
    label: "Confermate parzialmente",
    cls: "text-[#6F63C5]",
    predicate: (b) => b.status !== "cancelled" && b.partnerDecision === "partial",
  },
  rejected: {
    label: "Rifiutate",
    cls: "text-ink-3",
    predicate: (b) => b.status === "cancelled" && b.cancelledBy === "center",
  },
};
const KPI_ORDER: FilterKey[] = ["pending", "proposed", "accepted", "partial", "rejected"];

export default function PrenotazioniClient({
  initialBookings,
}: {
  initialBookings: CenterBooking[];
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [proposalDrafts, setProposalDrafts] = useState<Record<string, string>>({});
  const [proposalOpenFor, setProposalOpenFor] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // 02/09/2026 — segnalazione beta di Fabrizio: "mi manca la possibilità di
  // selezionare tutte le richieste di prenotazione e approvarle/rifiutarle".
  // Riusa lo stesso "selected" già esistente per Segna come letta/non letta
  // (nessuna doppia selezione da gestire) — riepilogo separato perché
  // un'azione bulk può toccare sia prenotazioni a settimana intera (accetta/
  // rifiuta l'intera prenotazione) sia a giorni (accetta/rifiuta solo i
  // giorni ancora pending di quella prenotazione, non quelli già decisi).
  const [bulkResponseSummary, setBulkResponseSummary] = useState<string | null>(null);
  // "Seleziona tutto su più giorni" (segnalazione beta 02/09/2026) — stato
  // di selezione INDIPENDENTE dal "selected" sopra (quello è per
  // markBookingsReadAction a livello di intera prenotazione): qui è per
  // giorno, dentro una singola prenotazione "Giorni spot", per poter
  // accettare/rifiutare più giorni in blocco con verifica di disponibilità
  // per ciascuno (app/actions/booking-response.ts::respondToBookingDaysAction).
  const [selectedDaysByBooking, setSelectedDaysByBooking] = useState<Record<string, Set<string>>>({});
  const [dayBulkBusy, setDayBulkBusy] = useState<string | null>(null); // bookingId in corso
  const [dayBulkSummary, setDayBulkSummary] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);
  // Gruppi mese comprimibili (stesso pattern di
  // app/(main)/prenotazioni/PrenotazioniClient.tsx) — chiave prefissata con
  // la sezione per evitare collisioni tra "Da rispondere"/"Storico"/filtro.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  function toggleGroupCollapsed(groupKey: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  function patchBooking(id: string, patch: Partial<CenterBooking>) {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function patchDay(bookingId: string, activityDayId: string, patch: Partial<CenterBooking["days"][number]>) {
    setBookings((prev) =>
      prev.map((b) =>
        b.id !== bookingId
          ? b
          : { ...b, days: b.days.map((d) => (d.activityDayId === activityDayId ? { ...d, ...patch } : d)) }
      )
    );
  }

  async function respond(bookingId: string, decision: "accepted" | "rejected") {
    setErrorId(null);
    setBusyId(bookingId);
    const result = await respondToBookingAction({ bookingId, decision });
    setBusyId(null);
    if (result.error) {
      setErrorId(bookingId);
      return;
    }
    patchBooking(bookingId, {
      partnerDecision: decision,
      status: decision === "accepted" ? "confirmed" : "cancelled",
      readByCenter: true,
      cancelledBy: decision === "rejected" ? "center" : null,
    });
  }

  async function sendProposal(bookingId: string) {
    const note = (proposalDrafts[bookingId] ?? "").trim();
    if (!note) {
      setErrorId(bookingId);
      return;
    }
    setErrorId(null);
    setBusyId(bookingId);
    const result = await respondToBookingAction({ bookingId, decision: "proposed", proposalNote: note });
    setBusyId(null);
    if (result.error) {
      setErrorId(bookingId);
      return;
    }
    patchBooking(bookingId, { partnerDecision: "proposed", partnerProposalNote: note, readByCenter: true });
    setProposalOpenFor(null);
  }

  async function respondDay(bookingId: string, activityDayId: string, decision: "accepted" | "rejected") {
    const busyKey = `${bookingId}:${activityDayId}`;
    setErrorId(null);
    setBusyId(busyKey);
    const result = await respondToBookingDayAction({ bookingId, activityDayId, decision });
    setBusyId(null);
    if (result.error) {
      setErrorId(busyKey);
      return;
    }
    patchDay(bookingId, activityDayId, { partnerDecision: decision });
    patchBooking(bookingId, { readByCenter: true });
  }

  async function cancelDay(bookingId: string, activityDayId: string) {
    const busyKey = `cancel:${bookingId}:${activityDayId}`;
    setBusyId(busyKey);
    const result = await cancelBookingDayAction({ bookingId, activityDayId, cancelledBy: "center" });
    setBusyId(null);
    if (result.error) {
      setErrorId(busyKey);
      return;
    }
    setBookings((prev) =>
      prev.map((b) =>
        b.id !== bookingId ? b : { ...b, days: b.days.filter((d) => d.activityDayId !== activityDayId) }
      )
    );
  }

  function toggleDaySelected(bookingId: string, activityDayId: string) {
    setSelectedDaysByBooking((prev) => {
      const current = new Set(prev[bookingId] ?? []);
      if (current.has(activityDayId)) current.delete(activityDayId);
      else current.add(activityDayId);
      return { ...prev, [bookingId]: current };
    });
  }

  function toggleAllDaysSelected(bookingId: string, pendingDayIds: string[]) {
    setSelectedDaysByBooking((prev) => {
      const current = prev[bookingId] ?? new Set<string>();
      const allSelected = pendingDayIds.length > 0 && pendingDayIds.every((id) => current.has(id));
      return { ...prev, [bookingId]: allSelected ? new Set() : new Set(pendingDayIds) };
    });
  }

  async function respondSelectedDays(bookingId: string, decision: "accepted" | "rejected") {
    const ids = Array.from(selectedDaysByBooking[bookingId] ?? []);
    if (ids.length === 0) return;
    setDayBulkBusy(bookingId);
    setDayBulkSummary((prev) => ({ ...prev, [bookingId]: "" }));
    const result = await respondToBookingDaysAction({ bookingId, activityDayIds: ids, decision });
    setDayBulkBusy(null);
    if (result.error) {
      setDayBulkSummary((prev) => ({ ...prev, [bookingId]: "Errore, riprova." }));
      return;
    }
    // waitlisted_unavailable/error non toccano lo stato del giorno (resta
    // "pending", coerente con app/actions/booking-response.ts::applyDayDecision).
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id !== bookingId) return b;
        return {
          ...b,
          days: b.days.map((d) => {
            const outcome = result.results[d.activityDayId];
            if (outcome === "accepted" || outcome === "rejected" || outcome === "waitlisted") {
              return { ...d, partnerDecision: outcome };
            }
            return d;
          }),
        };
      })
    );
    patchBooking(bookingId, { readByCenter: true });
    setSelectedDaysByBooking((prev) => ({ ...prev, [bookingId]: new Set() }));

    const parts: string[] = [];
    if (result.accepted > 0) parts.push(`${result.accepted} accettat${result.accepted === 1 ? "o" : "i"}`);
    if (result.rejected > 0) parts.push(`${result.rejected} rifiutat${result.rejected === 1 ? "o" : "i"}`);
    if (result.waitlisted > 0) {
      parts.push(`${result.waitlisted} in lista d'attesa (pien${result.waitlisted === 1 ? "o" : "i"})`);
    }
    if (result.waitlistUnavailable > 0) {
      parts.push(
        `${result.waitlistUnavailable} rimast${result.waitlistUnavailable === 1 ? "o" : "i"} in attesa (nessun posto — lista d'attesa non ancora disponibile in questo ambiente)`
      );
    }
    if (result.failed > 0) parts.push(`${result.failed} error${result.failed === 1 ? "e" : "i"}`);
    setDayBulkSummary((prev) => ({ ...prev, [bookingId]: parts.join(" · ") }));
  }

  async function promoteDay(bookingId: string, activityDayId: string) {
    const busyKey = `promote:${bookingId}:${activityDayId}`;
    setErrorId(null);
    setBusyId(busyKey);
    const result = await promoteWaitlistedDayAction({ bookingId, activityDayId });
    setBusyId(null);
    if (result.error) {
      setErrorId(busyKey);
      return;
    }
    patchDay(bookingId, activityDayId, { partnerDecision: "accepted" });
    patchBooking(bookingId, { readByCenter: true });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === bookings.length ? new Set() : new Set(bookings.map((b) => b.id))));
  }

  async function markSelected(read: boolean) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    const result = await markBookingsReadAction({ ids, side: "center", read });
    setBulkBusy(false);
    if (result.error) return;
    setBookings((prev) => prev.map((b) => (ids.includes(b.id) ? { ...b, readByCenter: read } : b)));
    setSelected(new Set());
  }

  // 02/09/2026 — "mi manca la possibilità di selezionare tutte le richieste
  // di prenotazione e approvarle/rifiutarle" (segnalazione beta di Fabrizio).
  // Riusa le stesse server action già esistenti per la risposta singola
  // (respondToBookingAction per le prenotazioni a settimana intera,
  // respondToBookingDaysAction — già usata da "seleziona tutto su più
  // giorni" DENTRO una prenotazione — per quelle a giorni), chiamate in
  // sequenza per ogni prenotazione selezionata invece che in parallelo:
  // stesso principio prudente di respondToBookingDaysAction lato server
  // (CAS su spots_left, la contesa in parallelo non porterebbe benefici
  // reali qui). Ogni prenotazione selezionata che non ha PIÙ nulla da
  // decidere (già accettata/rifiutata/annullata, o "Giorni spot" con zero
  // giorni ancora pending) viene saltata silenziosamente — il riepiloego
  // finale la conta comunque, per trasparenza.
  async function respondSelectedBookings(decision: "accepted" | "rejected") {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setBulkResponseSummary(null);
    const ids = Array.from(selected);
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    let waitlistedDaysTotal = 0;

    for (const id of ids) {
      const booking = bookings.find((b) => b.id === id);
      if (!booking || booking.status === "cancelled") {
        skipped++;
        continue;
      }
      if (booking.isDayBased) {
        const pendingDayIds = booking.days.filter((d) => d.partnerDecision === "pending").map((d) => d.activityDayId);
        if (pendingDayIds.length === 0) {
          skipped++;
          continue;
        }
        const result = await respondToBookingDaysAction({ bookingId: id, activityDayIds: pendingDayIds, decision });
        if (result.error) {
          failed++;
          continue;
        }
        setBookings((prev) =>
          prev.map((b) => {
            if (b.id !== id) return b;
            return {
              ...b,
              readByCenter: true,
              days: b.days.map((d) => {
                const outcome = result.results[d.activityDayId];
                if (outcome === "accepted" || outcome === "rejected" || outcome === "waitlisted") {
                  return { ...d, partnerDecision: outcome };
                }
                return d;
              }),
            };
          })
        );
        waitlistedDaysTotal += result.waitlisted;
        processed++;
      } else {
        // Solo prenotazioni davvero "Da rispondere" — una "proposed" aspetta
        // una decisione del GENITORE sulla proposta del centro, non va mai
        // forzata accettata/rifiutata da qui.
        if (booking.partnerDecision !== "pending") {
          skipped++;
          continue;
        }
        const result = await respondToBookingAction({ bookingId: id, decision });
        if (result.error) {
          failed++;
          continue;
        }
        patchBooking(id, {
          partnerDecision: decision,
          status: decision === "accepted" ? "confirmed" : "cancelled",
          readByCenter: true,
          cancelledBy: decision === "rejected" ? "center" : null,
        });
        processed++;
      }
    }

    setBulkBusy(false);
    setSelected(new Set());

    const parts: string[] = [
      `${processed} prenotazion${processed === 1 ? "e" : "i"} ${decision === "accepted" ? "accettat" : "rifiutat"}${processed === 1 ? "a" : "e"}`,
    ];
    if (waitlistedDaysTotal > 0) {
      parts.push(`${waitlistedDaysTotal} giorn${waitlistedDaysTotal === 1 ? "o" : "i"} pien${waitlistedDaysTotal === 1 ? "o" : "i"} finit${waitlistedDaysTotal === 1 ? "o" : "i"} in lista d'attesa`);
    }
    if (skipped > 0) parts.push(`${skipped} saltat${skipped === 1 ? "a" : "e"} (già decisa/annullata o senza giorni da rispondere)`);
    if (failed > 0) parts.push(`${failed} error${failed === 1 ? "e" : "i"}`);
    setBulkResponseSummary(parts.join(" · "));
  }

  const pending = bookings.filter(bookingNeedsAction);
  const decided = bookings.filter((b) => !bookingNeedsAction(b));
  const allSelected = bookings.length > 0 && selected.size === bookings.length;
  const pendingBuckets = useMonthBuckets(pending);
  const decidedBuckets = useMonthBuckets(decided);

  const filteredList = activeFilter ? bookings.filter(KPI_CONFIG[activeFilter].predicate) : null;
  const filteredBuckets = useMonthBuckets(filteredList ?? []);

  function renderBucketSection(sectionKey: string, buckets: { label: string; items: CenterBooking[] }[], emptyMessage: string) {
    if (buckets.length === 0) {
      return <p className="px-4 py-6 text-center text-sm text-ink-2">{emptyMessage}</p>;
    }
    return buckets.map((bucket) => {
      const groupKey = `${sectionKey}:${bucket.label}`;
      const collapsed = collapsedGroups.has(groupKey);
      return (
        <div key={bucket.label}>
          <button
            type="button"
            onClick={() => toggleGroupCollapsed(groupKey)}
            className="flex w-full items-center justify-between bg-bg px-4 py-1.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-ink-3"
          >
            <span>
              {bucket.label} · {bucket.items.length}
            </span>
            <i className={`ti ti-chevron-${collapsed ? "down" : "up"} text-[13px]`} />
          </button>
          {!collapsed && bucket.items.map(renderBooking)}
        </div>
      );
    });
  }

  function renderBooking(b: CenterBooking) {
    const busyKey = busyId === b.id;
    return (
      <div key={b.id} data-testid="booking-row" className="flex gap-2.5 px-4 py-3.5">
        <input
          type="checkbox"
          checked={selected.has(b.id)}
          onChange={() => toggleOne(b.id)}
          className="mt-0.5 h-4 w-4 flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              {!b.readByCenter && (
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#FF6B6B]" aria-label="Non letta" />
              )}
              {b.activityName}
            </div>
            <div className="flex gap-1.5">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${DECISION_LABEL[b.partnerDecision].cls}`}>
                {DECISION_LABEL[b.partnerDecision].label}
              </span>
            </div>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
            {/* Segnalazione di Fabrizio: senza un'etichetta esplicita non si
                capisce a colpo d'occhio se una prenotazione è "Giorni spot"
                (accettazione per singolo giorno, niente pulsanti a livello di
                card) o a settimana intera (pulsanti Accetta/Rifiuta/Proponi
                sulla card). */}
            {b.isDayBased && (
              <span className="rounded-full bg-sky-light px-2 py-0.5 text-[10.5px] font-semibold text-sky">
                Giorni spot
              </span>
            )}
            <span>
              {b.parentName}
              {b.parentEmail ? ` · ${b.parentEmail}` : ""}
              {b.kidNames.length > 0 ? ` · ${b.kidNames.join(", ")}` : ""}
            </span>
          </div>

          {b.isDayBased ? (
            <div className="mb-2.5 space-y-1.5">
              {(() => {
                const pendingDayIds = b.days.filter((d) => d.partnerDecision === "pending").map((d) => d.activityDayId);
                const selectedForBooking = selectedDaysByBooking[b.id] ?? new Set<string>();
                const selectedCount = pendingDayIds.filter((id) => selectedForBooking.has(id)).length;
                const allDaysSelected = pendingDayIds.length > 0 && selectedCount === pendingDayIds.length;
                const bookingBulkBusy = dayBulkBusy === b.id;
                return (
                  <>
                    {/* "Seleziona tutto su più giorni" — segnalazione beta
                        02/09/2026: mostra i controlli SOLO quando ha senso
                        (almeno 2 giorni ancora da decidere), stesso principio
                        del bottone "Seleziona tutte" in cima alla pagina. */}
                    {pendingDayIds.length > 1 && (
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-[#D8DCE3] px-2.5 py-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-2">
                          <input
                            type="checkbox"
                            checked={allDaysSelected}
                            onChange={() => toggleAllDaysSelected(b.id, pendingDayIds)}
                            className="h-3.5 w-3.5"
                          />
                          Seleziona tutti i giorni ({pendingDayIds.length})
                        </label>
                        {selectedCount > 0 && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => respondSelectedDays(b.id, "accepted")}
                              disabled={bookingBulkBusy}
                              className="rounded-md bg-partner px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
                            >
                              {bookingBulkBusy ? "…" : `Accetta selezionati (${selectedCount})`}
                            </button>
                            <button
                              onClick={() => respondSelectedDays(b.id, "rejected")}
                              disabled={bookingBulkBusy}
                              className="rounded-md bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] disabled:opacity-60"
                            >
                              Rifiuta selezionati
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {dayBulkSummary[b.id] && (
                      <p className="mb-1 rounded-md bg-bg px-2.5 py-1.5 text-[11px] font-medium text-ink-2">
                        {dayBulkSummary[b.id]}
                      </p>
                    )}
                    {b.days.map((d) => {
                      const dayBusyKey = `${b.id}:${d.activityDayId}`;
                      const promoteBusyKey = `promote:${b.id}:${d.activityDayId}`;
                      return (
                        <div
                          key={d.activityDayId}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-bg p-2.5 text-xs"
                        >
                          <span className="flex items-center gap-1.5 font-medium text-ink">
                            {d.partnerDecision === "pending" && pendingDayIds.length > 1 && (
                              <input
                                type="checkbox"
                                checked={selectedForBooking.has(d.activityDayId)}
                                onChange={() => toggleDaySelected(b.id, d.activityDayId)}
                                className="h-3.5 w-3.5"
                              />
                            )}
                            {formatDate(d.date)} · €{d.price}
                          </span>
                          {d.partnerDecision === "pending" ? (
                            <div className="flex items-center gap-2">
                              {/* Disponibilità PRIMA di decidere (segnalazione
                                  beta 02/09/2026: "se non ha quei dati, come
                                  fa a decidere?") — spots_left è già al netto
                                  di ogni accettazione precedente, MAI di
                                  questa o altre richieste ancora pending. */}
                              <span className={`text-[10.5px] font-semibold ${spotsLeftLabel(d.spotsLeft, d.capacity).cls}`}>
                                {spotsLeftLabel(d.spotsLeft, d.capacity).label}
                              </span>
                              <button
                                onClick={() => respondDay(b.id, d.activityDayId, "accepted")}
                                disabled={busyId === dayBusyKey}
                                className="rounded-md bg-partner px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
                              >
                                Accetta
                              </button>
                              <button
                                onClick={() => respondDay(b.id, d.activityDayId, "rejected")}
                                disabled={busyId === dayBusyKey}
                                className="rounded-md bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] disabled:opacity-60"
                              >
                                Rifiuta
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${DAY_DECISION_LABEL[d.partnerDecision].cls}`}
                              >
                                {DAY_DECISION_LABEL[d.partnerDecision].label}
                              </span>
                              {/* "waitlisted" — segnalazione beta 02/09/2026: il
                                  giorno era pieno al momento dell'accettazione.
                                  "Promuovi" riprova la riserva ora (es. dopo che
                                  un altro giorno/prenotazione è stato annullato). */}
                              {d.partnerDecision === "waitlisted" ? (
                                <button
                                  onClick={() => promoteDay(b.id, d.activityDayId)}
                                  disabled={busyId === promoteBusyKey}
                                  className="text-[11px] font-semibold text-sky underline disabled:opacity-60"
                                >
                                  {busyId === promoteBusyKey ? "…" : "Promuovi"}
                                </button>
                              ) : (
                                <button
                                  onClick={() => cancelDay(b.id, d.activityDayId)}
                                  disabled={busyId === `cancel:${b.id}:${d.activityDayId}`}
                                  className="text-[11px] font-semibold text-ink-3 underline disabled:opacity-60"
                                >
                                  Rimuovi giorno
                                </button>
                              )}
                            </div>
                          )}
                          {(errorId === dayBusyKey || errorId === promoteBusyKey) && (
                            <p className="w-full text-[11px] font-medium text-orange">
                              {errorId === promoteBusyKey ? "Ancora nessun posto disponibile per questo giorno." : "Errore, riprova."}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="mb-2.5 rounded-md bg-bg p-2.5 text-xs text-ink">
              <div>
                {b.weeks.length} settiman{b.weeks.length === 1 ? "a" : "e"} · Totale €{b.totalAmount}
                {b.shuttleIncluded ? " · con navetta" : ""}
              </div>
              {/* Disponibilità PRIMA di decidere (segnalazione beta
                  02/09/2026: "se non ha quei dati, come fa a decidere?") —
                  una riga per settimana, stessa fonte/soglie della griglia
                  Giorni spot sopra. */}
              {b.partnerDecision === "pending" && b.weeks.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {b.weeks.map((w) => (
                    <span key={w.weekId} className={`text-[10.5px] font-semibold ${spotsLeftLabel(w.spotsLeft, w.capacity).cls}`}>
                      {formatDate(w.startDate)}: {spotsLeftLabel(w.spotsLeft, w.capacity).label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Segnalazione Fabrizio 02/09/2026: la didascalia "flottava" subito
              sotto l'ultimo giorno, senza alcuna separazione — sembrava
              disallineata invece che una riga di riepilogo a sé stante. */}
          <div className="mb-1 mt-2 border-t border-[#F0F2F5] pt-2 text-[11px] text-ink-3">
            Stato prenotazione: {STATUS_LABEL[b.status]}
          </div>

          {b.partnerDecision === "proposed" && b.partnerProposalNote && (
            <div className="mb-2 rounded-md bg-sky-light p-2.5 text-xs text-ink">
              <div className="mb-0.5 font-semibold text-sky">La tua proposta</div>
              {b.partnerProposalNote}
            </div>
          )}

          {!b.isDayBased && b.partnerDecision === "pending" && b.status !== "cancelled" && (
            <div>
              {proposalOpenFor === b.id ? (
                <div className="mb-2">
                  <textarea
                    value={proposalDrafts[b.id] ?? ""}
                    onChange={(e) => setProposalDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                    rows={2}
                    placeholder="Es. proponi altre settimane disponibili…"
                    className="mb-2 w-full resize-none rounded-md border border-[#E8EBF0] px-3 py-2 text-sm outline-none focus:border-sky"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => sendProposal(b.id)}
                      disabled={busyKey}
                      className="rounded-md bg-sky px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {busyKey ? "Invio…" : "Invia proposta"}
                    </button>
                    <button
                      onClick={() => setProposalOpenFor(null)}
                      className="rounded-md bg-white px-3.5 py-2 text-xs font-bold text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => respond(b.id, "accepted")}
                    disabled={busyKey}
                    className="rounded-md bg-partner px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {busyKey ? "…" : "Accetta"}
                  </button>
                  <button
                    onClick={() => respond(b.id, "rejected")}
                    disabled={busyKey}
                    className="rounded-md bg-white px-3.5 py-2 text-xs font-bold text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] disabled:opacity-60"
                  >
                    Rifiuta
                  </button>
                  <button
                    onClick={() => setProposalOpenFor(b.id)}
                    className="rounded-md bg-white px-3.5 py-2 text-xs font-bold text-sky shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  >
                    Proponi alternativa
                  </button>
                </div>
              )}
              {errorId === b.id && (
                <p className="mt-2 text-xs font-medium text-orange">Errore — riprova.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Prenotazioni</h1>
        <p className="text-sm text-ink-2">
          Rispondi alle prenotazioni ricevute: accetta, rifiuta o proponi un&apos;alternativa. Per le
          prenotazioni a Giorni spot puoi rispondere singolo giorno per giorno.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-5 rounded-lg border border-orange-mid bg-orange-light p-4 text-sm text-ink">
          Supabase non è collegato in questo ambiente: qui vedrai le prenotazioni reali una volta
          collegato.
        </div>
      )}

      {bookings.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs font-medium text-ink-2">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4" />
            Seleziona tutte
          </label>
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-2">
              {/* "mi manca la possibilità di selezionare tutte le richieste
                  di prenotazione e approvarle/rifiutarle" (segnalazione beta
                  02/09/2026) — accetta/rifiuta in blocco tutte le
                  prenotazioni selezionate che hanno ancora qualcosa da
                  decidere (a settimana intera o "Giorni spot", vedi
                  respondSelectedBookings sopra). */}
              <button
                onClick={() => respondSelectedBookings("accepted")}
                disabled={bulkBusy}
                className="rounded-full bg-partner px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
              >
                Accetta selezionate ({selected.size})
              </button>
              <button
                onClick={() => respondSelectedBookings("rejected")}
                disabled={bulkBusy}
                className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-orange shadow-[0_1px_3px_rgba(0,0,0,0.08)] disabled:opacity-60"
              >
                Rifiuta selezionate ({selected.size})
              </button>
              <button
                onClick={() => markSelected(true)}
                disabled={bulkBusy}
                className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] disabled:opacity-60"
              >
                Segna come lette
              </button>
              <button
                onClick={() => markSelected(false)}
                disabled={bulkBusy}
                className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] disabled:opacity-60"
              >
                Segna come da leggere
              </button>
            </div>
          )}
        </div>
      )}

      {bulkResponseSummary && (
        <div className="mb-4 rounded-lg border border-[#E8EBF0] bg-white px-4 py-2.5 text-xs font-medium text-ink-2">
          {bulkResponseSummary}
        </div>
      )}

      {/* Strip KPI — segnalazione di Fabrizio: "un grafico di sintesi in alto
          con i KPI principali, cliccabili, che rimandano alla sezione
          giusta". Click su una card attiva/disattiva il filtro; "Tutte"
          torna alla vista originale a due sezioni. */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {KPI_ORDER.map((key) => {
          const cfg = KPI_CONFIG[key];
          const count = bookings.filter(cfg.predicate).length;
          const active = activeFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveFilter(active ? null : key)}
              className={`rounded-lg border px-3 py-2.5 text-left transition ${
                active ? "border-trama-violet bg-trama-violet/5" : "border-[#E8EBF0] bg-white"
              }`}
            >
              <div className={`text-xl font-bold ${cfg.cls}`}>{count}</div>
              <div className="text-[11px] font-medium text-ink-2">{cfg.label}</div>
            </button>
          );
        })}
      </div>
      {activeFilter && (
        <button
          type="button"
          onClick={() => setActiveFilter(null)}
          className="mb-3 text-[11.5px] font-semibold text-trama-violet"
        >
          ← Tutte le prenotazioni
        </button>
      )}

      {activeFilter ? (
        <div className="rounded-lg border border-[#E8EBF0] bg-white">
          <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
            {KPI_CONFIG[activeFilter].label} ({filteredList?.length ?? 0})
          </div>
          <div className="divide-y divide-[#F0F2F5]">
            {renderBucketSection(
              `filter-${activeFilter}`,
              filteredBuckets,
              "Nessuna prenotazione in questa categoria."
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white">
            <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
              Da rispondere ({pending.length})
            </div>
            <div className="divide-y divide-[#F0F2F5]">
              {renderBucketSection("pending", pendingBuckets, "Nessuna prenotazione in attesa di risposta.")}
            </div>
          </div>

          <div className="rounded-lg border border-[#E8EBF0] bg-white">
            <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
              Storico ({decided.length})
            </div>
            <div className="divide-y divide-[#F0F2F5]">
              {renderBucketSection("decided", decidedBuckets, "Ancora nessuna prenotazione gestita.")}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
