import { getGroupRequestsForCenter } from "@/lib/data/group-requests";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "In attesa", cls: "bg-orange-light text-trama-orange" },
  accepted: { label: "Accettata", cls: "bg-green-light text-[#2d8f52]" },
  rejected: { label: "Rifiutata", cls: "bg-[#FBEAEA] text-[#C0392B]" },
};

export default async function AdminGroupRequestsPage() {
  // Per un Admin piattaforma questa funzione non filtra per centro — vedi
  // lib/data/group-requests.ts (isPlatformAdmin salta il filtro center_id).
  const requests = await getGroupRequestsForCenter();
  const pending = requests.filter((r) => r.status === "pending").length;
  const accepted = requests.filter((r) => r.status === "accepted").length;
  const totalKids = requests.reduce((sum, r) => sum + r.kidsCount, 0);

  return (
    <div>
      <div className="mb-6">
        {/* FIX CONTRASTO ADMIN: text-ink==bg-navy, vedi analytics/page.tsx */}
        <h1 className="text-xl font-bold text-white">Richieste Gruppo — tutti i centri</h1>
        <p className="text-sm text-navy-text2">
          Report delle richieste di sconto gruppo inviate dalle famiglie a tutti i centri della
          piattaforma. Accettare o rifiutare resta una decisione del singolo Gestore centro (vedi
          la sua sezione &quot;Richieste Gruppo&quot;) — questa vista è di sola consultazione.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCardSimple label="Richieste totali" value={String(requests.length)} />
        <StatCardSimple label="In attesa" value={String(pending)} />
        <StatCardSimple label="Accettate" value={String(accepted)} />
        <StatCardSimple label="Bambini coinvolti" value={String(totalKids)} />
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
                <th className="px-4 py-3 font-medium">Gruppo</th>
                <th className="px-4 py-3 font-medium">Attività</th>
                <th className="px-4 py-3 font-medium">Centro</th>
                <th className="px-4 py-3 font-medium">Bambini</th>
                <th className="px-4 py-3 font-medium">Sconto</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-[#F0F2F5] last:border-0">
                  <td className="px-4 py-3 font-semibold text-ink">{r.groupName}</td>
                  <td className="px-4 py-3 text-ink-2">{r.activityName}</td>
                  <td className="px-4 py-3 text-ink-2">{r.centerName}</td>
                  <td className="px-4 py-3 text-ink-2">{r.kidsCount}</td>
                  <td className="px-4 py-3 text-ink-2">{r.discountPercent}%</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_LABEL[r.status].cls}`}
                    >
                      {STATUS_LABEL[r.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-2">
                    {new Date(r.createdAt).toLocaleDateString("it-IT", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-ink-2">
                    Nessuna Richiesta Gruppo inviata ancora su nessun centro.
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

function StatCardSimple({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
      <div className="text-xl font-bold text-ink">{value}</div>
      <div className="text-xs text-ink-2">{label}</div>
    </div>
  );
}
