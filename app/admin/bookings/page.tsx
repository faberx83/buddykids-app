import StatusBadge from "@/components/dashboard/StatusBadge";
import { getBookingsForCenter } from "@/lib/data/center-bookings";
import { getBookingsSlaOverview } from "@/lib/data/admin-bookings";

// TRAMA ONE Build Sprint 4 (DEC-42, ACR-007/ACR-022, vincolo P0 da V2) —
// prima di questo sprint questa pagina leggeva da lib/mock-data.ts::bookingsMock
// (vista dimostrativa, mai collegata a dati reali — vedi
// SPRINT_4_FEATURE_PRESERVATION_MATRIX.md). Ora legge da public.bookings
// reale, riusando getBookingsForCenter() (lib/data/center-bookings.ts):
// quella funzione già gestisce il bypass "tutti i centri" per l'Admin
// piattaforma via is_platform_admin() (nessuna nuova query duplicata).
export default async function AdminBookingsPage() {
  const [bookings, sla] = await Promise.all([getBookingsForCenter(), getBookingsSlaOverview()]);
  const sorted = [...bookings].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div>
      <div className="mb-6">
        {/* FIX CONTRASTO ADMIN: text-ink==bg-navy, vedi analytics/page.tsx */}
        <h1 className="text-xl font-bold text-white">Prenotazioni</h1>
        <p className="text-sm text-navy-text2">Tutte le prenotazioni su tutti i centri</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCardSimple label="In attesa di risposta (piattaforma)" value={String(sla.platformPendingCount)} />
        <StatCardSimple
          label="Tempo medio di risposta"
          value={sla.platformAvgResponseHours !== null ? formatHours(sla.platformAvgResponseHours) : "—"}
        />
        <StatCardSimple label="Centri con prenotazioni" value={String(sla.centers.length)} />
      </div>

      {sla.centers.length > 0 && (
        <div className="mb-6 rounded-lg border border-[#E8EBF0] bg-white">
          <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">SLA per centro</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
                  <th className="px-4 py-3 font-medium">Centro</th>
                  <th className="px-4 py-3 font-medium">Totale</th>
                  <th className="px-4 py-3 font-medium">In attesa</th>
                  <th className="px-4 py-3 font-medium">Tempo medio risposta</th>
                  <th className="px-4 py-3 font-medium">In attesa più vecchia</th>
                </tr>
              </thead>
              <tbody>
                {sla.centers.map((c) => (
                  <tr key={c.centerId} className="border-b border-[#F0F2F5] last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{c.centerEmoji}</span>
                        <span className="font-semibold text-ink">{c.centerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{c.totalCount}</td>
                    <td className="px-4 py-3">
                      {c.pendingCount > 0 ? (
                        <span className="rounded-full bg-orange-light px-2.5 py-1 text-xs font-semibold text-trama-orange">
                          {c.pendingCount} in attesa
                        </span>
                      ) : (
                        <span className="text-ink-2">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-2">
                      {c.avgResponseHours !== null ? formatHours(c.avgResponseHours) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {c.oldestPendingDays !== null ? (
                        <span className={`font-semibold ${c.oldestPendingDays > 3 ? "text-[#C0392B]" : "text-ink-2"}`}>
                          {c.oldestPendingDays >= 1 ? `${Math.round(c.oldestPendingDays)} giorni` : "meno di 1 giorno"}
                        </span>
                      ) : (
                        <span className="text-ink-2">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[#E8EBF0] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
              <th className="px-4 py-3 font-medium">Bambino</th>
              <th className="px-4 py-3 font-medium">Genitore</th>
              <th className="px-4 py-3 font-medium">Attività</th>
              <th className="px-4 py-3 font-medium">Periodo</th>
              <th className="px-4 py-3 font-medium">Totale</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Stato</th>
              <th className="px-4 py-3 font-medium">Risposta centro</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => (
              <tr key={b.id} className="border-b border-[#F0F2F5] last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{b.kidNames.join(", ") || "—"}</td>
                <td className="px-4 py-3 text-ink-2">{b.parentName}</td>
                <td className="px-4 py-3 text-ink-2">{b.activityName}</td>
                <td className="px-4 py-3 text-ink-2">
                  {b.isDayBased ? `${b.days.length} giorni` : `${b.weeks.length} settimane`}
                </td>
                <td className="px-4 py-3 font-semibold text-ink">€{b.totalAmount}</td>
                <td className="px-4 py-3 text-ink-2">
                  {new Date(b.createdAt).toLocaleDateString("it-IT")}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={b.status} />
                </td>
                <td className="px-4 py-3">
                  <PartnerDecisionBadge decision={b.partnerDecision} />
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-ink-2">
                  Nessuna prenotazione registrata.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PartnerDecisionBadge({ decision }: { decision: "pending" | "accepted" | "rejected" | "proposed" | "partial" }) {
  const cls: Record<typeof decision, string> = {
    pending: "bg-orange-light text-trama-orange",
    accepted: "bg-green-light text-[#2d8f52]",
    rejected: "bg-bg text-ink-3",
    proposed: "bg-sky-light text-sky",
    // "partial" (02/09/2026) — Giorni spot con esito misto, vedi
    // lib/booking-response/effective-decision.ts.
    partial: "bg-[#F0EEFF] text-[#6F63C5]",
  };
  const label: Record<typeof decision, string> = {
    pending: "Da rispondere",
    accepted: "Accettata",
    rejected: "Rifiutata",
    proposed: "Proposta inviata",
    partial: "Confermata parzialmente",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls[decision]}`}>{label[decision]}</span>
  );
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours)} ore`;
  return `${Math.round(hours / 24)} giorni`;
}

function StatCardSimple({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
      <div className="text-xl font-bold text-ink">{value}</div>
      <div className="text-xs text-ink-2">{label}</div>
    </div>
  );
}
