import Link from "next/link";
import { activities, bookingsMock, centers } from "@/lib/mock-data";
import NewCenterForm from "@/components/admin/NewCenterForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import AdminMockDataBanner from "@/components/admin/AdminMockDataBanner";

export default function AdminCentersPage() {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          {/* FIX CONTRASTO ADMIN: text-ink==bg-navy, vedi analytics/page.tsx */}
          <h1 className="text-xl font-bold text-white">Centri</h1>
          <p className="text-sm text-navy-text2">Tutti i centri estivi registrati sulla piattaforma</p>
        </div>
        {isSupabaseConfigured && <NewCenterForm />}
      </div>

      {/* R-01 (Wave 1): l'elenco sotto è SEMPRE lib/mock-data.ts, anche se
          "Nuovo centro" sopra scrive un centro reale su Supabase — un centro
          appena creato qui NON compare in questa lista (non risolto in
          questa fase, per decisione esplicita di non rifare le dashboard
          mock prima della Beta).
          NOTA CORRETTIVA: il Command Center (/admin/one) NON mostra un
          elenco dei centri reali — aggrega solo code operative (onboarding,
          prenotazioni, richieste...); listCentersForAdminReview() vi è letto
          solo per contare i centri "SUBMITTED", mai renderizzato come lista.
          Oggi non esiste nell'app nessuna vista che elenchi i centri reali:
          nessuna CTA verso una vista inesistente, per non introdurre
          un'altra affermazione non verificata. */}
      <AdminMockDataBanner description="Questo elenco è sempre di esempio, anche dopo aver creato un centro reale con 'Nuovo centro' qui sopra: il centro appena creato non comparirà in questa lista. Al momento l'app non ha una vista che elenchi i centri reali." />

      <div className="overflow-hidden rounded-lg border border-[#E8EBF0] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
              <th className="px-4 py-3 font-medium">Centro</th>
              <th className="px-4 py-3 font-medium">Città</th>
              <th className="px-4 py-3 font-medium">Attività</th>
              <th className="px-4 py-3 font-medium">Prenotazioni</th>
              <th className="px-4 py-3 font-medium">Referente</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {centers.map((c) => {
              const centerActivities = activities.filter((a) => a.centerId === c.id);
              const centerBookings = bookingsMock.filter((b) =>
                centerActivities.some((a) => a.id === b.activityId)
              );
              return (
                <tr key={c.id} className="border-b border-[#F0F2F5] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
                        style={{ background: c.gradient }}
                      >
                        {c.emoji}
                      </div>
                      <span className="font-semibold text-ink">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{c.city}</td>
                  <td className="px-4 py-3 text-ink-2">{centerActivities.length}</td>
                  <td className="px-4 py-3 text-ink-2">{centerBookings.length}</td>
                  <td className="px-4 py-3 text-ink-2">{c.ownerName}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/centers/${c.id}`} className="text-xs font-semibold text-sky">
                      Dettaglio →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
