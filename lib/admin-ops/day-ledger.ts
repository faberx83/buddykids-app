// TRAMA — ADMIN OPERATIVO (12/11/2026). Richiesta di Fabrizio: "apro la
// giornata e spiego quanti posti sono occupati e da quali prenotazioni" e
// "Verifica che disponibilità Parent, calendario Partner, registro e
// dettaglio Admin concordino". Iniziativa: claude/INIZIATIVA_admin_operativo.md.
//
// Libro di una giornata (o di una settimana): capacità, posti occupati e
// liberi, partecipanti confermati, richieste in attesa, e cosa vede ciascun
// portale. Pura, senza I/O.
//
// Fonti di verità, come le leggono i tre portali (verificato sul codice):
//   - Parent, disponibilità: activity_days.spots_left (posti liberi salvati);
//   - Partner, "Date e posti": capacity, spots_left e "confermati" = somma di
//     booking_days.capacity_units sulle righe che hanno preso posti
//     (lib/data/day-confirmed.ts → lib/capacity/units.ts#confirmedByDate);
//   - Partner, registro presenze: i bambini delle prenotazioni accettate
//     (booking_kids);
//   - Admin: questo modulo, che mette in fila le tre letture.
// Concordano quando ogni riga accettata ha preso un posto per bambino
// (capacity_units = bambini, regola del 04/11) e spots_left = capacity −
// posti presi. Il caso del QA (UX DEMO 3 novembre, 8 dicembre) è una riga
// accettata il 04/11 alle 09:42, PRIMA del rilascio della regola: 2 bambini,
// 1 posto preso. Qui diventa un avviso "storico da riconciliare".

export interface LedgerDay {
  capacity: number;
  spotsLeft: number;
}

export interface LedgerRow {
  bookingId: string;
  ref: string;
  bookingStatus: "pending" | "confirmed" | "cancelled";
  decision: "pending" | "accepted" | "rejected" | "waitlisted";
  capacityDecremented: boolean;
  units: number | null;
  kidsCount: number;
  label: string;
  isDemo?: boolean;
}

export interface LedgerGroupRequest {
  id: string;
  status: string;
  kidsCount: number;
  label: string;
}

export type LedgerIssueKind = "units_mismatch" | "overbooked_store" | "accepted_without_seat" | "cancelled_holding_seat" | "manual_hold";

export interface LedgerIssue {
  kind: LedgerIssueKind;
  severity: "errore" | "avviso" | "info";
  message: string;
  bookingId?: string;
}

export interface DayLedger {
  capacity: number;
  /** Posti liberi salvati: è il numero che vede la famiglia. */
  spotsLeft: number;
  /** Posti presi dalle prenotazioni (somma di capacity_units, 1 per le righe vecchie). */
  occupied: number;
  /** Liberi attesi = totali − presi. */
  expectedFree: number;
  /** Bambini delle prenotazioni accettate e non annullate: è il numero del registro. */
  confirmedParticipants: number;
  /** Bambini nelle richieste ancora da decidere (non occupano posti). */
  pendingParticipants: number;
  occupying: LedgerRow[];
  pending: LedgerRow[];
  other: LedgerRow[];
  groupRequests: LedgerGroupRequest[];
  issues: LedgerIssue[];
  /** Cosa mostra ogni portale per questo giorno. */
  portals: { parentFree: number; partnerConfirmed: number; partnerRegister: number; adminFree: number };
  consistent: boolean;
}

const unitsOf = (r: LedgerRow) => (r.capacityDecremented ? Math.max(1, Math.floor(r.units ?? 1)) : 0);
const posti = (n: number) => (n === 1 ? "1 posto" : `${n} posti`);
const bambini = (n: number) => (n === 1 ? "1 bambino" : `${n} bambini`);

export function buildDayLedger(day: LedgerDay, rows: LedgerRow[], groupRequests: LedgerGroupRequest[] = []): DayLedger {
  const occupying = rows.filter((r) => r.capacityDecremented);
  const live = (r: LedgerRow) => r.bookingStatus !== "cancelled";
  const pending = rows.filter((r) => live(r) && !r.capacityDecremented && (r.decision === "pending" || r.decision === "waitlisted"));
  const other = rows.filter((r) => !occupying.includes(r) && !pending.includes(r));

  const occupied = occupying.reduce((s, r) => s + unitsOf(r), 0);
  const capacity = Math.max(0, Math.floor(day.capacity || 0));
  const spotsLeft = Math.floor(day.spotsLeft || 0);
  const expectedFree = Math.max(0, capacity - occupied);
  const confirmedParticipants = rows.filter((r) => live(r) && r.decision === "accepted").reduce((s, r) => s + Math.max(1, r.kidsCount), 0);
  const pendingParticipants = pending.reduce((s, r) => s + Math.max(1, r.kidsCount), 0);

  const issues: LedgerIssue[] = [];
  for (const r of occupying) {
    const took = unitsOf(r);
    const kids = Math.max(1, r.kidsCount);
    if (live(r) && r.decision === "accepted" && took < kids) {
      issues.push({
        kind: "units_mismatch",
        severity: "errore",
        bookingId: r.bookingId,
        message: `${r.ref}: ${bambini(kids)} ma ${posti(took)} ${took === 1 ? "preso" : "presi"}. Accettata prima della regola "un posto per bambino" (04/11): dato storico da riconciliare (supabase/riconciliazione_60_posti_per_bambino.sql).`,
      });
    }
    if (!live(r)) {
      issues.push({
        kind: "cancelled_holding_seat",
        severity: "errore",
        bookingId: r.bookingId,
        message: `${r.ref}: annullata ma tiene ancora ${posti(took)}.`,
      });
    }
  }
  for (const r of rows) {
    if (live(r) && r.decision === "accepted" && !r.capacityDecremented) {
      issues.push({
        kind: "accepted_without_seat",
        severity: "errore",
        bookingId: r.bookingId,
        message: `${r.ref}: accettata ma non occupa posti.`,
      });
    }
  }
  if (spotsLeft > capacity - occupied) {
    issues.push({
      kind: "overbooked_store",
      severity: "errore",
      message: `Posti liberi salvati ${spotsLeft}, ma con ${posti(occupied)} ${occupied === 1 ? "preso" : "presi"} su ${capacity} i liberi possono essere al massimo ${Math.max(0, capacity - occupied)}.`,
    });
  } else if (spotsLeft < capacity - occupied) {
    issues.push({
      kind: "manual_hold",
      severity: "info",
      message: `${posti(capacity - occupied - spotsLeft)} ${capacity - occupied - spotsLeft === 1 ? "tenuto" : "tenuti"} fuori dal centro (posti liberi abbassati a mano in "Date e posti").`,
    });
  }

  const portals = { parentFree: spotsLeft, partnerConfirmed: occupied, partnerRegister: confirmedParticipants, adminFree: Math.min(spotsLeft, Math.max(0, capacity - Math.max(occupied, confirmedParticipants))) };
  const consistent = !issues.some((i) => i.severity === "errore");
  return {
    capacity,
    spotsLeft,
    occupied,
    expectedFree,
    confirmedParticipants,
    pendingParticipants,
    occupying,
    pending,
    other,
    groupRequests,
    issues,
    portals,
    consistent,
  };
}
