import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminActivityDetail } from "@/lib/data/admin-ops";
import { ledgerRowsForDay } from "@/lib/admin-ops/activity-days";
import { buildDayLedger, type LedgerRow } from "@/lib/admin-ops/day-ledger";
import { bookingsHref } from "@/lib/admin-ops/bookings";
import { countOf, daySummary } from "@/lib/admin-ops/text";

export const dynamic = "force-dynamic";

// TRAMA — ADMIN OPERATIVO (12/11/2026): una giornata di un'attività.
// Richiesta di Fabrizio: "apro la giornata e spiego quanti posti sono
// occupati e da quali prenotazioni" e "Verifica che disponibilità Parent,
// calendario Partner, registro e dettaglio Admin concordino". Il libro del
// giorno (lib/admin-ops/day-ledger.ts) dice capacità, posti presi riga per
// riga, liberi, bambini confermati, richieste in attesa, e cosa vede ogni
// portale; se i numeri non tornano spiega perché (es. il caso del QA dell'8
// dicembre: riga accettata prima della regola "un posto per bambino").
type Params = Promise<{ id: string; activityId: string; date: string }>;

const DECISION: Record<string, string> = { pending: "da decidere", accepted: "accettata", rejected: "rifiutata", waitlisted: "in lista d'attesa" };

export default async function AdminActivityDayPage({ params }: { params: Params }) {
  const { id, activityId, date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return notFound();
  const detail = await getAdminActivityDetail(activityId);
  if (!detail || (detail.activity.centerId && detail.activity.centerId !== id)) return notFound();
  const day = detail.days.find((x) => x.date === date);
  if (!day) return notFound();
  const ledger = buildDayLedger({ capacity: day.capacity, spotsLeft: day.spotsLeft }, ledgerRowsForDay(detail.bookings, day.id));
  const base = `/admin/centers/${id}/attivita/${activityId}`;
  const title = new Date(date + "T12:00:00Z").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const took = (r: LedgerRow) => (r.capacityDecremented ? Math.max(1, r.units ?? 1) : 0);

  return (
    <div>
      <Link href={base} className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-sky">
        <i className="ti ti-arrow-left" /> {detail.activity.name}
      </Link>
      <h1 className="text-xl font-bold text-white">{title.charAt(0).toUpperCase() + title.slice(1)}</h1>
      <p className="mb-5 mt-1 text-sm text-navy-text2">
        {detail.activity.centerName} · {detail.activity.name}
        {!day.isOpen ? " · giorno chiuso" : ""}
      </p>

      <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white p-4 text-sm text-ink" data-testid="day-explanation">
        <div className="text-base font-bold">
          {daySummary(ledger.capacity, ledger.occupied, ledger.spotsLeft)}
        </div>
        <div className="mt-1 text-ink-2">
          {ledger.occupying.length === 0
            ? "Nessuna prenotazione occupa posti in questo giorno."
            : `Occupati da: ${ledger.occupying.map((r) => `${r.ref} (${took(r)} ${took(r) === 1 ? "posto" : "posti"}, ${Math.max(1, r.kidsCount)} ${r.kidsCount === 1 ? "bambino" : "bambini"})`).join(", ")}.`}
        </div>
        <div className="mt-1 text-ink-2">
          Bambini confermati: {ledger.confirmedParticipants}. Richieste ancora da decidere: {countOf(ledger.pendingParticipants, "bambino", "bambini")} (non occupano posti).
        </div>
      </div>

      {ledger.issues.length > 0 && (
        <ul className="mb-5 flex flex-col gap-2">
          {ledger.issues.map((i, k) => (
            <li
              key={k}
              className={`rounded-lg px-4 py-2 text-sm ${i.severity === "errore" ? "border-2 border-[#E8543E] bg-[#FDEDEA] text-[#8A2E23]" : "border border-[#E8EBF0] bg-white text-ink-2"}`}
            >
              {i.message}
            </li>
          ))}
        </ul>
      )}

      <div className="mb-5 overflow-x-auto rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">Cosa vede ogni portale</div>
        <table className="w-full min-w-[520px] text-sm">
          <tbody>
            <tr className="border-b border-[#F0F2F5]">
              <td className="px-4 py-2 text-ink">Famiglie (disponibilità)</td>
              <td className="px-4 py-2 font-semibold text-ink">{countOf(ledger.portals.parentFree, "libero", "liberi")}</td>
              <td className="px-4 py-2 text-xs text-ink-2">activity_days.spots_left</td>
            </tr>
            <tr className="border-b border-[#F0F2F5]">
              <td className="px-4 py-2 text-ink">Centro, Date e posti</td>
              <td className="px-4 py-2 font-semibold text-ink">
                {countOf(ledger.portals.partnerConfirmed, "confermato", "confermati")} su {ledger.capacity}
              </td>
              <td className="px-4 py-2 text-xs text-ink-2">posti presi dalle prenotazioni accettate</td>
            </tr>
            <tr className="border-b border-[#F0F2F5]">
              <td className="px-4 py-2 text-ink">Centro, registro presenze</td>
              <td className="px-4 py-2 font-semibold text-ink">{countOf(ledger.portals.partnerRegister, "bambino", "bambini")}</td>
              <td className="px-4 py-2 text-xs text-ink-2">bambini delle prenotazioni accettate</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-ink">Admin</td>
              <td className="px-4 py-2 font-semibold text-ink">{ledger.consistent ? "i numeri tornano" : "i numeri non tornano (sopra il perché)"}</td>
              <td className="px-4 py-2 text-xs text-ink-2">questa pagina</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Section title="Prenotazioni che occupano posti" rows={ledger.occupying} took={took} />
      <Section title="Richieste in attesa (non occupano posti)" rows={ledger.pending} took={took} />
      <Section title="Rifiutate o annullate" rows={ledger.other} took={took} />

      {detail.groupRequests.length > 0 && (
        <p className="mb-5 text-xs text-navy-text2">
          Questa attività ha {detail.groupRequests.length} {detail.groupRequests.length === 1 ? "richiesta" : "richieste"} di gruppo: valgono per
          l&apos;attività, non per un giorno, e non occupano posti. Le trovi nella pagina dell&apos;attività.
        </p>
      )}

      <Link href={bookingsHref({ centro: id, attivita: activityId, data: date, demo: true })} className="text-xs font-semibold text-white underline underline-offset-2">
        Apri in Prenotazioni con questa data →
      </Link>
    </div>
  );
}

function Section({ title, rows, took }: { title: string; rows: LedgerRow[]; took: (r: LedgerRow) => number }) {
  return (
    <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white">
      <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
        {title} ({rows.length})
      </div>
      <ul className="divide-y divide-[#F0F2F5] text-sm">
        {rows.map((r) => (
          <li key={r.bookingId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
            <span>
              <Link href={`/admin/bookings/${r.bookingId}`} className="font-mono text-xs font-semibold text-sky">
                {r.ref}
              </Link>{" "}
              <span className="text-ink">{r.label}</span>
            </span>
            <span className="text-xs text-ink-2">
              {DECISION[r.decision] ?? r.decision}
              {r.bookingStatus === "cancelled" ? " · prenotazione annullata" : ""} · {took(r)} {took(r) === 1 ? "posto" : "posti"}
            </span>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-3 text-ink-2">Nessuna.</li>}
      </ul>
    </div>
  );
}
