import { getAttendanceOverviewForAdmin } from "@/lib/data/admin-attendance";

// Proposta Admin (Fabrizio ha chiesto cosa portare lato piattaforma dalle
// nuove funzionalità: ticketing, presenze, preferiti — questa copre le
// presenze). Il Gestore ha già "Report presenze" per il proprio centro; qui
// l'Admin confronta TUTTI i centri con la media piattaforma per individuare
// chi si discosta di più — non è detto sia un problema del centro (può
// essere un errore di registrazione delle presenze), ma è un buon punto di
// partenza per capire dove guardare.
export default async function AdminPresenzePage() {
  const overview = await getAttendanceOverviewForAdmin();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Presenze — confronto tra centri</h1>
        <p className="text-sm text-ink-2">
          Tasso di assenze/ritardi per centro rispetto alla media piattaforma, calcolato sui
          giorni di camp già trascorsi.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCardSimple label="Media piattaforma" value={`${Math.round(overview.platformIssueRate * 100)}%`} />
        <StatCardSimple label="Centri con dati" value={String(overview.centers.length)} />
        <StatCardSimple
          label="Centro più fuori norma"
          value={overview.centers[0] ? overview.centers[0].centerName : "—"}
        />
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
                <th className="px-4 py-3 font-medium">Centro</th>
                <th className="px-4 py-3 font-medium">Giorni registrati</th>
                <th className="px-4 py-3 font-medium">Assenze</th>
                <th className="px-4 py-3 font-medium">Ritardi</th>
                <th className="px-4 py-3 font-medium">Tasso assenza/ritardo</th>
                <th className="px-4 py-3 font-medium">Rispetto alla media</th>
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
                  <td className="px-4 py-3 text-ink-2">{c.totalRecords}</td>
                  <td className="px-4 py-3 text-ink-2">{c.assenteCount}</td>
                  <td className="px-4 py-3 text-ink-2">{c.inRitardoCount}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{Math.round(c.issueRate * 100)}%</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        c.deltaFromPlatformAvg > 10
                          ? "bg-[#FBEAEA] text-[#C0392B]"
                          : c.deltaFromPlatformAvg < -10
                          ? "bg-green-light text-[#2d8f52]"
                          : "bg-bg text-ink-2"
                      }`}
                    >
                      {c.deltaFromPlatformAvg > 0 ? "+" : ""}
                      {Math.round(c.deltaFromPlatformAvg)} punti
                    </span>
                  </td>
                </tr>
              ))}
              {!overview.hasData && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-ink-2">
                    Nessuna presenza registrata ancora per giorni già trascorsi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[#F0F2F5] px-4 py-3 text-[11px] text-ink-3">
          Nota: un tasso alto non è automaticamente colpa del centro — può anche indicare che il
          Gestore registra le presenze con meno cura (segna &quot;assente&quot; di default invece
          di controllare davvero). Vale la pena guardare prima i centri evidenziati in rosso.
        </p>
      </div>
    </div>
  );
}

function StatCardSimple({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
      <div className="text-xl font-bold text-ink">{value}</div>
      <div className="text-xs text-ink-2">{label}</div>
    </div>
  );
}
