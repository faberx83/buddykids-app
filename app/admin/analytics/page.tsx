import { activities } from "@/lib/mock-data";
import {
  ageBucketBreakdown,
  aggregateWeeklyOccupancy,
  tagBreakdown,
  nearbyComplementaryCenters,
} from "@/lib/analytics";
import TrendLineChart from "@/components/charts/TrendLineChart";
import SimpleBarChart from "@/components/charts/SimpleBarChart";

export default function AdminAnalyticsPage() {
  const occupancy = aggregateWeeklyOccupancy(activities.map((a) => a.id));
  const categories = tagBreakdown();
  const ageBuckets = ageBucketBreakdown();
  const suggestions = nearbyComplementaryCenters(2);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Analisi piattaforma</h1>
        <p className="text-sm text-ink-2">
          Andamento occupazione, composizione clienti e opportunità di cross-selling tra centri
        </p>
      </div>

      <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white p-4">
        <div className="mb-1 text-sm font-bold text-ink">Stagionalità — occupazione media per settimana</div>
        <p className="mb-2 text-xs text-ink-2">
          Somma di tutte le attività su tutti i centri: dove sale e dove scende la domanda nel
          corso dell&apos;estate.
        </p>
        <TrendLineChart data={occupancy} dataKey="occupancyPercent" labelKey="label" color="#4DAFEF" />
      </div>

      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
          <div className="mb-1 text-sm font-bold text-ink">Prenotazioni per tag</div>
          <p className="mb-2 text-xs text-ink-2">Che tipo di attività cercano di più le famiglie</p>
          <SimpleBarChart
            data={categories.map((c) => ({ label: `${c.emoji} ${c.label}`, count: c.count }))}
            dataKey="count"
            labelKey="label"
            color="#8B7CF8"
          />
        </div>

        <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
          <div className="mb-1 text-sm font-bold text-ink">Prenotazioni per fascia d&apos;età</div>
          <p className="mb-2 text-xs text-ink-2">Età dei bambini iscritti, per tipo di cliente</p>
          <SimpleBarChart
            data={ageBuckets.map((b) => ({ label: b.bucket, count: b.count }))}
            dataKey="count"
            labelKey="label"
            color="#3ECFB2"
          />
        </div>
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3">
          <div className="text-sm font-bold text-ink">Centri limitrofi complementari</div>
          <p className="text-xs text-ink-2">
            Coppie di centri vicini (entro 2 km) con categorie diverse — candidati per iniziative
            di cross-selling, come una navetta condivisa o pacchetti combinati.
          </p>
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {suggestions.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
                style={{ background: s.centerA.gradient }}
              >
                {s.centerA.emoji}
              </div>
              <div className="text-sm font-semibold text-ink">{s.centerA.name}</div>
              <i className="ti ti-arrows-left-right text-ink-3" />
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
                style={{ background: s.centerB.gradient }}
              >
                {s.centerB.emoji}
              </div>
              <div className="text-sm font-semibold text-ink">{s.centerB.name}</div>
              <span className="ml-auto rounded-full bg-sky-light px-2.5 py-1 text-[11px] font-semibold text-sky">
                {s.distanceKm.toFixed(1)} km
              </span>
              <span className="rounded-full bg-green-light px-2.5 py-1 text-[11px] font-semibold text-[#2d8f52]">
                🚌 Navetta condivisa?
              </span>
            </div>
          ))}
          {suggestions.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-ink-2">
              Nessuna coppia di centri abbastanza vicina trovata con questa soglia di distanza.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
