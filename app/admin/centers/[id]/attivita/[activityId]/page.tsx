import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminActivityDetail } from "@/lib/data/admin-ops";
import { summarizeDays, ledgerRowsForWeek } from "@/lib/admin-ops/activity-days";
import { buildDayLedger } from "@/lib/admin-ops/day-ledger";
import { bookingsHref, romeTodayIso } from "@/lib/admin-ops/bookings";
import { activityPrice } from "@/lib/nextgen/activity-price";
import { countOf } from "@/lib/admin-ops/text";

export const dynamic = "force-dynamic";

// TRAMA — ADMIN OPERATIVO (12/11/2026): dettaglio attività (Admin). Richiesta
// di Fabrizio: "Dal centro rendi apribile ciascuna attività, poi la singola
// giornata. Mostra capacità totale, posti occupati e disponibili,
// partecipanti confermati, prenotazioni collegate e storico delle
// variazioni, nei limiti dei permessi esistenti. Distingui chiaramente
// richieste pendenti, proposte di gruppo e prenotazioni che occupano posti."
// Numeri dal libro del giorno (lib/admin-ops/day-ledger.ts), che mette in fila
// ciò che vedono famiglia, calendario del centro e registro. Sola lettura.
type Params = Promise<{ id: string; activityId: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

const ACTION_LABEL: Record<string, string> = {
  activity_create: "Attività creata",
  activity_update: "Attività modificata",
  activity_days_save: "Calendario salvato (date e posti)",
  activity_requests_paused: "Richieste in pausa",
  activity_requests_resumed: "Richieste riaperte",
  promotion_create: "Promozione creata",
  promotion_toggle: "Promozione accesa/spenta",
};

function d(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
function dt(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export default async function AdminActivityPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { id, activityId } = await params;
  const sp = await searchParams;
  const detail = await getAdminActivityDetail(activityId);
  if (!detail || (detail.activity.centerId && detail.activity.centerId !== id)) return notFound();
  const { activity } = detail;
  const today = romeTodayIso();
  const showPast = sp.passati === "1";
  const groupRows = detail.groupRequests.map((g) => ({ id: g.id, status: g.status, kidsCount: g.kidsCount, label: `Richiesta di gruppo · ${countOf(g.kidsCount, "bambino", "bambini")}` }));
  const days = summarizeDays(detail.days, detail.bookings, []).filter((s) => showPast || s.date >= today);
  const pastCount = detail.days.filter((x) => x.date < today).length;
  const price = activityPrice({ pricePerWeek: activity.pricePerWeek, bookingMode: activity.bookingMode });
  const base = `/admin/centers/${id}/attivita/${activityId}`;
  const problemDays = days.filter((s) => !s.ledger.consistent).length;

  return (
    <div>
      <Link href={`/admin/centers/${id}`} className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-sky">
        <i className="ti ti-arrow-left" /> {activity.centerName}
      </Link>
      <h1 className="text-xl font-bold text-white">{activity.name}</h1>
      <p className="mb-5 mt-1 text-sm text-navy-text2">
        {price.label}
        {price.amount === null ? " (tariffa non configurata dal centro)" : ""} ·{" "}
        {activity.bookingMode === "day_only" ? "solo giorni" : activity.bookingMode === "mixed" ? "settimane o giorni" : "settimane"}
      </p>

      <div className="mb-5 flex flex-wrap gap-4 text-xs">
        <Link href={bookingsHref({ centro: id, attivita: activityId, demo: true })} className="font-semibold text-white underline underline-offset-2">
          Prenotazioni collegate ({detail.bookings.length}) →
        </Link>
        <Link href={bookingsHref({ centro: id, attivita: activityId, stato: "da_rispondere", demo: true })} className="font-semibold text-white underline underline-offset-2">
          Da rispondere →
        </Link>
      </div>

      {problemDays > 0 && (
        <div className="mb-4 rounded-lg border-2 border-[#E8543E] bg-[#FDEDEA] px-4 py-2 text-sm text-[#8A2E23]">
          {problemDays} {problemDays === 1 ? "giorno ha" : "giorni hanno"} numeri che non tornano tra i portali: apri il giorno per vedere perché.
        </div>
      )}

      {detail.days.length > 0 && (
        <div className="mb-5 overflow-x-auto rounded-lg border border-[#E8EBF0] bg-white">
          <div className="flex items-center justify-between border-b border-[#E8EBF0] px-4 py-3">
            <span className="text-sm font-bold text-ink">Giorni {showPast ? "(tutti)" : "da oggi"}</span>
            <Link href={showPast ? base : `${base}?passati=1`} className="text-xs font-semibold text-sky">
              {showPast ? "Solo da oggi" : `Mostra anche i ${pastCount} passati`}
            </Link>
          </div>
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
                <th className="px-4 py-2 font-medium">Giorno</th>
                <th className="px-4 py-2 font-medium">Posti totali</th>
                <th className="px-4 py-2 font-medium">Occupati</th>
                <th className="px-4 py-2 font-medium">Liberi (famiglie)</th>
                <th className="px-4 py-2 font-medium">Bambini confermati</th>
                <th className="px-4 py-2 font-medium">Richieste in attesa</th>
                <th className="px-4 py-2 font-medium">Controllo</th>
              </tr>
            </thead>
            <tbody>
              {days.map((s) => (
                <tr key={s.id} className="border-b border-[#F0F2F5] last:border-0 hover:bg-bg">
                  <td className="px-4 py-2">
                    <Link href={`${base}/giorno/${s.date}`} className="text-sky">
                      {d(s.date)}
                    </Link>
                    {!s.isOpen && <span className="ml-1 text-xs text-ink-3">chiuso</span>}
                  </td>
                  <td className="px-4 py-2 text-ink">{s.ledger.capacity}</td>
                  <td className="px-4 py-2 text-ink">{s.ledger.occupied}</td>
                  <td className="px-4 py-2 text-ink">{s.ledger.spotsLeft}</td>
                  <td className="px-4 py-2 text-ink">{s.ledger.confirmedParticipants}</td>
                  <td className="px-4 py-2 text-ink-2">{s.ledger.pendingParticipants > 0 ? countOf(s.ledger.pendingParticipants, "bambino", "bambini") : "—"}</td>
                  <td className="px-4 py-2 text-xs">
                    {s.ledger.consistent ? <span className="text-[#2d8f52]">torna</span> : <span className="font-semibold text-[#C0392B]">da vedere</span>}
                  </td>
                </tr>
              ))}
              {days.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-center text-ink-2">
                    Nessun giorno {showPast ? "" : "da oggi in poi"}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {detail.weeks.length > 0 && (
        <div className="mb-5 overflow-x-auto rounded-lg border border-[#E8EBF0] bg-white">
          <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">Settimane</div>
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
                <th className="px-4 py-2 font-medium">Settimana</th>
                <th className="px-4 py-2 font-medium">Posti totali</th>
                <th className="px-4 py-2 font-medium">Occupati</th>
                <th className="px-4 py-2 font-medium">Liberi</th>
                <th className="px-4 py-2 font-medium">Bambini confermati</th>
                <th className="px-4 py-2 font-medium">Controllo</th>
              </tr>
            </thead>
            <tbody>
              {detail.weeks.map((w) => {
                const l = buildDayLedger({ capacity: w.capacity, spotsLeft: w.spotsLeft }, ledgerRowsForWeek(detail.bookings, w.id));
                return (
                  <tr key={w.id} className="border-b border-[#F0F2F5] last:border-0">
                    <td className="px-4 py-2 text-ink">{w.label ?? d(w.startDate)}</td>
                    <td className="px-4 py-2 text-ink">{l.capacity}</td>
                    <td className="px-4 py-2 text-ink">{l.occupied}</td>
                    <td className="px-4 py-2 text-ink">{l.spotsLeft}</td>
                    <td className="px-4 py-2 text-ink">{l.confirmedParticipants}</td>
                    <td className="px-4 py-2 text-xs">
                      {l.consistent ? <span className="text-[#2d8f52]">torna</span> : <span className="font-semibold text-[#C0392B]">{l.issues.find((i) => i.severity === "errore")?.message}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">Richieste di gruppo (non occupano posti finché il centro non accetta e le famiglie non prenotano)</div>
        <ul className="divide-y divide-[#F0F2F5] text-sm">
          {groupRows.map((g, i) => (
            <li key={g.id} className="px-4 py-2 text-ink-2">
              {g.label} · stato {g.status} · {dt(detail.groupRequests[i].createdAt)}
            </li>
          ))}
          {groupRows.length === 0 && <li className="px-4 py-3 text-ink-2">Nessuna richiesta di gruppo.</li>}
        </ul>
        <div className="px-4 pb-3 text-xs">
          <Link href="/admin/group-requests" className="font-semibold text-sky">
            Tutte le richieste di gruppo →
          </Link>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">Storico delle modifiche del centro</div>
        <ul className="divide-y divide-[#F0F2F5] text-sm">
          {detail.log.map((l, i) => (
            <li key={i} className="px-4 py-2 text-ink-2">
              <span className="font-medium text-ink">{ACTION_LABEL[l.action] ?? l.action}</span> · {dt(l.createdAt)}
            </li>
          ))}
          {detail.log.length === 0 && <li className="px-4 py-3 text-ink-2">Nessuna modifica registrata.</li>}
          <li className="px-4 py-2 text-[11px] text-ink-3">
            Il registro dice quando il calendario è stato salvato, non i posti prima e dopo: lo storico della capacità per giorno non
            esiste ancora (Lotto 2).
          </li>
        </ul>
      </div>
    </div>
  );
}
