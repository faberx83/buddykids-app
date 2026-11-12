import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminBooking } from "@/lib/data/admin-ops";
import { ACTOR_LABEL, BOOKING_STATE_LABEL, romeTodayIso, viewAdminBooking } from "@/lib/admin-ops/bookings";
import { activityPrice, formatEuro } from "@/lib/nextgen/activity-price";

export const dynamic = "force-dynamic";

// TRAMA — ADMIN OPERATIVO (12/11/2026): dettaglio di una prenotazione.
// Richiesta di Fabrizio: "Ogni riga deve aprire un dettaglio con link interno
// stabile" e "ricostruire lo storico". Link stabile: /admin/bookings/<id>
// (l'id della prenotazione, che non cambia). Il riferimento breve (#XXXXXXXX)
// sono i primi 8 caratteri dello stesso id. "Torna all'elenco" riporta ai
// filtri da cui si è arrivati (?da=…, solo query string di /admin/bookings).
// Storico: ciò che il database conserva davvero (creazione, risposta del
// centro, annullamento); le decisioni giorno per giorno non hanno un orario
// proprio (booking_days non ha date di modifica) e lo diciamo.
type Params = Promise<{ id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

function dt(iso: string | null): string {
  return iso ? new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";
}
function d(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
const DAY_DECISION: Record<string, string> = { pending: "Da decidere", accepted: "Accettato", rejected: "Rifiutato", waitlisted: "In lista d'attesa" };

export default async function AdminBookingDetailPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const row = await getAdminBooking(id);
  if (!row) return notFound();
  const v = viewAdminBooking(row, romeTodayIso());
  const rawBack = typeof sp.da === "string" ? sp.da : "";
  const back = `/admin/bookings${rawBack.startsWith("?") ? rawBack : ""}`;
  const price = activityPrice({ pricePerWeek: row.pricePerWeek, bookingMode: row.bookingMode });
  const kids = Math.max(1, row.kidNames.length);

  return (
    <div>
      <Link href={back} className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-sky">
        <i className="ti ti-arrow-left" /> Torna all&apos;elenco
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-bold text-white">{v.ref}</h1>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink">{BOOKING_STATE_LABEL[v.state]}</span>
        {v.isDemo && <span className="rounded-full bg-[#EEF0F4] px-2.5 py-1 text-xs text-[#6B7280]">di prova</span>}
      </div>

      {v.actor && (
        <div className="mb-5 rounded-lg border-2 border-[#E0A040] bg-[#FFF8EC] px-4 py-3 text-sm">
          <span className="font-bold text-[#7A4500]">{ACTOR_LABEL[v.actor]}</span>
          <span className="text-[#7A4500]"> · {v.nextStep}</span>
          <span className="block text-xs text-[#7A4500]">
            Richiesta da {v.ageDays} {v.ageDays === 1 ? "giorno" : "giorni"}
            {v.dueInDays !== null ? ` · prima data ${v.dueInDays === 0 ? "oggi" : `tra ${v.dueInDays} giorni`}` : ""}
          </span>
        </div>
      )}

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <Box title="Famiglia">
          <div className="font-semibold text-ink">{row.parentName}</div>
          <div className="text-ink-2">{row.parentEmail || "—"}</div>
          <div className="mt-1 text-ink-2">Bambini: {row.kidNames.join(", ") || "—"}</div>
        </Box>
        <Box title="Centro e attività">
          {row.centerId ? (
            <Link href={`/admin/centers/${row.centerId}`} className="font-semibold text-sky">
              {row.centerName}
            </Link>
          ) : (
            <div className="font-semibold text-ink">{row.centerName}</div>
          )}
          {row.centerId && row.activityId ? (
            <Link href={`/admin/centers/${row.centerId}/attivita/${row.activityId}`} className="block text-sky">
              {row.activityName}
            </Link>
          ) : (
            <div className="text-ink-2">{row.activityName}</div>
          )}
          <div className="mt-1 text-ink-2">Prezzo dell&apos;attività: {price.label}</div>
        </Box>
        <Box title="Importo richiesto">
          <div className="font-semibold text-ink">{formatEuro(row.totalAmount)}</div>
          {row.discountAmount > 0 && <div className="text-ink-2">di cui sconti: −{formatEuro(row.discountAmount)}</div>}
          <div className="mt-1 text-[11px] text-ink-2">Beta senza pagamenti: non è un incasso.</div>
        </Box>
      </div>

      {row.days.length > 0 && (
        <div className="mb-5 overflow-x-auto rounded-lg border border-[#E8EBF0] bg-white">
          <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">Giorni richiesti ({row.days.length})</div>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
                <th className="px-4 py-2 font-medium">Giorno</th>
                <th className="px-4 py-2 font-medium">Decisione del centro</th>
                <th className="px-4 py-2 font-medium">Posti occupati</th>
                <th className="px-4 py-2 font-medium">Prezzo × bambini (prima degli sconti)</th>
              </tr>
            </thead>
            <tbody>
              {row.days.map((day) => {
                const took = day.capacityDecremented ? Math.max(1, day.units ?? 1) : 0;
                return (
                  <tr key={day.activityDayId} className="border-b border-[#F0F2F5] last:border-0">
                    <td className="px-4 py-2">
                      {row.centerId && row.activityId && day.date ? (
                        <Link href={`/admin/centers/${row.centerId}/attivita/${row.activityId}/giorno/${day.date}`} className="text-sky">
                          {d(day.date)}
                        </Link>
                      ) : (
                        d(day.date)
                      )}
                    </td>
                    <td className="px-4 py-2 text-ink-2">{DAY_DECISION[day.decision] ?? day.decision}</td>
                    <td className="px-4 py-2 text-ink-2">
                      {took}
                      {day.decision === "accepted" && took < kids && <span className="ml-1 text-xs font-semibold text-[#C0392B]">({kids} bambini: da riconciliare)</span>}
                    </td>
                    <td className="px-4 py-2 text-ink-2">{formatEuro(day.price * kids)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {row.weeks.length > 0 && (
        <div className="mb-5 overflow-x-auto rounded-lg border border-[#E8EBF0] bg-white">
          <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">Settimane ({row.weeks.length})</div>
          <table className="w-full text-sm">
            <tbody>
              {row.weeks.map((w) => (
                <tr key={w.weekId} className="border-b border-[#F0F2F5] last:border-0">
                  <td className="px-4 py-2 text-ink">{w.startDate ? `${d(w.startDate)} → ${d(w.endDate || w.startDate)}` : "—"}</td>
                  <td className="px-4 py-2 text-ink-2">{w.capacityDecremented ? `occupa ${Math.max(1, w.units ?? 1)} posti` : "non occupa posti"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">Storico</div>
        <ul className="divide-y divide-[#F0F2F5] text-sm">
          <li className="px-4 py-2 text-ink-2">
            <span className="font-medium text-ink">Richiesta inviata dalla famiglia</span> · {dt(row.createdAt)}
          </li>
          {row.respondedAt && (
            <li className="px-4 py-2 text-ink-2">
              <span className="font-medium text-ink">Prima risposta del centro</span> · {dt(row.respondedAt)}
            </li>
          )}
          {row.status === "cancelled" && (
            <li className="px-4 py-2 text-ink-2">
              <span className="font-medium text-ink">Annullata</span>
              {row.cancelledBy ? ` dal ${row.cancelledBy === "parent" ? "genitore" : "centro"}` : ""} (data non registrata)
            </li>
          )}
          <li className="px-4 py-2 text-[11px] text-ink-3">
            Le decisioni giorno per giorno non hanno un orario proprio nel database: si vede lo stato attuale di ogni giorno.
          </li>
        </ul>
      </div>
      <p className="text-[11px] text-navy-text2">Id: {row.id}</p>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#E8EBF0] bg-white p-4 text-sm">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">{title}</div>
      {children}
    </div>
  );
}
