import { getInquiriesSlaOverview } from "@/lib/data/admin-inquiries";

// Proposta Admin (Fabrizio ha chiesto cosa portare lato piattaforma dalle
// nuove funzionalità: ticketing, presenze, preferiti — questa copre il
// ticketing). Il Gestore ha già "Le mie richieste" per il proprio centro;
// qui l'Admin vede TUTTI i centri per controllare la qualità del servizio:
// chi ha troppe richieste aperte, chi risponde lentamente o per niente.
export default async function AdminRichiestePage() {
  const overview = await getInquiriesSlaOverview();

  return (
    <div>
      <div className="mb-6">
        {/* FIX CONTRASTO ADMIN: text-ink==bg-navy, vedi analytics/page.tsx */}
        <h1 className="text-xl font-bold text-white">Richieste — SLA per centro</h1>
        <p className="text-sm text-navy-text2">
          Quanto velocemente ogni centro risponde alle richieste dei genitori (&quot;Contatta il
          gestore&quot;) — utile per individuare centri lenti o che non rispondono affatto.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCardSimple label="Richieste aperte (piattaforma)" value={String(overview.platformOpenCount)} />
        <StatCardSimple
          label="Tempo medio di risposta"
          value={overview.platformAvgResponseHours !== null ? formatHours(overview.platformAvgResponseHours) : "—"}
        />
        <StatCardSimple label="Centri con richieste" value={String(overview.centers.length)} />
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
                <th className="px-4 py-3 font-medium">Centro</th>
                <th className="px-4 py-3 font-medium">Totale richieste</th>
                <th className="px-4 py-3 font-medium">Aperte</th>
                <th className="px-4 py-3 font-medium">Tempo medio risposta</th>
                <th className="px-4 py-3 font-medium">Aperta più vecchia</th>
              </tr>
            </thead>
            <tbody>
              {overview.centers.map((c) => (
                <tr key={c.centerId} className="border-b border-[#F0F2F5] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{c.centerEmoji}</span>
                      <span className="font-semibold text-ink">{c.centerName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{c.totalCount}</td>
                  <td className="px-4 py-3">
                    {c.openCount > 0 ? (
                      <span className="rounded-full bg-orange-light px-2.5 py-1 text-xs font-semibold text-trama-orange">
                        {c.openCount} in attesa
                      </span>
                    ) : (
                      <span className="text-ink-2">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-2">
                    {c.avgResponseHours !== null ? formatHours(c.avgResponseHours) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {c.oldestOpenDays !== null ? (
                      <span
                        className={`font-semibold ${
                          c.oldestOpenDays > 3 ? "text-[#C0392B]" : "text-ink-2"
                        }`}
                      >
                        {c.oldestOpenDays >= 1 ? `${Math.round(c.oldestOpenDays)} giorni` : "meno di 1 giorno"}
                      </span>
                    ) : (
                      <span className="text-ink-2">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {overview.centers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-ink-2">
                    Nessuna richiesta ancora registrata (o la tabella activity_inquiries non è
                    stata ancora creata su Supabase).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
