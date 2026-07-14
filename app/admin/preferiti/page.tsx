import { getFavoritesDemandSignal } from "@/lib/data/admin-favorites";

// Proposta Admin (Fabrizio ha chiesto cosa portare lato piattaforma dalle
// nuove funzionalità: ticketing, presenze, preferiti — questa copre i
// preferiti). Le attività molto salvate ma poco/mai prenotate segnalano
// interesse alto e conversione bassa: un buon punto di partenza per
// contattare il centro (prezzo? disponibilità? descrizione poco chiara?) o
// per proporre una promozione mirata.
export default async function AdminPreferitiPage() {
  const signals = await getFavoritesDemandSignal();
  const neverBooked = signals.filter((s) => s.bookingsCount === 0).length;

  return (
    <div>
      <div className="mb-6">
        {/* FIX CONTRASTO ADMIN: text-ink==bg-navy, vedi analytics/page.tsx */}
        <h1 className="text-xl font-bold text-white">Preferiti — segnale di domanda</h1>
        <p className="text-sm text-navy-text2">
          Le attività più salvate dai genitori rispetto a quante volte sono state davvero
          prenotate — interesse alto e conversione bassa vale la pena di essere indagato.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCardSimple label="Attività con preferiti" value={String(signals.length)} />
        <StatCardSimple label="Salvate ma mai prenotate" value={String(neverBooked)} />
        <StatCardSimple
          label="Più salvata"
          value={signals[0] ? `${signals[0].activityEmoji} ${signals[0].activityName}` : "—"}
        />
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
                <th className="px-4 py-3 font-medium">Attività</th>
                <th className="px-4 py-3 font-medium">Centro</th>
                <th className="px-4 py-3 font-medium">Preferiti</th>
                <th className="px-4 py-3 font-medium">Prenotazioni</th>
                <th className="px-4 py-3 font-medium">Segnale</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.activityId} className="border-b border-[#F0F2F5] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{s.activityEmoji}</span>
                      <span className="font-semibold text-ink">{s.activityName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{s.centerName}</td>
                  <td className="px-4 py-3 text-ink-2">{s.favoritesCount}</td>
                  <td className="px-4 py-3 text-ink-2">{s.bookingsCount}</td>
                  <td className="px-4 py-3">
                    {s.bookingsCount === 0 ? (
                      <span className="rounded-full bg-orange-light px-2.5 py-1 text-xs font-semibold text-[#d4622a]">
                        Mai prenotata
                      </span>
                    ) : s.favoritesCount > s.bookingsCount * 2 ? (
                      <span className="rounded-full bg-yellow-light px-2.5 py-1 text-xs font-semibold text-[#9a6b00]">
                        Interesse alto
                      </span>
                    ) : (
                      <span className="text-ink-2">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {signals.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-ink-2">
                    Nessun preferito salvato ancora (o la tabella favorites non è stata ancora
                    creata su Supabase).
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
